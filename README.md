# Online Interview Scheduler v2 — MERN + Authentication + Calendar

This upgraded learning/portfolio project includes:
- Registration and login with bcrypt password hashing and JWT authentication
- Two roles: `recruiter` and `interviewer`
- Recruiter-only interview creation, editing, and deletion
- Interviewers can view their assigned interviews and mark them completed
- Email notifications on scheduling/updating (when SMTP is configured)
- Automatic reminder job: checks every few minutes for interviews starting within 30 minutes
- `.ics` calendar export, compatible with Google Calendar, Outlook, and Apple Calendar imports
- Conflict detection for overlapping interviews assigned to the same interviewer OR using the same candidate email
- Candidate search, status filters, dashboard counts

## Important design/security notes
- Public registration always creates an `interviewer`; the client cannot choose `recruiter` in the request.
- Recruiter setup is a one-time local bootstrap. Remove bootstrap credentials from `.env` after the recruiter is created.
- This is a portfolio starter, not a production-certified scheduling service. For production add rate limiting, audit logging, robust email delivery/retry queues, HTTPS, secret management, account verification/password reset, stronger input validation, and a carefully reviewed authorization policy.
- Email notifications are attempted only if SMTP settings exist. Candidate email delivery requires real SMTP credentials and may fail because of provider restrictions.
- Calendar support here is downloadable `.ics` import, not a live two-way Google Calendar OAuth sync.
- Times are interpreted using the selected IANA timezone. The reminder worker runs while the backend process is running. For production, use a durable job queue and a single scheduler instance.

## Requirements
- Node.js current LTS
- MongoDB Community Server running locally, or a MongoDB Atlas database
- VS Code

## Step 1: Configure backend
Open terminal in project root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`. Replace the JWT secret with a long random value (at least 24 characters). For local MongoDB:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/interview_scheduler
JWT_SECRET=replace_with_a_long_random_secret_at_least_24_chars
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
REMINDER_INTERVAL_MINUTES=5
```

### Create the first recruiter
Temporarily add these lines to `.env` before first backend startup:

```env
BOOTSTRAP_RECRUITER_NAME=Recruiter Admin
BOOTSTRAP_RECRUITER_EMAIL=recruiter@example.com
BOOTSTRAP_RECRUITER_PASSWORD=use_a_unique_password_at_least_12_chars
```

Use a password of at least 12 characters. Start the backend; the recruiter is created if that email does not already exist. **Then remove all three `BOOTSTRAP_RECRUITER_*` lines from `.env` and restart the backend.** Do not commit `.env`.

### Run backend
Keep MongoDB running. In the backend terminal:

```powershell
npm run dev
```

Expected output includes `MongoDB connected successfully` and `Backend running at http://localhost:5000`.

## Step 2: Configure and run frontend
Open a second VS Code terminal at the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Step 3: Configure email notifications (optional, required for actual mail)
In `backend/.env`, configure SMTP. Example for Gmail:
1. Turn on 2-Step Verification for the Google account.
2. Create an App Password in Google Account security settings (if available for that account).
3. Use the app password, not your regular Google password.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM="Interview Scheduler <your-email@gmail.com>"
```

Restart the backend after editing `.env`. Never commit SMTP credentials. If SMTP is not configured, interviews still save, but mail is skipped. Scheduling/update messages go to the candidate and the assigned interviewer. The reminder worker attempts a single reminder within 30 minutes of the start and records `reminderSentAt` after successful delivery to all recipients. Ensure the backend is running for reminders to execute.

## User roles and workflow
1. Create the recruiter account using the bootstrap method above.
2. Sign in as recruiter.
3. Create interviewer accounts through the **Create interviewer account** form (public registration creates interviewer role only).
4. Sign in again as recruiter and schedule an interview, selecting an interviewer.
5. Interviewer signs in and sees only interviews assigned to them (plus interviews they created, if applicable).
6. Recruiter can edit/delete and see all interviews. Interviewer can mark their assigned scheduled interview as completed.

## Calendar integration
Each interview card has **Add to calendar**. It downloads an `.ics` file. Open/import it into Google Calendar, Outlook, or Apple Calendar. The file includes start/end time, timezone-converted UTC timestamps, title, candidate details, notes, and meeting link.
- Google Calendar: open Google Calendar → Settings → Import & export → Import → choose the downloaded `.ics`.
- Outlook: open/import the `.ics` file or use Outlook's calendar import option.
- Apple Calendar: open the `.ics` file and add the event.
This is a one-way export; changes in this app do not automatically update an already imported calendar event.

## Conflict detection
When a recruiter creates or edits a scheduled interview, the API checks existing scheduled interviews on that date. It rejects the operation with HTTP `409 Conflict` if time ranges overlap for the same interviewer or same candidate email. Adjacent meetings (for example 10:00–10:30 and 10:30–11:00) are allowed. Cancelled/completed interviews do not block a new slot. It checks overlapping durations and converts the selected timezone to UTC for comparisons.

## API reference
All interview endpoints require `Authorization: Bearer <token>`.

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register interviewer account |
| POST | `/api/auth/login` | Public | Sign in and get JWT |
| GET | `/api/auth/me` | Signed in | Current user profile |
| GET | `/api/users/interviewers` | Recruiter | List interviewer accounts |
| GET | `/api/interviews` | Signed in | List permitted interviews |
| GET | `/api/interviews/:id/calendar.ics` | Authorized user | Download calendar event |
| POST | `/api/interviews` | Recruiter | Schedule interview |
| PUT | `/api/interviews/:id` | Recruiter | Update interview |
| DELETE | `/api/interviews/:id` | Recruiter | Delete interview |

## Environment variables
| Variable | Required? | Description |
|---|---|---|
| `PORT` | No | Backend port, defaults to 5000 |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing/verifying JWTs |
| `JWT_EXPIRES_IN` | No | Token lifetime, defaults to `1d` |
| `FRONTEND_URL` | No | Allowed frontend origin |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | For email | SMTP credentials |
| `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM` | For email | SMTP transport settings |
| `REMINDER_INTERVAL_MINUTES` | No | Reminder job interval, defaults to 5 minutes |

## Common issues
- **Mongo connection refused:** start MongoDB service or use valid Atlas URI.
- **JWT_SECRET error:** set a secret of at least 24 characters in `backend/.env`.
- **Recruiter cannot sign in:** verify bootstrap credentials were set before backend startup; if the account already existed, bootstrap will not reset its password. For local development, register a new email and repeat bootstrap, or update the account securely in your database.
- **No interviewer in dropdown:** register one or more interviewer accounts first, then refresh recruiter dashboard.
- **401 Unauthorized:** sign in again; JWT is stored in local browser storage for this demo.
- **403 Forbidden:** the action is not allowed for your role. Recruiters schedule/edit/delete; interviewers view assigned interviews and mark completion.
- **409 conflict:** choose a different time, interviewer, or candidate slot.
- **No email received:** verify SMTP settings and app password, check spam, and inspect backend terminal output.
- **No reminder:** the backend must remain running; configure SMTP; reminder checks occur within 30 minutes before the start.
- **Frontend cannot connect:** backend should be on port 5000 and frontend on 5173. If you change either port, update `FRONTEND_URL` and/or `frontend/src/api.js`.

## GitHub
Commit source code but never `.env`, SMTP passwords, or JWT secrets. `.env.example` is safe to commit because it contains placeholders only.
