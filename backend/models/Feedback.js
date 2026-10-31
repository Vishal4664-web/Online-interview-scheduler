const mongoose = require('mongoose');
const feedbackSchema = new mongoose.Schema({
  interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  technical: { type: Number, min: 1, max: 5, required: true },
  communication: { type: Number, min: 1, max: 5, required: true },
  problemSolving: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String, trim: true, maxlength: 5000, default: '' },
  recommendation: { type: String, enum: ['Strong Hire','Hire','Hold','No Hire'], required: true },
  aiSummary: { type: String, default: '' }
}, { timestamps: true });
feedbackSchema.index({ interview: 1, interviewer: 1 }, { unique: true });
module.exports = mongoose.model('Feedback', feedbackSchema);
