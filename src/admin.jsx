import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Brain, NotebookPen, Bot, Cpu, ScrollText, Plug, Workflow, Webhook,
  KeyRound, Activity, LayoutGrid, Plus, Trash2, Save, RefreshCw, Power,
  Send, Shield, Sparkles, ChevronRight, X, AlertTriangle, Circle, CheckCircle2,
} from "lucide-react";
import { supabase } from "./dataService";
import { T, Eyebrow, Btn, Card, inputBase, Field } from "./ui";

/* ============================================================================
   COMMAND (owner-only) navigation + Systems sub-menu.
   Exported so the side menu in App.jsx can render them.
   ========================================================================== */
export const OWNER_NAV = [
  { id: "admin_users", label: "Members & Roles", icon: Users },
  { id: "admin_memories", label: "Memories", icon: Brain },
  { id: "admin_notepad", label: "Notepad", icon: NotebookPen },
  { id: "gideon", label: "Gideon AI", icon: Bot },
  { id: "admin_robots", label: "Robots", icon: Cpu },
  { id: "admin_constitution", label: "AI Constitution", icon: ScrollText },
];

export const SYSTEMS_SUB = [
  { id: "sys_overview", label: "Overview", icon: LayoutGrid },
  { id: "sys_integrations", label: "Integrations", icon: Plug },
  { id: "sys_automations", label: "Automations", icon: Workflow },
  { id: "sys_webhooks", label: "Webhooks", icon: Webhook },
  { id: "sys_secrets", label: "Secrets & Keys", icon: KeyRound },
  { id: "sys_log", label: "Update Log", icon: Activity },
];

export const ADMIN_TITLES = {
  admin_users: "Members & Roles", admin_memories: "Memories", admin_notepad: "Notepad",
  gideon: "Gideon AI", admin_robots: "Robots", admin_constitution: "AI Constitution",
  systems: "Systems", sys_overview: "Systems · Overview", sys_integrations: "Systems · Integrations",
  sys_automations: "Systems · Automations", sys_webhooks: "Systems · Webhooks",
  sys_secrets: "Systems · Secrets & Keys", sys_log: "Systems · Update Log",
};

/* ---------------------------------------------------------------------------
   helpers
   ------------------------------------------------------------------------- */
async function logUpdate(actor, summary, detail) {
  try { await supabase.from("update_log").insert({ actor, summary, detail }); } catch (_) {}
}

function useTable(table, order = "created_at") {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
    if (error) setErr(error.message); else { setRows(data || []); setErr(null); }
    setLoading(false);
  }, [table, order]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, err, reload, setRows };
}

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
  <Card pad={16} style={{ borderColor: "rgba(212,80,43,.4)" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <AlertTriangle size={16} color={T.emberHot} />
      <span style={{ fontFamily: T.body, fontSize: 13, color: T.emberLt }}>{msg}</span>
    </div>
  </Card>
);

const fmt = d => d ? new Date(d).toLocaleString() : "—";

/* ===========================================================================
   MEMBERS & ROLES   (owner reads all profiles; can promote/demote)
   ========================================================================= */
function AdminUsers({ profile }) {
  const { rows, loading, err, reload, setRows } = useTable("profiles", "created_at");
  const [busy, setBusy] = useState(null);

  const setRole = async (u, role) => {
    setBusy(u.id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", u.id);
    if (!error) {
      setRows(rs => rs.map(r => r.id === u.id ? { ...r, role } : r));
      logUpdate(profile?.email || "owner", `Role change → ${role}`, `${u.email} set to ${role}`);
    }
    setBusy(null);
  };

  return (
    <Wrap>
      <Head kicker="Command" title="Members & Roles"
        sub="Everyone in the Kingdom. Promote a man to owner or hold him as a member."
        right={<Btn kind="ghost" onClick={reload}><RefreshCw size={14} /> Refresh</Btn>} />
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>No members yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(u => (
            <Card key={u.id} pad={16} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: T.gold, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1206",
                fontFamily: T.reg, fontWeight: 700,
              }}>{(u.full_name?.[0] || u.email?.[0] || "M").toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream }}>{u.full_name || "—"}</div>
                <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted }}>{u.email}</div>
                <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 2 }}>
                  Streak {u.streak ?? 0} · Joined {fmt(u.created_at).split(",")[0]}
                </div>
              </div>
              <span style={{
                fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase",
                padding: "5px 10px", borderRadius: 2,
                color: u.role === "owner" ? "#1a1206" : T.bronzeLt,
                background: u.role === "owner" ? T.gold : "transparent",
                border: `1px solid ${u.role === "owner" ? "transparent" : T.line}`,
              }}>{u.role || "member"}</span>
              {u.id !== profile?.id && (
                <Btn kind="ghost" disabled={busy === u.id}
                  onClick={() => setRole(u, u.role === "owner" ? "member" : "owner")}>
                  {busy === u.id ? "…" : u.role === "owner" ? "Make member" : "Make owner"}
                </Btn>
              )}
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   MEMORIES
   ========================================================================= */
