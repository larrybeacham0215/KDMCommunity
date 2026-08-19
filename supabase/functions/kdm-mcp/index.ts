// ============================================================================
// KDM MCP SERVER  —  Kingdom of Disciplined Men
// Remote MCP server (Streamable HTTP) for Claude custom connectors.
//
// URL SHAPE:   /functions/v1/kdm-mcp/<KDM_MCP_TOKEN>/mcp
// AUTH:        shared secret in the path, constant-time compared.
//              Deployed verify_jwt=false so Anthropic's cloud can reach it.
// SQL PATH:    public.mcp_exec_sql() / mcp_set_role(), SECURITY DEFINER,
//              EXECUTE granted to service_role ONLY (never anon/authenticated).
// KILL SWITCH: public.mcp_flags where key='connector' -> enabled=false.
// AUDIT:       every write lands in public.update_log as actor 'claude-mcp'.
// ============================================================================


const TOKEN = Deno.env.get("KDM_MCP_TOKEN") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SERVER_NAME = "kdm";
const SERVER_VERSION = "1.0.0";
const DEFAULT_PROTOCOL = "2025-06-18";
const ANON_KEY = "sb_publishable_F_BgmwyD3OgkpbRVINvI1A_PfSBA8AK";
const FN_BASE = SB_URL + "/functions/v1/kdm-mcp";
// Discovery documents live on kdmcommunity.com because Supabase's gateway
// answers /.well-known/* with 401, which makes Claude think OAuth failed.
const RESOURCE_METADATA = "https://kdmcommunity.com/.well-known/oauth-protected-resource";

/** Call a Postgres function through PostgREST. No SDK: the JSON-body deploy
 *  path does not bundle remote imports, so this file stays dependency-free. */
