import React, { useState, useEffect, useCallback } from "react";
import { Dumbbell, Flame, ChevronRight, ChevronLeft, RefreshCw, AlertTriangle, Check, Eye, EyeOff, Users, User as UserIcon, TrendingUp, BookOpen, ChevronDown, ChevronUp, Trash2, Trophy } from "lucide-react";
import { T, Eyebrow, Card, Btn, Field, inputBase } from "./ui";
import {
  fetchMuscleGroups, fetchGroupVerses, fetchStats,
  setVerseStatus, incrementQuizCount, logWorkoutSession, fetchMemberDirectory, fetchSessionHistory,
  fetchContent, createMuscleGroup, createVerse, setMergedView,
  fetchMyCohorts, createCohort, deleteCohort, fetchCohortMembers, addCohortMember, removeCohortMember,
  fetchBadges, MILESTONE_THRESHOLDS, STREAK_THRESHOLDS,
  fetchLeaderboard, setNickname,
  postToCohort, fetchCohortsForMember, fetchCohortFeed, toggleCheer,
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
  const [merged, setMerged] = useState(group.merged_view || false);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [draft, setDraft] = useState({ reference: "", verse_text: "" });
  const [addSaving, setAddSaving] = useState(false);
  const isPersonal = group.owner_type === "personal";

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

  const toggleMerge = async () => {
    const next = !merged;
    setMergeSaving(true);
    setMerged(next);
    await setMergedView(group.id, next);
    setMergeSaving(false);
  };

  const addVerse = async () => {
    if (!draft.reference.trim() || !draft.verse_text.trim()) return;
    setAddSaving(true);
    const { error } = await createVerse(group.id, user.id, draft.reference, draft.verse_text);
    setAddSaving(false);
    if (!error) { setDraft({ reference: "", verse_text: "" }); load(); }
  };

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title={group.name}
        sub={group.description || "Pick the verses you want to train today."}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      {isPersonal && (
        <Card pad={16} style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.cream, fontWeight: 600 }}>Show with Official Muscle Groups</div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 2 }}>
              Cosmetic only — still just yours, no one else ever sees this group.
            </div>
          </div>
          <Btn kind={merged ? "solid" : "ghost"} onClick={toggleMerge} disabled={mergeSaving}>
            {merged ? "Merged In" : "Keep Separate"}
          </Btn>
        </Card>
      )}

      {isPersonal && (
        <Card pad={16} style={{ marginBottom: 18 }}>
          <Field label="Reference" />
          <input style={inputBase} value={draft.reference}
            onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} placeholder="e.g. Joshua 1:9" />
          <div style={{ marginTop: 10 }}>
            <Field label="Verse Text" />
            <textarea rows={2} style={{ ...inputBase, resize: "vertical" }} value={draft.verse_text}
              onChange={e => setDraft(d => ({ ...d, verse_text: e.target.value }))} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn onClick={addVerse} disabled={addSaving}>{addSaving ? "Adding…" : "Add Verse"}</Btn>
          </div>
        </Card>
      )}

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

function ContentBody({ content }) {
  return (
    <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
      {content.body}
    </p>
  );
}

