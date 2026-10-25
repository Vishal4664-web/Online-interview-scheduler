function escapeICS(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function localDateTimeToUtc(date, time, timezone = "Asia/Kolkata") {
  // Iteratively map the wall-clock date/time in an IANA timezone to UTC.
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = targetAsUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += targetAsUtc - represented;
  }
  return new Date(guess);
}

function toICSDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildICS(interview) {
  const start = localDateTimeToUtc(interview.interviewDate, interview.interviewTime, interview.timezone);
  const end = new Date(start.getTime() + Number(interview.durationMinutes || 60) * 60000);
  const uid = `${interview._id}@online-interview-scheduler`;
  const description = [
    `Candidate: ${interview.candidateName}`,
    `Candidate email: ${interview.candidateEmail}`,
    `Role: ${interview.jobRole}`,
    `Status: ${interview.status}`,
    interview.meetingLink ? `Meeting link: ${interview.meetingLink}` : "",
    interview.notes ? `Notes: ${interview.notes}` : ""
  ].filter(Boolean).join("\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Online Interview Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeICS(uid)}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(`Interview: ${interview.candidateName} - ${interview.jobRole}`)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    interview.meetingLink ? `URL:${escapeICS(interview.meetingLink)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].filter((line) => line !== "").join("\r\n");
}

module.exports = { buildICS, localDateTimeToUtc };
