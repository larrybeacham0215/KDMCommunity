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
// The domain can receive mail as of 13 Aug 2026 (MX -> Microsoft 365). Replies
// now land on the Kingdom's own mailbox rather than a personal Gmail.
// FROM stays welcome@ because that is the voice of the app; REPLY_TO is larry@
// because that is the mailbox a man actually reaches.
const REPLY_TO = { email: "larry@kdmcommunity.com", name: "Larry Beacham" };

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

// Every email closes the same way. A man should know who it came from without
// checking the header — that is what makes it a letter and not a notification.
const SIGNATURE = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(216,168,92,.14);">
      <tr><td style="padding-top:20px;font-family:Georgia,'Times New Roman',serif;">
        <p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;color:#c8862e;line-height:1.4;">Go forth in victory!</p>
        <p style="margin:0 0 3px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-style:italic;color:#c8862e;line-height:1.4;">Larry Beacham</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:#a08d6d;line-height:1.4;">Founder, Kingdom of Disciplined Men</p>
      </td></tr>
    </table>`;

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

// Greetings use the first name only: "Larry Beacham," reads like a form letter,
// "Larry," reads like a man talking to a man. Handles the odd cases a roster
// collects — extra spaces, an email in the name field, a lone initial.
const firstName = (full?: string) => {
  const raw = String(full ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return "";                        // an email, not a name
  const parts = raw.replace(/,+$/, "").split(/\s+/)
    // drop leading titles so we don't greet a man as "Dr."
    .filter((w, i) => !(i === 0 && /^(mr|mrs|ms|dr|pastor|rev|sr|fr|bro|coach)\.?$/i.test(w)));
  if (!parts.length) return "";
  // Initials given as separate letters ("J J") read as one name.
  if (parts.every((w) => w.replace(/\./g, "").length === 1)) {
    return parts.map((w) => w.replace(/\./g, "").toUpperCase()).join("");
  }
  const first = parts[0].replace(/,+$/, "");
  // Preserve intentional casing (McQueen, JJ); only fix ALL CAPS or all lower.
  if (first.length > 3 && first === first.toUpperCase()) {
    return first[0] + first.slice(1).toLowerCase();
  }
  if (first === first.toLowerCase()) {
    return first[0].toUpperCase() + first.slice(1);
  }
  return first;
};

// Day name from the meeting itself — never hardcode a weekday in a subject line.
// The live meeting row wins over the payload. The payload is a snapshot taken
// when the row was queued; a title can be edited between then and the send, and
// a hand-queued row may carry no payload at all. Either way an email must never
// go out saying "undefined".
const mTitle = (d: Record<string, unknown>, m: Record<string, unknown>) =>
  String(m?.title ?? d?.title ?? "Scripture Gym");

const greet = (n?: string) => (n ? `Hey ${esc(n)} \u2014 ` : "Hey brother \u2014 ");

const dayName = (iso?: string) => {
  if (!iso) return "This week";
  return "This " + new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", timeZone: "America/New_York",
  });
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
    ${SIGNATURE}
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
    subject: `Received: ${mTitle(d, m)}`,
    html: shell("We've got it", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}your workout <strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> has been submitted.`),
      p("Nothing else is needed from you. It's with Larry for the keys — you'll hear the moment it's cleared."),
      p(`<strong style="color:#f7f1e6;">Good work putting this together, ${esc(name || "brother")}. I will look at it shortly.</strong>`),
    ].join("")),
  }),

  meeting_needs_approval: ({ d, m }) => ({
    subject: `Needs your keys: ${mTitle(d, m)}`,
    html: shell("A workout is waiting on you", [
      p(`<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> was submitted by ${esc(d.submitted_by || "a member")}.`),
      detail("When", when(m.scheduled_at as string)),
      p("Approving opens it to the men and makes the join link live."),
      p(`<strong style="color:#f7f1e6;">One decision from you and this opens to the men.</strong>`),
    ].join(""), { label: "Review it", url: APP }),
  }),

  meeting_approved_creator: ({ d, m, name }) => ({
    subject: `Cleared: ${mTitle(d, m)}`,
    html: shell("You're cleared", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> is approved and open to the men.`),
      detail("When", when(m.scheduled_at as string)),
      p("Share this link anywhere — it works for people who don't have an account."),
      p(`<strong style="color:#f7f1e6;">Now fill the room, ${esc(name || "brother")}. Send that link to one man today.</strong>`),
    ].join(""), { label: "Open the workout", url: `${APP}?share=${d.share_slug ?? m.share_slug}` }),
  }),

  meeting_rejected_creator: ({ d, name }) => ({
    subject: `Sent back: ${mTitle(d, m)}`,
    html: shell("Not this one — yet", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> wasn't cleared.`),
      d.reason ? detail("What to fix", String(d.reason)) : "",
      p("Adjust it and submit again. This isn't a no, it's a not like this."),
      p(`<strong style="color:#f7f1e6;">This is not a no, ${esc(name || "brother")}. It is a not like this. Send it back to me.</strong>`),
    ].join(""), { label: "Open the gym", url: APP }),
  }),

  manager_assigned: ({ d, m, name }) => ({
    subject: `You're covering: ${mTitle(d, m)}`,
    html: shell("You've been asked to cover a session", [
      p(`You're the manager on <strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong>.`),
      detail("When", when(m.scheduled_at as string)),
      p("That means you're expected in the room, vouching for it."),
      p(`<strong style="color:#f7f1e6;">Thank you for covering this one, ${esc(name || "brother")}. The men will feel it.</strong>`),
    ].join(""), { label: "See the session", url: APP }),
  }),

  meeting_published_members: ({ d, m, name }) => ({
    subject: `New workout: ${mTitle(d, m)}`,
    html: shell("A new workout is open", [
      p(`<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong>`),
      detail("When", when(m.scheduled_at as string)),
      m.description ? p(esc(m.description)) : "",
      p("Seats aren't limited, but showing up is."),
      p(`<strong style="color:#f7f1e6;">Seats are not limited, ${esc(name || "brother")}. Showing up is.</strong>`),
    ].join(""), { label: "Save your seat", url: `${APP}?share=${m.share_slug}` }),
  }),

  registration_confirmed: ({ d, m, name }) => ({
    subject: `Your seat is saved: ${mTitle(d, m)}`,
    html: shell("Your seat is saved", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}you're in for <strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong>.`),
      detail("When", when((d.scheduled_at || m.scheduled_at) as string)),
      m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
      questions(m.discussion_questions as string),
      p("Come with one honest answer. That's the whole entry fee."),
    // Live meeting row wins over the payload: the payload is a snapshot taken
    // when the man registered, and the room can move between then and send.
      p(`<strong style="color:#f7f1e6;">Come with one honest answer, ${esc(name || "brother")}. That is the whole entry fee.</strong>`),
    ].join(""), { label: "Open the meeting", url: String(m.join_url || d.join_url || ROOM) }),
  }),

  schedule_correction: ({ d, m, name }) => ({
    subject: `Correction: Scripture Gym is MONDAY, not Wednesday`,
    html: shell("We got the day wrong", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}an earlier email said Open Gym meets Wednesday. That was our mistake. Scripture Gym meets <strong style="color:#f7f1e6;">Monday at 7:00 PM ET</strong> \u2014 every week.`),
      detail("Next session", when((d.scheduled_at || m.scheduled_at) as string)),
      p("Apologies for the confusion. The schedule in the app and every future reminder now say Monday."),
      p("You don't need to be ready. You need to be there."),
      p(`<strong style="color:#f7f1e6;">Thank you for your patience, ${esc(name || "brother")}. See you Monday.</strong>`),
    ].join(""), { label: "Join the room", url: String(d.join_url || m.join_url || ROOM) }),
  }),

  weekly_open_gym: ({ d, m, name }) => ({
    subject: `${dayName((d.scheduled_at || m.scheduled_at) as string)}: ${mTitle(d, m)}`,
    html: shell("This week at the gym", [
      p(`${greet(name)}we're back in the room this week for <strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong>. Same room, same time, the way it runs every week.`),
      detail("When", when((d.scheduled_at || m.scheduled_at) as string)),
      m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
      questions(m.discussion_questions as string),
      p("You don't need to be ready. You need to be there."),
      p(`<strong style="color:#f7f1e6;">Bring whatever this week has done to you, ${esc(name || "brother")}. That is what the room is for.</strong>`),
    ].join(""), { label: "Join the room", url: String(d.join_url || m.join_url || ROOM) }),
  }),

  reminder_7d: ({ d, m, name }) => {
    const h = hoursUntil(m.scheduled_at as string);
    const days = h === null ? null : Math.round(h / 24);
    return {
      subject: `${days !== null && days <= 1 ? "Coming up" : `${days} days out`}: ${mTitle(d, m)}`,
      html: shell("On the calendar", [
        p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> is ${days !== null && days <= 1 ? "almost here" : `${days} days out`}.`),
        detail("When", when(m.scheduled_at as string)),
        m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
        p("Far enough out to move what needs moving. Put it in your calendar now."),
      ].join(""), { label: "See the session", url: `${APP}?share=${m.share_slug}` }),
    };
  },

  meeting_rescheduled: ({ d, m, name }) => ({
    subject: `New time: ${mTitle(d, m)}`,
    html: shell("The time has moved", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> has been rescheduled. Your seat is still yours — nothing to do but note the new time.`),
      detail("Was", when(d.old_time as string)),
      detail("Now", when((d.new_time || m.scheduled_at) as string)),
      p("Your reminders have already been moved with it."),
    ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
  }),

  reminder_24h: ({ d, m, name }) => {
    const l = lead(hoursUntil(m.scheduled_at as string));
    return {
      subject: `${l.word}: ${mTitle(d, m)}`,
      html: shell(l.word, [
        p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> ${l.sentence}.`),
        detail("When", when(m.scheduled_at as string)),
        questions(m.discussion_questions as string),
        p(`<strong style="color:#f7f1e6;">Clear the night if you can, ${esc(name || "brother")}. It is worth the hour.</strong>`),
      ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
    };
  },

  reminder_1h: ({ d, m, name }) => {
    const h = hoursUntil(m.scheduled_at as string);
    const soon = h !== null && h < 0.75;
    return {
      subject: soon ? `Starting now: ${mTitle(d, m)}` : `One hour: ${mTitle(d, m)}`,
      html: shell(soon ? "Starting now" : "One hour out", [
        p(`<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> ${soon ? "is starting" : "starts in an hour"}.`),
        detail("Starts", when(m.scheduled_at as string)),
        p("Bring something to write with."),
        p(`<strong style="color:#f7f1e6;">See you in there, ${esc(name || "brother")}.</strong>`),
      ].join(""), { label: "Join the room", url: String(m.join_url || ROOM) }),
    };
  },

  meeting_cancelled: ({ d, name }) => ({
    subject: `Cancelled: ${mTitle(d, m)}`,
    html: shell("This one's been called off", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}<strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong> has been cancelled.`),
      p("Nothing is required from you. Watch for the next one."),
      p(`<strong style="color:#f7f1e6;">Nothing is required from you, ${esc(name || "brother")}. Watch for the next one.</strong>`),
    ].join(""), { label: "See what's open", url: APP }),
  }),

  meeting_completed_followup: ({ d, m, name }) => ({
    subject: `Recap: ${mTitle(d, m)}`,
    html: shell("In the books", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}thank you for showing up to <strong style="color:#f7f1e6;">${esc(mTitle(d, m))}</strong>.`),
      m.notes ? detail("Notes", String(m.notes)) : "",
      m.focus_verses ? detail("Verses", String(m.focus_verses)) : "",
      p("The work continues where nobody's watching."),
      p(`<strong style="color:#f7f1e6;">The work continues where nobody is watching, ${esc(name || "brother")}.</strong>`),
    ].join(""), { label: "What's next", url: APP }),
  }),

  gym_invite: ({ d, name }) => ({
    subject: "You've been called into the Scripture Gym",
    html: shell("You've been called in", [
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}${esc(d.invited_by_name || "a brother")} invited you into the Scripture Gym.`),
      p("It's where the men train the Word like iron — live sessions, honest rooms, and the discipline of showing up."),
      p(`<strong style="color:#f7f1e6;">The door is open, ${esc(name || "brother")}. Walk through it.</strong>`),
    ].join(""), { label: "Step in", url: APP }),
  }),

  /* ---- WELCOME SERIES, days 2-5. Day 1 is welcome_member above.
     Each one ends with exactly one action. Queued on signup by
     gym_enqueue_welcome() with staggered send_after. ---- */

  welcome_day2: ({ name }) => ({
    subject: "Why we memorize (it's not what you think)",
    html: shell("Why we memorize", [
      p(`${greet(name)}most men know <em>about</em> the Bible. Fewer men have it <em>in</em> them.`),
      p("There's a difference between a verse you can look up and a verse that shows up uninvited — at 11 PM when you're about to send the text you shouldn't send. At the dinner table when your son asks something you weren't ready for. In the argument, before you say the thing you can't take back."),
      p("You can't look up what you haven't stored."),
      p("That's what the Scripture Gym is. Not a Bible trivia contest. A weight room for the only muscle that decides who you are when nobody's watching."),
      p("Verses are grouped into <strong style=\"color:#f7f1e6;\">muscle groups</strong> — marriage, fatherhood, temper, provision, integrity. You pick one. You train a few reps at a time."),
      p("<strong style=\"color:#f7f1e6;\">Today's rep:</strong> open the Scripture Gym and pick the muscle group that names your weakest area. Not your strongest. Your weakest."),
      p(`<strong style="color:#f7f1e6;">Store it now, ${esc(name || "brother")}, so it is there when you need it.</strong>`),
    ].join(""), { label: "Open the Scripture Gym", url: APP }),
  }),

  welcome_day3: ({ name }) => ({
    subject: "What actually happens Monday night",
    html: shell("What happens in the room", [
      p(`${greet(name)}some men have never sat in a room like this, so let me take the mystery out of it.`),
      detail("When", "Every Monday, 7:00 PM ET. One link, same room."),
      p("<strong style=\"color:#f7f1e6;\">We open with study.</strong> A passage, and a real conversation about it. Not a lecture you sit through — a discussion you're in. Men say true things about their marriages, their tempers, their fathers, their work."),
      p("<strong style=\"color:#f7f1e6;\">We close with the reps.</strong> You leave with the week's memory verse and a clear thing to work on."),
      p("You don't have to talk. First-timers often don't, and nobody pushes. But most men find out fast that saying the true thing out loud, to men who won't flinch, does something no book does."),
      p("Come as you are. Come tired. Come from the car. Just come."),
      p("<strong style=\"color:#f7f1e6;\">Today's rep:</strong> put Monday 7:00 PM on your calendar right now, before you close this. Set it to repeat."),
      p(`<strong style="color:#f7f1e6;">The room is better when you are in it, ${esc(name || "brother")}.</strong>`),
    ].join(""), { label: "See this week's session", url: APP }),
  }),

  welcome_day4: ({ name }) => ({
    subject: "Tools we've already paid for",
    html: shell("Already covered", [
      p(`${greet(name)}a man who wants to grow shouldn't be blocked by a paywall. So some of this is already handled.`),
      p("<strong style=\"color:#f7f1e6;\">RightNow Media</strong> — think Netflix for Bible study. More than 25,000 video studies on marriage, fatherhood, money, leadership and recovery, from teachers like Tony Evans, Francis Chan and John Maxwell. Safe shows for your kids too. Grace Family Church sponsors it, so it costs you nothing."),
      p("<strong style=\"color:#f7f1e6;\">The reading list.</strong> Start with <em>Disciplines of a Godly Man</em> if you want the foundation, or <em>Stand Firm</em> if you want the shorter, sharper hit."),
      p("You don't need all of it. You need one of it, actually finished."),
      p("<strong style=\"color:#f7f1e6;\">Today's rep:</strong> claim your RightNow Media access — two minutes — or order one book. One. Then close the tab and go be present with your people."),
      p(`<strong style="color:#f7f1e6;">Take what has already been paid for, ${esc(name || "brother")}. It is yours.</strong>`),
    ].join(""), { label: "Open Resources", url: APP }),
  }),

  welcome_day5: ({ name }) => ({
    subject: "The only thing that separates these men",
    html: shell("The honest part", [
      p(`${greet(name)}five days in. Here's the honest part.`),
      p("Nothing in this app will change you. Not the verses, not the videos, not the Monday room. Men have sat in rooms like this for years and walked out exactly as they came in."),
      p("What changes a man is the boring thing: showing up when he doesn't feel like it. Again. And again."),
      p("That's the whole secret, and it's why this is built like a gym instead of a library. Nobody gets strong reading about squats."),
      p(`<em style="color:#c8862e;">"Let us not grow weary in well-doing, for in due time we will reap a harvest, if we do not give up." — Galatians 6:9</em>`),
      p("You will miss a Monday. You will drop a streak. That isn't failure, that's a rep you didn't get. Get the next one."),
      p("<strong style=\"color:#f7f1e6;\">Today's rep:</strong> mark one verse as memorized. Your first. Then show up Monday and tell a brother you did it."),
      p(`<strong style="color:#f7f1e6;">Consistency is the whole game, ${esc(name || "brother")}. Start your count today.</strong>`),
    ].join(""), { label: "Train a verse", url: APP }),
  }),

  /* The Daily Rep. Same content the app shows on the Forge that morning —
     both read public.daily_reps, so the email and the screen can never
     disagree about what today's work is. */
  daily_rep: ({ d, name }) => ({
    subject: String(d.headline || "Today's rep"),
    html: shell(String(d.headline || "Today's rep"), [
      d.verse_text
        ? `<p style="margin:0 0 16px;padding-left:14px;border-left:2px solid rgba(216,168,92,.25);font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.55;color:#c8862e;">&ldquo;${esc(d.verse_text)}&rdquo;<span style="display:block;font-style:normal;font-size:12px;color:#8a7f6d;margin-top:5px;">${esc(d.verse_ref)}</span></p>`
        : "",
      p(`${greet(name)}today's work is one thing, not five.`),
      `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c8862e;">Today's rep</p>`,
      p(`<strong style="color:#f7f1e6;">${esc(d.action)}</strong>`),
      p(`Mark it done in the app when you have done it. The streak is not the point &mdash; but it will tell you the truth about your week.`),
      d.is_monday ? p(`<strong style="color:#f7f1e6;">The room meets tonight, 7:00 PM ET.</strong>`) : "",
    ].join(""), { label: "Log today's rep", url: APP }),
  }),

  welcome_member: ({ name }) => ({
    subject: "Welcome to the Kingdom",
    html: shell("Welcome, brother", [
      // Do NOT claim the account is already active here. Signup confirmation
      // is ON (mailer_autoconfirm=false), so a separate Supabase email carries
      // the link he must click. Telling him there is nothing to verify is how
      // a man ends up locked out believing he is already in.
      p(`${name ? `Hey ${esc(name)} \u2014 ` : "Hey brother \u2014 "}you're in. One thing first: check your inbox for a separate email titled "Welcome to the Kingdom — confirm your account" and click the button inside. That switches your account on.`),
      p(`If it isn't there in a few minutes, look in spam — the first message from a new address often lands there. Mark it "not spam" and the rest will come straight through.`),
      p("The Scripture Gym is where the work happens: live sessions with other men, verses to train on, and the discipline of showing up when you don't feel like it."),
      p(`<em style="color:#c8862e;">"A disciplined man builds a home where his whole family can thrive."</em>`),
      p(`<strong style="color:#f7f1e6;">You did not find this room by accident, ${esc(name || "brother")}. Step in.</strong>`),
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

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // AUTHORISATION. This function drains the mail queue and can report who
    // received what. A plain member token used to be enough to call it — any
    // signed-in man could force a send or probe another man's mail history.
    // Only the service role (cron) or a Super Admin may call it now.
    {
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      let allowed = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      // The cron job authenticates with the legacy service_role JWT, which is
      // not always byte-identical to the injected env var. Trust the token's
      // own role claim instead of comparing strings.
      if (!allowed && token.startsWith("eyJ")) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (payload?.role === "service_role") allowed = true;
        } catch { /* not a readable JWT */ }
      }

      if (!allowed && token) {
        const { data: u } = await db.auth.getUser(token);
        if (u?.user?.id) {
          const { data: prof } = await db
            .from("profiles").select("role").eq("id", u.user.id).maybeSingle();
          allowed = prof?.role === "owner";
        }
      }
      if (!allowed) {
        return json({ ok: false, error: "Not authorised." }, 403);
      }
    }

    const dryRun = body.dry_run === true;

    // { "probe": "someone@example.com" } -> what Brevo actually did with his
    // mail. Answers the only question that matters when a man says he never
    // got it: accepted-but-bounced, filtered as spam, or never sent at all.
    if (typeof body.probe === "string" && body.probe) {
      const key = Deno.env.get("BREVO_API_KEY");
      if (!key) return json({ ok: false, error: "BREVO_API_KEY is not set." }, 400);
      const acct = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key } });
      const ev = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(body.probe)}&limit=50`,
        { headers: { "api-key": key } });
      const events = ev.ok ? (await ev.json())?.events ?? [] : [];
      return json({
        ok: true,
        probe: body.probe,
        brevo_reachable: acct.ok,
        event_count: events.length,
        events: events.map((e: Record<string, unknown>) => ({
          event: e.event, date: e.date, subject: e.subject, reason: e.reason,
        })),
      });
    }
    const limit = Math.min(Number(body.limit) || 50, 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey && !dryRun) {
      return json({
        ok: false,
        error: "BREVO_API_KEY is not set on this function. Add it in Supabase → Edge Functions → Secrets.",
      }, 400);
    }


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
        name: firstName(row.recipient_name),   // first name only — see firstName()
      });

      if (dryRun) {
        // Where the button actually points — the thing most worth checking
        // before a batch goes out.
        const cta = html.match(/color:#c8862e;">(https?:\/\/[^<]+)<\/a>/)?.[1] ?? null;
        preview.push({ to: row.recipient_email, template: row.template_key, subject, cta,
          hasName: /Larry/.test(html), hasSig: /Go forth in victory/.test(html),
          hasFounder: /Founder, Kingdom of Disciplined Men/.test(html) });
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
        // Brevo returns a messageId. Keep it: "sent" means Brevo ACCEPTED the
        // message, not that it landed. Without this there is no way to trace
        // a message that bounced or was filtered after acceptance.
        let messageId: string | null = null;
        try { messageId = (await res.clone().json())?.messageId ?? null; } catch { /* non-JSON */ }
        await db.from("gym_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error: null,
            payload: { ...(row.payload as Record<string, unknown> ?? {}), brevo_message_id: messageId },
          })
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
