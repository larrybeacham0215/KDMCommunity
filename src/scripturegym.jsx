import React, { useState, useEffect, useCallback } from "react";
import { Dumbbell, Flame, ChevronRight, ChevronLeft, RefreshCw, AlertTriangle, Check, Eye, EyeOff, Users, User as UserIcon } from "lucide-react";
import { T, Eyebrow, Card, Btn, Field, inputBase } from "./ui";
import {
  fetchMuscleGroups, fetchGroupVerses, fetchStats,
  setVerseStatus, incrementQuizCount, logWorkoutSession, fetchMemberDirectory,
} from "./scriptureGymData";

/* ===========================================================================
   Local layout helpers — mirrors admin.jsx's Wrap/Head/Loading/Empty/ErrBox
   exactly, kept local so this module has no dependency on admin.jsx.
   ========================================================================= */
const Wrap = ({ children }) => <div style={{ maxWidth: 820, margin: "0 auto" }}>{children}</div>;

const Head = ({ kicker, title, sub, right }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
    <div>
      <Eyebrow>{kicker}</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 28, color: T.cream, margin: "9px 0 2px" }}>{title}</h2>
      {sub && <p style={{ fontFamily: T.body, color: T.muted, fontSize: 13.5, lineHeight: 1.5 }}>{sub}</p>}
    </div>
    {right}
  </div>
);

const Empty = ({ children }) => (
  <Card pad={26} style={{ textAlign: "center" }}>
    <p style={{ fontFamily: T.body, color: T.muted2, fontSize: 13.5 }}>{children}</p>
  </Card>
);

const Loading = () => (
  <Card pad={26} style={{ textAlign: "center" }}>
    <RefreshCw size={18} color={T.muted2} style={{ animation: "kpulse 1.2s infinite" }} />
  </Card>
);

const ErrBox = ({ msg }) => (
  <Card pad={16} style={{ borderColor: "rgba(212,80,43,.4)", marginBottom: 14 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <AlertTriangle size={16} color={T.emberHot} />
      <span style={{ fontFamily: T.body, fontSize: 13, color: T.emberLt }}>{msg}</span>
    </div>
  </Card>
);

const sectionLabel = (txt) => (
  <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.bronze, marginBottom: 10 }}>
    {txt}
  </div>
);

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(216,168,92,.12)", overflow: "hidden", marginTop: 8 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: T.gold, borderRadius: 3, transition: "width .3s" }} />
    </div>
  );
}

function GroupRow({ group, onClick }) {
  return (
    <Card pad={16} style={{ cursor: "pointer", marginBottom: 10 }} onClick={() => onClick(group)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, fontWeight: 600 }}>{group.name}</div>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.muted2, marginTop: 2 }}>
            {group.memorizedCount} / {group.verseCount} memorized
          </div>
          <ProgressBar value={group.memorizedCount} max={group.verseCount} />
        </div>
        <ChevronRight size={16} color={T.muted2} style={{ flexShrink: 0 }} />
      </div>
    </Card>
  );
}

function StatusPill({ status }) {
  const cfg = {
    memorized: { label: "Memorized", bg: "rgba(91,138,91,.18)", color: "#8fc48f", border: "rgba(91,138,91,.4)" },
    learning: { label: "Learning", bg: "rgba(200,134,46,.15)", color: T.bronzeLt, border: T.line },
    not_started: { label: "Not Started", bg: "rgba(255,255,255,.04)", color: T.muted2, border: T.lineSoft },
  }[status] || { label: status, bg: "transparent", color: T.muted2, border: T.lineSoft };
  return (
    <span style={{
      fontFamily: T.reg, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700,
      padding: "3px 9px", borderRadius: 100, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

function VerseRow({ verse, selected, onToggle }) {
  const lastTrained = verse.lastPracticedAt
    ? `Last trained ${new Date(verse.lastPracticedAt).toLocaleDateString()}`
    : "Never trained";
  return (
    <Card pad={16} onClick={() => onToggle(verse.id)} style={{
      cursor: "pointer", marginBottom: 10,
      border: `1px solid ${selected ? T.bronze : T.line}`,
      background: selected ? `linear-gradient(180deg, rgba(200,134,46,.10), ${T.obsidian2})` : undefined,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.body, fontSize: 14, color: T.cream, fontWeight: 700 }}>{verse.reference}</span>
            <StatusPill status={verse.status} />
          </div>
          <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 13.5, color: T.muted, lineHeight: 1.5, margin: "8px 0 6px" }}>
            "{verse.verse_text}"
          </p>
          <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted2 }}>{lastTrained}</div>
        </div>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          border: `2px solid ${selected ? T.bronze : T.line}`,
          background: selected ? T.gold : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <Check size={13} color="#1a1206" strokeWidth={3} />}
        </div>
      </div>
    </Card>
  );
}

