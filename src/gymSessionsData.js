import { supabase } from "./dataService";

/* ============================================================================
   SCRIPTURE GYM — LIVE SESSIONS ("workouts you show up to")
   Data layer for gym_meetings and friends.

   NOTE ON NAMING: the memorization gym already owns the word "workout" in
   `workout_sessions` (one man drilling verses alone). These are the scheduled
   group meetings, namespaced `gym_meetings*` so the two never collide.
   ========================================================================== */

/* Cover swatches stay dark on purpose. Against bone paper they read as pieces
   of forged metal and give the cards something to hold onto without needing
   photography. Each one keeps a dark end so the label on top stays legible. */
export const COVERS = {
  iron:  { label: "Iron",  grad: "linear-gradient(135deg,#2E3439 0%,#161A1D 100%)" },
  anvil: { label: "Anvil", grad: "linear-gradient(135deg,#35302B 0%,#1B1815 100%)" },
  forge: { label: "Forge", grad: "linear-gradient(135deg,#4A3220 0%,#241811 100%)" },
};

export const STATUS_META = {
  draft:     { label: "Draft",            tone: "muted", blurb: "Only you can see this. Submit it when it's ready." },
  pending:   { label: "Pending approval", tone: "warn",  blurb: "Submitted. Waiting on the keys before it opens to the men." },
  approved:  { label: "Open",             tone: "ok",    blurb: "Approved and joinable. Share it widely." },
  rejected:  { label: "Sent back",        tone: "stop",  blurb: "Not cleared this time. Read the note, adjust, resubmit." },
  completed: { label: "Completed",        tone: "info",  blurb: "This one is in the books." },
  cancelled: { label: "Cancelled",        tone: "stop",  blurb: "Called off." },
};

export const OPEN_STATUSES = ["approved", "completed"];

/* ---------------------------------------------------------------------------
   LINKS
   ------------------------------------------------------------------------- */

const appBase = () => `${window.location.origin}${window.location.pathname.replace(/\/?$/, "/")}`;

export const shareUrl = slug => `${appBase()}?share=${slug}`;
export const joinUrl  = slug => `${appBase()}?join=${slug}`;

/* THE SCRIPTURE GYM ROOM
   Every gym event meets here unless someone deliberately overrides it.

   The real source of truth is the DATABASE, not this line:
       scripture_gym_content WHERE content_key = 'gym_join_url'
   A database trigger stamps that value onto any meeting saved without a link,
   so the room reaches the app, the share page and every email from one place.

   TO CHANGE THE ROOM — one statement, no code deploy, no rebuild:
       UPDATE public.scripture_gym_content
          SET body = 'https://us06web.zoom.us/NEW', updated_at = now()
        WHERE content_key = 'gym_join_url';
       UPDATE public.gym_meetings SET join_url = public.gym_default_join_url();

   This constant only prefills the propose form and covers the rare case where
   a row somehow arrives empty. Keep it matched to the database value. */
export const DEFAULT_JOIN_URL = "https://us06web.zoom.us/j/89018752634";

/** The room for a public session, if it's open. Returns null when it isn't. */
export async function fetchJoinUrl(slug) {
  const { data, error } = await supabase.rpc("get_meeting_join_url", { p_slug: slug });
  return { data: data || null, error };
}

/* ---------------------------------------------------------------------------
   READS
   ------------------------------------------------------------------------- */

const SELECT = `
  id, title, description, focus_verses, discussion_questions, notes, cover_key,
  created_by, host_id, host_name, manager_id, status, scheduled_at,
  duration_minutes, join_url, share_slug, approved_by, approved_at,
  rejected_reason, created_at
`;

/* Host names come from member_directory, NOT from profiles.
   profiles is locked by RLS to your own row, so embedding it here returns null
   for everyone except the owner — which is why every card read "Host to be
   named" for members while looking correct to Larry. member_directory exposes
   {id, display_name} to any signed-in member for exactly this purpose. */
async function attachNames(rows) {
  const ids = [...new Set(rows.flatMap(r => [r.host_id, r.created_by]).filter(Boolean))];
  if (!ids.length) return rows;
  const { data } = await supabase.from("member_directory").select("id, display_name").in("id", ids);
  const byId = new Map((data || []).map(m => [m.id, m.display_name]));
  return rows.map(r => ({
    ...r,
    host:    r.host_id    ? { id: r.host_id,    full_name: byId.get(r.host_id)    || null } : null,
    creator: r.created_by ? { id: r.created_by, full_name: byId.get(r.created_by) || null } : null,
  }));
}

/** Every session the signed-in user is allowed to see (RLS decides). */
export async function fetchMeetings() {
  const { data, error } = await supabase
    .from("gym_meetings")
    .select(SELECT)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return { data: await attachNames(data || []), error };
}

