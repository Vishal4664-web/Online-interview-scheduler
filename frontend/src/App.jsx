import { useEffect, useMemo, useState } from "react";
import api from "./api";

const emptyForm = {
  candidateName: "", candidateEmail: "", jobRole: "", interviewer: "",
  interviewDate: "", interviewTime: "", durationMinutes: 60,
  timezone: "Asia/Kolkata", meetingLink: "", status: "Scheduled", notes: ""
};

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ois_user") || "null"); } catch { return null; }
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [form, setForm] = useState(emptyForm);
  const [interviews, setInterviews] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  function logout() {
    localStorage.removeItem("ois_token");
    localStorage.removeItem("ois_user");
    setUser(null); setInterviews([]); setInterviewers([]); resetForm();
    setNotice("You have signed out."); setError("");
  }

  async function authenticate(event) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      if (authMode === "register") {
        await api.post("/auth/register", authForm);
        setAuthMode("login");
        setNotice("Interviewer account created. Sign in to continue.");
        setAuthForm((old) => ({ ...old, password: "" }));
        return;
      }
      const { data } = await api.post("/auth/login", {
        email: authForm.email, password: authForm.password
      });
      localStorage.setItem("ois_token", data.token);
      localStorage.setItem("ois_user", JSON.stringify(data.user));
      setUser(data.user); setAuthForm({ name: "", email: "", password: "" });
      setNotice(`Welcome, ${data.user.name}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed. Is the backend running?");
    }
  }

  async function loadData() {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const response = await api.get("/interviews");
      setInterviews(response.data);
      // Public UI intentionally does not expose all users. Recruiter selects interviewer
      // IDs from this list; backend endpoint is included below.
      if (user.role === "recruiter") {
        const usersResponse = await api.get("/users/interviewers");
        setInterviewers(usersResponse.data);
      }
    } catch (err) {
      if (err.response?.status === 401) logout();
      else setError(err.response?.data?.message || "Could not load interviews.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user) loadData(); }, [user?.id]);

  const stats = useMemo(() => ({
    total: interviews.length,
    scheduled: interviews.filter((i) => i.status === "Scheduled").length,
    completed: interviews.filter((i) => i.status === "Completed").length,
    cancelled: interviews.filter((i) => i.status === "Cancelled").length
  }), [interviews]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return interviews.filter((i) => {
      const matches = [i.candidateName, i.candidateEmail, i.jobRole, i.interviewer?.name]
        .some((value) => (value || "").toLowerCase().includes(q));
      return matches && (statusFilter === "All" || i.status === statusFilter);
    });
  }, [interviews, search, statusFilter]);

  function changeForm(event) {
    setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  }
  function resetForm() { setForm(emptyForm); setEditingId(null); }

  async function saveInterview(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (editingId) {
        await api.put(`/interviews/${editingId}`, form);
        setNotice("Interview updated.");
      } else {
        await api.post("/interviews", form);
        setNotice("Interview scheduled. Email is sent only when SMTP is configured.");
      }
      resetForm(); await loadData();
    } catch (err) {
      const body = err.response?.data;
      setError(body?.conflict ? `${body.message} Existing interview: ${body.conflict.candidateName}, ${body.conflict.interviewDate} ${body.conflict.interviewTime}.` : body?.message || "Could not save interview.");
    } finally { setSaving(false); }
  }

  function editInterview(i) {
    setEditingId(i._id);
    setForm({
      candidateName: i.candidateName, candidateEmail: i.candidateEmail, jobRole: i.jobRole,
      interviewer: i.interviewer?._id || i.interviewer, interviewDate: i.interviewDate,
      interviewTime: i.interviewTime, durationMinutes: i.durationMinutes || 60,
      timezone: i.timezone || "Asia/Kolkata", meetingLink: i.meetingLink || "",
      status: i.status, notes: i.notes || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeStatus(i, status) {
    try { await api.put(`/interviews/${i._id}`, { status }); setNotice("Status updated."); await loadData(); }
    catch (err) { setError(err.response?.data?.message || "Could not update status."); }
  }

  async function removeInterview(i) {
    if (!window.confirm("Delete this interview?")) return;
    try { await api.delete(`/interviews/${i._id}`); setNotice("Interview deleted."); await loadData(); }
    catch (err) { setError(err.response?.data?.message || "Could not delete interview."); }
  }

  async function downloadCalendar(i) {
    try {
      const response = await api.get(`/interviews/${i._id}/calendar.ics`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = `interview-${i._id}.ics`; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.response?.data?.message || "Could not download calendar event."); }
  }

  if (!user) return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand"><span className="brand-icon">IS</span><span>Interview Scheduler</span></div>
        <p className="eyebrow">RECRUITMENT WORKSPACE</p>
        <h1>{authMode === "login" ? "Welcome back" : "Create interviewer account"}</h1>
        <p className="muted">{authMode === "login" ? "Sign in to manage your interview calendar." : "Public registration creates an interviewer account."}</p>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        <form className="form" onSubmit={authenticate}>
          {authMode === "register" && <label>Full name<input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required autoComplete="name" /></label>}
          <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required autoComplete="email" /></label>
          <label>Password<input type="password" minLength="8" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>
          <button className="primary" type="submit">{authMode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="link-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>
          {authMode === "login" ? "New interviewer? Create an account" : "Already registered? Sign in"}
        </button>
        <p className="tiny">Recruiter accounts are created through the one-time bootstrap configuration described in README.md.</p>
      </section>
    </main>
  );

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-icon">IS</span><span>Interview Scheduler</span></a>
        <div className="user-tools"><span>{user.name} <small className="role">{user.role}</small></span><button className="secondary" onClick={logout}>Sign out</button></div>
      </header>
      <section className="hero">
        <div><p className="eyebrow">RECRUITMENT WORKSPACE</p><h1>Plan interviews.<br /><span>Find the right fit.</span></h1><p className="muted">Manage schedules, prevent clashes, and keep your team in sync.</p>
          {user.role === "recruiter" && <button className="primary hero-cta" onClick={() => document.getElementById("schedule-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>＋ Schedule an interview</button>}
        </div>
        <div className="hero-art"><span>23</span><small>CALENDAR READY</small></div>
      </section>

      {(error || notice) && <div className={`alert ${error ? "error" : "success"}`}>{error || notice}</div>}
      <section className="stats">
        <Stat label="Total interviews" value={stats.total} symbol="▦" />
        <Stat label="Scheduled" value={stats.scheduled} symbol="◷" />
        <Stat label="Completed" value={stats.completed} symbol="✓" />
        <Stat label="Cancelled" value={stats.cancelled} symbol="×" />
      </section>

      <section className="layout">
        {user.role === "recruiter" && <section className="panel" id="schedule-form">
          <p className="eyebrow">{editingId ? "UPDATE DETAILS" : "GET STARTED"}</p>
          <h2>{editingId ? "Edit interview" : "Schedule an interview"}</h2>
          <form className="form" onSubmit={saveInterview}>
            <label>Candidate name *<input name="candidateName" value={form.candidateName} onChange={changeForm} required /></label>
            <label>Candidate email *<input type="email" name="candidateEmail" value={form.candidateEmail} onChange={changeForm} required /></label>
            <label>Job role *<input name="jobRole" value={form.jobRole} onChange={changeForm} required /></label>
            <label>Interviewer *
              <select name="interviewer" value={form.interviewer} onChange={changeForm} required>
                <option value="">Choose interviewer</option>
                {interviewers.map((person) => <option key={person._id} value={person._id}>{person.name} — {person.email}</option>)}
              </select>
            </label>
            <div className="two">
              <label>Date *<input type="date" name="interviewDate" value={form.interviewDate} onChange={changeForm} required /></label>
              <label>Time *<input type="time" name="interviewTime" value={form.interviewTime} onChange={changeForm} required /></label>
            </div>
            <div className="two">
              <label>Duration (minutes)<select name="durationMinutes" value={form.durationMinutes} onChange={changeForm}><option value="15">15</option><option value="30">30</option><option value="45">45</option><option value="60">60</option><option value="90">90</option><option value="120">120</option></select></label>
              <label>Timezone<select name="timezone" value={form.timezone} onChange={changeForm}><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select></label>
            </div>
            <label>Meeting URL<input type="url" name="meetingLink" value={form.meetingLink} onChange={changeForm} placeholder="https://..." /></label>
            {editingId && <label>Status<select name="status" value={form.status} onChange={changeForm}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></label>}
            <label>Notes<textarea name="notes" rows="3" value={form.notes} onChange={changeForm} /></label>
            <div className="actions"><button className="primary" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "＋ Schedule interview"}</button>{editingId && <button className="secondary" type="button" onClick={resetForm}>Cancel</button>}</div>
          </form>
        </section>}
        {user.role !== "recruiter" && <section className="panel role-notice">
          <p className="eyebrow">INTERVIEWER ACCOUNT</p>
          <h2>Interview scheduling is for recruiters</h2>
          <p className="muted">You are signed in as an interviewer, so the scheduling form is hidden. Sign out and sign in with your recruiter account to add a candidate, job role, interviewer, date, time, duration, and meeting link.</p>
        </section>}

        <section className="panel interview-panel">
          <div className="panel-title"><div><p className="eyebrow">YOUR CALENDAR</p><h2>{user.role === "recruiter" ? "All interviews" : "My interviews"}</h2><p className="muted small">{filtered.length} result(s)</p></div><button className="secondary" onClick={loadData}>Refresh ↻</button></div>
          <div className="filters"><input placeholder="Search candidate, role..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></div>
          {loading ? <p className="empty">Loading interviews…</p> : filtered.length === 0 ? <p className="empty">No interviews found. {user.role === "recruiter" ? "Use the form to schedule one." : "Ask a recruiter to assign you an interview."}</p> :
            <div className="cards">{filtered.map((i) => <article className="interview" key={i._id}>
              <div className="card-head"><div className="avatar">{i.candidateName?.[0]?.toUpperCase() || "C"}</div><div className="candidate"><h3>{i.candidateName}</h3><p>{i.candidateEmail}</p></div><span className={`status ${i.status.toLowerCase()}`}>{i.status}</span></div>
              <div className="role-line"><span>ROLE</span><strong>{i.jobRole}</strong></div>
              <div className="details"><div><small>DATE & TIME</small><strong>{i.interviewDate} · {i.interviewTime}</strong></div><div><small>INTERVIEWER</small><strong>{i.interviewer?.name || "Assigned interviewer"}</strong></div><div><small>DURATION</small><strong>{i.durationMinutes} min · {i.timezone}</strong></div></div>
              {i.notes && <p className="notes">{i.notes}</p>}
              <div className="card-actions">
                {i.meetingLink && <a href={i.meetingLink} target="_blank" rel="noreferrer">Join meeting ↗</a>}
                <button className="text-button" onClick={() => downloadCalendar(i)}>Add to calendar</button>
                {user.role === "recruiter" && <><button className="text-button" onClick={() => editInterview(i)}>Edit</button><button className="danger" onClick={() => removeInterview(i)}>Delete</button></>}
                {user.role === "interviewer" && i.status === "Scheduled" && <button className="text-button" onClick={() => changeStatus(i, "Completed")}>Mark completed</button>}
              </div>
            </article>)}</div>}
        </section>
      </section>
      <footer>Online Interview Scheduler · MERN + JWT · Calendar export · Conflict detection</footer>
    </main>
  );
}

function Stat({ label, value, symbol }) {
  return <article className="stat"><span>{symbol}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}
