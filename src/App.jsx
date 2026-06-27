import React, { useState, useRef, useEffect } from "react";
import {
  Menu, X, Flame, ShieldCheck, BookOpen, CalendarCheck, Compass,
  Video, Upload, Square, Play, ChevronRight, ChevronDown, LogOut, User,
  CheckCircle2, Circle, Quote, ArrowRight, Lock, Mail, NotebookPen, Target,
  Server
} from "lucide-react";
import { supabase } from "./dataService";
import { T, Crest, Eyebrow, Btn, Card } from "./ui";
import { AdminScreen, SystemsScreen, OWNER_NAV, SYSTEMS_SUB, ADMIN_TITLES } from "./admin";

/* ============================================================================
   KINGDOM OF DISCIPLINED MEN — Member App
   Larry Beacham · Tampa, FL
   Auth + profile wired to Supabase. Owner ("Command") admin + Systems layer
   reads/writes the live tables (profiles, memories, notepad, robots,
   ai_constitution, update_log) under owner-only RLS.
   ========================================================================== */

/* ============================================================================
   LOGIN
   ========================================================================== */
function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Enter a valid email.");
    if (!pw) return setErr("Enter your password.");
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setLoading(false);
    if (error) setErr(error.message || "Login failed. Check your email and password.");
    // success → App's onAuthStateChange picks up the session
  };

  const inputStyle = {
    width: "100%", background: T.obsidian, border: `1px solid ${T.line}`, borderRadius: 2,
    color: T.cream, padding: "14px 14px 14px 42px", fontFamily: T.body, fontSize: 15, outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", background: `radial-gradient(120% 80% at 50% -10%, #1c140a 0%, ${T.obsidian} 55%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Crest size={54} /></div>
        <div style={{ marginBottom: 6 }}><Eyebrow>Members Only</Eyebrow></div>
        <h1 style={{
          fontFamily: T.display, fontSize: 30, color: T.cream, margin: "8px 0 4px",
          letterSpacing: ".01em", lineHeight: 1.05,
        }}>KINGDOM OF<br />DISCIPLINED MEN</h1>
        <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 14, marginBottom: 26 }}>
          Step back through the gate.
        </p>

        <Card pad={24} style={{ textAlign: "left" }}>
          <label style={lblStyle}>Email</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Mail size={16} style={iconInInput} />
            <input style={inputStyle} type="email" value={email} placeholder="you@email.com"
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <label style={lblStyle}>Password</label>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Lock size={16} style={iconInInput} />
            <input style={inputStyle} type="password" value={pw} placeholder="••••••••"
              onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {err && <p style={{ color: T.emberHot, fontFamily: T.body, fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <Btn full onClick={submit} disabled={loading}>{loading ? "Entering…" : <>Enter <ArrowRight size={15} /></>}</Btn>
          <p style={{ textAlign: "center", marginTop: 16, color: T.muted2, fontFamily: T.body, fontSize: 12 }}>
            Access is granted by application. Use the email and password set up for you.
          </p>
        </Card>
      </div>
    </div>
  );
}
const lblStyle = { fontFamily: T.reg, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: T.muted, display: "block", marginBottom: 7 };
const iconInInput = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.bronze };

/* ============================================================================
   PROGRAM DATA
   ========================================================================== */
const PROGRAMS = {
  p30: {
    id: "p30", roman: "I", tag: "The 30-Day Starter",
    title: "30-Day Intensive",
    desc: "Total immersion. A daily, structured forge that rewires how you lead yourself, your wife, and your children — in one month.",
    accent: T.bronze, days: 30,
    pillars: ["Daily disciplines & assignments", "Faith-rooted leadership", "Direct accountability from Larry", "Marriage & fatherhood deep-dives"],
  },
  p90: {
    id: "p90", roman: "II", tag: "The 90-Day Plan",
    title: "90-Day Curriculum",
    desc: "A full quarter of transformation — memorize the Word, build a plan for your life, and document the man you're becoming.",
    accent: T.emberLt, days: 90,
    pillars: ["Scripture memory track", "A written plan for your life", "Daily documentation & journal", "Quarterly accountability checkpoints"],
  },
};