async function rpc(fn: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(SB_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("rpc " + fn + " failed (" + res.status + "): " + text.slice(0, 400));
  try { return JSON.parse(text); } catch { return text; }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

// ---------------------------------------------------------------- utilities

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Escape a value for safe inlining into SQL. */
function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/** Run SQL through the locked-down executor. */
async function q(text: string, wantRows = true): Promise<any> {
  const data = await rpc("mcp_exec_sql", { query: text, want_rows: wantRows });
  if (data && data.ok === false) throw new Error(data.error ?? "unknown error");
  return data;
}

async function rows(text: string): Promise<any[]> {
  const d = await q(text, true);
  return d?.rows ?? [];
}

const MAX_ROWS = 200;
const MAX_CHARS = 24000;

function renderRows(rs: unknown[]): string {
  if (!Array.isArray(rs) || rs.length === 0) return "(0 rows)";
  const shown = rs.slice(0, MAX_ROWS);
  let out = JSON.stringify(shown, null, 2);
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS) + "\n… (truncated)";
  const note =
    rs.length > shown.length
      ? "\n\n(" + rs.length + " rows total, showing first " + shown.length + ")"
      : "\n\n(" + rs.length + " row" + (rs.length === 1 ? "" : "s") + ")";
  return out + note;
}

function stripSql(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim();
}

const READ_ONLY_START = /^(select|with|explain|show|table)\b/i;
const DESTRUCTIVE =
  /\b(drop\s+(table|schema|database|function|view|policy|trigger|type|index)|truncate|delete\s+from|alter\s+table\s+\S+\s+drop)\b/i;
const RETURNS_ROWS = /^(select|with|explain|show|table)\b|\breturning\b/i;

async function auditLog(summary: string, detail: string) {
  try {
    await q(
      "INSERT INTO public.update_log (actor, summary, detail) VALUES ('claude-mcp', " +
        lit(summary.slice(0, 300)) + ", " + lit(detail.slice(0, 8000)) + ")",
      false,
    );
  } catch (_e) { /* audit failure must never break a tool call */ }
}

async function connectorEnabled(): Promise<boolean> {
  try {
    const r = await rows(
      "SELECT enabled FROM public.mcp_flags WHERE key = 'connector' LIMIT 1",
    );
    if (r.length === 0) return true;
    return r[0].enabled === true;
  } catch (_e) { return true; }
}

// ------------------------------------------------------------------- tools

const TOOLS = [
  {
    name: "kdm_status",
    description:
      "Health snapshot of the Kingdom of Disciplined Men platform: live site and member portal HTTP status, the deployed bundle hash, table count, member counts by tier, and recent change-log entries. Call this first when asked how the app is doing or what changed recently.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "kdm_schema",
    description:
      "Inspect the Supabase database structure. With no arguments, lists every table and view with approximate row counts and whether RLS is enabled. With a table name, returns that table's columns, types, defaults and RLS policies. Use this before writing queries so you work from the real schema.",
    inputSchema: {
      type: "object",
      properties: { table: { type: "string", description: "Optional table name for detail." } },
      additionalProperties: false,
    },
  },
  {
    name: "kdm_query",
    description:
      "Run a READ-ONLY SQL query (SELECT / WITH / EXPLAIN) against the KDM Postgres database. This bypasses row-level security and can see every member's private data. Rejects writes; use kdm_execute for those.",
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string", description: "A single read-only SQL statement." } },
      required: ["sql"],
      additionalProperties: false,
    },
  },
  {
    name: "kdm_execute",
    description:
      "Run a WRITE SQL statement (INSERT / UPDATE / DDL). Requires confirm=true. Destructive statements (DROP, TRUNCATE, DELETE FROM, ALTER..DROP) also require confirm_destructive=true. Every success is written to update_log. Always show the user the exact SQL and get agreement before setting confirm flags.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "The SQL to execute." },
        reason: { type: "string", description: "Short reason, recorded in the audit log." },
        confirm: { type: "boolean", description: "Must be true. The user approved this write." },
        confirm_destructive: { type: "boolean", description: "Also required for destructive SQL." },
      },
      required: ["sql", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "kdm_members",
    description:
      "List members with tier, streak and join date. Filter by role or search by name/email. Tiers: owner (shown as Super Admin), admin, cohort_leader, member.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "owner | admin | cohort_leader | member" },
        search: { type: "string", description: "Match against name or email." },
        limit: { type: "number", description: "Max rows, default 50." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kdm_set_role",
    description:
      "Change a member's tier. Handles the protect_profile_privileges trigger atomically. Promoting to 'owner' grants full control over every member's private data and requires confirm=true. Logged to update_log.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The member's email address." },
        role: { type: "string", description: "owner | admin | cohort_leader | member" },
        confirm: { type: "boolean", description: "Required when promoting to owner." },
      },
      required: ["email", "role"],
      additionalProperties: false,
    },
  },
  {
    name: "kdm_log",
    description:
      "Read or append to the KDM change log (update_log). action='read' lists recent entries; action='write' records a decision so nothing important happens silently (Article VII of the AI Constitution).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'read' or 'write'." },
        summary: { type: "string", description: "One-line summary (write only)." },
        detail: { type: "string", description: "Fuller detail (write only)." },
        limit: { type: "number", description: "Rows for read, default 20." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
];

// ------------------------------------------------------------ tool handlers