export async function fetchMeeting(id) {
  const { data, error } = await supabase
    .from("gym_meetings").select(SELECT).eq("id", id).single();
  return { data: data ? (await attachNames([data]))[0] : data, error };
}

export async function fetchRegistrations(meetingId) {
  const { data, error } = await supabase
    .from("gym_meeting_registrations")
    .select("id, full_name, email, phone, opt_in_comms, created_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

/* ---------------------------------------------------------------------------
   WRITES
   ------------------------------------------------------------------------- */

/** Propose a workout. status: "draft" to park it, "pending" to submit.
    The DB trigger promotes pending -> approved automatically for key holders. */
export async function createMeeting(userId, form, status = "pending") {
  const row = {
    created_by: userId,
    host_id: form.host_id || userId,
    host_name: form.host_name || null,
    title: (form.title || "").trim(),
    description: form.description || null,
    focus_verses: form.focus_verses || null,
    discussion_questions: form.discussion_questions || null,
    notes: form.notes || null,
    cover_key: form.cover_key || "iron",
    memory_verse_id: form.memory_verse_id || null,
    scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    duration_minutes: Number(form.duration_minutes) || 60,
    join_url: (form.join_url || "").trim() || DEFAULT_JOIN_URL,
    status,
  };
  const { data, error } = await supabase
    .from("gym_meetings").insert(row).select(SELECT).single();
  return { data: data ? (await attachNames([data]))[0] : data, error };
}

export async function updateMeeting(id, patch) {
  const { data, error } = await supabase
    .from("gym_meetings").update(patch).eq("id", id).select(SELECT).single();
  return { data: data ? (await attachNames([data]))[0] : data, error };
}

export const submitMeeting  = id => updateMeeting(id, { status: "pending" });
export const cancelMeeting  = id => updateMeeting(id, { status: "cancelled" });
export const completeMeeting = id => updateMeeting(id, { status: "completed" });

export async function approveMeeting(id, approverId) {
  return updateMeeting(id, {
    status: "approved", approved_by: approverId, approved_at: new Date().toISOString(),
  });
}

export async function rejectMeeting(id, reason) {
  return updateMeeting(id, { status: "rejected", rejected_reason: reason || null });
}

/* ---------------------------------------------------------------------------
   INVITES
   ------------------------------------------------------------------------- */

export async function createInvite(userId, { email, full_name, meeting_id }) {
  const { data, error } = await supabase
    .from("gym_invites")
    .insert({
      invited_by: userId,
      email: (email || "").trim().toLowerCase(),
      full_name: full_name || null,
      meeting_id: meeting_id || null,
    })
    .select("id, email, token, status")
    .single();
  return { data, error };
}

/* ---------------------------------------------------------------------------
   PUBLIC — no account required. Both go through SECURITY DEFINER functions so
   anon never touches the tables and never sees anyone's contact details.
   ------------------------------------------------------------------------- */

export async function getSharedMeeting(slug) {
  const { data, error } = await supabase.rpc("get_shared_meeting", { p_slug: slug });
  return { data, error };
}

export async function registerForMeeting({ slug, name, email, phone, optIn }) {
  const { data, error } = await supabase.rpc("register_for_meeting", {
    p_slug: slug, p_name: name, p_email: email,
    p_phone: phone || null, p_opt_in: !!optIn,
  });
  return { data, error };
}

/* ---------------------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------------------- */

export function canPublishDirectly(profile) {
  if (!profile) return false;
  return profile.role === "owner" || profile.role === "admin" || profile.gym_keys === true;
}

export function isApprover(profile) {
  return !!profile && (profile.role === "owner" || profile.role === "admin");
}

/* The gym meets Monday nights at 7:00 PM Eastern, full stop. Times are shown in
   Eastern and labelled ET rather than in each man's local zone — a man in
   Phoenix seeing "4:00 PM" next to marketing that says 7:00 PM ET is how people
   miss the room. The emails already format this way; the app now matches. */
export const GYM_TZ = "America/New_York";

export function fmtWhen(iso, mins) {
  if (!iso) return "Date to be set";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: GYM_TZ });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: GYM_TZ });
  return `${day} · ${time} ET${mins ? ` · ${mins} min` : ""}`;
}

export function isPast(iso) {
  return !!iso && new Date(iso).getTime() < Date.now();
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}


/** Curriculum verses, grouped, for the "week's memory verse" picker on a session. */
export async function fetchCurriculumVerses() {
  const { data, error } = await supabase
    .from("verses")
    .select("id, reference, verse_text, muscle_group:muscle_groups!verses_muscle_group_id_fkey(name, owner_type)")
    .order("reference", { ascending: true });
  const rows = (data || []).filter(v => v.muscle_group?.owner_type === "official");
  return { data: rows, error };
}