function Memories({ profile }) {
  const { rows, loading, err, reload } = useTable("memories", "created_at");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", title: "", content: "", source: "manual" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("memories").insert({
      category: form.category || "general", title: form.title, content: form.content,
      source: form.source || "manual", created_by: profile?.id,
    });
    setSaving(false);
    if (!error) { setForm({ category: "", title: "", content: "", source: "manual" }); setOpen(false); reload(); logUpdate(profile?.email || "owner", "Memory added", form.title); }
  };
  const del = async (id) => { await supabase.from("memories").delete().eq("id", id); reload(); };

  return (
    <Wrap>
      <Head kicker="Command" title="Memories"
        sub="The Kingdom's long-term recall — decisions, facts, and context that should never be lost."
        right={<Btn onClick={() => setOpen(o => !o)}>{open ? <><X size={14} /> Close</> : <><Plus size={14} /> New</>}</Btn>} />
      {open && (
        <Card pad={18} style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div><Field label="Category" /><input style={inputBase} value={form.category} placeholder="e.g. foundation" onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div><Field label="Source" /><input style={inputBase} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} /></div>
          </div>
          <div style={{ marginTop: 12 }}><Field label="Title" /><input style={inputBase} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div style={{ marginTop: 12 }}><Field label="Content" /><textarea rows={4} style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} /></div>
          <div style={{ marginTop: 14 }}><Btn onClick={save} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save Memory"}</Btn></div>
        </Card>
      )}
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>No memories yet. Add the first.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(m => (
            <Card key={m.id} pad={16}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.bronze }}>{m.category}</span>
                <button onClick={() => del(m.id)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={15} /></button>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 15, color: T.cream, fontWeight: 600, margin: "4px 0 6px" }}>{m.title}</div>
              {m.content && <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.content}</p>}
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 8 }}>{m.source} · {fmt(m.created_at)}</div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   NOTEPAD
   ========================================================================= */
function Notepad({ profile }) {
  const { rows, loading, err, reload } = useTable("notepad", "updated_at");
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("notepad").insert({ title: draft.title || "Untitled", body: draft.body });
    setSaving(false);
    if (!error) { setDraft({ title: "", body: "" }); reload(); logUpdate(profile?.email || "owner", "Note added", draft.title); }
  };
  const del = async (id) => { await supabase.from("notepad").delete().eq("id", id); reload(); };

  return (
    <Wrap>
      <Head kicker="Command" title="Notepad" sub="Quick scratchpad — thoughts, drafts, and reminders for running the operation." />
      <Card pad={18} style={{ marginBottom: 16 }}>
        <Field label="Title" /><input style={inputBase} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        <div style={{ marginTop: 12 }}><Field label="Note" /><textarea rows={4} style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} /></div>
        <div style={{ marginTop: 14 }}><Btn onClick={add} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Add Note"}</Btn></div>
      </Card>
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>Notepad is empty.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(n => (
            <Card key={n.id} pad={16}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: T.body, fontSize: 15, color: T.cream, fontWeight: 600 }}>{n.title}</span>
                <button onClick={() => del(n.id)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={15} /></button>
              </div>
              {n.body && <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</p>}
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 8 }}>Updated {fmt(n.updated_at || n.created_at)}</div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   GIDEON AI  (chat UI, offline until ANTHROPIC_API_KEY set)
   ========================================================================= */
