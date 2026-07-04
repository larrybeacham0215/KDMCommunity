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
    .select("id, name, description, owner_type, display_order, created_by")
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

  return {
    data: {
      official: enriched.filter(g => g.owner_type === "official"),
      personal: enriched.filter(g => g.owner_type === "personal" && g.created_by === userId),
    },
    error: null,
  };
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

  return recalcTotalMemorized(userId);
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
