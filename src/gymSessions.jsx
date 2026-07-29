import React, { useState, useEffect, useCallback } from "react";
import {
  Dumbbell, Plus, UserPlus, Calendar, Link2, Share2, Check, X, ChevronLeft,
  Users, Shield, Copy, AlertTriangle, RefreshCw, Clock,
} from "lucide-react";
import { T, Eyebrow, Card, Btn, Field, inputBase, Crest } from "./ui";
import {
  COVERS, STATUS_META, fetchMeetings, fetchMeeting, fetchRegistrations,
  createMeeting, updateMeeting, approveMeeting, rejectMeeting, cancelMeeting,
  completeMeeting, createInvite, getSharedMeeting, registerForMeeting,
  shareUrl, joinUrl, canPublishDirectly, isApprover, fmtWhen, isPast, toLocalInput,
  DEFAULT_JOIN_URL, fetchJoinUrl,
} from "./gymSessionsData";

/* ===========================================================================
   SHARED BITS
   ========================================================================= */

const TONE = {
  ok:    { fg: "#5cb377", bd: "rgba(92,179,119,.42)", bg: "rgba(92,179,119,.13)" },
  warn:  { fg: T.bronzeLt, bd: "rgba(200,134,46,.45)", bg: "rgba(200,134,46,.13)" },
  stop:  { fg: T.emberHot, bd: "rgba(212,80,43,.45)",  bg: "rgba(212,80,43,.13)" },
  info:  { fg: "#8cbde0",  bd: "rgba(74,127,166,.45)", bg: "rgba(74,127,166,.13)" },
  muted: { fg: T.muted2,   bd: T.lineSoft,             bg: "transparent" },
};

export function StatusPill({ status, size = 10 }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  const tone = TONE[meta.tone] || TONE.muted;
  return (
    <span style={{
      display: "inline-block", fontFamily: T.reg, fontSize: size, fontWeight: 700,
      letterSpacing: ".16em", textTransform: "uppercase", padding: "4px 10px",
      borderRadius: 20, color: tone.fg, border: `1px solid ${tone.bd}`, background: tone.bg,
    }}>{meta.label}</span>
  );
}

const Cover = ({ ck, h = 84, children }) => (
  <div style={{
    height: h, background: (COVERS[ck] || COVERS.iron).grad,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: T.reg, fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase",
    color: "rgba(247,241,230,.42)", borderBottom: `1px solid ${T.lineSoft}`,
  }}>{children || (COVERS[ck] || COVERS.iron).label}</div>
);

const Wrap = ({ children, w = 900 }) => (
  <div style={{ maxWidth: w, margin: "0 auto" }}>{children}</div>
);

const Loading = () => (
  <div style={{ padding: 40, textAlign: "center", color: T.muted2 }}>
    <RefreshCw size={17} style={{ animation: "kpulse 1.2s infinite" }} /> Loading…
  </div>
);

const ErrBox = ({ msg }) => !msg ? null : (
  <Card pad={14} style={{ border: `1px solid ${TONE.stop.bd}`, marginBottom: 16 }}>
    <div style={{ display: "flex", gap: 9, color: T.emberHot, fontSize: 14 }}>
      <AlertTriangle size={16} /> <span style={{ color: T.cream }}>{msg}</span>
    </div>
  </Card>
);

const Sub = ({ children }) => (
  <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".22em",
    textTransform: "uppercase", color: T.muted2, margin: "26px 0 12px" }}>{children}</div>
);

function CopyBtn({ value, label = "Copy link" }) {
  const [done, setDone] = useState(false);
  return (
    <Btn kind="ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
      setDone(true); setTimeout(() => setDone(false), 1800);
    }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </Btn>
  );
}

/* ===========================================================================
   SESSION CARD
   ========================================================================= */