function Gideon() {
  const { rows, loading } = useTable("robots", "created_at");
  const gideon = rows.find(r => (r.name || "").toLowerCase() === "gideon") || rows[0];
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [sending, setSending] = useState(false);
  const scroller = useRef(null);
  const online = true;

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, sending]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    const next = [...msgs, { role: "user", content }];
    setMsgs(next); setText(""); setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gideon", { body: { messages: next } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMsgs(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", content: "⚠ " + (e?.message || "Gideon couldn't respond just now. Try again."), error: true }]);
    } finally { setSending(false); }
  };

  return (
    <Wrap>
      <Head kicker="Command · Robot" title="Gideon AI"
        sub="Your primary operational assistant — summaries, drafts, logging, and memory, governed by the AI Constitution." />

      {/* online status */}
      <Card pad={14} style={{ marginBottom: 16, borderColor: "rgba(231,171,76,.3)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#7bbf6a", boxShadow: "0 0 8px #7bbf6a", flexShrink: 0 }} />
          <span style={{ fontFamily: T.body, fontSize: 13, color: T.cream }}>
            Gideon is <b style={{ color: T.bronzeLt }}>online</b> — running on the Anthropic API through a secure Supabase edge function. The key stays server-side.
          </span>
        </div>
      </Card>

      {/* robot card */}
      {loading ? <Loading /> : gideon && (
        <Card pad={18} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 10, background: "radial-gradient(circle,rgba(231,171,76,.25),transparent 70%)", border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={24} color={T.bronzeLt} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.display, fontSize: 20, color: T.cream }}>{gideon.name}</div>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted }}>{gideon.model} · {gideon.is_active ? "active" : "inactive"}</div>
            </div>
            <Shield size={18} color={T.bronze} title="Governed by the AI Constitution" />
          </div>
          {gideon.description && <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.55, marginTop: 12 }}>{gideon.description}</p>}
        </Card>
      )}

      {/* chat surface */}
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div ref={scroller} style={{ padding: 18, maxHeight: 420, minHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* greeting (display only) */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(231,171,76,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={15} color={T.bronzeLt} /></div>
            <div style={{ background: T.surface2, border: `1px solid ${T.lineSoft}`, borderRadius: "2px 10px 10px 10px", padding: "11px 14px", maxWidth: "82%" }}>
              <p style={{ fontFamily: T.body, fontSize: 14, color: T.cream, lineHeight: 1.5 }}>
                Peace, Larry. I'm Gideon. Ask me anything — summaries, drafts, planning, or recall. I won't fabricate, and I never cross a man's privacy.
              </p>
            </div>
          </div>

          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ background: "rgba(200,134,46,.16)", border: `1px solid ${T.line}`, borderRadius: "10px 2px 10px 10px", padding: "11px 14px", maxWidth: "82%" }}>
                <p style={{ fontFamily: T.body, fontSize: 14, color: T.cream, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}</p>
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(231,171,76,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={15} color={m.error ? T.emberHot : T.bronzeLt} /></div>
              <div style={{ background: T.surface2, border: `1px solid ${m.error ? "rgba(212,80,43,.4)" : T.lineSoft}`, borderRadius: "2px 10px 10px 10px", padding: "11px 14px", maxWidth: "82%" }}>
                <p style={{ fontFamily: T.body, fontSize: 14, color: m.error ? T.emberLt : T.cream, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}</p>
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(231,171,76,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={15} color={T.bronzeLt} /></div>
              <span style={{ fontFamily: T.body, fontSize: 13, color: T.muted2 }}>Gideon is thinking…</span>
            </div>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, padding: 12, display: "flex", gap: 10, alignItems: "center", background: T.obsidian }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Message Gideon…" style={inputBase} />
          <Btn onClick={send} disabled={sending || !text.trim()}><Send size={15} /></Btn>
        </div>
      </Card>
    </Wrap>
  );
}

/* ===========================================================================
   ROBOTS
   ========================================================================= */
function Robots({ profile }) {
  const { rows, loading, err, reload, setRows } = useTable("robots", "created_at");
  const toggle = async (r) => {
    const next = !r.is_active;
    setRows(rs => rs.map(x => x.id === r.id ? { ...x, is_active: next } : x));
    await supabase.from("robots").update({ is_active: next }).eq("id", r.id);
    logUpdate(profile?.email || "owner", `Robot ${next ? "activated" : "deactivated"}`, r.name);
  };
  return (
    <Wrap>
      <Head kicker="Command" title="Robots"
        sub="The AI workers in the Kingdom. Each one operates under the Constitution."
        right={<Btn kind="ghost" onClick={reload}><RefreshCw size={14} /> Refresh</Btn>} />
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>No robots yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(r => (
            <Card key={r.id} pad={16} style={{ display: "flex", gap: 13, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Bot size={22} color={T.bronzeLt} /></div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: T.body, fontSize: 15, color: T.cream, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted }}>{r.model}</div>
                {r.description && <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted2, marginTop: 4, lineHeight: 1.5 }}>{r.description}</p>}
              </div>
              <button onClick={() => toggle(r)} style={{
                display: "flex", alignItems: "center", gap: 7, cursor: "pointer", borderRadius: 2,
                padding: "8px 12px", background: "transparent",
                border: `1px solid ${r.is_active ? "rgba(231,171,76,.5)" : T.line}`,
                color: r.is_active ? T.bronzeLt : T.muted2, fontFamily: T.reg, fontSize: 12,
              }}>
                <Power size={14} /> {r.is_active ? "Active" : "Inactive"}
              </button>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   AI CONSTITUTION (viewer)
   ========================================================================= */
function Constitution() {
  const { rows, loading, err } = useTable("ai_constitution", "version");
  const current = rows.find(r => r.is_current) || rows[0];
  return (
    <Wrap>
      <Head kicker="Command" title="AI Constitution"
        sub="The law every robot in the Kingdom is bound by." />
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : !current ? <Empty>No constitution on file.</Empty> : (
        <Card pad={24}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ScrollText size={18} color={T.bronze} />
            <span style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: T.bronzeLt }}>Version {current.version}{current.is_current ? " · current" : ""}</span>
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 15, color: T.cream, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{current.body}</div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 16 }}>Ratified {fmt(current.created_at)}</div>
        </Card>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   ADMIN ROUTER
   ========================================================================= */
export function AdminScreen({ view, profile }) {
  if (view === "admin_users") return <AdminUsers profile={profile} />;
  if (view === "admin_memories") return <Memories profile={profile} />;
  if (view === "admin_notepad") return <Notepad profile={profile} />;
  if (view === "gideon") return <Gideon />;
  if (view === "admin_robots") return <Robots profile={profile} />;
  if (view === "admin_constitution") return <Constitution />;
  return null;
}

/* ===========================================================================
   SYSTEMS  (hub + sub-pages — scaffold for Larry to wire up)
   ========================================================================= */
const PlaceholderModule = ({ icon: Icon, title, blurb, ideas }) => (
  <Wrap>
    <Head kicker="Systems" title={title} sub={blurb} />
    <Card pad={22} style={{ textAlign: "center", marginBottom: 14 }}>
      <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 12, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle,rgba(231,171,76,.12),transparent 70%)" }}>
        <Icon size={26} color={T.bronzeLt} />
      </div>
      <div style={{ fontFamily: T.reg, fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: T.muted }}>Not connected yet</div>
      <p style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted2, maxWidth: 440, margin: "8px auto 0", lineHeight: 1.55 }}>
        This slot is wired into the menu and ready for you to hook up. Drop your config here when you're ready.
      </p>
    </Card>
    {ideas && (
      <Card pad={18}>
        <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.bronze, marginBottom: 10 }}>Wire-up targets</div>
        <div style={{ display: "grid", gap: 8 }}>
          {ideas.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Circle size={13} color={T.muted2} />
              <span style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted }}>{it}</span>
            </div>
          ))}
        </div>
      </Card>
    )}
  </Wrap>
);