/* ============================================================================
   SIDE MENU
   ========================================================================== */
function SideMenu({ open, onClose, go, view, user, onLogout, isOwner }) {
  const [sysOpen, setSysOpen] = useState(false);
  const items = [
    { id: "dashboard", label: "The Forge", icon: Flame },
    { id: "p30", label: "30-Day Intensive", icon: ShieldCheck },
    { id: "p90", label: "90-Day Curriculum", icon: BookOpen },
    { id: "checkin", label: "Daily Check-In", icon: CalendarCheck },
    { id: "profile", label: "My Profile", icon: User },
  ];
  const navBtn = (it, opts = {}) => {
    const active = view === it.id;
    const Icon = it.icon;
    return (
      <button key={it.id} onClick={() => { go(it.id); if (!opts.keepOpen) onClose(); }} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 13,
        padding: opts.sub ? "10px 14px 10px 30px" : "13px 14px",
        background: active ? "rgba(200,134,46,.12)" : "transparent",
        border: "none", borderLeft: `2px solid ${active ? T.bronze : "transparent"}`,
        color: active ? T.bronzeLt : T.muted, cursor: "pointer", fontFamily: T.reg,
        fontSize: opts.sub ? 12.5 : 13.5, letterSpacing: ".03em", borderRadius: 2, marginBottom: 2,
      }}>
        <Icon size={opts.sub ? 15 : 17} /> {it.label}
        {active && <ChevronRight size={13} style={{ marginLeft: "auto" }} />}
      </button>
    );
  };
  const sectionLabel = (txt) => (
    <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: T.muted2, padding: "14px 14px 6px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 14, height: 1, background: T.line }} /> {txt}
    </div>
  );
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 40,
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .25s",
      }} />
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 286, zIndex: 50,
        background: `linear-gradient(180deg,${T.surface2},${T.obsidian})`,
        borderRight: `1px solid ${T.line}`, transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .28s cubic-bezier(.4,0,.2,1)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "22px 20px", borderBottom: `1px solid ${T.lineSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
          <Crest size={36} />
          <div>
            <div style={{ fontFamily: T.reg, fontWeight: 700, fontSize: 13, color: T.cream, letterSpacing: ".04em" }}>KINGDOM</div>
            <div style={{ fontFamily: T.body, fontSize: 10, color: T.muted2, letterSpacing: ".2em" }}>DISCIPLINED MEN</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <nav style={{ padding: 12, flex: 1, overflowY: "auto" }}>
          {items.map(it => navBtn(it))}

          {isOwner && (
            <>
              {sectionLabel("Command")}
              {OWNER_NAV.map(it => navBtn(it))}

              {/* Systems — expandable parent with sub-menu */}
              <button onClick={() => setSysOpen(o => !o)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 14px",
                background: view.startsWith("sys") ? "rgba(200,134,46,.12)" : "transparent",
                border: "none", borderLeft: `2px solid ${view.startsWith("sys") ? T.bronze : "transparent"}`,
                color: view.startsWith("sys") ? T.bronzeLt : T.muted, cursor: "pointer", fontFamily: T.reg,
                fontSize: 13.5, letterSpacing: ".03em", borderRadius: 2, marginBottom: 2,
              }}>
                <Server size={17} /> Systems
                {sysOpen ? <ChevronDown size={14} style={{ marginLeft: "auto" }} /> : <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
              {sysOpen && SYSTEMS_SUB.map(it => navBtn(it, { sub: true }))}
            </>
          )}
        </nav>

        <div style={{ padding: 16, borderTop: `1px solid ${T.lineSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: T.gold, display: "flex",
              alignItems: "center", justifyContent: "center", color: "#1a1206", fontFamily: T.reg, fontWeight: 700,
            }}>{(user.name[0] || "M").toUpperCase()}</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.cream, textTransform: "capitalize" }}>{user.name}{isOwner && <span style={{ color: T.bronze, fontSize: 10, letterSpacing: ".1em", marginLeft: 6 }}>OWNER</span>}</div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "transparent", border: `1px solid ${T.line}`, color: T.muted, padding: "10px",
            borderRadius: 2, cursor: "pointer", fontFamily: T.reg, fontSize: 12, letterSpacing: ".06em",
          }}><LogOut size={14} /> Sign Out</button>
        </div>
      </aside>
    </>
  );
}

