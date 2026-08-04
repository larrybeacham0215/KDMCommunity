// =============================================================================
// gym-mailer — drains public.gym_notifications and sends through Brevo.
//
// WHY THIS EXISTS
//   Supabase's SMTP settings only cover *auth* mail (signup, password reset).
//   Application email — approvals, reminders, registration confirmations — has
//   to be sent by us. Rows are queued by database triggers the moment state
//   changes, and this worker delivers them.
//
// INVOKE
//   POST /functions/v1/gym-mailer            -> send everything due
//   POST … {"dry_run": true}                 -> render only, send nothing
//   POST … {"limit": 10}                     -> cap the batch
//
// REQUIRES
//   BREVO_API_KEY   edge secret (Brevo -> SMTP & API -> API keys)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://kdmcommunity.com";
const APP = `${SITE}/app/`;
const FROM = { email: "welcome@kdmcommunity.com", name: "Kingdom of Disciplined Men" };
// welcome@ is send-only — kdmcommunity.com has no MX records, so anything sent
// back to it disappears silently. Point replies at a mailbox that exists.
const REPLY_TO = { email: "larrybeacham@gmail.com", name: "Larry Beacham" };

// The Scripture Gym room. Read live from scripture_gym_content.gym_join_url on
// every invocation (see resolveRoom below) so changing the link in the database
// changes it in the mail too — no redeploy. This literal is only the net.
const ROOM_FALLBACK = "https://us06web.zoom.us/j/89018752634";
let ROOM = ROOM_FALLBACK;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ---------------------------------------------------------------------------
   Presentation
   ------------------------------------------------------------------------- */

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// How far out the session actually is, in hours. Reminders phrase themselves
// from this instead of assuming the queue drained on schedule — a reminder
// queued for "24h before" can sit past-due and go out the same afternoon.
const hoursUntil = (iso?: string): number | null => {
  if (!iso) return null;
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
};

// "Tomorrow" is only true if it is actually tomorrow.
const lead = (h: number | null) => {
  if (h === null) return { word: "Coming up", sentence: "is coming up" };
  if (h >= 20)   return { word: "Tomorrow",  sentence: "is tomorrow" };
  if (h >= 5)    return { word: "Today",     sentence: "is today" };
  if (h >= 1.5)  return { word: "In a few hours", sentence: "starts in a few hours" };
  return { word: "Starting soon", sentence: "starts shortly" };
};

const when = (iso?: string) => {
  if (!iso) return "Date to be announced";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  }) + " ET";
};

function shell(heading: string, blocks: string, cta?: { label: string; url: string }) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0907;margin:0;padding:32px 0;font-family:Georgia,'Times New Roman',serif;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#16130d;border:1px solid rgba(216,168,92,.18);border-radius:6px;max-width:600px;width:100%;">
  <tr><td style="padding:34px 40px 18px;border-bottom:1px solid rgba(216,168,92,.12);">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c8862e;">Kingdom of</div>
    <div style="font-size:25px;letter-spacing:2px;color:#f7f1e6;text-transform:uppercase;font-weight:bold;">Disciplined Men</div>
  </td></tr>
  <tr><td style="padding:32px 40px 10px;">
    <h1 style="margin:0 0 18px;font-size:23px;color:#f7f1e6;font-weight:normal;">${heading}</h1>
    ${blocks}
    ${cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 22px;">
      <tr><td align="center" style="background:#c8862e;border-radius:3px;">
        <a href="${cta.url}" style="display:inline-block;padding:15px 38px;font-family:Arial,Helvetica,sans-serif;font-size:14px;letter-spacing:1px;color:#1a1206;text-decoration:none;font-weight:bold;text-transform:uppercase;">${esc(cta.label)}</a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12.5px;color:#6e6557;">If the button doesn't work, paste this into your browser:</p>
    <p style="margin:0 0 8px;font-size:12.5px;word-break:break-all;"><a href="${cta.url}" style="color:#c8862e;">${cta.url}</a></p>` : ""}
  </td></tr>
  <tr><td style="padding:20px 40px 30px;border-top:1px solid rgba(216,168,92,.12);">
    <p style="margin:0;font-size:12px;color:#6e6557;font-family:Arial,Helvetica,sans-serif;">Kingdom of Disciplined Men · kdmcommunity.com</p>
  </td></tr>
</table>
</td></tr></table>`.trim();
}

