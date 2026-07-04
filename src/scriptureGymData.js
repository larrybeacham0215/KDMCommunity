import { supabase } from "./dataService";

/* ============================================================================
   SCRIPTURE GYM — DATA LAYER
   Every Scripture Gym screen calls through these helpers rather than hitting
   supabase directly, so the query/aggregation logic (progress counts, streaks,
   the tally) lives in exactly one place.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   MUSCLE GROUPS
   ------------------------------------------------------------------------- */

// Official + this user's personal groups, each annotated with verse count
// and how many of those verses this user has marked memorized.
export async function fetchMuscleGroups(userId) {
  const { data: groups, error } = await supabase
    .from("muscle_groups")
    .select("id, name, description, owner_type, display_order, created_by, merged_view")
    .order("display_order", { ascending: true });
  if (error) return { data: null, error };

  const { data: verseRows, error: vErr } = await supabase
    .from("verses")
    .select("id, muscle_group_id");
  if (vErr) return { data: null, error: vErr };

  const { data: progressRows, error: pErr } = await supabase
    .from("user_verse_progress")
    .select("verse_id, status")
    .eq("user_id", userId)
    .eq("status", "memorized");
  if (pErr) return { data: null, error: pErr };

  const memorizedVerseIds = new Set((progressRows || []).map(r => r.verse_id));
  const countsByGroup = {};
  for (const v of verseRows || []) {
    const c = (countsByGroup[v.muscle_group_id] ||= { total: 0, memorized: 0 });
    c.total += 1;
    if (memorizedVerseIds.has(v.id)) c.memorized += 1;
  }

  const enriched = (groups || []).map(g => ({
    ...g,
    verseCount: countsByGroup[g.id]?.total ?? 0,
    memorizedCount: countsByGroup[g.id]?.memorized ?? 0,
  }));

  const myPersonal = enriched.filter(g => g.owner_type === "personal" && g.created_by === userId);

  return {
    data: {
      // Official groups + this user's personal groups he's chosen to merge in
      official: [
        ...enriched.filter(g => g.owner_type === "official"),
        ...myPersonal.filter(g => g.merged_view),
      ],
      personal: myPersonal.filter(g => !g.merged_view),
    },
    error: null,
  };
}

export async function setMergedView(groupId, mergedView) {
  return supabase.from("muscle_groups").update({ merged_view: mergedView }).eq("id", groupId);
}

export async function createMuscleGroup(userId, name, description = "") {
  return supabase
    .from("muscle_groups")
    .insert({ name, description, owner_type: "personal", created_by: userId })
    .select()
    .single();
}

/* ---------------------------------------------------------------------------
   VERSES  (within a muscle group, with this user's progress joined in)
   ------------------------------------------------------------------------- */

export async function fetchGroupVerses(groupId, userId) {
  const { data: verses, error } = await supabase
    .from("verses")
    .select("id, reference, verse_text, translation, display_order")
    .eq("muscle_group_id", groupId)
    .order("display_order", { ascending: true });
  if (error) return { data: null, error };

  const { data: progress, error: pErr } = await supabase
    .from("user_verse_progress")
    .select("verse_id, status, times_quizzed, last_practiced_at, date_memorized")
    .eq("user_id", userId)
    .in("verse_id", (verses || []).map(v => v.id));
  if (pErr) return { data: null, error: pErr };

  const progressByVerse = Object.fromEntries((progress || []).map(p => [p.verse_id, p]));

  const merged = (verses || []).map(v => ({
    ...v,
    status: progressByVerse[v.id]?.status || "not_started",
    timesQuizzed: progressByVerse[v.id]?.times_quizzed || 0,
    lastPracticedAt: progressByVerse[v.id]?.last_practiced_at || null,
    dateMemorized: progressByVerse[v.id]?.date_memorized || null,
  }));

  return { data: merged, error: null };
}

export async function createVerse(muscleGroupId, userId, reference, verseText, translation = "BSB") {
  return supabase
    .from("verses")
    .insert({ muscle_group_id: muscleGroupId, reference, verse_text: verseText, translation, created_by: userId })
    .select()
    .single();
}

/* ---------------------------------------------------------------------------
   PROGRESS  (Still Learning / Mark Memorized / demote)
   ------------------------------------------------------------------------- */

export async function setVerseStatus(userId, verseId, status) {
  const patch = {
    user_id: userId,
    verse_id: verseId,
    status,
    last_practiced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "memorized") patch.date_memorized = new Date().toISOString();

  const { error } = await supabase
    .from("user_verse_progress")
    .upsert(patch, { onConflict: "user_id,verse_id" });
  if (error) return { error };

  const result = await recalcTotalMemorized(userId);
  await checkAndAwardBadges(userId);
  return result;
}

