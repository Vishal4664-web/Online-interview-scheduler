const express = require("express");
const Interview = require("../models/Interview");
const User = require("../models/User");
const { requireAuth, allowRoles } = require("../middleware/auth");
const { sendInterviewEmail } = require("../services/mailer");
const { buildICS, localDateTimeToUtc } = require("../services/calendar");

const router = express.Router();
router.use(requireAuth);

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function findConflict({ interviewerId, candidateEmail, date, time, durationMinutes, timezone, excludeId }) {
  const start = localDateTimeToUtc(date, time, timezone);
  const end = new Date(start.getTime() + Number(durationMinutes) * 60000);
  const existing = await Interview.find({
    status: "Scheduled",
    interviewDate: date,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ interviewer: interviewerId }, { candidateEmail: String(candidateEmail).toLowerCase() }]
  }).populate("interviewer", "name email");

  for (const item of existing) {
    const otherStart = localDateTimeToUtc(item.interviewDate, item.interviewTime, item.timezone);
    const otherEnd = new Date(otherStart.getTime() + Number(item.durationMinutes || 60) * 60000);
    if (overlaps(start, end, otherStart, otherEnd)) {
      return {
        message: "Scheduling conflict: this time overlaps an existing interview for the same interviewer or candidate.",
        conflict: {
          id: item._id,
          candidateName: item.candidateName,
          interviewer: item.interviewer?.name || "Interviewer",
          interviewDate: item.interviewDate,
          interviewTime: item.interviewTime,
          durationMinutes: item.durationMinutes
        }
      };
    }
  }
  return null;
}

function canView(req, interview) {
  return req.user.role === "recruiter" ||
    String(interview.interviewer?._id || interview.interviewer) === String(req.user._id) ||
    String(interview.createdBy) === String(req.user._id);
}

async function notifyInterview(interview, action) {
  const populated = await Interview.findById(interview._id).populate("interviewer", "name email");
  if (!populated) return;
  const start = `${populated.interviewDate} at ${populated.interviewTime} (${populated.timezone})`;
  const text = [
    `Interview ${action}.`,
    `Candidate: ${populated.candidateName} (${populated.candidateEmail})`,
    `Role: ${populated.jobRole}`,
    `Interviewer: ${populated.interviewer?.name || "Unknown"}`,
    `When: ${start}`,
    `Duration: ${populated.durationMinutes} minutes`,
    populated.meetingLink ? `Meeting link: ${populated.meetingLink}` : ""
  ].filter(Boolean).join("\n");
  const recipients = [...new Set([populated.candidateEmail, populated.interviewer?.email].filter(Boolean))];
  await Promise.allSettled(recipients.map((to) => sendInterviewEmail({
    to,
    subject: `Interview ${action}: ${populated.candidateName} - ${populated.jobRole}`,
    text
  })));
}

// GET /api/interviews
router.get("/", async (req, res) => {
  try {
    const query = req.user.role === "recruiter"
      ? {}
      : { $or: [{ interviewer: req.user._id }, { createdBy: req.user._id }] };
    const interviews = await Interview.find(query)
      .populate("interviewer", "name email role")
      .populate("createdBy", "name email")
      .sort({ interviewDate: 1, interviewTime: 1 });
    res.json(interviews);
  } catch {
    res.status(500).json({ message: "Could not fetch interviews." });
  }
});

