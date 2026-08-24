// Jethro — Larry's private business counsel. Calls the Anthropic API server-side.
// ANTHROPIC_API_KEY lives only as a Supabase function secret, never in the client.
//
// Unlike gideon, this function verifies WHO the caller is. The robots row carries
// private_to_user_id; if it is set, only that user may talk to the robot. verify_jwt
// at the gateway proves the caller is signed in, not that they are Larry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

const n = (v: unknown) => (typeof v === "number" ? v : 0);

async function buildContext(admin: any) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (k: number) => new Date(today.getTime() - k * 864e5);

  const [tiers, new7, new30, apps, meetings, regs, reps, log, notes, commits] = await Promise.all([
    admin.from("profiles").select("role"),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso(daysAgo(7))),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso(daysAgo(30))),
    admin.from("applications").select("status,created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("gym_meetings").select("id,title,scheduled_at,status").gte("scheduled_at", iso(daysAgo(30))).order("scheduled_at", { ascending: false }).limit(20),
    admin.from("gym_meeting_registrations").select("id", { count: "exact", head: true }).gte("created_at", iso(daysAgo(30))),
    admin.from("daily_rep_log").select("user_id", { count: "exact", head: true }).gte("rep_date", ymd(daysAgo(7))),
    admin.from("update_log").select("actor,summary,created_at").order("created_at", { ascending: false }).limit(15),
    admin.from("notepad").select("title,body,updated_at").order("updated_at", { ascending: false }).limit(5),
    admin.from("counsel_commitments").select("commitment,status,due_date,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(10),
  ]);

  const byTier: Record<string, number> = {};
  for (const r of tiers.data ?? []) byTier[r.role] = (byTier[r.role] ?? 0) + 1;

  const appByStatus: Record<string, number> = {};
  let staleApps = 0;
  const sixDays = daysAgo(6).getTime();
  for (const a of apps.data ?? []) {
    appByStatus[a.status ?? "unknown"] = (appByStatus[a.status ?? "unknown"] ?? 0) + 1;
    if ((a.status === "new" || a.status === "pending") && new Date(a.created_at).getTime() < sixDays) staleApps++;
  }

  return [
    `TODAY: ${today.toISOString().slice(0, 10)}`,
    `MEMBERS BY TIER: ${JSON.stringify(byTier)}`,
    `SIGNUPS: ${n(new7.count)} in last 7 days, ${n(new30.count)} in last 30 days`,
    `APPLICATIONS (last 50): ${JSON.stringify(appByStatus)}; ${staleApps} untouched for 6+ days`,
    `GYM MEETINGS last 30d: ${(meetings.data ?? []).length} scheduled, ${n(regs.count)} registrations`,
    `DAILY REP ENTRIES last 7d: ${n(reps.count)}`,
    `OPEN COMMITMENTS FROM PRIOR SESSIONS:\n${(commits.data ?? []).map((c: any) => `- ${c.commitment}${c.due_date ? ` (due ${c.due_date})` : ""} [opened ${String(c.created_at).slice(0, 10)}]`).join("\n") || "- none"}`,
    `RECENT SHIPPING (update_log):\n${(log.data ?? []).map((r: any) => `- ${String(r.created_at).slice(0, 10)} [${r.actor}] ${r.summary}`).join("\n") || "- none"}`,
    `LARRY'S RECENT NOTEPAD:\n${(notes.data ?? []).map((r: any) => `- ${r.title}: ${String(r.body ?? "").slice(0, 400)}`).join("\n") || "- none"}`,
  ].join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "Jethro's API key is not configured." }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Who is calling? verify_jwt proves signed-in, not identity.
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in." }, 401);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    const caller = userRes?.user;
    if (userErr || !caller) return json({ error: "Not signed in." }, 401);

    const { data: robot } = await admin
      .from("robots")
      .select("name,persona,description,model,is_active,private_to_user_id")
      .ilike("name", "jethro")
      .maybeSingle();

    if (!robot || !robot.is_active) return json({ error: "Jethro is not available." }, 404);
    if (robot.private_to_user_id && robot.private_to_user_id !== caller.id)
      return json({ error: "Jethro is not available." }, 404);

    const { messages = [] } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0)
      return json({ error: "No messages provided." }, 400);

    const { data: con } = await admin
      .from("ai_constitution").select("body,version").eq("is_current", true).maybeSingle();

    const context = await buildContext(admin);

    const system = [
      `You are ${robot.name}, private business counsel to Larry Beacham, founder of the Kingdom of Disciplined Men — a discipleship ministry and member platform in Tampa, FL.`,
      robot.persona ? `PERSONA:\n${robot.persona}` : "",
      con?.body ? `You are bound by the AI Constitution (v${con.version}). Obey it strictly:\n${con.body}` : "",
      `LIVE PLATFORM DATA — these are the real current numbers. Use them; never invent or round them into something friendlier.\n\n${context}`,
      `If Larry commits to a specific next action in this conversation, end your reply with a final line in exactly this form so it can be recorded:\nCOMMITMENT: <the single action, one sentence>\nOmit that line entirely if no clear commitment was made.`,
    ].filter(Boolean).join("\n\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: robot.model || "claude-opus-5",
        max_tokens: 2048,
        system,
        messages: messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? ""),
        })),
      }),
    });

    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Anthropic API error." }, r.status);

    let reply = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();

    // Pull the trailing COMMITMENT: line out of the visible reply.
    let commitment: string | null = null;
    const m = reply.match(/\nCOMMITMENT:\s*(.+)\s*$/);
    if (m) {
      commitment = m[1].trim();
      reply = reply.slice(0, m.index).trim();
    }

    return json({ reply: reply || "(no reply)", commitment, model: robot.model });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