function MuscleGroupDetail({ group, user, onBack, onStartWorkout }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [verses, setVerses] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchGroupVerses(group.id, user.id);
    if (error) setErr(error.message); else { setVerses(data); setErr(null); }
    setLoading(false);
  }, [group.id, user.id]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title={group.name}
        sub={group.description || "Pick the verses you want to train today."}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : verses.length === 0 ? <Empty>No verses in this muscle group yet.</Empty> : (
        <>
          {verses.map(v => (
            <VerseRow key={v.id} verse={v} selected={selected.has(v.id)} onToggle={toggle} />
          ))}
          <div style={{ marginTop: 16 }}>
            <Btn full disabled={selected.size === 0}
              onClick={() => onStartWorkout(verses.filter(v => selected.has(v.id)))}>
              <Dumbbell size={14} /> Start Workout{selected.size > 0 ? ` (${selected.size} selected)` : ""}
            </Btn>
          </div>
        </>
      )}
    </Wrap>
  );
}

function maskText(text) {
  return text.split(" ").map((w, i) => {
    if (w.length <= 2 || i % 4 === 0) return w; // leave short words + anchor points visible
    return w.replace(/[A-Za-z]/g, "_");
  }).join(" ");
}

function WorkoutVerseCard({ verse, userId, onStatusChange }) {
  const [status, setStatus] = useState(verse.status);
  const [quizzing, setQuizzing] = useState(false);
  const [busy, setBusy] = useState(false);

  const mark = async (newStatus) => {
    setBusy(true);
    const { error } = await setVerseStatus(userId, verse.id, newStatus);
    setBusy(false);
    if (!error) { setStatus(newStatus); onStatusChange(verse.id, newStatus); }
  };

  const toggleQuiz = async () => {
    const next = !quizzing;
    setQuizzing(next);
    if (next) await incrementQuizCount(userId, verse.id);
  };

  return (
    <Card pad={20} style={{ marginBottom: 14, border: `1px solid ${T.bronze}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: T.display, fontSize: 17, color: T.bronzeLt, letterSpacing: ".01em", textTransform: "uppercase" }}>
          {verse.reference}
        </span>
        <StatusPill status={status} />
      </div>
      <p style={{
        fontFamily: T.serif, fontStyle: "italic", fontSize: 15, color: quizzing ? T.muted2 : T.cream,
        lineHeight: 1.6, margin: "0 0 14px", borderLeft: `2px solid ${T.line}`, paddingLeft: 14,
      }}>
        "{quizzing ? maskText(verse.verse_text) : verse.verse_text}"
      </p>
      <div style={{ marginBottom: 12 }}>
        <Btn kind="ghost" onClick={toggleQuiz}>
          {quizzing ? <><Eye size={13} /> Reveal</> : <><EyeOff size={13} /> Quiz Me</>}
        </Btn>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Btn kind={status === "learning" ? "solid" : "ghost"} disabled={busy} onClick={() => mark("learning")} full>
            Still Learning
          </Btn>
        </div>
        <div style={{ flex: 1 }}>
          <Btn kind={status === "memorized" ? "solid" : "ghost"} disabled={busy} onClick={() => mark("memorized")} full>
            <Check size={13} /> Mark Memorized
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function WorkoutSession({ group, verses, user, onBack, onFinish }) {
  const [sessionType, setSessionType] = useState("solo");
  const [partnerId, setPartnerId] = useState("");
  const [members, setMembers] = useState([]);
  const [verseStates, setVerseStates] = useState(() => Object.fromEntries(verses.map(v => [v.id, v.status])));
  const [notes, setNotes] = useState("");
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (sessionType === "paired" && members.length === 0) {
      fetchMemberDirectory(user.id).then(({ data }) => { if (data) setMembers(data); });
    }
  }, [sessionType, members.length, user.id]);

  const handleStatusChange = (verseId, status) => setVerseStates(s => ({ ...s, [verseId]: status }));

  const finish = async () => {
    setFinishing(true);
    await logWorkoutSession({
      userId: user.id,
      muscleGroupId: group.id,
      verseIds: verses.map(v => v.id),
      sessionType,
      partnerUserId: sessionType === "paired" && partnerId ? partnerId : null,
      notes,
    });
    setFinishing(false);
    onFinish();
  };

  const memorizedCount = Object.values(verseStates).filter(s => s === "memorized").length;

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="Workout Session" sub={group.name}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      <Card pad={18} style={{ marginBottom: 18 }}>
        <Field label="Training With" />
        <div style={{ display: "flex", gap: 10, marginBottom: sessionType === "paired" ? 14 : 0 }}>
          <div style={{ flex: 1 }}>
            <Btn kind={sessionType === "solo" ? "solid" : "ghost"} full onClick={() => setSessionType("solo")}>
              <UserIcon size={14} /> Solo
            </Btn>
          </div>
          <div style={{ flex: 1 }}>
            <Btn kind={sessionType === "paired" ? "solid" : "ghost"} full onClick={() => setSessionType("paired")}>
              <Users size={14} /> Paired
            </Btn>
          </div>
        </div>
        {sessionType === "paired" && (
          <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={inputBase}>
            <option value="">Select a partner (optional)</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        )}
      </Card>

      {verses.map(v => (
        <WorkoutVerseCard key={v.id} verse={v} userId={user.id} onStatusChange={handleStatusChange} />
      ))}

      <Card pad={18} style={{ marginTop: 4, marginBottom: 18 }}>
        <Field label="Notes (optional)" />
        <textarea rows={3} style={{ ...inputBase, resize: "vertical" }} value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="How did it go?" />
      </Card>

      <Btn full onClick={finish} disabled={finishing}>
        <Flame size={14} /> {finishing ? "Saving…" : `Finish Workout${memorizedCount ? ` — ${memorizedCount} memorized` : ""}`}
      </Btn>
    </Wrap>
  );
}

/* ===========================================================================
   SCRIPTURE GYM — member-facing entry point
   ========================================================================= */
export function ScriptureGymApp({ user }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [groups, setGroups] = useState({ official: [], personal: [] });
  const [stats, setStats] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [workoutVerses, setWorkoutVerses] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [groupsRes, statsRes] = await Promise.all([
      fetchMuscleGroups(user.id),
      fetchStats(user.id),
    ]);
    if (groupsRes.error || statsRes.error) {
      setErr((groupsRes.error || statsRes.error).message);
    } else {
      setGroups(groupsRes.data);
      setStats(statsRes.data);
      setErr(null);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  if (selectedGroup && workoutVerses) {
    return (
      <WorkoutSession
        group={selectedGroup}
        verses={workoutVerses}
        user={user}
        onBack={() => setWorkoutVerses(null)}
        onFinish={() => { setWorkoutVerses(null); setSelectedGroup(null); load(); }}
      />
    );
  }

  if (selectedGroup) {
    return (
      <MuscleGroupDetail
        group={selectedGroup}
        user={user}
        onBack={() => setSelectedGroup(null)}
        onStartWorkout={setWorkoutVerses}
      />
    );
  }

  return (
    <Wrap>
      <Head kicker="The Gym" title="Scripture Gym"
        sub="Train the Word like iron. A place to build, drill, and strengthen scripture memory for the men."
        right={<Btn kind="ghost" onClick={load}><RefreshCw size={14} /> Refresh</Btn>} />

      {err && <ErrBox msg={err} />}

      {loading ? <Loading /> : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 26, flexWrap: "wrap" }}>
            <Card pad={20} style={{ flex: "1 1 160px", textAlign: "center" }}>
              <div style={{ fontFamily: T.display, fontSize: 32, color: T.bronzeLt, lineHeight: 1 }}>
                {stats?.total_memorized ?? 0}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 6 }}>
                Verses Memorized
              </div>
            </Card>
            <Card pad={20} style={{ flex: "1 1 160px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Flame size={22} color={T.emberHot} />
                <span style={{ fontFamily: T.display, fontSize: 32, color: T.emberHot, lineHeight: 1 }}>
                  {stats?.current_streak ?? 0}
                </span>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 6 }}>
                Day Streak
              </div>
            </Card>
          </div>

          {sectionLabel("Official Muscle Groups")}
          {groups.official.length === 0
            ? <Empty>No official muscle groups yet.</Empty>
            : groups.official.map(g => <GroupRow key={g.id} group={g} onClick={setSelectedGroup} />)}

          <div style={{ marginTop: 22 }}>{sectionLabel("My Muscle Groups")}</div>
          {groups.personal.length === 0
            ? <Empty>You haven't built your own muscle group yet. That's coming in Step 11.</Empty>
            : groups.personal.map(g => <GroupRow key={g.id} group={g} onClick={setSelectedGroup} />)}
        </>
      )}
    </Wrap>
  );
}