function SystemsOverview({ go }) {
  const tiles = SYSTEMS_SUB.filter(s => s.id !== "sys_overview");
  return (
    <Wrap>
      <Head kicker="Command" title="Systems"
        sub="Where the Kingdom connects to the outside world. Each module is a slot you can wire up." />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {tiles.map(t => {
          const Icon = t.icon;
          const real = t.id === "sys_log";
          return (
            <Card key={t.id} pad={18} style={{ cursor: "pointer" }}>
              <div onClick={() => go(t.id)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Icon size={22} color={T.bronzeLt} />
                  <span style={{ fontFamily: T.body, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: real ? T.bronzeLt : T.muted2, border: `1px solid ${real ? "rgba(231,171,76,.4)" : T.line}`, padding: "2px 7px", borderRadius: 2 }}>{real ? "live" : "open"}</span>
                </div>
                <div style={{ fontFamily: T.reg, fontSize: 15, color: T.cream, marginTop: 12 }}>{t.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, color: T.muted, fontFamily: T.body, fontSize: 12.5 }}>
                  Open <ChevronRight size={13} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Wrap>
  );
}

function UpdateLog() {
  const { rows, loading, err, reload } = useTable("update_log", "created_at");
  return (
    <Wrap>
      <Head kicker="Systems" title="Update Log"
        sub="Every build, schema, and config change — nothing important happens silently."
        right={<Btn kind="ghost" onClick={reload}><RefreshCw size={14} /> Refresh</Btn>} />
      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>No log entries yet.</Empty> : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map(l => (
            <Card key={l.id} pad={15}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: T.body, fontSize: 14, color: T.cream, fontWeight: 600 }}>{l.summary}</span>
                <span style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, whiteSpace: "nowrap" }}>{fmt(l.created_at)}</span>
              </div>
              {l.detail && <p style={{ fontFamily: T.body, fontSize: 13, color: T.muted, marginTop: 5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{l.detail}</p>}
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 6 }}>by {l.actor || "—"}</div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

export function SystemsScreen({ view, go }) {
  if (view === "systems" || view === "sys_overview") return <SystemsOverview go={go} />;
  if (view === "sys_log") return <UpdateLog />;
  if (view === "sys_integrations") return <PlaceholderModule icon={Plug} title="Integrations" blurb="Connect outside services into the Kingdom." ideas={["Stripe — payments & memberships", "Resend / SendGrid — email & password resets", "Calendar / scheduling", "Zapier / Make webhooks"]} />;
  if (view === "sys_automations") return <PlaceholderModule icon={Workflow} title="Automations" blurb="Rules that run on their own — triggers and scheduled jobs." ideas={["Daily check-in reminders", "Streak-break alerts to the owner", "New-member onboarding sequence", "Weekly summary from Gideon"]} />;
  if (view === "sys_webhooks") return <PlaceholderModule icon={Webhook} title="Webhooks" blurb="Inbound and outbound event hooks." ideas={["Stripe payment events", "Supabase database webhooks", "Custom outbound POST on check-in"]} />;
  if (view === "sys_secrets") return <PlaceholderModule icon={KeyRound} title="Secrets & Keys" blurb="Pointers to keys — real values live server-side in Supabase edge-function secrets, never in the app bundle." ideas={["ANTHROPIC_API_KEY — Gideon (edge function)", "RESEND_API_KEY — email", "STRIPE_SECRET_KEY — payments"]} />;
  return null;
}