export async function incrementQuizCount(userId, verseId) {
  const { data: existing } = await supabase
    .from("user_verse_progress")
    .select("times_quizzed")
    .eq("user_id", userId)
    .eq("verse_id", verseId)
    .maybeSingle();

  return supabase.from("user_verse_progress").upsert({
    user_id: userId,
    verse_id: verseId,
    status: existing?.status || "learning",
    times_quizzed: (existing?.times_quizzed || 0) + 1,
    last_practiced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,verse_id" });
}

/* ---------------------------------------------------------------------------
   STATS  (lifetime tally + streak)
   ------------------------------------------------------------------------- */

export async function fetchStats(userId) {
  const { data, error } = await supabase
    .from("scripture_gym_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { data: null, error };
  return {
    data: data || { user_id: userId, current_streak: 0, longest_streak: 0, total_memorized: 0, last_session_date: null, nickname: null },
    error: null,
  };
}

async function recalcTotalMemorized(userId) {
  const { count, error } = await supabase
    .from("user_verse_progress")
    .select("verse_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "memorized");
  if (error) return { error };

  const { error: upErr } = await supabase
    .from("scripture_gym_stats")
    .upsert({ user_id: userId, total_memorized: count || 0, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { error: upErr || null, total: count || 0 };
}

// Streak is tied to logging an actual workout session (not just opening the
// app or updating a verse) — one session per calendar day advances it.
async function bumpStreakForSession(userId) {
  const { data: stats } = await supabase
    .from("scripture_gym_stats")
    .select("current_streak, longest_streak, last_session_date")
    .eq("user_id", userId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const last = stats?.last_session_date || null;

  let nextStreak = 1;
  if (last === today) {
    nextStreak = stats.current_streak || 1; // already trained today, no change
  } else if (last) {
    const dayMs = 24 * 60 * 60 * 1000;
    const gap = Math.round((new Date(today) - new Date(last)) / dayMs);
    nextStreak = gap === 1 ? (stats.current_streak || 0) + 1 : 1;
  }
  const nextLongest = Math.max(nextStreak, stats?.longest_streak || 0);

  return supabase.from("scripture_gym_stats").upsert({
    user_id: userId,
    current_streak: nextStreak,
    longest_streak: nextLongest,
    last_session_date: today,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

/* ---------------------------------------------------------------------------
   WORKOUT SESSIONS
   ------------------------------------------------------------------------- */

export async function logWorkoutSession({ userId, muscleGroupId, verseIds, sessionType = "solo", partnerUserId = null, notes = "" }) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      muscle_group_id: muscleGroupId,
      verse_ids: verseIds,
      session_type: sessionType,
      partner_user_id: partnerUserId,
      notes,
    })
    .select()
    .single();
  if (error) return { data: null, error };

  await bumpStreakForSession(userId);
  await checkAndAwardBadges(userId);
  return { data, error: null };
}

/* ---------------------------------------------------------------------------
   LEADERBOARD  (Top 100 — total verses memorized, RLS only exposes rows
   where total_memorized > 0)
   ------------------------------------------------------------------------- */

export async function fetchLeaderboard(limit = 100) {
  const { data: statRows, error } = await supabase
    .from("scripture_gym_stats")
    .select("user_id, total_memorized, nickname")
    .order("total_memorized", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error };

  const ids = (statRows || []).map(r => r.user_id);
  if (ids.length === 0) return { data: [], error: null };

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (profErr) return { data: null, error: profErr };

  const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  const ranked = statRows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    total: r.total_memorized,
    displayName: r.nickname || profileById[r.user_id]?.full_name || profileById[r.user_id]?.email?.split("@")[0] || "A brother",
  }));

  return { data: ranked, error: null };
}

export async function setNickname(userId, nickname) {
  return supabase
    .from("scripture_gym_stats")
    .upsert({ user_id: userId, nickname, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

/* ---------------------------------------------------------------------------
   COHORTS  (leader-managed groups; a guy can belong to more than one)
   ------------------------------------------------------------------------- */

export async function fetchMyCohorts(userId) {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, created_by, created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error };

  const ids = (data || []).map(c => c.id);
  if (ids.length === 0) return { data: [], error: null };

  const { data: memberRows } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .in("cohort_id", ids);
  const counts = {};
  (memberRows || []).forEach(m => { counts[m.cohort_id] = (counts[m.cohort_id] || 0) + 1; });

  return { data: data.map(c => ({ ...c, memberCount: counts[c.id] || 0 })), error: null };
}

export async function createCohort(userId, name) {
  return supabase.from("cohorts").insert({ name, created_by: userId }).select().single();
}

export async function deleteCohort(cohortId) {
  return supabase.from("cohorts").delete().eq("id", cohortId);
}

export async function fetchCohortMembers(cohortId) {
  const { data: memberRows, error } = await supabase
    .from("cohort_members")
    .select("user_id, joined_at")
    .eq("cohort_id", cohortId);
  if (error) return { data: null, error };
  if (!memberRows || memberRows.length === 0) return { data: [], error: null };

  const ids = memberRows.map(m => m.user_id);
  const { data: people, error: pErr } = await supabase
    .from("member_directory")
    .select("id, display_name")
    .in("id", ids);
  if (pErr) return { data: null, error: pErr };

  const nameById = Object.fromEntries((people || []).map(p => [p.id, p.display_name]));
  return {
    data: memberRows.map(m => ({ userId: m.user_id, displayName: nameById[m.user_id] || "A brother", joinedAt: m.joined_at })),
    error: null,
  };
}

export async function addCohortMember(cohortId, userId) {
  return supabase.from("cohort_members").insert({ cohort_id: cohortId, user_id: userId });
}

export async function removeCohortMember(cohortId, userId) {
  return supabase.from("cohort_members").delete().eq("cohort_id", cohortId).eq("user_id", userId);
}

/* ---------------------------------------------------------------------------
   BADGES  (automatic milestone + streak recognition)
   ------------------------------------------------------------------------- */

export const MILESTONE_THRESHOLDS = [10, 25, 50, 100];
export const STREAK_THRESHOLDS = [5, 10, 25, 50, 90];

export async function fetchBadges(userId) {
  const { data, error } = await supabase
    .from("badges")
    .select("badge_type, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: true });
  return { data: data || [], error };
}

// Checks current stats against the milestone/streak thresholds and awards
// any newly-crossed badges. Safe to call after any progress-changing action —
// already-earned badges are never re-awarded (unique constraint + ignoreDuplicates).
export async function checkAndAwardBadges(userId) {
  const { data: stats, error: statsErr } = await fetchStats(userId);
  if (statsErr || !stats) return { newBadges: [], error: statsErr };

  const { data: existing, error: exErr } = await supabase
    .from("badges").select("badge_type").eq("user_id", userId);
  if (exErr) return { newBadges: [], error: exErr };
  const existingTypes = new Set((existing || []).map(b => b.badge_type));

  const toAward = [];
  for (const m of MILESTONE_THRESHOLDS) {
    const type = `milestone_${m}`;
    if ((stats.total_memorized || 0) >= m && !existingTypes.has(type)) toAward.push(type);
  }
  for (const s of STREAK_THRESHOLDS) {
    const type = `streak_${s}`;
    if ((stats.current_streak || 0) >= s && !existingTypes.has(type)) toAward.push(type);
  }

  if (toAward.length === 0) return { newBadges: [], error: null };

  const rows = toAward.map(badge_type => ({ user_id: userId, badge_type }));
  const { error } = await supabase
    .from("badges")
    .upsert(rows, { onConflict: "user_id,badge_type", ignoreDuplicates: true });

  return { newBadges: error ? [] : toAward, error };
}

/* ---------------------------------------------------------------------------
   MEMBER DIRECTORY  (name-only lookup, for picking a workout partner)
   ------------------------------------------------------------------------- */

export async function fetchMemberDirectory(excludeUserId) {
  const { data, error } = await supabase
    .from("member_directory")
    .select("id, display_name")
    .order("display_name", { ascending: true });
  if (error) return { data: null, error };
  return { data: (data || []).filter(m => m.id !== excludeUserId), error: null };
}

/* ---------------------------------------------------------------------------
   SESSION HISTORY  (for the Progress screen)
   ------------------------------------------------------------------------- */

export async function fetchSessionHistory(userId, limit = 20) {
  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, muscle_group_id, verse_ids, session_type, partner_user_id, notes, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error };
  if (!sessions || sessions.length === 0) return { data: [], error: null };

  const groupIds = [...new Set(sessions.map(s => s.muscle_group_id).filter(Boolean))];
  const partnerIds = [...new Set(sessions.map(s => s.partner_user_id).filter(Boolean))];

  const [{ data: groups }, { data: partners }] = await Promise.all([
    groupIds.length
      ? supabase.from("muscle_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] }),
    partnerIds.length
      ? supabase.from("member_directory").select("id, display_name").in("id", partnerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const groupById = Object.fromEntries((groups || []).map(g => [g.id, g.name]));
  const partnerById = Object.fromEntries((partners || []).map(p => [p.id, p.display_name]));

  const enriched = sessions.map(s => ({
    ...s,
    groupName: groupById[s.muscle_group_id] || "Muscle Group",
    partnerName: s.partner_user_id ? (partnerById[s.partner_user_id] || "A brother") : null,
    verseCount: (s.verse_ids || []).length,
  }));

  return { data: enriched, error: null };
}

/* ---------------------------------------------------------------------------
   STATIC CONTENT  (Training Wheels guide, etc. — editable without a deploy)
   ------------------------------------------------------------------------- */

export async function fetchContent(key) {
  const { data, error } = await supabase
    .from("scripture_gym_content")
    .select("title, body, updated_at")
    .eq("content_key", key)
    .maybeSingle();
  return { data, error };
}