const p = (t: string) =>
  `<p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;color:#a99d89;">${t}</p>`;

const detail = (label: string, value: string) =>
  `<p style="margin:0 0 8px;font-size:15px;color:#a99d89;"><span style="color:#6e6557;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">${esc(label)}</span><br>${esc(value)}</p>`;

const questions = (raw?: string) => {
  const list = String(raw ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!list.length) return "";
  return `<p style="margin:18px 0 8px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c8862e;">Questions we'll sit with</p>
  <ul style="margin:0 0 14px;padding-left:20px;color:#a99d89;font-size:15px;line-height:1.75;">${list.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`;
};

/* ---------------------------------------------------------------------------
   Templates — one entry per template_key written by the DB triggers
   ------------------------------------------------------------------------- */

type Ctx = { d: Record<string, unknown>; m: Record<string, unknown>; name: string };

const TEMPLATES: Record<string, (c: Ctx) => { subject: string; html: string }> = {
  meeting_submitted_creator: ({ d, name }) => ({
    subject: `Received: ${d.title}`,
    html: shell("We've got it", [
      p(`${esc(name || "Brother")}, your workout <strong style="color:#f7f1e6;">${esc(d.title)}</strong> has been submitted.`),
      p("Nothing else is needed from you. It's with Larry for the keys — you'll hear the moment it's cleared."),
    ].join("")),
  }),

  meeting_needs_approval: ({ d, m }) => ({
    subject: `Needs your keys: ${d.title}`,
    html: shell("A workout is waiting on you", [
      p(`<strong style="color:#f7f1e6;">${esc(d.title)}</strong> was submitted by ${esc(d.submitted_by || "a member")}.`),
      detail("When", when(m.scheduled_at as string)),
      p("Approving opens it to the men and makes the join link live."),
    ].join(""), { label: "Review it", url: APP }),
  }),

  meeting_approved_creator: ({ d, m, name }) => ({
    subject: `Cleared: ${d.title}`,
    html: shell("You're cleared", [
      p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> is approved and open to the men.`),
      detail("When", when(m.scheduled_at as string)),
      p("Share this link anywhere — it works for people who don't have an account."),
    ].join(""), { label: "Open the workout", url: `${APP}?share=${d.share_slug ?? m.share_slug}` }),
  }),

  meeting_rejected_creator: ({ d, name }) => ({
    subject: `Sent back: ${d.title}`,
    html: shell("Not this one — yet", [
      p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> wasn't cleared.`),
      d.reason ? detail("What to fix", String(d.reason)) : "",
      p("Adjust it and submit again. This isn't a no, it's a not like this."),
    ].join(""), { label: "Open the gym", url: APP }),
  }),

  manager_assigned: ({ d, m }) => ({
    subject: `You're covering: ${d.title}`,
    html: shell("You've been asked to cover a session", [
      p(`You're the manager on <strong style="color:#f7f1e6;">${esc(d.title)}</strong>.`),
      detail("When", when(m.scheduled_at as string)),
      p("That means you're expected in the room, vouching for it."),
    ].join(""), { label: "See the session", url: APP }),
  }),

  meeting_published_members: ({ d, m }) => ({
    subject: `New workout: ${d.title}`,
    html: shell("A new workout is open", [
      p(`<strong style="color:#f7f1e6;">${esc(d.title)}</strong>`),
      detail("When", when(m.scheduled_at as string)),
      m.description ? p(esc(m.description)) : "",
      p("Seats aren't limited, but showing up is."),
    ].join(""), { label: "Save your seat", url: `${APP}?share=${m.share_slug}` }),
  }),

  registration_confirmed: ({ d, m, name }) => ({
    subject: `Your seat is saved: ${d.title}`,
    html: shell("Your seat is saved", [
      p(`${esc(name || "Brother")}, you're in for <strong style="color:#f7f1e6;">${esc(d.title)}</strong>.`),
      detail("When", when((d.scheduled_at || m.scheduled_at) as string)),
      m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
      questions(m.discussion_questions as string),
      p("Come with one honest answer. That's the whole entry fee."),
    // Live meeting row wins over the payload: the payload is a snapshot taken
    // when the man registered, and the room can move between then and send.
    ].join(""), { label: "Open the meeting", url: String(m.join_url || d.join_url || ROOM) }),
  }),

  reminder_7d: ({ d, m, name }) => {
    const h = hoursUntil(m.scheduled_at as string);
    const days = h === null ? null : Math.round(h / 24);
    return {
      subject: `${days !== null && days <= 1 ? "Coming up" : `${days} days out`}: ${d.title}`,
      html: shell("On the calendar", [
        p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> is ${days !== null && days <= 1 ? "almost here" : `${days} days out`}.`),
        detail("When", when(m.scheduled_at as string)),
        m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
        p("Far enough out to move what needs moving. Put it in your calendar now."),
      ].join(""), { label: "See the session", url: `${APP}?share=${m.share_slug}` }),
    };
  },

  meeting_rescheduled: ({ d, m, name }) => ({
    subject: `New time: ${d.title}`,
    html: shell("The time has moved", [
      p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> has been rescheduled. Your seat is still yours — nothing to do but note the new time.`),
      detail("Was", when(d.old_time as string)),
      detail("Now", when((d.new_time || m.scheduled_at) as string)),
      p("Your reminders have already been moved with it."),
    ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
  }),

  reminder_24h: ({ d, m, name }) => {
    const l = lead(hoursUntil(m.scheduled_at as string));
    return {
      subject: `${l.word}: ${d.title}`,
      html: shell(l.word, [
        p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> ${l.sentence}.`),
        detail("When", when(m.scheduled_at as string)),
        questions(m.discussion_questions as string),
      ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
    };
  },

  reminder_1h: ({ d, m }) => {
    const h = hoursUntil(m.scheduled_at as string);
    const soon = h !== null && h < 0.75;
    return {
      subject: soon ? `Starting now: ${d.title}` : `One hour: ${d.title}`,
      html: shell(soon ? "Starting now" : "One hour out", [
        p(`<strong style="color:#f7f1e6;">${esc(d.title)}</strong> ${soon ? "is starting" : "starts in an hour"}.`),
        detail("Starts", when(m.scheduled_at as string)),
        p("Bring something to write with."),
      ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
    };
  },

  meeting_cancelled: ({ d, name }) => ({
    subject: `Cancelled: ${d.title}`,
    html: shell("This one's been called off", [
      p(`${esc(name || "Brother")}, <strong style="color:#f7f1e6;">${esc(d.title)}</strong> has been cancelled.`),
      p("Nothing is required from you. Watch for the next one."),
    ].join(""), { label: "See what's open", url: APP }),
  }),

  meeting_completed_followup: ({ d, m, name }) => ({
    subject: `Recap: ${d.title}`,
    html: shell("In the books", [
      p(`${esc(name || "Brother")}, thank you for showing up to <strong style="color:#f7f1e6;">${esc(d.title)}</strong>.`),
      m.notes ? detail("Notes", String(m.notes)) : "",
      m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
      p("The work continues where nobody's watching."),
    ].join(""), { label: "What's next", url: APP }),
  }),

  gym_invite: ({ d, name }) => ({
    subject: "You've been called into the Scripture Gym",
    html: shell("You've been called in", [
      p(`${esc(name || "Brother")}, ${esc(d.invited_by_name || "a brother")} invited you into the Scripture Gym.`),
      p("It's where the men train the Word like iron — live sessions, honest rooms, and the discipline of showing up."),
    ].join(""), { label: "Step in", url: APP }),
  }),

  welcome_member: ({ name }) => ({
    subject: "Welcome to the Kingdom",
    html: shell("Welcome, brother", [
      p(`${esc(name || "Brother")}, you're in. Your account is active — no link to click, nothing to verify.`),
      p("The Scripture Gym is where the work happens: live sessions with other men, verses to train on, and the discipline of showing up when you don't feel like it."),
      p(`<em style="color:#c8862e;">"A disciplined man builds a home where his whole family can thrive."</em>`),
    ].join(""), { label: "Enter the Forge", url: APP }),
  }),
};

