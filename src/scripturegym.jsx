import React, { useState, useEffect, useCallback } from "react";
import { Dumbbell, Flame, ChevronRight, ChevronLeft, RefreshCw, AlertTriangle } from "lucide-react";
import { T, Eyebrow, Card, Btn } from "./ui";
import { fetchMuscleGroups, fetchStats } from "./scriptureGymData";

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

// Temporary stand-in for the real Muscle Group Detail screen (Step 5).
function GroupDetailStub({ group, onBack }) {
  return (
    <Wrap>
      <Head kicker="Scripture Gym" title={group.name} sub="Muscle Group Detail"
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />
      <Card pad={30} style={{ textAlign: "center" }}>
        <Dumbbell size={30} color={T.bronzeLt} style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.muted }}>
          Coming in Step 5
        </div>
        <p style={{ fontFamily: T.body, color: T.muted2, fontSize: 13.5, marginTop: 10, maxWidth: 380, marginInline: "auto", lineHeight: 1.55 }}>
          This is where the verses in "{group.name}" will show up with their status —
          Not Started, Learning, or Memorized — and where you'll pick which ones to train today.
        </p>
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

  if (selectedGroup) {
    return <GroupDetailStub group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
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