// GET /api/interviews/:id/calendar.ics
router.get("/:id/calendar.ics", async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id).populate("interviewer", "name email");
    if (!interview) return res.status(404).json({ message: "Interview not found." });
    if (!canView(req, interview)) return res.status(403).json({ message: "Not allowed to access this interview." });
    const ics = buildICS(interview);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="interview-${interview._id}.ics"`);
    res.send(ics);
  } catch {
    res.status(400).json({ message: "Could not create calendar event." });
  }
});

// POST /api/interviews — recruiters schedule interviews
router.post("/", allowRoles("recruiter"), async (req, res) => {
  try {
    const {
      candidateName, candidateEmail, jobRole, interviewer, interviewDate,
      interviewTime, durationMinutes = 60, timezone = "Asia/Kolkata",
      meetingLink = "", notes = ""
    } = req.body;
    if (!candidateName || !candidateEmail || !jobRole || !interviewer || !interviewDate || !interviewTime) {
      return res.status(400).json({ message: "Candidate, email, role, interviewer, date, and time are required." });
    }
    const assignedInterviewer = await User.findOne({ _id: interviewer, role: "interviewer" });
    if (!assignedInterviewer) return res.status(400).json({ message: "Choose a valid interviewer account." });
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
      return res.status(400).json({ message: "Duration must be between 15 and 480 minutes." });
    }
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(interviewDate);
    const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(interviewTime);
    if (!dateValid || !timeValid) return res.status(400).json({ message: "Use date YYYY-MM-DD and time HH:mm." });
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date()); }
    catch { return res.status(400).json({ message: "Use a valid timezone such as Asia/Kolkata." }); }

    const conflict = await findConflict({
      interviewerId: interviewer, candidateEmail, date: interviewDate, time: interviewTime,
      durationMinutes: duration, timezone
    });
    if (conflict) return res.status(409).json(conflict);

    const interview = await Interview.create({
      candidateName, candidateEmail, jobRole, interviewer, interviewDate, interviewTime,
      durationMinutes: duration, timezone, meetingLink, notes, createdBy: req.user._id
    });
    await notifyInterview(interview, "scheduled");
    const result = await Interview.findById(interview._id)
      .populate("interviewer", "name email role").populate("createdBy", "name email");
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: "Could not schedule interview. Check the fields and try again." });
  }
});

// PUT /api/interviews/:id — recruiters edit details; assigned interviewers may mark completed
router.put("/:id", async (req, res) => {
  try {
    const current = await Interview.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Interview not found." });

    if (req.user.role === "interviewer") {
      const isAssigned = String(current.interviewer) === String(req.user._id);
      const onlyCompleting = Object.keys(req.body).length === 1 && req.body.status === "Completed";
      if (!isAssigned || !onlyCompleting) {
        return res.status(403).json({ message: "Interviewers may only mark their assigned interviews as completed." });
      }
      if (current.status !== "Scheduled") {
        return res.status(400).json({ message: "Only scheduled interviews can be marked completed." });
      }
      current.status = "Completed";
      await current.save();
      const result = await Interview.findById(current._id)
        .populate("interviewer", "name email role").populate("createdBy", "name email");
      await notifyInterview(result, "updated");
      return res.json(result);
    }

    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Your account role is not allowed to update interviews." });
    }

    const allowed = [
      "candidateName", "candidateEmail", "jobRole", "interviewer", "interviewDate",
      "interviewTime", "durationMinutes", "timezone", "meetingLink", "status", "notes"
    ];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];

    if (updates.interviewer) {
      const interviewer = await User.findOne({ _id: updates.interviewer, role: "interviewer" });
      if (!interviewer) return res.status(400).json({ message: "Choose a valid interviewer account." });
    }
    const merged = { ...current.toObject(), ...updates };
    if (merged.status === "Scheduled") {
      const conflict = await findConflict({
        interviewerId: merged.interviewer, candidateEmail: merged.candidateEmail,
        date: merged.interviewDate, time: merged.interviewTime,
        durationMinutes: merged.durationMinutes, timezone: merged.timezone,
        excludeId: current._id
      });
      if (conflict) return res.status(409).json(conflict);
    }
    const interview = await Interview.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    }).populate("interviewer", "name email role").populate("createdBy", "name email");
    await notifyInterview(interview, "updated");
    res.json(interview);
  } catch {
    res.status(400).json({ message: "Could not update interview. Check the supplied values." });
  }
});

// DELETE /api/interviews/:id — recruiters only
router.delete("/:id", allowRoles("recruiter"), async (req, res) => {
  try {
    const interview = await Interview.findByIdAndDelete(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found." });
    res.json({ message: "Interview deleted successfully." });
  } catch {
    res.status(400).json({ message: "Invalid interview ID." });
  }
});

module.exports = router;
