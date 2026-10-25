import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import { startReminderJob } from "./services/reminders.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _dirname = path.resolve(__dirname, "..");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.error("JWT_SECRET must be set in backend/.env and should be at least 24 characters.");
  process.exit(1);
}

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/users", userRoutes);

app.use(express.static(path.join(_dirname, "/frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(_dirname, "frontend", "dist", "index.html"));
});

// One-time local bootstrap: set BOOTSTRAP_RECRUITER_EMAIL and BOOTSTRAP_RECRUITER_PASSWORD
// in .env before starting; remove these values after the recruiter account is created.
async function bootstrapRecruiter() {
  const email = process.env.BOOTSTRAP_RECRUITER_EMAIL;
  const password = process.env.BOOTSTRAP_RECRUITER_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error("Bootstrap recruiter password must be at least 12 characters.");
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized });
  if (!existing) {
    await User.create({
      name: process.env.BOOTSTRAP_RECRUITER_NAME || "Recruiter Admin",
      email: normalized,
      passwordHash: await bcrypt.hash(password, 12),
      role: "recruiter"
    });
    console.log(`Bootstrap recruiter created for ${normalized}. Remove bootstrap credentials from .env now.`);
  } else {
    console.log("Bootstrap recruiter email already exists; no account was changed.");
  }
}

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

connectDB()
  .then(bootstrapRecruiter)
  .then(() => {
    startReminderJob();
    app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error("Server could not start:", error.message);
    process.exit(1);
  });