// Inline, collapsible — used inside an active Workout Session so opening it
// never loses the guy's in-progress verse selections or notes.
function TrainingWheelsInline() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!open && !content) {
      setLoading(true);
      const { data } = await fetchContent("training_wheels");
      setContent(data);
      setLoading(false);
    }
    setOpen(o => !o);
  };

  return (
    <Card pad={16} style={{ marginBottom: 18 }}>
      <div onClick={toggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <BookOpen size={16} color={T.bronzeLt} />
          <span style={{ fontFamily: T.body, fontSize: 13.5, color: T.cream, fontWeight: 600 }}>Training Wheels Method</span>
          <span style={{ fontFamily: T.body, fontSize: 11, color: T.muted2 }}>(optional)</span>
        </div>
        {open ? <ChevronUp size={16} color={T.muted2} /> : <ChevronDown size={16} color={T.muted2} />}
      </div>
      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}` }}>
          {loading ? <Loading /> : content ? <ContentBody content={content} /> : <Empty>Guide not set up yet.</Empty>}
        </div>
      )}
    </Card>
  );
}

// Standalone full page — reachable any time from the Gym Home header.
function TrainingWheelsPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await fetchContent("training_wheels");
      if (error) setErr(error.message); else setContent(data);
      setLoading(false);
    })();
  }, []);

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title={content?.title || "Training Wheels Method"}
        sub="Optional. Use it, adapt it, or make it your own."
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : content ? (
        <Card pad={26}><ContentBody content={content} /></Card>
      ) : <Empty>Guide not set up yet.</Empty>}
    </Wrap>
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

      <TrainingWheelsInline />

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
function SessionRow({ session }) {
  const date = new Date(session.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <Card pad={14} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: T.body, fontSize: 13.5, color: T.cream, fontWeight: 600 }}>{session.groupName}</div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 2 }}>
            {date} · {session.verseCount} verse{session.verseCount === 1 ? "" : "s"}
            {session.session_type === "paired"
              ? ` · with ${session.partnerName || "a brother"}`
              : " · solo"}
          </div>
        </div>
        {session.session_type === "paired"
          ? <Users size={15} color={T.muted2} />
          : <UserIcon size={15} color={T.muted2} />}
      </div>
    </Card>
  );
}

function BadgeMedal({ label, earned }) {
  return (
    <div style={{
      aspectRatio: "1", borderRadius: "50%",
      background: "radial-gradient(circle at 35% 30%, #2a2f36, #14161a 75%)",
      border: `2px solid ${earned ? T.bronze : T.line}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: T.display, fontSize: 13, color: earned ? T.bronzeLt : T.muted2,
      boxShadow: earned ? "0 0 14px rgba(200,134,46,.25)" : "none",
    }}>{label}</div>
  );
}

function ProgressScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState({ official: [], personal: [] });
  const [history, setHistory] = useState([]);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [statsRes, groupsRes, historyRes, badgesRes] = await Promise.all([
        fetchStats(user.id),
        fetchMuscleGroups(user.id),
        fetchSessionHistory(user.id, 20),
        fetchBadges(user.id),
      ]);
      if (statsRes.error || groupsRes.error || historyRes.error) {
        setErr((statsRes.error || groupsRes.error || historyRes.error).message);
      } else {
        setStats(statsRes.data);
        setGroups(groupsRes.data);
        setHistory(historyRes.data);
        setBadges(badgesRes.data || []);
        setErr(null);
      }
      setLoading(false);
    })();
  }, [user.id]);

  const earnedTypes = new Set(badges.map(b => b.badge_type));
  const allGroups = [...groups.official, ...groups.personal];

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="Progress" sub="Your lifetime record — a rep at a time."
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 26, flexWrap: "wrap" }}>
            <Card pad={20} style={{ flex: "1 1 140px", textAlign: "center" }}>
              <div style={{ fontFamily: T.display, fontSize: 30, color: T.bronzeLt, lineHeight: 1 }}>{stats?.total_memorized ?? 0}</div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 6 }}>Total Memorized</div>
            </Card>
            <Card pad={20} style={{ flex: "1 1 140px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Flame size={20} color={T.emberHot} />
                <span style={{ fontFamily: T.display, fontSize: 30, color: T.emberHot, lineHeight: 1 }}>{stats?.current_streak ?? 0}</span>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 6 }}>Current Streak</div>
            </Card>
            <Card pad={20} style={{ flex: "1 1 140px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <TrendingUp size={19} color={T.bronzeLt} />
                <span style={{ fontFamily: T.display, fontSize: 30, color: T.bronzeLt, lineHeight: 1 }}>{stats?.longest_streak ?? 0}</span>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 6 }}>Longest Streak</div>
            </Card>
          </div>

          {sectionLabel("Badges Earned")}
          <Card pad={18} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted2, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
              Verses Memorized
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
              {MILESTONE_THRESHOLDS.map(n => (
                <BadgeMedal key={`m-${n}`} label={n} earned={earnedTypes.has(`milestone_${n}`)} />
              ))}
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.muted2, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
              Day Streak
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {STREAK_THRESHOLDS.map(n => (
                <BadgeMedal key={`s-${n}`} label={`${n}d`} earned={earnedTypes.has(`streak_${n}`)} />
              ))}
            </div>
          </Card>

          {sectionLabel("By Muscle Group")}
          {allGroups.length === 0 ? <Empty>No muscle groups yet.</Empty> : allGroups.map(g => (
            <Card key={g.id} pad={14} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.body, fontSize: 13, color: T.cream, marginBottom: 6 }}>
                <span>{g.name}</span>
                <span style={{ color: T.muted2, fontSize: 12 }}>{g.memorizedCount} / {g.verseCount}</span>
              </div>
              <ProgressBar value={g.memorizedCount} max={g.verseCount} />
            </Card>
          ))}

          <div style={{ marginTop: 22 }}>{sectionLabel("Recent Sessions")}</div>
          {history.length === 0
            ? <Empty>No workout sessions logged yet — finish one from a muscle group to see it here.</Empty>
            : history.map(s => <SessionRow key={s.id} session={s} />)}
        </>
      )}
    </Wrap>
  );
}
function badgeLabel(badgeType) {
  const [kind, n] = badgeType.split("_");
  if (kind === "milestone") return `just crossed ${n} verses memorized`;
  if (kind === "streak") return `hit a ${n}-day streak`;
  return badgeType;
}

