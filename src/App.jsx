import React, { useState, useRef, useEffect } from "react";
import {
  Menu, X, Flame, ShieldCheck, BookOpen, CalendarCheck, Compass,
  Video, Upload, Square, Play, ChevronRight, ChevronDown, LogOut, User,
  CheckCircle2, Circle, Quote, ArrowRight, Lock, Mail, NotebookPen, Target,
  Server, Dumbbell, LibraryBig, ExternalLink, Route
} from "lucide-react";
import { supabase } from "./dataService";
import { T, Crest, Eyebrow, Btn, Card, firstName } from "./ui";
import { AdminScreen, SystemsScreen, OWNER_NAV, SYSTEMS_SUB, ADMIN_TITLES } from "./admin";
import { ScriptureGymApp } from "./scripturegym";
import { PublicSharePage, JoinPage } from "./gymSessions";
import { PathScreen } from "./path";

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
  const [mode, setMode] = useState("login"); // "login" | "signup" | "sent"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
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

  const submitSignup = async () => {
    if (!name.trim()) return setErr("Enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Enter a valid email.");
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Those passwords don't match.");
    setErr(""); setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { full_name: name.trim() } },
    });
    setLoading(false);
    if (error) return setErr(error.message || "Couldn't create your account. Try again.");
    // When email confirmation is required, Supabase returns a user but no session.
    if (data?.user && !data?.session) return setMode("sent");
    // Otherwise onAuthStateChange picks up the session and drops them into the app.
  };

  const go = (m) => { setMode(m); setErr(""); setPw(""); setPw2(""); };

  const inputStyle = {
    width: "100%", background: T.obsidian, border: `1px solid ${T.line}`, borderRadius: 2,
    color: T.cream, padding: "14px 14px 14px 42px", fontFamily: T.body, fontSize: 16, outline: "none",
  };

  const eyebrow = mode === "signup" ? "Answer The Call" : mode === "sent" ? "One Step Left" : "Members Only";
  const tagline = mode === "signup"
    ? "Step through the gate for the first time."
    : mode === "sent"
      ? "Confirm your email to finish."
      : "Step back through the gate.";

  return (
    <div style={{
      minHeight: "100vh", background: `radial-gradient(120% 80% at 50% -10%, #1c140a 0%, ${T.obsidian} 55%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Crest size={54} /></div>
        <div style={{ marginBottom: 6 }}><Eyebrow>{eyebrow}</Eyebrow></div>
        <h1 style={{
          fontFamily: T.display, fontSize: 30, color: T.cream, margin: "8px 0 4px",
          letterSpacing: ".01em", lineHeight: 1.05,
        }}>KINGDOM OF<br />DISCIPLINED MEN</h1>
        <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 14, marginBottom: 26 }}>
          {tagline}
        </p>

        {mode === "sent" ? (
          <Card pad={26}>
            <Mail size={30} color={T.bronze} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, lineHeight: 1.6, marginBottom: 8 }}>
              We sent a confirmation link to <strong style={{ color: T.bronzeLt }}>{email}</strong>.
            </p>
            <p style={{ fontFamily: T.body, fontSize: 13, color: T.muted, lineHeight: 1.55, marginBottom: 20 }}>
              Click the link in that email to activate your account, then come back and sign in.
            </p>
            <Btn kind="outline" full onClick={() => go("login")}>Back to sign in</Btn>
          </Card>
        ) : mode === "signup" ? (
          <Card pad={24} style={{ textAlign: "left" }}>
            <label style={lblStyle}>Full Name</label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <User size={16} style={iconInInput} />
              <input style={inputStyle} type="text" value={name} placeholder="Your name"
                onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submitSignup()} />
            </div>
            <label style={lblStyle}>Email</label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Mail size={16} style={iconInInput} />
              <input style={inputStyle} type="email" value={email} placeholder="you@email.com"
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitSignup()} />
            </div>
            <label style={lblStyle}>Password</label>
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Lock size={16} style={iconInInput} />
              <input style={inputStyle} type="password" value={pw} placeholder="At least 8 characters"
                onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submitSignup()} />
            </div>
            <p style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginBottom: 14 }}>
              Minimum 8 characters.
            </p>
            <label style={lblStyle}>Confirm Password</label>
            <div style={{ position: "relative", marginBottom: 18 }}>
              <Lock size={16} style={iconInInput} />
              <input style={inputStyle} type="password" value={pw2} placeholder="••••••••"
                onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === "Enter" && submitSignup()} />
            </div>
            {err && <p style={{ color: T.emberHot, fontFamily: T.body, fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <Btn full onClick={submitSignup} disabled={loading}>
              {loading ? "Creating your account…" : <>Create Account <ArrowRight size={15} /></>}
            </Btn>
            <p style={{ textAlign: "center", marginTop: 16, color: T.muted2, fontFamily: T.body, fontSize: 12 }}>
              Already have an account?{" "}
              <span style={{ color: T.bronzeLt, cursor: "pointer", textDecoration: "underline" }}
                onClick={() => go("login")}>Sign in</span>
            </p>
          </Card>
        ) : (
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
              <span style={{ flex: 1, height: 1, background: T.lineSoft }} />
              <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".2em", color: T.muted2, textTransform: "uppercase" }}>New here</span>
              <span style={{ flex: 1, height: 1, background: T.lineSoft }} />
            </div>

            <Btn kind="outline" full onClick={() => go("signup")}>Create an Account</Btn>

            <p style={{ textAlign: "center", marginTop: 16, color: T.muted2, fontFamily: T.body, fontSize: 12 }}>
              Already applied? Use the email and password set up for you.
            </p>
          </Card>
        )}
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
function SideMenu({ open, onClose, go, view, user, onLogout, isOwner, previewMember, onTogglePreview }) {
  const [sysOpen, setSysOpen] = useState(false);
  const showCommand = isOwner && !previewMember;
  // The two programs and Daily Check-In are Super Admin only for now.
  // Members see The Forge, Scripture Gym and their profile until these open up.
  const items = [
    { id: "dashboard", label: "The Forge", icon: Flame },
    { id: "path", label: "The Path", icon: Route },
    { id: "scripturegym", label: "Scripture Gym", icon: Dumbbell },
    ...(showCommand ? [
      { id: "p30", label: "30-Day Intensive", icon: ShieldCheck },
      { id: "p90", label: "90-Day Curriculum", icon: BookOpen },
      { id: "checkin", label: "Daily Check-In", icon: CalendarCheck },
    ] : []),
  ];
  // Outside links and member perks. Its own section so it doesn't read as
  // another part of the program.
  const resourceItems = [
    { id: "resources", label: "RightNow Media", icon: LibraryBig },
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

          {sectionLabel("Resources")}
          {resourceItems.map(it => navBtn(it))}
          {navBtn({ id: "profile", label: "My Profile", icon: User })}

          {showCommand && (
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
          {isOwner && (
            <button onClick={onTogglePreview} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              background: previewMember ? "rgba(200,134,46,.14)" : "transparent",
              border: `1px solid ${previewMember ? T.bronze : T.line}`, borderRadius: 4,
              padding: "9px 12px", marginBottom: 12, cursor: "pointer",
              color: previewMember ? T.bronzeLt : T.muted, fontFamily: T.reg, fontSize: 12,
            }}>
              <span>{previewMember ? "Previewing as Member" : "Preview as Member"}</span>
              <span style={{
                width: 30, height: 16, borderRadius: 100, position: "relative", flexShrink: 0,
                background: previewMember ? T.bronze : T.line, transition: "background .2s",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: previewMember ? 16 : 2, width: 12, height: 12,
                  borderRadius: "50%", background: T.obsidian, transition: "left .2s",
                }} />
              </span>
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: T.gold, display: "flex",
              alignItems: "center", justifyContent: "center", color: "#1a1206", fontFamily: T.reg, fontWeight: 700,
            }}>{(user.name[0] || "M").toUpperCase()}</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.cream, textTransform: "capitalize" }}>{user.name}{showCommand && <span style={{ color: T.bronze, fontSize: 10, letterSpacing: ".1em", marginLeft: 6 }}>OWNER</span>}</div>
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
function Dashboard({ user, go, streak, progress, staff }) {
  const [verse, setVerse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // A new man needs a path, not a dashboard. We show Start Here until he has
  // actually done something, then it retires itself — no dismiss button to
  // hunt for, and it comes back if he somehow ends up with nothing again.
  const [firstSteps, setFirstSteps] = useState(null);
  const [today, setToday] = useState(null);
  const [repBusy, setRepBusy] = useState(false);

  const startWeekVerse = async () => {
    const { error } = await supabase.rpc("start_week_verse");
    if (!error) { const { data } = await supabase.rpc("get_today"); if (data) setToday(data); }
    go("scripturegym");
  };

  const markRepDone = async () => {
    if (repBusy || today?.rep_done) return;
    setRepBusy(true);
    // Optimistic: the tick should land the instant he taps it. If the write
    // fails we reload and the truth wins.
    setToday(t => ({ ...t, rep_done: true,
      week: (t.week || []).map(d => d.is_today ? { ...d, done: true } : d) }));
    const { error } = await supabase.rpc("complete_today_rep");
    if (error) { const { data } = await supabase.rpc("get_today"); if (data) setToday(data); }
    setRepBusy(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [v, s, prog, td] = await Promise.all([
        supabase.rpc("verse_of_the_day"),
        supabase.from("gym_meetings")
          .select("id, title, scheduled_at, duration_minutes, cover_key, status, host_name, host:profiles!gym_meetings_host_id_fkey(full_name)")
          .eq("status", "approved")
          .order("scheduled_at", { ascending: true })
          .limit(3),
        supabase.from("user_verse_progress")
          .select("status", { count: "exact", head: false })
          .eq("user_id", user.id),
        supabase.rpc("get_today"),
      ]);
      if (!alive) return;
      if (v.data) setVerse(v.data);
      if (td?.data) setToday(td.data);
      const rows = prog?.data || [];
      setFirstSteps({
        picked: rows.length > 0,
        memorized: rows.some(r => r.status === "memorized"),
      });
      if (s.data) setSessions(s.data.filter(m => !m.scheduled_at || new Date(m.scheduled_at) > new Date(Date.now() - 36e5)));
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const when = (iso, mins) => {
    if (!iso) return "Time to be set";
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${mins ? ` · ${mins} min` : ""}`;
  };
  const countdown = (iso) => {
    if (!iso) return null;
    const ms = new Date(iso) - Date.now();
    if (ms < 0) return "Happening now";
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24;
    if (d > 0) return `In ${d} day${d > 1 ? "s" : ""}`;
    if (h > 0) return `In ${h} hour${h > 1 ? "s" : ""}`;
    return "Starting soon";
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Eyebrow>The Forge</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 18px", textTransform: "capitalize" }}>
        Welcome back, {firstName(user.name) || user.name}.
      </h2>

      {/* ---- TODAY'S REP — the one thing. Everything else is below it. ---- */}
      {today?.rep && (
        <Card pad={0} style={{ marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "20px 22px 18px",
            background: today.rep_done
              ? "linear-gradient(135deg, rgba(92,179,119,.10), transparent 70%)"
              : "linear-gradient(135deg, rgba(200,134,46,.14), transparent 70%)" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".24em",
                textTransform: "uppercase", color: today.rep_done ? "#5cb377" : T.bronze }}>
                {today.rep_done ? "Today — done" : "Today's rep"}
              </span>
              <span style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".16em",
                textTransform: "uppercase", color: T.muted2, border: `1px solid ${T.lineSoft}`,
                borderRadius: 20, padding: "3px 10px" }}>{today.rep.theme}</span>
            </div>

            <div style={{ fontFamily: T.display, fontSize: 24, color: T.cream,
              lineHeight: 1.15, marginBottom: 10 }}>{today.rep.headline}</div>

            {today.rep.verse_text && (
              <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 15, lineHeight: 1.55,
                color: T.bronzeLt, margin: "0 0 12px", paddingLeft: 12,
                borderLeft: `2px solid ${T.lineSoft}` }}>
                &ldquo;{today.rep.verse_text}&rdquo;
                <span style={{ display: "block", fontStyle: "normal", fontFamily: T.reg,
                  fontSize: 12, color: T.muted2, marginTop: 5 }}>{today.rep.verse_ref}</span>
              </p>
            )}

            <p style={{ fontFamily: T.body, fontSize: 15, lineHeight: 1.6, color: T.cream,
              margin: "0 0 16px" }}>{today.rep.action}</p>

            <button onClick={markRepDone} disabled={today.rep_done || repBusy} style={{
              display: "inline-flex", alignItems: "center", gap: 9, minHeight: 46,
              padding: "13px 24px", borderRadius: 3, cursor: today.rep_done ? "default" : "pointer",
              fontFamily: T.reg, fontSize: 12.5, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase",
              background: today.rep_done ? "transparent" : T.gold,
              color: today.rep_done ? "#5cb377" : "#1a1206",
              border: today.rep_done ? "1px solid rgba(92,179,119,.45)" : "none",
            }}>
              {today.rep_done ? <><CheckCircle2 size={16} /> Rep logged</> : <>Mark it done</>}
            </button>
          </div>

          {/* week strip — the reward half of the loop */}
          {today.week?.length > 0 && (
            <div style={{ display: "flex", gap: 6, padding: "13px 22px 15px",
              borderTop: `1px solid ${T.lineSoft}`, alignItems: "center" }}>
              {today.week.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    height: 30, borderRadius: 3, marginBottom: 5,
                    background: d.done ? T.gold : "transparent",
                    border: `1px solid ${d.done ? T.gold : (d.is_today ? T.bronzeDim || "rgba(200,134,46,.5)" : T.lineSoft)}`,
                  }} />
                  <div style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".08em",
                    color: d.is_today ? T.bronzeLt : T.muted2 }}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---- THIS WEEK'S VERSE — set by Monday's session. The link between
             the room and the training that was missing. ---- */}
      {today?.week_verse?.verse_id && (
        <Card pad={0} style={{ marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px 18px",
            background: "linear-gradient(135deg, rgba(184,134,59,.09), transparent 68%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 10, marginBottom: 9, flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".24em",
                textTransform: "uppercase", color: T.bronze }}>
                {today.week_verse.upcoming ? "Coming Monday" : "This week's verse"}
              </span>
              {today.week_verse.group_name && (
                <span style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".16em",
                  textTransform: "uppercase", color: T.muted2, border: `1px solid ${T.lineSoft}`,
                  borderRadius: 20, padding: "3px 10px" }}>{today.week_verse.group_name}</span>
              )}
            </div>

            <p style={{ fontFamily: T.serif, fontSize: 18, lineHeight: 1.5, color: T.cream,
              margin: "0 0 8px" }}>&ldquo;{today.week_verse.verse_text}&rdquo;</p>
            <div style={{ fontFamily: T.reg, fontSize: 12.5, color: T.bronzeLt, marginBottom: 13 }}>
              {today.week_verse.reference}
              <span style={{ color: T.muted2 }}>
                {" · from "}{today.week_verse.session_title}
              </span>
            </div>

            {today.week_verse.memorized ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                color: "#5cb377", fontFamily: T.reg, fontSize: 12.5, letterSpacing: ".08em",
                textTransform: "uppercase" }}>
                <CheckCircle2 size={16} /> Memorized
              </div>
            ) : (
              <button onClick={startWeekVerse} style={{
                display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
                padding: "12px 22px", borderRadius: 3, cursor: "pointer",
                fontFamily: T.reg, fontSize: 12, fontWeight: 700, letterSpacing: ".1em",
                textTransform: "uppercase",
                background: today.week_verse.started ? "transparent" : T.gold,
                color: today.week_verse.started ? T.bronzeLt : "#1a1206",
                border: today.week_verse.started ? `1px solid ${T.line}` : "none",
              }}>
                {today.week_verse.started ? "Keep training it" : "Train this verse"}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ---- the verse he's mid-way through ---- */}
      {today?.verse_in_progress && (
        <Card pad={0} style={{ marginBottom: 14, overflow: "hidden", cursor: "pointer" }}
          onClick={() => go("scripturegym")}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".22em",
                textTransform: "uppercase", color: T.muted2, marginBottom: 5 }}>Still learning</div>
              <div style={{ fontFamily: T.serif, fontSize: 15.5, color: T.cream, lineHeight: 1.45,
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {today.verse_in_progress.verse_text}
              </div>
              <div style={{ fontFamily: T.reg, fontSize: 12, color: T.bronzeLt, marginTop: 5 }}>
                {today.verse_in_progress.reference}
              </div>
            </div>
            <span style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".1em",
              textTransform: "uppercase", color: T.bronzeLt, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 4 }}>
              Train it <ChevronRight size={14} />
            </span>
          </div>
        </Card>
      )}

      {/* ---- Start Here: retires itself once he's training ---- */}
      {firstSteps && !firstSteps.memorized && (
        <Card pad={0} style={{ marginBottom: 18, overflow: "hidden",
          border: `1px solid ${T.bronzeDim || "rgba(200,134,46,.35)"}` }}>
          <div style={{ padding: "20px 22px 18px",
            background: "linear-gradient(135deg, rgba(200,134,46,.13), transparent 70%)" }}>
            <div style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".24em",
              textTransform: "uppercase", color: T.bronze, marginBottom: 8 }}>Start here</div>
            <div style={{ fontFamily: T.display, fontSize: 23, color: T.cream, marginBottom: 6 }}>
              Three things, then you're training
            </div>
            <p style={{ fontFamily: T.body, fontSize: 14.5, color: T.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
              This is a gym, not a library. Here's the whole starting line.
            </p>

            {[
              { n: 1, done: firstSteps.picked,
                title: "Pick your first verse",
                blurb: "Choose the muscle group that names your weakest area — not your strongest.",
                cta: "Open the Gym", go: "scripturegym" },
              { n: 2, done: false,
                title: "Put Monday on your calendar",
                blurb: "We meet Mondays, 7:00 PM ET. Study first, then the reps. Come as you are.",
                cta: "See the session", go: "scripturegym" },
              { n: 3, done: false,
                title: "Claim what's already paid for",
                blurb: "RightNow Media is sponsored for you — 25,000+ studies, no cost.",
                cta: "Open Resources", go: "resources" },
            ].map(step => (
              <div key={step.n} style={{ display: "flex", gap: 13, alignItems: "flex-start",
                padding: "12px 0", borderTop: `1px solid ${T.lineSoft}` }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flex: "0 0 auto", marginTop: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${step.done ? T.bronze : T.line}`,
                  background: step.done ? "rgba(200,134,46,.18)" : "transparent",
                  color: step.done ? T.bronzeLt : T.muted2,
                  fontFamily: T.reg, fontSize: 12, fontWeight: 700,
                }}>{step.done ? <CheckCircle2 size={15} /> : step.n}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.body, fontSize: 15, color: step.done ? T.muted2 : T.cream,
                    textDecoration: step.done ? "line-through" : "none", marginBottom: 3 }}>
                    {step.title}
                  </div>
                  <div style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>
                    {step.blurb}
                  </div>
                  {!step.done && (
                    <button onClick={() => go(step.go)} style={{
                      marginTop: 8, background: "none", border: "none", padding: "6px 0",
                      color: T.bronzeLt, cursor: "pointer", fontFamily: T.reg, fontSize: 12,
                      letterSpacing: ".1em", textTransform: "uppercase",
                      display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32,
                    }}>{step.cta} <ChevronRight size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- verse of the day: the front door into the Gym ---- */}
      <Card pad={0} style={{ marginBottom: 18, overflow: "hidden", cursor: "pointer" }}
        onClick={() => go("scripturegym")}>
        <div style={{ padding: "22px 24px 20px",
          background: "linear-gradient(135deg, rgba(200,134,46,.10), transparent 65%)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".26em",
              textTransform: "uppercase", color: T.bronze }}>Today's verse</span>
            {verse?.theme && (
              <span style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".18em",
                textTransform: "uppercase", color: T.muted2, border: `1px solid ${T.lineSoft}`,
                borderRadius: 20, padding: "3px 10px" }}>{verse.theme}</span>
            )}
          </div>
          {verse ? (
            <>
              <p style={{ fontFamily: T.serif, fontSize: 19, lineHeight: 1.5, color: T.cream, margin: "0 0 12px" }}>
                “{verse.text}”
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontFamily: T.reg, fontSize: 13, color: T.bronzeLt, letterSpacing: ".08em" }}>
                  {verse.reference} <span style={{ color: T.muted2 }}>· {verse.translation}</span>
                </span>
                <span style={{ fontFamily: T.reg, fontSize: 12, color: T.bronzeLt,
                  display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Train it in the Gym <ChevronRight size={14} />
                </span>
              </div>
            </>
          ) : (
            <p style={{ color: T.muted2, fontSize: 15, margin: 0 }}>
              {loaded ? "Verse unavailable right now." : "Loading today's verse…"}
            </p>
          )}
        </div>
      </Card>

      {/* ---- what's live in the Gym ---- */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "26px 0 12px" }}>
        <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".26em",
          textTransform: "uppercase", color: T.muted2 }}>In the gym</span>
        <span onClick={() => go("scripturegym")} style={{ fontFamily: T.reg, fontSize: 12,
          color: T.bronzeLt, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          See all <ChevronRight size={13} />
        </span>
      </div>

      {sessions.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map(m => (
            <Card key={m.id} pad={0} style={{ overflow: "hidden", cursor: "pointer" }}
              onClick={() => go("scripturegym")}>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ width: 6, background: T.gold, flex: "0 0 auto" }} />
                <div style={{ padding: "16px 18px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <span style={{ fontFamily: T.reg, fontSize: 9.5, fontWeight: 700, letterSpacing: ".16em",
                      textTransform: "uppercase", color: T.bronzeLt, border: `1px solid ${T.line}`,
                      borderRadius: 20, padding: "3px 9px" }}>{countdown(m.scheduled_at)}</span>
                  </div>
                  <div style={{ fontFamily: T.serif, fontSize: 17.5, color: T.cream, marginBottom: 5, lineHeight: 1.3 }}>
                    {m.title}
                  </div>
                  <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted }}>
                    {m.host?.full_name || m.host_name || "Kingdom"} · {when(m.scheduled_at, m.duration_minutes)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingRight: 16 }}>
                  <ChevronRight size={18} color={T.bronze} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card pad={22}>
          <div style={{ fontFamily: T.serif, fontSize: 18, color: T.cream, marginBottom: 6 }}>
            {loaded ? "Nothing on the calendar yet" : "Loading sessions…"}
          </div>
          {loaded && (
            <>
              <p style={{ fontFamily: T.body, fontSize: 14, color: T.muted, marginTop: 0 }}>
                Be the man who calls the first one. Set a time and put it in front of the brothers.
              </p>
              <Btn onClick={() => go("scripturegym")}><Dumbbell size={15} /> Start a workout</Btn>
            </>
          )}
        </Card>
      )}

      {/* ---- streak, kept quiet ---- */}
      <Card pad={18} style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 18 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%", border: `1px solid ${T.line}`,
          display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
          background: "radial-gradient(circle, rgba(255,106,60,.22), transparent 70%)",
        }}><Flame size={22} color={T.emberHot} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.display, fontSize: 23, color: T.cream, lineHeight: 1 }}>
            {streak} <span style={{ fontSize: 12.5, color: T.muted, fontFamily: T.reg }}>day streak</span>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted, marginTop: 4 }}>
            {streak > 0 ? "Keep the fire lit." : "Show up once and the fire starts."}
          </div>
        </div>
        {staff && <Btn kind="ghost" onClick={() => go("checkin")}><Video size={15} /> Check In</Btn>}
      </Card>

      {staff && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", marginTop: 18 }}>
          {Object.values(PROGRAMS).map(p => (
            <Card key={p.id} pad={20} style={{ cursor: "pointer" }}>
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
      )}
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
/* ===========================================================================
   RESOURCES — outside tools the men get through the Kingdom
   ========================================================================= */
const RIGHTNOW_JOIN = "https://app.rightnowmedia.org/en/join/GraceFamilyChurch";

function Resources() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Eyebrow>Resources</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 6px" }}>
        What's available to you
      </h2>
      <p style={{ fontFamily: T.body, color: T.muted, fontSize: 15, lineHeight: 1.6, marginTop: 0, marginBottom: 22, maxWidth: "62ch" }}>
        Tools and libraries the Kingdom has opened up for the men. Free to you — no card, no catch.
      </p>

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{
          padding: "26px 24px 22px",
          background: "linear-gradient(135deg, rgba(200,134,46,.10), transparent 70%)",
          borderBottom: `1px solid ${T.lineSoft}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 3, flex: "0 0 auto",
              border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(200,134,46,.10)",
            }}><LibraryBig size={21} color={T.bronzeLt} /></div>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 21, color: T.cream, lineHeight: 1.1 }}>
                RightNow Media
              </div>
              <div style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".18em",
                textTransform: "uppercase", color: T.bronze, marginTop: 4 }}>
                Sponsored by Grace Family Church
              </div>
            </div>
          </div>

          <p style={{ fontFamily: T.body, fontSize: 15, lineHeight: 1.65, color: T.cream, margin: "0 0 12px" }}>
            Think of it as the Netflix of Bible study — a streaming library of more than
            25,000 video studies you can watch on your phone, tablet, computer, or TV.
          </p>
          <p style={{ fontFamily: T.body, fontSize: 14.5, lineHeight: 1.65, color: T.muted, margin: 0 }}>
            Series on marriage, fatherhood, leadership, finances, and recovery, taught by
            voices like Tony Evans, Francis Chan, and John Maxwell — plus safe shows for the
            kids. Use it for your own morning time, or run a series with the men in your
            cohort. Downloads work offline, so it travels with you.
          </p>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".2em",
            textTransform: "uppercase", color: T.muted2, marginBottom: 10 }}>
            How to get in
          </div>
          <p style={{ fontFamily: T.body, fontSize: 14.5, lineHeight: 1.6, color: T.muted, margin: "0 0 18px" }}>
            RightNow Media isn't sold to individuals — you get it through a church.
            Grace Family Church covers this one, so it costs you nothing. Tap below,
            create your free account, and the whole library opens up.
          </p>

          <a
            href={RIGHTNOW_JOIN}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
              background: T.gold, color: "#1a1206", textDecoration: "none",
              fontFamily: T.reg, fontSize: 13, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase", padding: "15px 30px", borderRadius: 3,
              minHeight: 48, boxSizing: "border-box",
            }}
          >
            Claim your free access <ExternalLink size={15} />
          </a>

          <p style={{ fontFamily: T.body, fontSize: 12.5, lineHeight: 1.55, color: T.muted2, margin: "16px 0 0", wordBreak: "break-all" }}>
            Or paste this into your browser:{" "}
            <a href={RIGHTNOW_JOIN} target="_blank" rel="noopener noreferrer" style={{ color: T.bronze }}>
              {RIGHTNOW_JOIN}
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}

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
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    return isIOS && !isStandalone;
  });
  const [previewMember, setPreviewMember] = useState(false);

  const streak = profile?.streak ?? 0;
  const user = session?.user
    ? { id: session.user.id, email: session.user.email, name: profile?.full_name || session.user.email.split("@")[0] }
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

  // Public lanes. A shared session link has to work for a man who has never
  // heard of this app, so these render before the sign-in wall and never wait
  // on the auth handshake.
  const q = new URLSearchParams(window.location.search);
  const shareSlug = q.get("share");
  const joinSlug = q.get("join");
  if (shareSlug) return <PublicSharePage slug={shareSlug} />;
  if (joinSlug) return <JoinPage slug={joinSlug} />;

  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: T.obsidian, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Crest size={48} />
    </div>
  );
  if (!user) return <Login />;

  const isOwner = profile?.role === "owner";
  // Staff = Super Admin, not currently previewing as a member. Gates the two
  // programs and Daily Check-In as well as the Command section.
  const staff = isOwner && !previewMember;
  const STAFF_ONLY_VIEWS = ["p30", "p90", "checkin"];
  const titles = { dashboard: "The Forge", scripturegym: "Scripture Gym", p30: "30-Day Intensive", p90: "90-Day Curriculum", checkin: "Daily Check-In", profile: "Profile", resources: "Resources", path: "The Path", ...ADMIN_TITLES };

  const togglePreview = () => {
    setPreviewMember(p => {
      const next = !p;
      // Turning preview ON while sitting on an owner-only screen would be
      // confusing (nav hidden, but still viewing admin content) — bounce
      // back to a normal member screen instead.
      if (next && (view.startsWith("admin_") || view.startsWith("sys_") || view === "gideon" || view === "systems" || STAFF_ONLY_VIEWS.includes(view))) {
        setView("scripturegym");
      }
      return next;
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: T.obsidian, color: T.cream, fontFamily: T.body }}>
      {previewMember && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "9px 16px", background: T.bronze, borderBottom: `1px solid ${T.line}`,
        }}>
          <span style={{ fontFamily: T.reg, fontSize: 12.5, color: "#1a1206", fontWeight: 700, letterSpacing: ".03em" }}>
            👁 PREVIEWING AS MEMBER
          </span>
          <button onClick={togglePreview} style={{
            background: "rgba(10,9,7,.2)", border: "none", borderRadius: 3, color: "#1a1206",
            fontFamily: T.reg, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", cursor: "pointer",
          }}>Exit Preview</button>
        </div>
      )}

      {showInstallBanner && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "10px 16px", background: "rgba(200,134,46,.12)", borderBottom: `1px solid ${T.line}`,
        }}>
          <span style={{ fontFamily: T.body, fontSize: 12.5, color: T.cream }}>
            Add this to your Home Screen for the best experience — tap <b>Share</b>, then <b>Add to Home Screen</b>.
          </span>
          <button onClick={() => setShowInstallBanner(false)}
            style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      <SideMenu open={menu} onClose={() => setMenu(false)} go={setView} view={view} user={user}
        onLogout={logout} isOwner={isOwner} previewMember={previewMember} onTogglePreview={togglePreview} />

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
        <div
          onClick={() => { if (staff) setView("checkin"); }}
          style={{ marginLeft: "auto", color: T.emberHot, cursor: staff ? "pointer" : "default", display: "flex", alignItems: "center", gap: 5 }}
        >
          <Flame size={18} /><span style={{ fontFamily: T.reg, fontSize: 13 }}>{streak}</span>
        </div>
      </header>

      <main style={{ padding: "26px 18px 60px" }}>
        {view === "dashboard" && <Dashboard user={user} go={setView} streak={streak} progress={progress} staff={staff} />}
        {view === "scripturegym" && <ScriptureGymApp user={user} role={previewMember ? "member" : profile?.role} profile={profile} />}
        {staff && view === "p30" && <ProgramPage program={PROGRAMS.p30} go={setView} progress={progress} />}
        {staff && view === "p90" && <ProgramPage program={PROGRAMS.p90} go={setView} progress={progress} />}
        {staff && view === "checkin" && <CheckIn checkins={checkins} addCheckin={c => setCheckins(s => [c, ...s])} onStreak={bumpStreak} />}
        {!staff && STAFF_ONLY_VIEWS.includes(view) && (
          <div style={{ maxWidth: 520, margin: "40px auto 0", textAlign: "center" }}>
            <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 16 }}>Not yet opened. Hold the line.</p>
          </div>
        )}
        {view === "profile" && <Profile user={user} streak={streak} checkins={checkins} />}
        {view === "resources" && <Resources />}
        {view === "path" && <PathScreen />}

        {/* Owner Command + Systems (UI gate; RLS enforces at the DB regardless) */}
        {isOwner && !previewMember && (view.startsWith("admin_") || view === "gideon") && <AdminScreen view={view} profile={profile} />}
        {isOwner && !previewMember && (view === "systems" || view.startsWith("sys_")) && <SystemsScreen view={view} go={setView} />}
        {(!isOwner || previewMember) && (view.startsWith("admin_") || view.startsWith("sys_") || view === "gideon" || view === "systems") && (
          <div style={{ maxWidth: 520, margin: "40px auto 0", textAlign: "center" }}>
            <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 16 }}>This gate is for the owner alone.</p>
          </div>
        )}
      </main>
    </div>
  );
}