/* ---------------------------------------------------------------------------
   Worker
   ------------------------------------------------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b, null, 2), {
      status: s, headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(Number(body.limit) || 50, 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey && !dryRun) {
      return json({
        ok: false,
        error: "BREVO_API_KEY is not set on this function. Add it in Supabase → Edge Functions → Secrets.",
      }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // One read, one source of truth, shared by every template in this batch.
    const { data: roomRow } = await db
      .from("scripture_gym_content")
      .select("body")
      .eq("content_key", "gym_join_url")
      .maybeSingle();
    ROOM = String(roomRow?.body ?? "").trim() || ROOM_FALLBACK;

    const { data: queue, error } = await db
      .from("gym_notifications")
      .select("id, meeting_id, template_key, recipient_email, recipient_name, payload")
      .eq("status", "queued")
      .lte("send_after", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!queue?.length) return json({ ok: true, sent: 0, message: "Nothing due." });

    // Pull the meetings referenced by this batch, once.
    const ids = [...new Set(queue.map((r) => r.meeting_id).filter(Boolean))];
    const { data: meetings } = await db
      .from("gym_meetings")
      .select("id, title, description, status, scheduled_at, duration_minutes, join_url, share_slug, focus_verses, discussion_questions, notes")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((meetings ?? []).map((m) => [m.id, m]));

    let sent = 0, failed = 0, skipped = 0;
    const preview: unknown[] = [];

    for (const row of queue) {
      const tpl = TEMPLATES[row.template_key];
      if (!tpl) {
        skipped++;
        await db.from("gym_notifications")
          .update({ status: "skipped", error: `No template for ${row.template_key}` })
          .eq("id", row.id);
        continue;
      }

      const m = byId.get(row.meeting_id) ?? {} as Record<string, unknown>;

      // A reminder for a session that already happened — or was called off —
      // is worse than no reminder. Retire it instead of sending it.
      if (row.template_key.startsWith("reminder_")) {
        const over = ["completed", "cancelled", "rejected"].includes(String(m.status ?? ""));
        const past = m.scheduled_at ? new Date(String(m.scheduled_at)).getTime() < Date.now() : false;
        if (over || past) {
          skipped++;
          await db.from("gym_notifications")
            .update({ status: "skipped", error: "Session already passed or was called off" })
            .eq("id", row.id);
          continue;
        }

        // Someone who registers inside the 24h window gets a day-before
        // reminder that is already past due, so it goes out immediately —
        // landing minutes after their confirmation and, before this, saying
        // "Tomorrow" about something happening that evening. The confirmation
        // already carries the date; the 1h reminder still fires. Retire it.
        const h = hoursUntil(m.scheduled_at as string);
        if (row.template_key === "reminder_7d" && h !== null && h < 120) {
          skipped++;
          await db.from("gym_notifications")
            .update({ status: "skipped", error: "Too close to the session for a week-out notice" })
            .eq("id", row.id);
          continue;
        }
        if (row.template_key === "reminder_24h" && h !== null && h < 20) {
          skipped++;
          await db.from("gym_notifications")
            .update({ status: "skipped", error: "Registered inside 24h — confirmation already covered it" })
            .eq("id", row.id);
          continue;
        }
      }

      const { subject, html } = tpl({
        d: row.payload ?? {},
        m: m as Record<string, unknown>,
        name: row.recipient_name ?? "",
      });

      if (dryRun) {
        // Where the button actually points — the thing most worth checking
        // before a batch goes out.
        const cta = html.match(/color:#c8862e;">(https?:\/\/[^<]+)<\/a>/)?.[1] ?? null;
        preview.push({ to: row.recipient_email, template: row.template_key, subject, cta });
        continue;
      }

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey!,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: FROM,
          replyTo: REPLY_TO,
          to: [{ email: row.recipient_email, name: row.recipient_name || undefined }],
          subject,
          htmlContent: html,
        }),
      });

      if (res.ok) {
        sent++;
        await db.from("gym_notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", row.id);
      } else {
        failed++;
        const text = await res.text();
        await db.from("gym_notifications")
          .update({ status: "failed", error: `${res.status} ${text}`.slice(0, 500) })
          .eq("id", row.id);
      }

      // Brevo free tier throttles hard; stay well under it.
      await new Promise((r) => setTimeout(r, 250));
    }

    return json({ ok: true, considered: queue.length, sent, failed, skipped, ...(dryRun ? { dry_run: true, preview } : {}) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