async function callTool(name: string, args: Record<string, any>): Promise<string> {
  if (name === "kdm_status") {
    const tables = await rows(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
    );
    const roles = await rows(
      "SELECT role, count(*)::int AS n FROM public.profiles GROUP BY role ORDER BY n DESC",
    );
    const log = await rows(
      "SELECT actor, summary, created_at FROM public.update_log ORDER BY created_at DESC LIMIT 8",
    );
    let site = "unknown", portal = "unknown", bundle = "unknown";
    try { site = String((await fetch("https://kdmcommunity.com/")).status); }
    catch (_e) { site = "unreachable"; }
    try {
      const r = await fetch("https://kdmcommunity.com/app/");
      portal = String(r.status);
      const html = await r.text();
      bundle = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? "not found";
    } catch (_e) { portal = "unreachable"; }

    const out = [
      "KDM PLATFORM STATUS",
      "===================",
      "Marketing site  https://kdmcommunity.com       HTTP " + site,
      "Member portal   https://kdmcommunity.com/app/  HTTP " + portal,
      "Live bundle     " + bundle,
      "Public tables   " + (tables[0]?.n ?? "?"),
      "",
      "MEMBERS BY TIER",
    ];
    for (const r of roles) out.push("  " + String(r.role).padEnd(14) + r.n);
    out.push("", "RECENT CHANGE LOG");
    for (const r of log) {
      out.push("  " + String(r.created_at).slice(0, 16) + "  [" + r.actor + "] " + r.summary);
    }
    return out.join("\n");
  }

  if (name === "kdm_schema") {
    if (!args.table) {
      return renderRows(await rows(
        "SELECT c.relname AS table_name, CASE WHEN c.relkind='v' THEN 'view' ELSE 'table' END AS kind, " +
        "c.reltuples::bigint AS approx_rows, c.relrowsecurity AS rls_enabled " +
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "WHERE n.nspname='public' AND c.relkind IN ('r','v') ORDER BY c.relname",
      ));
    }
    const t = lit(args.table);
    const cols = await rows(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name=" + t + " ORDER BY ordinal_position",
    );
    if (cols.length === 0) return 'No table named "' + args.table + '" in schema public.';
    const pol = await rows(
      "SELECT policyname, cmd, qual, with_check FROM pg_policies " +
      "WHERE schemaname='public' AND tablename=" + t,
    );
    return "COLUMNS — public." + args.table + "\n" + renderRows(cols) +
           "\n\nRLS POLICIES — public." + args.table + "\n" + renderRows(pol);
  }

  if (name === "kdm_query") {
    const clean = stripSql(String(args.sql ?? ""));
    if (!clean) return "Error: empty query.";
    if (!READ_ONLY_START.test(clean)) {
      return "Rejected: kdm_query runs read-only statements only (SELECT / WITH / EXPLAIN / SHOW / TABLE). Use kdm_execute for writes.";
    }
    if (/;\s*\S/.test(clean.replace(/;\s*$/, ""))) {
      return "Rejected: send a single statement (no semicolon-chained statements).";
    }
    try { return renderRows(await rows(clean.replace(/;\s*$/, ""))); }
    catch (e) { return "SQL error: " + (e as Error).message; }
  }

  if (name === "kdm_execute") {
    const clean = stripSql(String(args.sql ?? ""));
    if (!clean) return "Error: empty statement.";
    if (args.confirm !== true) {
      return "BLOCKED — confirm flag not set.\n\nShow the user this exact SQL, get explicit agreement, then call again with confirm=true:\n\n" + clean;
    }
    const destructive = DESTRUCTIVE.test(clean);
    if (destructive && args.confirm_destructive !== true) {
      return "BLOCKED — destructive statement (DROP / TRUNCATE / DELETE FROM / ALTER..DROP).\n\nConfirm the user understands data will be permanently removed, then call again with BOTH confirm=true and confirm_destructive=true:\n\n" + clean;
    }
    try {
      const wantRows = RETURNS_ROWS.test(clean);
      const d = await q(clean, wantRows);
      const out = wantRows ? renderRows(d?.rows ?? []) : (d?.rows_affected ?? 0) + " row(s) affected";
      await auditLog(
        "MCP execute: " + (args.reason ?? clean.slice(0, 120)),
        "SQL:\n" + clean + "\n\nDestructive: " + destructive + "\nResult:\n" + out.slice(0, 4000),
      );
      return "Executed.\n\n" + out + "\n\n(Logged to update_log as actor 'claude-mcp'.)";
    } catch (e) { return "SQL error: " + (e as Error).message; }
  }

  if (name === "kdm_members") {
    const limit = Math.min(Number(args.limit ?? 50), 500);
    const where: string[] = [];
    if (args.role) where.push("role = " + lit(args.role));
    if (args.search) {
      const s = lit("%" + args.search + "%");
      where.push("(full_name ILIKE " + s + " OR email ILIKE " + s + ")");
    }
    const sqlText =
      "SELECT full_name, email, role, streak, created_at FROM public.profiles " +
      (where.length ? "WHERE " + where.join(" AND ") + " " : "") +
      "ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'cohort_leader' THEN 2 ELSE 3 END, created_at " +
      "LIMIT " + limit;
    return renderRows(await rows(sqlText));
  }

  if (name === "kdm_set_role") {
    const valid = ["owner", "admin", "cohort_leader", "member"];
    if (!valid.includes(args.role)) return "Rejected: role must be one of " + valid.join(", ") + ".";
    if (args.role === "owner" && args.confirm !== true) {
      return "BLOCKED — promoting " + args.email + " to Super Admin (owner) grants full control over curriculum, every member's private data, and other members' tiers.\n\nConfirm with the user, then call again with confirm=true.";
    }
    let data: any;
    try {
      data = await rpc("mcp_set_role", { p_email: args.email, p_role: args.role });
    } catch (e) { return "Error: " + (e as Error).message; }
    if (!data?.ok) return "Error: " + (data?.error ?? "no such member");
    await auditLog(
      "MCP tier change: " + args.email + " " + data.previous_role + " -> " + data.new_role,
      "Changed by Claude via the MCP connector.\nMember: " + (data.name ?? "") +
      " (" + args.email + ")\nPrevious: " + data.previous_role + "\nNew: " + data.new_role,
    );
    return (data.name || args.email) + ": " + data.previous_role + " -> " + data.new_role +
           ". Logged to update_log.";
  }

  if (name === "kdm_log") {
    if (args.action === "write") {
      if (!args.summary) return "Error: summary is required when action='write'.";
      await q(
        "INSERT INTO public.update_log (actor, summary, detail) VALUES ('claude-mcp', " +
        lit(String(args.summary).slice(0, 300)) + ", " +
        lit(String(args.detail ?? "").slice(0, 8000)) + ")", false,
      );
      return "Written to update_log.";
    }
    const limit = Math.min(Number(args.limit ?? 20), 200);
    return renderRows(await rows(
      "SELECT actor, summary, detail, created_at FROM public.update_log ORDER BY created_at DESC LIMIT " + limit,
    ));
  }

  return "Unknown tool: " + name;
}