function SessionCard({ m, onOpen }) {
  const host = m.host?.full_name || m.host_name || m.creator?.full_name || "Host to be named";
  return (
    <div onClick={() => onOpen(m)} style={{
      background: `linear-gradient(180deg,${T.surface},${T.obsidian2})`,
      border: `1px solid ${T.line}`, borderRadius: 4, overflow: "hidden", cursor: "pointer",
    }}>
      <Cover ck={m.cover_key} />
      <div style={{ padding: "13px 15px 15px" }}>
        <StatusPill status={m.status} />
        <div style={{ fontFamily: T.serif, fontSize: 16.5, color: T.cream,
          margin: "9px 0 7px", lineHeight: 1.3 }}>{m.title}</div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 3 }}>Host · {host}</div>
        <div style={{ fontSize: 13, color: T.muted }}>{fmtWhen(m.scheduled_at, m.duration_minutes)}</div>
      </div>
    </div>
  );
}

/* ===========================================================================
   PROPOSE A WORKOUT
   ========================================================================= */

const BLANK = {
  title: "", description: "", scheduled_at: toLocalInput(), duration_minutes: 60,
  cover_key: "iron", join_url: DEFAULT_JOIN_URL, focus_verses: "", discussion_questions: "",
  notes: "", host_name: "",
};

function ProposeForm({ user, profile, onDone, onCancel }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const direct = canPublishDirectly(profile);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async (status) => {
    if (!f.title.trim()) { setErr("Give it a title — that's what the men will see first."); return; }
    setBusy(true); setErr(null);
    const { data, error } = await createMeeting(user.id, f, status);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone(data);
  };

  const L = ({ label, children, full }) => (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <Field label={label} />{children}
    </div>
  );

  return (
    <Wrap w={860}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: T.bronze,
          cursor: "pointer", fontFamily: T.reg, fontSize: 12, letterSpacing: ".12em",
          textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
          <ChevronLeft size={15} /> Back to the gym
        </button>
        <StatusPill status={direct ? "approved" : "draft"} />
      </div>

      <div style={{ fontFamily: T.display, fontSize: 34, color: T.cream, letterSpacing: ".01em",
        margin: "6px 0 4px", textTransform: "uppercase" }}>Start a workout</div>
      <p style={{ color: T.muted, fontSize: 14.5, maxWidth: "62ch", marginTop: 0 }}>
        {direct
          ? "You hold the keys — this opens to the men as soon as you submit."
          : "Propose it here. It goes to Larry for the keys before it opens to the men."}
      </p>

      <ErrBox msg={err} />

      <Card pad={22}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <L label="Title" full>
            <input style={inputBase} value={f.title} onChange={e => set("title", e.target.value)}
              placeholder="The Discipline of Showing Up" />
          </L>

          <L label="What it's about" full>
            <textarea style={{ ...inputBase, minHeight: 74, resize: "vertical" }}
              value={f.description} onChange={e => set("description", e.target.value)}
              placeholder="One or two lines. What will the room actually work on?" />
          </L>

          <L label="Date & time">
            <input type="datetime-local" style={inputBase} value={f.scheduled_at}
              onChange={e => set("scheduled_at", e.target.value)} />
          </L>

          <L label="Length (minutes)">
            <input type="number" min="15" step="15" style={inputBase} value={f.duration_minutes}
              onChange={e => set("duration_minutes", e.target.value)} />
          </L>

          <L label="Host (leave blank for yourself)">
            <input style={inputBase} value={f.host_name} onChange={e => set("host_name", e.target.value)}
              placeholder={profile?.full_name || "You"} />
          </L>

          <L label="Cover">
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(COVERS).map(([k, v]) => (
                <button key={k} onClick={() => set("cover_key", k)} style={{
                  flex: 1, padding: "11px 4px", cursor: "pointer", borderRadius: 2,
                  background: v.grad, color: f.cover_key === k ? T.bronzeLt : T.muted2,
                  border: `1px solid ${f.cover_key === k ? T.bronze : T.lineSoft}`,
                  fontFamily: T.reg, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase",
                }}>{v.label}</button>
              ))}
            </div>
          </L>

          <L label="Meeting room" full>
            <input style={inputBase} value={f.join_url} onChange={e => set("join_url", e.target.value)}
              placeholder={DEFAULT_JOIN_URL} />
            <div style={{ color: T.muted2, fontSize: 12.5, marginTop: 6 }}>
              {(f.join_url || "").trim() === DEFAULT_JOIN_URL || !(f.join_url || "").trim()
                ? "The standard Scripture Gym room. Leave it as it is unless this one meets somewhere else."
                : "Meeting somewhere other than the standard Scripture Gym room."}
            </div>
          </L>

          <L label="Focus verses" full>
            <input style={inputBase} value={f.focus_verses}
              onChange={e => set("focus_verses", e.target.value)}
              placeholder="Galatians 6:9; James 1:22-25" />
          </L>

          <L label="Questions the room will sit with" full>
            <textarea style={{ ...inputBase, minHeight: 88, resize: "vertical" }}
              value={f.discussion_questions} onChange={e => set("discussion_questions", e.target.value)}
              placeholder={"One per line.\nWhat breaks your streak, every time?\nWho notices when you show up?"} />
          </L>

          <L label="Notes — things to know before you come" full>
            <textarea style={{ ...inputBase, minHeight: 70, resize: "vertical" }}
              value={f.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Bring something to write with. Come with one honest answer." />
          </L>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22,
          borderTop: `1px solid ${T.lineSoft}`, paddingTop: 18 }}>
          <Btn onClick={() => save("pending")} disabled={busy}>
            <Check size={15} /> {direct ? "Publish the workout" : "Submit for approval"}
          </Btn>
          <Btn kind="ghost" onClick={() => save("draft")} disabled={busy}>Save as draft</Btn>
        </div>
      </Card>
    </Wrap>
  );
}

