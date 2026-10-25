const nodemailer = require("nodemailer");

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendInterviewEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("Email skipped: SMTP settings are not configured.");
    return { skipped: true };
  }
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to, subject, text, html
  });
}

module.exports = { sendInterviewEmail };