/* ==========================================================================
   OAUTH 2.1 (authorization code + PKCE, with dynamic client registration)

   Claude requires a 401 to begin the flow, and reads the resource_metadata
   pointer off the WWW-Authenticate header. That pointer aims at
   kdmcommunity.com because Supabase's gateway cannot serve /.well-known/*.
   ========================================================================== */

function rand(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

const LOGIN_PAGE = "https://kdmcommunity.com/connect-claude.html";

function jsonCors(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Sign in against Supabase auth, then require Super Admin. */
async function verifyOwner(email: string, password: string): Promise<{ id: string } | null> {
  const res = await fetch(SB_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "apikey": ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const uid = data?.user?.id;
  if (!uid) return null;
  const r = await rows(
    "SELECT role FROM public.profiles WHERE id = " + lit(uid) + " LIMIT 1",
  );
  if (r[0]?.role !== "owner") return null;
  return { id: uid };
}

async function handleRegister(req: Request): Promise<Response> {
  let body: any = {};
  try { body = await req.json(); } catch { /* DCR bodies are sometimes empty */ }
  const clientId = "kdm-" + rand(16);
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  await q(
    "INSERT INTO public.mcp_oauth_clients (client_id, client_name, redirect_uris) VALUES (" +
      lit(clientId) + ", " + lit(body?.client_name ?? "Claude") + ", " +
      lit(JSON.stringify(uris)) + "::jsonb)", false,
  );
  return new Response(JSON.stringify({
    client_id: clientId,
    client_name: body?.client_name ?? "Claude",
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }), { status: 201, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function handleAuthorize(req: Request, url: URL): Promise<Response> {
  // GET -> bounce the browser to the sign-in page hosted on kdmcommunity.com,
  // carrying the OAuth parameters along. Supabase cannot serve HTML itself.
  if (req.method === "GET") {
    const dest = new URL(LOGIN_PAGE);
    for (const k of ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method"]) {
      const v = url.searchParams.get(k);
      if (v) dest.searchParams.set(k, v);
    }
    return Response.redirect(dest.toString(), 302);
  }

  // POST -> the sign-in page submits JSON here and gets JSON back.
  let p: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    p = await req.json();
  } else {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) p[k] = String(v);
  }

  const clientId = p.client_id ?? "";
  const redirectUri = p.redirect_uri ?? "";
  const state = p.state ?? "";
  const challenge = p.code_challenge ?? "";
  if (!clientId || !redirectUri) {
    return jsonCors({ ok: false, error: "Missing client_id or redirect_uri." }, 400);
  }

  const owner = await verifyOwner(p.email ?? "", p.password ?? "");
  if (!owner) {
    return jsonCors({ ok: false, error: "Sign-in failed, or that account is not a Super Admin." }, 401);
  }

  const code = rand(32);
  await q(
    "INSERT INTO public.mcp_oauth_codes (code, client_id, redirect_uri, code_challenge, user_id, user_email, expires_at) VALUES (" +
      lit(code) + ", " + lit(clientId) + ", " + lit(redirectUri) + ", " +
      lit(challenge) + ", " + lit(owner.id) + ", " + lit(p.email ?? "") +
      ", now() + interval '10 minutes')", false,
  );
  await auditLog("MCP connector authorized via OAuth",
    "Super Admin " + (p.email ?? "") + " authorized a Claude client (" + clientId + ").");

  const dest = new URL(redirectUri);
  dest.searchParams.set("code", code);
  if (state) dest.searchParams.set("state", state);
  return jsonCors({ ok: true, redirect: dest.toString() });
}

async function handleToken(req: Request): Promise<Response> {
  const ct = req.headers.get("content-type") ?? "";
  let p: Record<string, string> = {};
  if (ct.includes("application/json")) {
    p = await req.json();
  } else {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) p[k] = String(v);
  }
  const bad = (e: string, d: string) =>
    new Response(JSON.stringify({ error: e, error_description: d }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

  const issue = async (userId: string, email: string, clientId: string) => {
    const access = rand(32), refresh = rand(32);
    await q(
      "INSERT INTO public.mcp_oauth_tokens (token, kind, client_id, user_id, user_email, expires_at) VALUES (" +
      lit(access) + ", 'access', " + lit(clientId) + ", " + lit(userId) + ", " + lit(email) +
      ", now() + interval '30 days'), (" +
      lit(refresh) + ", 'refresh', " + lit(clientId) + ", " + lit(userId) + ", " + lit(email) +
      ", now() + interval '365 days')", false,
    );
    return new Response(JSON.stringify({
      access_token: access, token_type: "Bearer",
      expires_in: 2592000, refresh_token: refresh, scope: "mcp",
    }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  };

  if (p.grant_type === "refresh_token") {
    const r = await rows(
      "SELECT user_id, user_email, client_id FROM public.mcp_oauth_tokens WHERE token = " +
      lit(p.refresh_token ?? "") + " AND kind='refresh' AND revoked=false AND (expires_at IS NULL OR expires_at > now())",
    );
    if (r.length === 0) return bad("invalid_grant", "Unknown or expired refresh token.");
    return await issue(r[0].user_id, r[0].user_email, r[0].client_id);
  }

  if (p.grant_type !== "authorization_code") return bad("unsupported_grant_type", "Use authorization_code or refresh_token.");

  const r = await rows(
    "SELECT * FROM public.mcp_oauth_codes WHERE code = " + lit(p.code ?? "") +
    " AND used = false AND expires_at > now()",
  );
  if (r.length === 0) return bad("invalid_grant", "Authorization code is invalid, used, or expired.");
  const row = r[0];
  if (row.code_challenge) {
    if (!p.code_verifier) return bad("invalid_grant", "code_verifier required.");
    if (await s256(p.code_verifier) !== row.code_challenge) return bad("invalid_grant", "PKCE verification failed.");
  }
  await q("UPDATE public.mcp_oauth_codes SET used = true WHERE code = " + lit(row.code), false);
  return await issue(row.user_id, row.user_email, row.client_id);
}

/** Bearer token -> valid? */
async function bearerOk(req: Request): Promise<boolean> {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const r = await rows(
    "SELECT 1 AS ok FROM public.mcp_oauth_tokens WHERE token = " + lit(m[1].trim()) +
    " AND kind='access' AND revoked=false AND (expires_at IS NULL OR expires_at > now()) LIMIT 1",
  );
  return r.length > 0;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="kdm", resource_metadata="' + RESOURCE_METADATA + '"',
    },
  });
}

// --------------------------------------------------------------- transport

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) =>
  ({ jsonrpc: "2.0", id, error: { code, message } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("kdm-mcp");
  const seg1 = idx >= 0 ? (parts[idx + 1] ?? "") : "";
  const seg2 = idx >= 0 ? (parts[idx + 2] ?? "") : "";

  // ---- OAuth endpoints (unauthenticated by design) ------------------------
  if (seg1 === "oauth") {
    try {
      if (seg2 === "register" && req.method === "POST") return await handleRegister(req);
      if (seg2 === "authorize") return await handleAuthorize(req, url);
      if (seg2 === "token" && req.method === "POST") return await handleToken(req);
    } catch (e) {
      return json({ error: "server_error", error_description: (e as Error).message }, 500);
    }
    return json({ error: "not_found" }, 404);
  }

  // Some clients probe the origin for discovery docs. Supabase's gateway
  // answers those with 401, so mirror them here too; harmless either way.
  if (seg1 === ".well-known" || seg1 === "well-known") {
    return json({
      resource: FN_BASE + "/mcp",
      authorization_servers: ["https://kdmcommunity.com"],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"],
    });
  }

  // ---- MCP endpoint auth --------------------------------------------------
  // Either a valid OAuth bearer token, or the legacy path secret (kept so the
  // endpoint stays testable with curl and usable by non-OAuth clients).
  const pathSecretOk = !!TOKEN && timingSafeEqual(seg1, TOKEN);
  if (!pathSecretOk && !(await bearerOk(req))) return unauthorized();

  if (req.method === "GET") return json({ error: "method not allowed" }, 405);
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let msg: any;
  try { msg = await req.json(); }
  catch { return json(rpcError(null, -32700, "Parse error"), 400); }

  if (msg && msg.id === undefined) return new Response(null, { status: 202, headers: CORS });

  const { id, method, params } = msg ?? {};
  try {
    if (method === "initialize") {
      const requested = params?.protocolVersion;
      return json(rpcResult(id, {
        protocolVersion: typeof requested === "string" ? requested : DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          "Tools for the Kingdom of Disciplined Men platform (Supabase + GitHub Pages). " +
          "These tools bypass row-level security and can read every member's private data, " +
          "so treat member information as confidential and never surface one member's data to " +
          "another. Prefer kdm_status and kdm_schema before querying. Always show the user the " +
          "exact SQL and get agreement before any write.",
      }));
    }
    if (method === "ping") return json(rpcResult(id, {}));
    if (method === "tools/list") return json(rpcResult(id, { tools: TOOLS }));
    if (method === "resources/list") return json(rpcResult(id, { resources: [] }));
    if (method === "prompts/list") return json(rpcResult(id, { prompts: [] }));

    if (method === "tools/call") {
      if (!(await connectorEnabled())) {
        return json(rpcResult(id, {
          content: [{ type: "text", text:
            "The KDM connector is currently DISABLED via the kill switch (Command -> Systems -> Connectors, or mcp_flags.enabled). No tools will run." }],
          isError: true,
        }));
      }
      const nm = params?.name;
      if (!TOOLS.some((t) => t.name === nm)) return json(rpcError(id, -32602, "Unknown tool: " + nm));
      try {
        const text = await callTool(nm, params?.arguments ?? {});
        return json(rpcResult(id, { content: [{ type: "text", text }] }));
      } catch (e) {
        return json(rpcResult(id, {
          content: [{ type: "text", text: "Tool error: " + (e as Error).message }], isError: true,
        }));
      }
    }
    return json(rpcError(id, -32601, "Method not found: " + method));
  } catch (e) {
    return json(rpcError(id ?? null, -32603, (e as Error).message));
  }
});
