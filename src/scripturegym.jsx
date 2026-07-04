import React, { useState, useEffect, useCallback } from "react";
import { Dumbbell, Flame, ChevronRight, ChevronLeft, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { T, Eyebrow, Card, Btn } from "./ui";
import { fetchMuscleGroups, fetchGroupVerses, fetchStats } from "./scriptureGymData";

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

// Temporary stand-in for the real Workout Session screen (Step 6).
function WorkoutStub({ verses, onBack }) {
  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="Workout Session"
        sub={`${verses.length} verse${verses.length === 1 ? "" : "s"} selected`}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />
      <Card pad={30} style={{ textAlign: "center" }}>
        <Dumbbell size={30} color={T.bronzeLt} style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.muted }}>
          Coming in Step 6
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 8, textAlign: "left", maxWidth: 360, marginInline: "auto" }}>
          {verses.map(v => (
            <div key={v.id} style={{ fontFamily: T.body, fontSize: 13, color: T.cream }}>• {v.reference}</div>
          ))}
        </div>
      </Card>
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
    return <WorkoutStub verses={workoutVerses} onBack={() => setWorkoutVerses(null)} />;
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
