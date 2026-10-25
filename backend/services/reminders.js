const cron = require("node-cron");
const Interview = require("../models/Interview");
const { sendInterviewEmail } = require("./mailer");
const { localDateTimeToUtc } = require("./calendar");

function startReminderJob() {
  const interval = Math.max(1, Number(process.env.REMINDER_INTERVAL_MINUTES || 5));
  cron.schedule(`*/${Math.min(interval, 59)} * * * *`, async () => {
    try {
      const now = new Date();
      const horizon = new Date(now.getTime() + 30 * 60 * 1000);
      const interviews = await Interview.find({
        status: "Scheduled",
        reminderSentAt: null
      }).populate("interviewer", "name email");

      for (const interview of interviews) {
        const start = localDateTimeToUtc(interview.interviewDate, interview.interviewTime, interview.timezone);
        if (start < now || start > horizon) continue;
        const text = [
          "Reminder: your interview starts within 30 minutes.",
          `Candidate: ${interview.candidateName}`,
          `Role: ${interview.jobRole}`,
          `Date/time: ${interview.interviewDate} ${interview.interviewTime} (${interview.timezone})`,
          `Duration: ${interview.durationMinutes} minutes`,
          interview.meetingLink ? `Meeting link: ${interview.meetingLink}` : ""
        ].filter(Boolean).join("\n");
        const recipients = [...new Set([interview.candidateEmail, interview.interviewer?.email].filter(Boolean))];
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
          console.warn("Reminder not sent: SMTP is not configured.");
          continue;
        }
        const results = await Promise.allSettled(recipients.map((to) => sendInterviewEmail({
          to, subject: `Interview reminder: ${interview.candidateName}`, text
        })));
        if (results.every((result) => result.status === "fulfilled" && !result.value?.skipped)) {
          interview.reminderSentAt = new Date();
          await interview.save();
          console.log(`Reminder sent for interview ${interview._id}`);
        }
      }
    } catch (error) {
      console.error("Reminder job failed:", error.message);
    }
  });
  console.log(`Interview reminder job started (every ${interval} minute(s)).`);
}

module.exports = { startReminderJob };
