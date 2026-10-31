const express = require("express");
const User = require("../models/User");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();

router.get("/interviewers", requireAuth, allowRoles("recruiter"), async (req, res) => {
  const users = await User.find({ role: "interviewer" }).select("name email role").sort({ name: 1 });
  res.json(users);
});

module.exports = router;