function FeedItem({ event, user, onCheerToggle }) {
  const myCheer = event.cheers.find(c => c.user_id === user.id);
  return (
    <Card pad={14} style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: T.body, fontSize: 13, color: T.cream, lineHeight: 1.5 }}>
        {event.event_type === "leader_post"
          ? <><b>{event.authorName}</b>: "{event.payload.message}"</>
          : <>🎉 <b>{event.authorName}</b> {badgeLabel(event.payload.badge_type)}</>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button onClick={() => onCheerToggle(event.id)} style={{
          background: myCheer ? "rgba(200,134,46,.18)" : "transparent",
          border: `1px solid ${myCheer ? T.bronze : T.line}`,
          borderRadius: 100, padding: "4px 11px", cursor: "pointer",
          fontFamily: T.body, fontSize: 12, color: myCheer ? T.bronzeLt : T.muted2,
        }}>🔥 {event.cheers.length || ""}</button>
        <span style={{ fontFamily: T.body, fontSize: 11, color: T.muted2 }}>
          {new Date(event.created_at).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}

function CohortFeed({ cohortId, user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchCohortFeed(cohortId);
    setEvents(data || []);
    setLoading(false);
  }, [cohortId]);

  useEffect(() => { load(); }, [load]);

  const cheer = async (eventId) => {
    await toggleCheer(eventId, cohortId, user.id);
    load();
  };

  if (loading) return <Loading />;
  if (events.length === 0) return <Empty>No activity in this cohort yet.</Empty>;
  return <div>{events.map(e => <FeedItem key={e.id} event={e} user={user} onCheerToggle={cheer} />)}</div>;
}

