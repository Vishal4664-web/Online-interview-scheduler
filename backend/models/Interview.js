const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  candidateName: { type: String, required: true, trim: true },
  candidateEmail: { type: String, required: true, trim: true, lowercase: true },
  jobRole: { type: String, required: true, trim: true },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  interviewDate: { type: String, required: true }, // YYYY-MM-DD, local calendar date
  interviewTime: { type: String, required: true }, // HH:mm, local clock time
  durationMinutes: { type: Number, required: true, min: 15, max: 480, default: 60 },
  timezone: { type: String, required: true, default: "Asia/Kolkata" },
  meetingLink: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["Scheduled", "Completed", "Cancelled"], default: "Scheduled" },
  notes: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reminderSentAt: { type: Date, default: null }
}, { timestamps: true });

interviewSchema.index({ interviewer: 1, interviewDate: 1, interviewTime: 1 });
module.exports = mongoose.model("Interview", interviewSchema);
