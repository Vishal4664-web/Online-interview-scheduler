# Online Interview Scheduler — Full-stack Edition

React + Express + MongoDB interview management platform with recruiter/interviewer roles.

## Included features
- JWT authentication and role-based access
- Interview scheduling, editing, cancellation, calendar `.ics` export and email notifications
- Conflict detection for overlapping interviewer/candidate appointments using UTC instants (including different timezones)
- Candidate pipeline: Applied, Screening, Interview, Offer, Hired, Rejected; candidate profile, resume URL and notes
- Interview feedback scorecards (technical, communication, problem solving, comments and recommendation)
- Optional Gemini AI feedback summary (human decision remains authoritative)
- Analytics: interview counts, candidate stages, feedback average and interviewer workload

## Requirements
Node.js 22+, npm, MongoDB Atlas/local MongoDB. SMTP and Gemini are optional.

## Environment
Create `backend/.env` (never commit it):


After first recruiter creation, remove the bootstrap email/password from the environment.

## Local development
Terminal 1 (project root):

```bash
npm install
npm run dev
```

Terminal 2:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Open the Vite URL, normally `http://localhost:5173`. The backend runs on port 5000. The frontend API client uses `/api`; for local Vite development configure a proxy in `frontend/vite.config.js` or use the deployed same-origin backend. A Vite proxy is included in the project config.

## Tests and production build

```bash
npm test
npm run build
npm start
```


## Render deployment
1. Push the project root to GitHub (do not commit `.env`, `node_modules`, or secrets).
2. Create/update a Render Web Service connected to the repository.
3. Build command: `npm run build`; Start command: `npm start`.
4. Add `MONGODB_URI`, `JWT_SECRET`, and optional SMTP/Gemini environment variables in Render's Environment settings.
5. Keep the frontend and API on the same Render service; the frontend uses relative `/api` requests.
6. Deploy and verify `/api/health`, recruiter login, interviewer login, scheduling, feedback and analytics.

## Notes
- Resume handling currently stores a secure external resume URL; it does not upload binary files to server storage. Add a private object-storage provider (e.g. S3/Cloudinary) before accepting actual resume files.
- Gemini summary requires `GEMINI_API_KEY`. AI output is an assistant summary only, not a hiring decision.
- SMTP is required for actual outbound emails. Without SMTP, the app logs that email was skipped.