function MyCohortFeedsScreen({ user, onBack }) {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchCohortsForMember(user.id).then(({ data }) => { setCohorts(data || []); setLoading(false); });
  }, [user.id]);

  if (selected) {
    return (
      <Wrap>
        <Head kicker="Scripture Gym" title={selected.name} sub="Cohort activity"
          right={<Btn kind="ghost" onClick={() => setSelected(null)}><ChevronLeft size={14} /> Back</Btn>} />
        <CohortFeed cohortId={selected.id} user={user} />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="My Groups" sub="Cohorts you belong to."
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />
      {loading ? <Loading /> : cohorts.length === 0 ? <Empty>You're not part of a cohort yet — ask a leader to add you.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {cohorts.map(c => (
            <Card key={c.id} pad={16} onClick={() => setSelected(c)} style={{ cursor: "pointer" }}>
              <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, fontWeight: 600 }}>{c.name}</div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

function CohortDetail({ cohort, user, onBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [addingId, setAddingId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchCohortMembers(cohort.id);
    if (error) setErr(error.message); else { setMembers(data); setErr(null); }
    setLoading(false);
  }, [cohort.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchMemberDirectory().then(({ data }) => { if (data) setDirectory(data); }); }, []);

  const addMember = async () => {
    if (!addingId) return;
    setSaving(true);
    await addCohortMember(cohort.id, addingId);
    setSaving(false);
    setAddingId("");
    load();
  };

  const removeMember = async (userId) => {
    await removeCohortMember(cohort.id, userId);
    load();
  };

  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [feedKey, setFeedKey] = useState(0);

  const post = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    await postToCohort(user.id, cohort.id, postText.trim());
    setPosting(false);
    setPostText("");
    setFeedKey(k => k + 1);
  };

  const availableToAdd = directory.filter(d => !members.some(m => m.userId === d.id));

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title={cohort.name} sub={`${members.length} member${members.length === 1 ? "" : "s"}`}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back to Cohorts</Btn>} />

      <Card pad={16} style={{ marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={addingId} onChange={e => setAddingId(e.target.value)} style={{ ...inputBase, flex: "1 1 200px" }}>
          <option value="">Add a member…</option>
          {availableToAdd.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
        </select>
        <Btn onClick={addMember} disabled={saving || !addingId}>{saving ? "Adding…" : "+ Add"}</Btn>
      </Card>

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : members.length === 0 ? <Empty>No members yet — add one above.</Empty> : (
        <div style={{ display: "grid", gap: 8 }}>
          {members.map(m => (
            <Card key={m.userId} pad={14} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: T.body, fontSize: 13.5, color: T.cream }}>{m.displayName}</span>
              <button onClick={() => removeMember(m.userId)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={14} /></button>
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 26 }}>{sectionLabel("Post an Encouragement")}</div>
      <Card pad={16} style={{ marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputBase, flex: "1 1 220px" }} value={postText}
          onChange={e => setPostText(e.target.value)} placeholder="Great push this week, gents…" />
        <Btn onClick={post} disabled={posting}>{posting ? "Posting…" : "Post"}</Btn>
      </Card>

      {sectionLabel("Activity")}
      <CohortFeed key={feedKey} cohortId={cohort.id} user={user} />
    </Wrap>
  );
}

function CohortsScreen({ user, onBack }) {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchMyCohorts(user.id);
    if (error) setErr(error.message); else { setCohorts(data); setErr(null); }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const addCohort = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await createCohort(user.id, newName);
    setSaving(false);
    if (!error) { setNewName(""); load(); }
  };

  const removeCohort = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? This removes all its members too.`)) return;
    await deleteCohort(c.id);
    load();
  };

  if (selected) {
    return <CohortDetail cohort={selected} user={user} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="My Cohorts" sub="Groups you lead — guys can belong to more than one."
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      <Card pad={16} style={{ marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputBase, flex: "1 1 200px" }} value={newName}
          onChange={e => setNewName(e.target.value)} placeholder="e.g. Tuesday Night Group" />
        <Btn onClick={addCohort} disabled={saving}>{saving ? "Adding…" : "+ New Cohort"}</Btn>
      </Card>

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : cohorts.length === 0 ? <Empty>You haven't created a cohort yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {cohorts.map(c => (
            <Card key={c.id} pad={16} onClick={() => setSelected(c)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontFamily: T.body, fontSize: 12, color: T.muted2, marginTop: 2 }}>
                  {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={(e) => { e.stopPropagation(); removeCohort(c); }}
                  style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={15} /></button>
                <ChevronRight size={16} color={T.muted2} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

function LeaderboardScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNick, setSavingNick] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [lbRes, statsRes] = await Promise.all([fetchLeaderboard(100), fetchStats(user.id)]);
    if (lbRes.error) setErr(lbRes.error.message); else { setRows(lbRes.data); setErr(null); }
    if (statsRes.data) setNicknameInput(statsRes.data.nickname || "");
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const saveNickname = async () => {
    setSavingNick(true);
    await setNickname(user.id, nicknameInput.trim() || null);
    setSavingNick(false);
    load();
  };

  return (
    <Wrap>
      <Head kicker="Scripture Gym" title="Leaderboard" sub="Top 100 — total verses memorized."
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back</Btn>} />

      <Card pad={16} style={{ marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px" }}>
          <Field label="Your Display Name (optional nickname for privacy)" />
          <input style={inputBase} value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
            placeholder="Leave blank to use your real name" />
        </div>
        <Btn onClick={saveNickname} disabled={savingNick}>{savingNick ? "Saving…" : "Save"}</Btn>
      </Card>

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>Nobody's memorized a verse yet — be the first!</Empty> : (
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map(r => {
            const isMe = r.userId === user.id;
            return (
              <Card key={r.userId} pad={13} style={{
                display: "flex", alignItems: "center", gap: 12,
                border: isMe ? `1px solid ${T.bronze}` : undefined,
                background: isMe ? "linear-gradient(90deg, rgba(200,134,46,.12), transparent)" : undefined,
              }}>
                <span style={{ fontFamily: T.display, fontSize: 16, color: r.rank <= 3 ? T.bronzeLt : T.muted2, width: 30, flexShrink: 0 }}>
                  {r.rank}
                </span>
                <span style={{ fontFamily: T.body, fontSize: 13.5, color: T.cream, flex: 1, fontWeight: isMe ? 700 : 400 }}>
                  {r.displayName}{isMe ? " (you)" : ""}
                </span>
                <span style={{ fontFamily: T.reg, fontSize: 13, color: T.bronzeLt }}>{r.total}</span>
              </Card>
            );
          })}
        </div>
      )}
    </Wrap>
  );
}

export function ScriptureGymApp({ user, role }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [groups, setGroups] = useState({ official: [], personal: [] });
  const [stats, setStats] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [workoutVerses, setWorkoutVerses] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showTrainingWheels, setShowTrainingWheels] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [showCohorts, setShowCohorts] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMyGroups, setShowMyGroups] = useState(false);
  const isLeader = role === "owner" || role === "admin" || role === "cohort_leader";

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

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    const { error } = await createMuscleGroup(user.id, newGroupName);
    setAddingGroup(false);
    if (!error) { setNewGroupName(""); load(); }
  };

  if (showProgress) {
    return <ProgressScreen user={user} onBack={() => setShowProgress(false)} />;
  }

  if (showTrainingWheels) {
    return <TrainingWheelsPage onBack={() => setShowTrainingWheels(false)} />;
  }

  if (showCohorts) {
    return <CohortsScreen user={user} onBack={() => setShowCohorts(false)} />;
  }

  if (showLeaderboard) {
    return <LeaderboardScreen user={user} onBack={() => setShowLeaderboard(false)} />;
  }

  if (showMyGroups) {
    return <MyCohortFeedsScreen user={user} onBack={() => setShowMyGroups(false)} />;
  }

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
        onBack={() => { setSelectedGroup(null); load(); }}
        onStartWorkout={setWorkoutVerses}
      />
    );
  }

  return (
    <Wrap>
      <Head kicker="The Gym" title="Scripture Gym"
        sub="Train the Word like iron. A place to build, drill, and strengthen scripture memory for the men."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isLeader && <Btn kind="ghost" onClick={() => setShowCohorts(true)}><Users size={14} /> My Cohorts</Btn>}
            <Btn kind="ghost" onClick={() => setShowMyGroups(true)}><Users size={14} /> My Groups</Btn>
            <Btn kind="ghost" onClick={() => setShowLeaderboard(true)}><Trophy size={14} /> Leaderboard</Btn>
            <Btn kind="ghost" onClick={() => setShowTrainingWheels(true)}><BookOpen size={14} /> Training Wheels</Btn>
            <Btn kind="ghost" onClick={() => setShowProgress(true)}><TrendingUp size={14} /> Progress</Btn>
            <Btn kind="ghost" onClick={load}><RefreshCw size={14} /> Refresh</Btn>
          </div>
        } />

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
          <Card pad={14} style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...inputBase, flex: "1 1 200px" }} value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)} placeholder="Name your own muscle group…" />
            <Btn onClick={addGroup} disabled={addingGroup}>{addingGroup ? "Adding…" : "+ Add"}</Btn>
          </Card>
          {groups.personal.length === 0
            ? <Empty>You haven't built your own muscle group yet — add one above.</Empty>
            : groups.personal.map(g => <GroupRow key={g.id} group={g} onClick={setSelectedGroup} />)}
        </>
      )}
    </Wrap>
  );
}
