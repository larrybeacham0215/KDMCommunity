// Gideon — KDM operational assistant. Calls the Anthropic API server-side.
// The ANTHROPIC_API_KEY lives only as a Supabase function secret, never in the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "Gideon's API key is not configured." }, 500);

    const { messages = [] } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0)
      return json({ error: "No messages provided." }, 400);

    // Read persona + current constitution server-side (service role bypasses RLS).
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: robot } = await admin.from("robots").select("name,persona,description,model").ilike("name", "gideon").maybeSingle();
    const { data: con } = await admin.from("ai_constitution").select("body,version").eq("is_current", true).maybeSingle();

    const system = [
      `You are ${robot?.name ?? "Gideon"}, the operational assistant for the Kingdom of Disciplined Men — Larry Beacham's discipleship ministry in Tampa, FL.`,
      robot?.persona ? `PERSONA:\n${robot.persona}` : "",
      robot?.description ? `ROLE:\n${robot.description}` : "",
      con?.body ? `You are bound by the AI Constitution (v${con.version}). Obey it strictly:\n${con.body}` : "",
      `Hard rules: never fabricate facts, scripture, progress, or data — if you don't know, say so. Never expose one member's private data to another. No medical, legal, financial, or clinical advice; in a crisis, point to real human help. Be direct, encouraging, and honest; never shame the man.`,
    ].filter(Boolean).join("\n\n");

    const model = robot?.model || "claude-sonnet-4-6";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 1024, system,
        messages: messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") })),
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Anthropic API error." }, r.status);
    const reply = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    return json({ reply: reply || "(no reply)", model });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