/* ===========================================================================
   INVITE
   ========================================================================= */

function InviteDialog({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const send = async () => {
    if (!email.trim()) { setErr("An email address is required."); return; }
    setBusy(true); setErr(null);
    const { error } = await createInvite(user.id, { email, full_name: name });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 90,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440 }}>
        <Card pad={24}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Eyebrow>Invite</Eyebrow>
            <button onClick={onClose} style={{ background: "none", border: "none",
              color: T.muted2, cursor: "pointer", padding: 0 }}><X size={18} /></button>
          </div>

          {done ? (
            <>
              <div style={{ fontFamily: T.serif, fontSize: 21, color: T.cream, margin: "12px 0 8px" }}>
                Invitation logged
              </div>
              <p style={{ color: T.muted, fontSize: 14 }}>
                {email} is on the list. The invitation email goes out as soon as sending is switched on.
              </p>
              <Btn full onClick={onClose}>Done</Btn>
            </>
          ) : (
            <>
              <div style={{ fontFamily: T.serif, fontSize: 21, color: T.cream, margin: "12px 0 4px" }}>
                Call a man into the gym
              </div>
              <p style={{ color: T.muted, fontSize: 14, marginTop: 0 }}>
                He'll get an invitation with what this is and how to join.
              </p>
              <ErrBox msg={err} />
              <Field label="His name" />
              <input style={{ ...inputBase, marginBottom: 14 }} value={name}
                onChange={e => setName(e.target.value)} placeholder="Optional" />
              <Field label="Email" />
              <input style={{ ...inputBase, marginBottom: 18 }} value={email}
                onChange={e => setEmail(e.target.value)} placeholder="him@example.com" />
              <Btn full onClick={send} disabled={busy}><UserPlus size={15} /> Send the invitation</Btn>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   SESSION DETAIL — links, status, and what to know while you wait
   ========================================================================= */

function SessionDetail({ id, user, profile, onBack, onChanged }) {
  const [m, setM] = useState(null);
  const [regs, setRegs] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await fetchMeeting(id);
    if (error) { setErr(error.message); return; }
    setM(data);
    const mine = data.created_by === user.id || data.host_id === user.id || isApprover(profile);
    if (mine) { const r = await fetchRegistrations(id); setRegs(r.data); }
  }, [id, user.id, profile]);

  useEffect(() => { load(); }, [load]);

  if (err) return <Wrap><ErrBox msg={err} /></Wrap>;
  if (!m) return <Loading />;

  const meta = STATUS_META[m.status] || STATUS_META.draft;
  const host = m.host?.full_name || m.host_name || m.creator?.full_name || "Host to be named";
  const owns = m.created_by === user.id || m.host_id === user.id;
  const approver = isApprover(profile);
  const questions = (m.discussion_questions || "").split("\n").map(s => s.trim()).filter(Boolean);

  const act = async (fn) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await load(); onChanged?.();
  };

  return (
    <Wrap w={860}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.bronze,
        cursor: "pointer", fontFamily: T.reg, fontSize: 12, letterSpacing: ".12em",
        textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
        padding: 0, marginBottom: 16 }}>
        <ChevronLeft size={15} /> All workouts
      </button>

      <Card pad={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <Cover ck={m.cover_key} h={120} />
        <div style={{ padding: 24 }}>
          <StatusPill status={m.status} size={11} />
          <div style={{ fontFamily: T.display, fontSize: 32, color: T.cream, textTransform: "uppercase",
            margin: "12px 0 8px", lineHeight: 1.1 }}>{m.title}</div>
          <div style={{ color: T.muted, fontSize: 14.5, marginBottom: 2 }}>Hosted by {host}</div>
          <div style={{ color: T.muted, fontSize: 14.5 }}>
            <Calendar size={13} style={{ verticalAlign: -2 }} /> {fmtWhen(m.scheduled_at, m.duration_minutes)}
          </div>
          {m.description && (
            <p style={{ color: T.cream, fontSize: 15, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
              {m.description}
            </p>
          )}

          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 3,
            background: TONE[meta.tone].bg, border: `1px solid ${TONE[meta.tone].bd}` }}>
            <div style={{ color: TONE[meta.tone].fg, fontSize: 13.5 }}>{meta.blurb}</div>
            {m.status === "rejected" && m.rejected_reason && (
              <div style={{ color: T.cream, fontSize: 13.5, marginTop: 7 }}>
                Note: {m.rejected_reason}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            {m.status === "approved" && m.join_url && (
              <Btn onClick={() => window.open(joinUrl(m.share_slug), "_blank")}>
                <Link2 size={15} /> Join the room
              </Btn>
            )}
            <CopyBtn value={shareUrl(m.share_slug)} label="Copy share link" />
            {owns && m.status === "draft" && (
              <Btn kind="ghost" onClick={() => act(() => updateMeeting(m.id, { status: "pending" }))}>
                Submit for approval
              </Btn>
            )}
            {owns && ["approved", "pending"].includes(m.status) && isPast(m.scheduled_at) && (
              <Btn kind="ghost" onClick={() => act(() => completeMeeting(m.id))} disabled={busy}>
                Mark completed
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {approver && m.status === "pending" && (
        <Card pad={20} style={{ marginBottom: 18, border: `1px solid ${TONE.warn.bd}` }}>
          <Eyebrow>Keys</Eyebrow>
          <div style={{ fontFamily: T.serif, fontSize: 19, color: T.cream, margin: "10px 0 6px" }}>
            This one is waiting on you
          </div>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 0 }}>
            Approving opens it to the men and makes the join link live.
          </p>
          {rejecting ? (
            <>
              <Field label="What should they fix?" />
              <textarea style={{ ...inputBase, minHeight: 66, marginBottom: 12 }}
                value={reason} onChange={e => setReason(e.target.value)} />
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={() => act(() => rejectMeeting(m.id, reason))} disabled={busy}>Send it back</Btn>
                <Btn kind="ghost" onClick={() => setRejecting(false)}>Cancel</Btn>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn onClick={() => act(() => approveMeeting(m.id, user.id))} disabled={busy}>
                <Shield size={15} /> Grant the keys
              </Btn>
              <Btn kind="ghost" onClick={() => setRejecting(true)}>Send back</Btn>
            </div>
          )}
        </Card>
      )}

      {(m.focus_verses || questions.length > 0 || m.notes) && (
        <Card pad={22} style={{ marginBottom: 18 }}>
          <Eyebrow>While you wait</Eyebrow>
          {m.focus_verses && (<>
            <Sub>Verses</Sub>
            <div style={{ color: T.cream, fontSize: 15 }}>{m.focus_verses}</div>
          </>)}
          {questions.length > 0 && (<>
            <Sub>Questions the room will sit with</Sub>
            <ul style={{ margin: 0, paddingLeft: 20, color: T.cream, fontSize: 14.5, lineHeight: 1.8 }}>
              {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </>)}
          {m.notes && (<>
            <Sub>Notes</Sub>
            <div style={{ color: T.cream, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{m.notes}</div>
          </>)}
        </Card>
      )}

      {(owns || approver) && (
        <Card pad={22}>
          <Eyebrow>Who's coming</Eyebrow>
          <Sub>{regs.length} registered</Sub>
          {regs.length === 0 ? (
            <div style={{ color: T.muted2, fontSize: 14 }}>
              Nobody yet. Share the link and that changes.
            </div>
          ) : regs.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12,
              padding: "9px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 14 }}>
              <span style={{ color: T.cream }}>{r.full_name}</span>
              <span style={{ color: T.muted2 }}>
                {r.email}{r.opt_in_comms ? " · opted in" : ""}
              </span>
            </div>
          ))}
        </Card>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   SESSIONS TAB — the hub
   ========================================================================= */

export function GymSessions({ user, profile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState("list");   // list | propose
  const [openId, setOpenId] = useState(null);
  const [invite, setInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchMeetings();
    if (error) setErr(error.message); else { setRows(data); setErr(null); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openId) return (
    <SessionDetail id={openId} user={user} profile={profile}
      onBack={() => { setOpenId(null); load(); }} onChanged={load} />
  );

  if (mode === "propose") return (
    <ProposeForm user={user} profile={profile}
      onCancel={() => setMode("list")}
      onDone={(m) => { setMode("list"); load(); setOpenId(m?.id || null); }} />
  );

  const open    = rows.filter(r => ["approved", "completed"].includes(r.status));
  const pending = rows.filter(r => r.status === "pending");
  const mine    = rows.filter(r => r.created_by === user.id && ["draft", "rejected"].includes(r.status));
  const approver = isApprover(profile);

  const Grid = ({ items }) => (
    <div style={{ display: "grid", gap: 14,
      gridTemplateColumns: "repeat(auto-fill,minmax(238px,1fr))" }}>
      {items.map(m => <SessionCard key={m.id} m={m} onOpen={x => setOpenId(x.id)} />)}
    </div>
  );

  return (
    <Wrap>
      {invite && <InviteDialog user={user} onClose={() => setInvite(false)} />}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingBottom: 18,
        borderBottom: `1px solid ${T.lineSoft}`, marginBottom: 4 }}>
        <Btn onClick={() => setMode("propose")}><Plus size={15} /> Start a workout</Btn>
        <Btn kind="ghost" onClick={() => setInvite(true)}><UserPlus size={15} /> Invite someone</Btn>
        <Btn kind="ghost" onClick={load}><RefreshCw size={14} /> Refresh</Btn>
      </div>

      <ErrBox msg={err} />
      {loading ? <Loading /> : (
        <>
          {approver && pending.length > 0 && (<>
            <Sub>Waiting on your keys · {pending.length}</Sub>
            <Grid items={pending} />
          </>)}

          {mine.length > 0 && (<>
            <Sub>Yours to finish</Sub>
            <Grid items={mine} />
          </>)}

          <Sub>Open workouts</Sub>
          {open.length === 0 ? (
            <Card pad={26}>
              <div style={{ fontFamily: T.serif, fontSize: 19, color: T.cream, marginBottom: 6 }}>
                Nothing on the calendar yet
              </div>
              <p style={{ color: T.muted, fontSize: 14.5, marginTop: 0 }}>
                Start a workout, pick a time, and put it in front of the men.
              </p>
              <Btn onClick={() => setMode("propose")}><Plus size={15} /> Start a workout</Btn>
            </Card>
          ) : <Grid items={open} />}
        </>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   PUBLIC PAGES — no account required
   ========================================================================= */

const PublicShell = ({ children }) => (
  <div style={{ minHeight: "100vh", background: T.obsidian, color: T.cream,
    fontFamily: T.body, padding: "36px 20px 70px" }}>
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
        <Crest size={34} />
        <div>
          <div style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".34em",
            textTransform: "uppercase", color: T.bronze }}>Kingdom of</div>
          <div style={{ fontFamily: T.display, fontSize: 17, letterSpacing: ".05em",
            textTransform: "uppercase", color: T.cream }}>Disciplined Men</div>
        </div>
      </div>
      {children}
    </div>
  </div>
);

export function PublicSharePage({ slug }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", optIn: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getSharedMeeting(slug).then(({ data, error }) => {
      if (error) setErr(error.message);
      else if (!data) setErr("We couldn't find that session. The link may have expired.");
      else setM(data);
    });
  }, [slug]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setErr("Your name and email are needed to save your seat."); return;
    }
    setBusy(true); setErr(null);
    const { data, error } = await registerForMeeting({ slug, ...form });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data && data.ok === false) { setErr(data.error); return; }
    setResult(data);
  };

  if (err && !m) return <PublicShell><ErrBox msg={err} /></PublicShell>;
  if (!m) return <PublicShell><Loading /></PublicShell>;

  const questions = (m.discussion_questions || "").split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <PublicShell>
      <Card pad={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <Cover ck={m.cover_key} h={110} />
        <div style={{ padding: 24 }}>
          <StatusPill status={m.status} />
          <div style={{ fontFamily: T.display, fontSize: 30, color: T.cream, textTransform: "uppercase",
            margin: "12px 0 8px", lineHeight: 1.12 }}>{m.title}</div>
          <div style={{ color: T.muted, fontSize: 14.5 }}>
            Hosted by {m.host_name || "the Kingdom"} · {fmtWhen(m.scheduled_at, m.duration_minutes)}
          </div>
          {m.description && (
            <p style={{ color: T.cream, fontSize: 15, lineHeight: 1.65, marginBottom: 0 }}>
              {m.description}
            </p>
          )}
        </div>
      </Card>

      <Card pad={24} style={{ marginBottom: 18 }}>
        {result ? (
          <>
            <Eyebrow>You're in</Eyebrow>
            <div style={{ fontFamily: T.serif, fontSize: 22, color: T.cream, margin: "12px 0 8px" }}>
              Your seat is saved
            </div>
            <p style={{ color: T.muted, fontSize: 14.5, marginTop: 0 }}>
              A confirmation is on its way to {form.email}. Bring one honest answer — that's the entry fee.
            </p>
            <Btn full onClick={() => window.open(result.join_url || DEFAULT_JOIN_URL, "_blank")}>
              <Link2 size={15} /> Open the meeting
            </Btn>
          </>
        ) : (
          <>
            <Eyebrow>Save your seat</Eyebrow>
            <p style={{ color: T.muted, fontSize: 14, margin: "12px 0 16px" }}>
              No account needed. Tell us where to send the link.
            </p>
            <ErrBox msg={err} />
            <Field label="Your name" />
            <input style={{ ...inputBase, marginBottom: 13 }} value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Field label="Email" />
            <input style={{ ...inputBase, marginBottom: 13 }} value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <Field label="Phone (optional)" />
            <input style={{ ...inputBase, marginBottom: 15 }} value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
              marginBottom: 18, color: T.muted, fontSize: 13.5, lineHeight: 1.5 }}>
              <input type="checkbox" checked={form.optIn} style={{ marginTop: 3, accentColor: T.bronze }}
                onChange={e => setForm(p => ({ ...p, optIn: e.target.checked }))} />
              Send me texts and emails about Scripture Gym sessions and what the Kingdom is building.
            </label>
            <Btn full onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save my seat"}
            </Btn>
          </>
        )}
      </Card>

      {(m.focus_verses || questions.length > 0 || m.notes) && (
        <Card pad={22}>
          <Eyebrow>What we're working through</Eyebrow>
          {m.focus_verses && (<>
            <Sub>Verses</Sub>
            <div style={{ color: T.cream, fontSize: 15 }}>{m.focus_verses}</div>
          </>)}
          {questions.length > 0 && (<>
            <Sub>Questions we'll sit with</Sub>
            <ul style={{ margin: 0, paddingLeft: 20, color: T.cream, fontSize: 14.5, lineHeight: 1.8 }}>
              {questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </>)}
          {m.notes && (<>
            <Sub>Notes</Sub>
            <div style={{ color: T.cream, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{m.notes}</div>
          </>)}
        </Card>
      )}
    </PublicShell>
  );
}

export function JoinPage({ slug }) {
  const [m, setM] = useState(null);
  const [err, setErr] = useState(null);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    getSharedMeeting(slug).then(({ data, error }) => {
      if (error) setErr(error.message);
      else if (!data) setErr("We couldn't find that session.");
      else setM(data);
    });
    // Kept separate from get_shared_meeting on purpose: the share page still
    // takes a name and email before it gives the room away. This route is the
    // handoff itself, so it resolves the room directly.
    fetchJoinUrl(slug).then(({ data }) => setRoom(data || DEFAULT_JOIN_URL));
  }, [slug]);

  // Hand off automatically, with a beat so the man sees where he's going.
  useEffect(() => {
    if (!room) return;
    const t = setTimeout(() => { window.location.href = room; }, 1400);
    return () => clearTimeout(t);
  }, [room]);

  return (
    <PublicShell>
      <Card pad={40} style={{ textAlign: "center" }}>
        <Crest size={54} />
        <div style={{ fontFamily: T.display, fontSize: 30, color: T.cream, textTransform: "uppercase",
          margin: "18px 0 10px", letterSpacing: ".02em" }}>The room is opening</div>
        <p style={{ color: T.muted, fontSize: 15, maxWidth: "42ch", margin: "0 auto 22px", lineHeight: 1.6 }}>
          Hold tight — we're handing you off to the meeting. Bring something to write with.
        </p>

        <div style={{ width: 190, height: 3, background: T.lineSoft, margin: "0 auto 24px",
          borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: "62%", height: "100%", background: T.gold,
            animation: "kpulse 1.4s ease-in-out infinite" }} />
        </div>

        {err && <ErrBox msg={err} />}
        {m && (
          <>
            <div style={{ fontFamily: T.serif, fontSize: 19, color: T.cream, marginBottom: 4 }}>
              {m.title}
            </div>
            <div style={{ color: T.muted2, fontSize: 13.5, marginBottom: 22 }}>
              <Clock size={12} style={{ verticalAlign: -1 }} /> {fmtWhen(m.scheduled_at, m.duration_minutes)}
            </div>
          </>
        )}

        <div style={{ color: T.muted2, fontSize: 13.5, fontStyle: "italic", marginBottom: 22 }}>
          "A disciplined man builds a home where his whole family can thrive."
        </div>

        {room && !err && (
          <>
            <Btn full onClick={() => { window.location.href = room; }}>
              <Link2 size={15} /> Open the room now
            </Btn>
            <div style={{ fontSize: 12, color: T.muted2, marginTop: 14, wordBreak: "break-all" }}>
              Nothing happening? Go straight there:{" "}
              <a href={room} style={{ color: T.gold }}>{room}</a>
            </div>
          </>
        )}
      </Card>
    </PublicShell>
  );
}
