import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db.js');
const authRoutes = require('./routes/authRoutes.js');
const interviewRoutes = require('./routes/interviewRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const candidateRoutes = require('./routes/candidateRoutes.js');
const feedbackRoutes = require('./routes/feedbackRoutes.js');
const analyticsRoutes = require('./routes/analyticsRoutes.js');
const User = require('./models/User.js');
const bcrypt = require('bcryptjs');
const { startReminderJob } = require('./services/reminders.js');
const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(rootDir, '.env'), override: false });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.error('JWT_SECRET must be set and contain at least 24 characters.'); process.exit(1);
}
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(path.join(rootDir, 'frontend/dist')));
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found' }));
app.get('*', (_req, res) => res.sendFile(path.join(rootDir, 'frontend', 'dist', 'index.html')));
async function bootstrapRecruiter() {
  const email = process.env.BOOTSTRAP_RECRUITER_EMAIL;
  const password = process.env.BOOTSTRAP_RECRUITER_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('Bootstrap recruiter password must be at least 12 characters.');
  const normalized = email.trim().toLowerCase();
  if (!(await User.findOne({ email: normalized }))) {
    await User.create({ name: process.env.BOOTSTRAP_RECRUITER_NAME || 'Recruiter Admin', email: normalized, passwordHash: await bcrypt.hash(password, 12), role: 'recruiter' });
    console.log(`Bootstrap recruiter created for ${normalized}. Remove bootstrap credentials from environment now.`);
  }
}
connectDB().then(bootstrapRecruiter).then(() => {
  startReminderJob(); app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}).catch((error) => { console.error('Server could not start:', error.message); process.exit(1); });