/* ============================================================================
   DASHBOARD ("The Forge")
   ========================================================================== */
function Dashboard({ user, go, streak, progress }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Eyebrow>The Forge</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 4px", textTransform: "capitalize" }}>
        Welcome back, {user.name}.
      </h2>
      <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 15, marginBottom: 22 }}>
        "A disciplined man builds a home where his whole family can thrive."
      </p>

      {/* streak banner */}
      <Card pad={20} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", border: `1px solid ${T.line}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(circle, rgba(255,106,60,.22), transparent 70%)",
        }}><Flame size={26} color={T.emberHot} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.display, fontSize: 26, color: T.cream, lineHeight: 1 }}>{streak} <span style={{ fontSize: 13, color: T.muted, fontFamily: T.reg }}>day streak</span></div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted, marginTop: 4 }}>Keep the fire lit — check in today.</div>
        </div>
        <Btn onClick={() => go("checkin")}><Video size={15} /> Check In</Btn>
      </Card>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
        {Object.values(PROGRAMS).map(p => (
          <Card key={p.id} pad={20} style={{ cursor: "pointer" }} >
            <div onClick={() => go(p.id)}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: T.reg, color: p.accent, fontSize: 13, letterSpacing: ".2em" }}>{p.roman}</span>
                <span style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: T.muted2 }}>{p.tag}</span>
              </div>
              <h3 style={{ fontFamily: T.display, fontSize: 22, color: T.cream, marginBottom: 6 }}>{p.title}</h3>
              <ProgressBar value={progress[p.id]} total={p.days} accent={p.accent} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <span style={{ fontFamily: T.body, fontSize: 13, color: T.muted }}>Day {progress[p.id]} of {p.days}</span>
                <span style={{ fontFamily: T.reg, fontSize: 12, color: T.bronzeLt, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Continue <ChevronRight size={14} />
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, total, accent }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div>
      <div style={{ height: 6, background: T.obsidian, borderRadius: 3, overflow: "hidden", border: `1px solid ${T.lineSoft}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: T.gold, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/* ============================================================================
   PROGRAM PAGE
   ========================================================================== */
function ProgramPage({ program, go, progress }) {
  const [tab, setTab] = useState("plan");
  const p = program;
  const is90 = p.id === "p90";
  const tabs = is90
    ? [{ id: "plan", label: "Curriculum" }, { id: "scripture", label: "Scripture" }, { id: "lifeplan", label: "Life Plan" }, { id: "journal", label: "Journal" }]
    : [{ id: "plan", label: "Daily Plan" }, { id: "journal", label: "Journal" }];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: T.reg, color: p.accent, fontSize: 14, letterSpacing: ".2em" }}>— {p.roman}</span>
        <Eyebrow>{p.tag}</Eyebrow>
      </div>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "6px 0 8px" }}>{p.title}</h2>
      <p style={{ fontFamily: T.body, color: T.muted, fontSize: 15, lineHeight: 1.6, marginBottom: 16, maxWidth: 560 }}>{p.desc}</p>

      <Card pad={18} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".12em", color: T.muted, textTransform: "uppercase" }}>Progress</span>
          <span style={{ fontFamily: T.body, fontSize: 13, color: T.bronzeLt }}>Day {progress[p.id]} / {p.days}</span>
        </div>
        <ProgressBar value={progress[p.id]} total={p.days} accent={p.accent} />
        <div style={{ marginTop: 16 }}>
          <Btn full onClick={() => go("checkin")}><Video size={15} /> Record Today's Check-In</Btn>
        </div>
      </Card>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: `1px solid ${T.lineSoft}`, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 14px",
            color: tab === t.id ? T.bronzeLt : T.muted2, fontFamily: T.reg, fontSize: 13, letterSpacing: ".05em",
            borderBottom: `2px solid ${tab === t.id ? T.bronze : "transparent"}`, marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "plan" && <PlanTab p={p} progress={progress} />}
      {tab === "scripture" && <ScriptureTab />}
      {tab === "lifeplan" && <LifePlanTab />}
      {tab === "journal" && <JournalTab />}
    </div>
  );
}

function PlanTab({ p, progress }) {
  const today = progress[p.id];
  const sample = p.id === "p30"
    ? ["Wake before the house. 20 min in the Word.", "Identify one area you've been drifting. Name it out loud.", "Lead a 10-min conversation with your wife — listen first.", "Record your check-in. No excuses."]
    : ["Review this week's memory verse. Recite from memory.", "Add one line to your written life plan.", "Document today: one win, one struggle, one prayer.", "Record your check-in for the brotherhood."];
  return (
    <>
      <Card pad={20} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: T.display, fontSize: 30, color: p.accent }}>{String(today).padStart(2, "0")}</span>
          <div>
            <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".2em", color: T.muted2, textTransform: "uppercase" }}>Today's Disciplines</div>
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted }}>Day {today} of {p.days}</div>
          </div>
        </div>
        {sample.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 11, padding: "11px 0", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
            <Circle size={18} color={T.bronze} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, lineHeight: 1.5 }}>{s}</span>
          </div>
        ))}
      </Card>
      <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted2, textAlign: "center" }}>
        Daily content is placeholder — Larry's real assignments load from Supabase.
      </p>
    </>
  );
}

const VERSES = [
  { ref: "Joshua 1:9", text: "Be strong and of a good courage; be not afraid, for the Lord thy God is with thee whithersoever thou goest." },
  { ref: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { ref: "Proverbs 27:17", text: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend." },
];
function ScriptureTab() {
  const [done, setDone] = useState([false, false, false]);
  return (
    <>
      <p style={{ fontFamily: T.body, color: T.muted, fontSize: 14, marginBottom: 14 }}>
        Hide the Word in your heart. Mark a verse mastered once you can recite it from memory.
      </p>
      {VERSES.map((v, i) => (
        <Card key={i} pad={18} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setDone(d => d.map((x, j) => j === i ? !x : x))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: done[i] ? T.bronzeLt : T.muted2, flexShrink: 0 }}>
              {done[i] ? <CheckCircle2 size={22} /> : <Circle size={22} />}
            </button>
            <div>
              <Quote size={16} color={T.bronze} style={{ marginBottom: 6 }} />
              <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.cream, fontSize: 16, lineHeight: 1.55, marginBottom: 8 }}>{v.text}</p>
              <span style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".14em", color: T.bronze, textTransform: "uppercase" }}>{v.ref}</span>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function LifePlanTab() {
  const fields = [
    { icon: Target, label: "My calling", ph: "The man God is calling me to be..." },
    { icon: ShieldCheck, label: "As a husband", ph: "How I will lead and love my wife..." },
    { icon: Compass, label: "As a father", ph: "The legacy I'm building for my children..." },
  ];
  const [vals, setVals] = useState(["", "", ""]);
  return (
    <>
      <p style={{ fontFamily: T.body, color: T.muted, fontSize: 14, marginBottom: 16 }}>
        A man who refuses to drift writes it down. Build your plan one section at a time.
      </p>
      {fields.map((f, i) => {
        const Icon = f.icon;
        return (
          <Card key={i} pad={18} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <Icon size={17} color={T.bronze} />
              <span style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: T.bronzeLt }}>{f.label}</span>
            </div>
            <textarea value={vals[i]} onChange={e => setVals(v => v.map((x, j) => j === i ? e.target.value : x))}
              placeholder={f.ph} rows={3} style={{
                width: "100%", resize: "vertical", background: T.obsidian, border: `1px solid ${T.line}`,
                borderRadius: 2, color: T.cream, fontFamily: T.body, fontSize: 14.5, padding: 12, outline: "none", lineHeight: 1.5,
              }} />
          </Card>
        );
      })}
      <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted2, textAlign: "center" }}>Saves to Supabase once wired.</p>
    </>
  );
}

function JournalTab() {
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const add = () => { if (!text.trim()) return; setEntries(e => [{ text, when: new Date() }, ...e]); setText(""); };
  return (
    <>
      <Card pad={18} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <NotebookPen size={17} color={T.bronze} />
          <span style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: T.bronzeLt }}>Document Today</span>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="One win, one struggle, one prayer..."
          style={{ width: "100%", resize: "vertical", background: T.obsidian, border: `1px solid ${T.line}`, borderRadius: 2, color: T.cream, fontFamily: T.body, fontSize: 14.5, padding: 12, outline: "none", lineHeight: 1.5, marginBottom: 12 }} />
        <Btn onClick={add}><NotebookPen size={14} /> Save Entry</Btn>
      </Card>
      {entries.length === 0
        ? <p style={{ fontFamily: T.body, fontSize: 13, color: T.muted2, textAlign: "center" }}>Your documented journey will appear here.</p>
        : entries.map((e, i) => (
          <Card key={i} pad={16} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted2, marginBottom: 6 }}>{e.when.toLocaleString()}</div>
            <p style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{e.text}</p>
          </Card>
        ))}
    </>
  );
}

/* ============================================================================
   DAILY CHECK-IN  (record in-app  OR  upload — Marco Polo style thread)
   ========================================================================== */
function CheckIn({ checkins, addCheckin, onStreak }) {
  const [mode, setMode] = useState("idle"); // idle | live | preview
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const [program, setProgram] = useState("p30");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };
  useEffect(() => () => stopStream(), []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      setMode("live");
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 50);
    } catch (e) {
      setError("Camera access was blocked here. Use “Upload a Video” instead — it works everywhere. (On Larry's real domain, in-app recording is enabled.)");
    }
  };

  const startRec = () => {
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current);
    rec.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setPreviewUrl(URL.createObjectURL(blob));
      stopStream(); setMode("preview");
    };
    rec.start(); recRef.current = rec; setRecording(true);
  };
  const stopRec = () => { recRef.current && recRef.current.stop(); setRecording(false); };

  const onUpload = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewUrl(URL.createObjectURL(f)); setMode("preview"); setError("");
  };

  const post = () => {
    addCheckin({ url: previewUrl, when: new Date(), program });
    onStreak();
    setPreviewUrl(null); setMode("idle");
  };
  const discard = () => { setPreviewUrl(null); setMode("idle"); stopStream(); };

  const todayPosted = checkins.some(c => new Date(c.when).toDateString() === new Date().toDateString());

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Eyebrow>Daily Accountability</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 4px" }}>Daily Check-In</h2>
      <p style={{ fontFamily: T.body, color: T.muted, fontSize: 14.5, lineHeight: 1.55, marginBottom: 18 }}>
        Every man checks in daily — face to the camera, no hiding. Record here, or upload a clip you filmed elsewhere.
      </p>

      {/* today status */}
      <Card pad={16} style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        {todayPosted ? <CheckCircle2 size={22} color={T.bronzeLt} /> : <Circle size={22} color={T.emberLt} />}
        <span style={{ fontFamily: T.body, fontSize: 14, color: todayPosted ? T.bronzeLt : T.cream }}>
          {todayPosted ? "Today's check-in is in. Well done." : "You haven't checked in today."}
        </span>
      </Card>

      {/* recorder surface */}
      <Card pad={18} style={{ marginBottom: 22 }}>
        {/* program selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {Object.values(PROGRAMS).map(p => (
            <button key={p.id} onClick={() => setProgram(p.id)} style={{
              flex: 1, padding: "9px", borderRadius: 2, cursor: "pointer", fontFamily: T.reg, fontSize: 11.5, letterSpacing: ".05em",
              background: program === p.id ? "rgba(200,134,46,.14)" : "transparent",
              border: `1px solid ${program === p.id ? T.bronze : T.line}`,
              color: program === p.id ? T.bronzeLt : T.muted,
            }}>{p.title}</button>
          ))}
        </div>

        <div style={{ position: "relative", background: "#000", borderRadius: 3, overflow: "hidden", aspectRatio: "9/12", border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {mode === "live" && <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />}
          {mode === "preview" && previewUrl && <video src={previewUrl} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          {mode === "idle" && (
            <div style={{ textAlign: "center", color: T.muted2, padding: 20 }}>
              <Video size={40} color={T.muted2} />
              <p style={{ fontFamily: T.body, fontSize: 13, marginTop: 10 }}>Ready when you are.</p>
            </div>
          )}
          {recording && (
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.55)", padding: "5px 10px", borderRadius: 20 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.emberHot, animation: "kpulse 1s infinite" }} />
              <span style={{ fontFamily: T.body, fontSize: 11, color: T.cream, letterSpacing: ".1em" }}>REC</span>
            </div>
          )}
        </div>

        {error && <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.emberHot, marginTop: 12, lineHeight: 1.5 }}>{error}</p>}

        {/* controls */}
        <div style={{ marginTop: 16 }}>
          {mode === "idle" && (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <Btn onClick={startCamera}><Video size={15} /> Record</Btn>
              <Btn kind="ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload</Btn>
              <input ref={fileRef} type="file" accept="video/*" onChange={onUpload} style={{ display: "none" }} />
            </div>
          )}
          {mode === "live" && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {!recording
                ? <Btn onClick={startRec}><Video size={15} /> Start Recording</Btn>
                : <Btn onClick={stopRec}><Square size={14} /> Stop</Btn>}
            </div>
          )}
          {mode === "preview" && (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <Btn onClick={post}><CheckCircle2 size={15} /> Post Check-In</Btn>
              <Btn kind="ghost" onClick={discard}><X size={15} /> Discard</Btn>
            </div>
          )}
        </div>
      </Card>

      {/* thread */}
      <Eyebrow>The Thread</Eyebrow>
      <div style={{ marginTop: 14 }}>
        {checkins.length === 0
          ? <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted2, textAlign: "center", padding: 20 }}>No check-ins yet. Your daily record builds here, Marco-Polo style.</p>
          : checkins.map((c, i) => (
            <Card key={i} pad={12} style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 64, height: 84, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "#000", border: `1px solid ${T.line}` }}>
                <video src={c.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".1em", color: T.bronze, textTransform: "uppercase", marginBottom: 3 }}>
                  {PROGRAMS[c.program]?.title || "Check-In"}
                </div>
                <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted }}>{new Date(c.when).toLocaleString()}</div>
              </div>
              <a href={c.url} target="_blank" rel="noreferrer" style={{ color: T.bronzeLt }}><Play size={20} /></a>
            </Card>
          ))}
      </div>
    </div>
  );
}

/* ============================================================================
   PROFILE
   ========================================================================== */
function Profile({ user, streak, checkins }) {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Eyebrow>Your Standing</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 18px" }}>My Profile</h2>
      <Card pad={22} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: T.gold, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1206", fontFamily: T.display, fontSize: 26 }}>
          {(user.name[0] || "M").toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily: T.reg, fontSize: 18, color: T.cream, textTransform: "capitalize" }}>{user.name}</div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted }}>{user.email}</div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card pad={18} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.display, fontSize: 32, color: T.emberHot }}>{streak}</div>
          <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>Day Streak</div>
        </Card>
        <Card pad={18} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.display, fontSize: 32, color: T.bronzeLt }}>{checkins.length}</div>
          <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>Check-Ins</div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   ROOT
   ========================================================================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [progress] = useState({ p30: 12, p90: 27 });

  const streak = profile?.streak ?? 0;
  const user = session?.user
    ? { email: session.user.email, name: profile?.full_name || session.user.email.split("@")[0] }
    : null;

  // auth session bootstrap + listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setView("dashboard"); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // load profile for the signed-in user
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [session]);

  const bumpStreak = () => {
    if (!session?.user) return;
    const next = (profile?.streak ?? 0) + 1;
    setProfile(p => ({ ...(p || {}), streak: next }));
    supabase.from("profiles").update({ streak: next }).eq("id", session.user.id).then(() => {});
  };

  const logout = async () => { setMenu(false); await supabase.auth.signOut(); };

  // inject fonts + keyframes once
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Anton&family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Hanken+Grotesk:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.textContent = "@keyframes kpulse{0%,100%{opacity:1}50%{opacity:.3}}*{box-sizing:border-box}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:rgba(200,134,46,.3);border-radius:4px}";
    document.head.appendChild(s);
  }, []);

  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: T.obsidian, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Crest size={48} />
    </div>
  );
  if (!user) return <Login />;

  const isOwner = profile?.role === "owner";
  const titles = { dashboard: "The Forge", p30: "30-Day Intensive", p90: "90-Day Curriculum", checkin: "Daily Check-In", profile: "Profile", ...ADMIN_TITLES };

  return (
    <div style={{ minHeight: "100vh", background: T.obsidian, color: T.cream, fontFamily: T.body }}>
      <SideMenu open={menu} onClose={() => setMenu(false)} go={setView} view={view} user={user}
        onLogout={logout} isOwner={isOwner} />

      {/* top bar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 14,
        padding: "14px 18px", background: "rgba(10,9,7,.86)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <button onClick={() => setMenu(true)} style={{ background: "none", border: "none", color: T.bronzeLt, cursor: "pointer" }}><Menu size={24} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Crest size={26} />
          <span style={{ fontFamily: T.reg, fontSize: 13.5, letterSpacing: ".06em", color: T.cream }}>{titles[view]}</span>
        </div>
        <button onClick={() => setView("checkin")} style={{ marginLeft: "auto", background: "none", border: "none", color: T.emberHot, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <Flame size={18} /><span style={{ fontFamily: T.reg, fontSize: 13 }}>{streak}</span>
        </button>
      </header>

      <main style={{ padding: "26px 18px 60px" }}>
        {view === "dashboard" && <Dashboard user={user} go={setView} streak={streak} progress={progress} />}
        {view === "p30" && <ProgramPage program={PROGRAMS.p30} go={setView} progress={progress} />}
        {view === "p90" && <ProgramPage program={PROGRAMS.p90} go={setView} progress={progress} />}
        {view === "checkin" && <CheckIn checkins={checkins} addCheckin={c => setCheckins(s => [c, ...s])} onStreak={bumpStreak} />}
        {view === "profile" && <Profile user={user} streak={streak} checkins={checkins} />}

        {/* Owner Command + Systems (UI gate; RLS enforces at the DB regardless) */}
        {isOwner && (view.startsWith("admin_") || view === "gideon") && <AdminScreen view={view} profile={profile} />}
        {isOwner && (view === "systems" || view.startsWith("sys_")) && <SystemsScreen view={view} go={setView} />}
        {!isOwner && (view.startsWith("admin_") || view.startsWith("sys_") || view === "gideon" || view === "systems") && (
          <div style={{ maxWidth: 520, margin: "40px auto 0", textAlign: "center" }}>
            <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 16 }}>This gate is for the owner alone.</p>
          </div>
        )}
      </main>
    </div>
  );
}
