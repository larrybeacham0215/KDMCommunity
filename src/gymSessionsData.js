import { supabase } from "./dataService";

/* ============================================================================
   SCRIPTURE GYM — LIVE SESSIONS ("workouts you show up to")
   Data layer for gym_meetings and friends.

   NOTE ON NAMING: the memorization gym already owns the word "workout" in
   `workout_sessions` (one man drilling verses alone). These are the scheduled
   group meetings, namespaced `gym_meetings*` so the two never collide.
   ========================================================================== */

export const COVERS = {
  iron:  { label: "Iron",  grad: "linear-gradient(135deg,#232a2e,#100e0b)" },
  anvil: { label: "Anvil", grad: "linear-gradient(135deg,#2b2521,#100e0b)" },
  forge: { label: "Forge", grad: "linear-gradient(135deg,#33241c,#100e0b)" },
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

/* ---------------------------------------------------------------------------
   READS
   ------------------------------------------------------------------------- */

const SELECT = `
  id, title, description, focus_verses, discussion_questions, notes, cover_key,
  created_by, host_id, host_name, manager_id, status, scheduled_at,
  duration_minutes, join_url, share_slug, approved_by, approved_at,
  rejected_reason, created_at,
  host:profiles!gym_meetings_host_id_fkey ( id, full_name, email ),
  creator:profiles!gym_meetings_created_by_fkey ( id, full_name, email )
`;

/** Every session the signed-in user is allowed to see (RLS decides). */
export async function fetchMeetings() {
  const { data, error } = await supabase
    .from("gym_meetings")
    .select(SELECT)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return { data: data || [], error };
}

export async function fetchMeeting(id) {
  const { data, error } = await supabase
    .from("gym_meetings").select(SELECT).eq("id", id).single();
  return { data, error };
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
    scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    duration_minutes: Number(form.duration_minutes) || 60,
    join_url: form.join_url || null,
    status,
  };
  const { data, error } = await supabase
    .from("gym_meetings").insert(row).select(SELECT).single();
  return { data, error };
}

export async function updateMeeting(id, patch) {
  const { data, error } = await supabase
    .from("gym_meetings").update(patch).eq("id", id).select(SELECT).single();
  return { data, error };
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

export function fmtWhen(iso, mins) {
  if (!iso) return "Date to be set";
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}${mins ? ` · ${mins} min` : ""}`;
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
