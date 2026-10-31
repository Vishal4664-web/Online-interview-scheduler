const mongoose = require('mongoose');
const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, default: '' },
  jobRole: { type: String, required: true, trim: true },
  stage: { type: String, enum: ['Applied','Screening','Interview','Offer','Hired','Rejected'], default: 'Applied' },
  resumeUrl: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
candidateSchema.index({ email: 1, jobRole: 1 }, { unique: true });
module.exports = mongoose.model('Candidate', candidateSchema);
