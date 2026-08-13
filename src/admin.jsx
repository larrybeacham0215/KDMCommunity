import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Brain, NotebookPen, Bot, Cpu, ScrollText, Plug, Workflow, Webhook,
  KeyRound, Activity, LayoutGrid, Plus, Trash2, Save, RefreshCw, Power,
  Send, Shield, Sparkles, ChevronRight, ChevronLeft, X, AlertTriangle, Circle, CheckCircle2,
  Dumbbell, Pencil,
} from "lucide-react";
import { supabase } from "./dataService";
import { T, Eyebrow, Btn, Card, inputBase, Field } from "./ui";
import { Roster } from "./roster";

/* ============================================================================
   COMMAND (owner-only) navigation + Systems sub-menu.
   Exported so the side menu in App.jsx can render them.
   ========================================================================== */
export const OWNER_NAV = [
  { id: "admin_roster", label: "The Roster", icon: ClipboardList },
  { id: "admin_users", label: "Members & Roles", icon: Users },
  { id: "admin_memories", label: "Memories", icon: Brain },
  { id: "admin_notepad", label: "Notepad", icon: NotebookPen },
  { id: "gideon", label: "Gideon AI", icon: Bot },
  { id: "admin_robots", label: "Robots", icon: Cpu },
  { id: "admin_constitution", label: "AI Constitution", icon: ScrollText },
  { id: "admin_scripture_gym", label: "Scripture Gym", icon: Dumbbell },
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
  admin_roster: "The Roster",
  gideon: "Gideon AI", admin_robots: "Robots", admin_constitution: "AI Constitution",
  admin_scripture_gym: "Scripture Gym",
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

  const ROLE_LABELS = { owner: "Super Admin", admin: "Admin", cohort_leader: "Cohort Leader", member: "Member" };
  const TIER_ORDER = ["owner", "admin", "cohort_leader", "member"];
  const counts = TIER_ORDER.map(r => ({
    role: r,
    label: ROLE_LABELS[r],
    n: rows.filter(u => (u.role || "member") === r).length,
  }));

  const setRole = async (u, role) => {
    if (role === "owner" && !window.confirm(`Make ${u.full_name || u.email} a Super Admin (Owner)? This gives full control of the app, including the curriculum and every member's data.`)) return;
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
        sub="Everyone in the Kingdom. Super Admin owns the curriculum; Admins manage people & cohorts; Cohort Leaders shepherd their own group."
        right={<Btn kind="ghost" onClick={reload}><RefreshCw size={14} /> Refresh</Btn>} />
      {err && <ErrBox msg={err} />}
      {!loading && rows.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {counts.map(c => (
            <Card key={c.role} pad={14} style={{ flex: "1 1 120px", minWidth: 120 }}>
              <div style={{ fontFamily: T.display, fontSize: 26, color: c.role === "owner" ? T.gold : T.cream, lineHeight: 1 }}>{c.n}</div>
              <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted2, marginTop: 5 }}>{c.label}{c.n === 1 ? "" : "s"}</div>
            </Card>
          ))}
        </div>
      )}
      {loading ? <Loading /> : rows.length === 0 ? <Empty>No members yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map(u => (
            <Card key={u.id} pad={16} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: T.gold, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#FCFAF6",
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
                color: u.role === "owner" ? "#FCFAF6" : T.bronzeLt,
                background: u.role === "owner" ? T.gold : "transparent",
                border: `1px solid ${u.role === "owner" ? "transparent" : T.line}`,
              }}>{ROLE_LABELS[u.role] || "Member"}</span>
              {u.id !== profile?.id && (
                <select
                  value={u.role || "member"}
                  disabled={busy === u.id}
                  onChange={(e) => setRole(u, e.target.value)}
                  style={{ ...inputBase, width: "auto", padding: "8px 10px", fontSize: 12.5 }}
                >
                  <option value="member">Member</option>
                  <option value="cohort_leader">Cohort Leader</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
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
const thStyle = { textAlign: "left", padding: "12px 16px", fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted };
const tdStyle = { padding: "14px 16px", verticalAlign: "top" };

function Notepad({ profile }) {
  const { rows, loading, err, reload } = useTable("notepad", "updated_at");
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

  const add = async () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("notepad").insert({ title: draft.title || "Untitled", body: draft.body });
    setSaving(false);
    if (!error) { setDraft({ title: "", body: "" }); reload(); logUpdate(profile?.email || "owner", "Note added", draft.title); }
  };
  const del = async (id) => {
    await supabase.from("notepad").delete().eq("id", id);
    reload();
    if (openId === id) setOpenId(null);
  };

  const openNote = rows.find(n => n.id === openId);

  // ---- DETAIL PAGE ----
  if (openNote) {
    return (
      <Wrap>
        <Head kicker="Command" title={openNote.title}
          sub={`Updated ${fmt(openNote.updated_at || openNote.created_at)}`}
          right={<Btn kind="ghost" onClick={() => setOpenId(null)}><ChevronLeft size={14} /> Back to Notepad</Btn>} />
        <Card pad={24}>
          {openNote.body
            ? <p style={{ fontFamily: T.body, fontSize: 14, color: T.muted, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{openNote.body}</p>
            : <p style={{ fontFamily: T.body, color: T.muted2 }}>This note is empty.</p>}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2 }}>Created {fmt(openNote.created_at)}</span>
            <button onClick={() => del(openNote.id)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: T.body, fontSize: 12.5 }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </Card>
      </Wrap>
    );
  }

  // ---- TABLE VIEW ----
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
        <Card pad={0} style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={thStyle}>Title</th>
                <th style={{ ...thStyle, width: 170 }}>Updated</th>
                <th style={{ ...thStyle, width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n, i) => (
                <tr key={n.id}
                  onClick={() => setOpenId(n.id)}
                  style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.lineSoft}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,134,46,.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: T.body, fontSize: 14, color: T.cream, fontWeight: 600 }}>{n.title}</div>
                    {n.body && (
                      <div style={{ fontFamily: T.body, fontSize: 12, color: T.muted2, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 540 }}>
                        {n.body.replace(/\s+/g, " ").slice(0, 140)}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: T.body, fontSize: 12, color: T.muted2 }}>{fmt(n.updated_at || n.created_at)}</td>
                  <td style={tdStyle}>
                    <button onClick={(e) => { e.stopPropagation(); del(n.id); }} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3F7D57", boxShadow: "0 0 8px #3F7D57", flexShrink: 0 }} />
          <span style={{ fontFamily: T.body, fontSize: 13, color: T.cream }}>
            Gideon is <b style={{ color: T.bronzeLt }}>online</b> — running on the Anthropic API through a secure Supabase edge function. The key stays server-side.
          </span>
        </div>
      </Card>

      {/* robot card */}
      {loading ? <Loading /> : gideon && (
        <Card pad={18} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 10, background: "radial-gradient(circle,rgba(156,106,36,.16),transparent 70%)", border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
   SCRIPTURE GYM — CURRICULUM EDITOR (owner-only)
   Manages the OFFICIAL muscle groups + verses every guy sees. Personal
   groups guys build themselves live entirely outside this screen.
   ========================================================================= */
function CurriculumEditor({ profile }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    const { data } = await supabase
      .from("content_proposals").select("*")
      .eq("status", "pending").order("created_at", { ascending: true });
    setProposals(data || []);
    setProposalsLoading(false);
  }, []);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data: gs, error } = await supabase
      .from("muscle_groups")
      .select("id, name, description, display_order")
      .eq("owner_type", "official")
      .order("display_order", { ascending: true });
    if (error) { setErr(error.message); setLoading(false); return; }
    const { data: vs } = await supabase.from("verses").select("id, muscle_group_id");
    const counts = {};
    (vs || []).forEach(v => { counts[v.muscle_group_id] = (counts[v.muscle_group_id] || 0) + 1; });
    setGroups((gs || []).map(g => ({ ...g, verseCount: counts[g.id] || 0 })));
    setErr(null);
    setLoading(false);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const approve = async (p) => {
    setReviewingId(p.id);
    if (p.proposal_type === "muscle_group") {
      await supabase.from("muscle_groups").insert({
        name: p.payload.name, description: p.payload.description || "",
        owner_type: "official", created_by: profile?.id,
      });
    } else if (p.proposal_type === "verse") {
      await supabase.from("verses").insert({
        muscle_group_id: p.payload.muscle_group_id,
        reference: p.payload.reference, verse_text: p.payload.verse_text,
        translation: p.payload.translation || "BSB", created_by: profile?.id,
      });
    }
    await supabase.from("content_proposals")
      .update({ status: "approved", reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    logUpdate(profile?.email || "owner", "Proposal approved",
      p.proposal_type === "muscle_group" ? p.payload.name : p.payload.reference);
    setReviewingId(null);
    loadProposals();
    loadGroups();
  };

  const reject = async (p) => {
    setReviewingId(p.id);
    await supabase.from("content_proposals")
      .update({ status: "rejected", reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    logUpdate(profile?.email || "owner", "Proposal rejected",
      p.proposal_type === "muscle_group" ? p.payload.name : p.payload.reference);
    setReviewingId(null);
    loadProposals();
  };

  const addGroup = async () => {
    if (!newGroup.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("muscle_groups").insert({
      name: newGroup.name, description: newGroup.description,
      owner_type: "official", created_by: profile?.id, display_order: groups.length + 1,
    });
    setSaving(false);
    if (!error) {
      logUpdate(profile?.email || "owner", "Muscle group added", newGroup.name);
      setNewGroup({ name: "", description: "" });
      loadGroups();
    }
  };

  const deleteGroup = async (g) => {
    if (!window.confirm(`Delete "${g.name}" and all ${g.verseCount} of its verses? This can't be undone.`)) return;
    await supabase.from("muscle_groups").delete().eq("id", g.id);
    logUpdate(profile?.email || "owner", "Muscle group deleted", g.name);
    loadGroups();
  };

  if (selectedGroup) {
    return <VerseEditor group={selectedGroup} profile={profile} onBack={() => { setSelectedGroup(null); loadGroups(); }} />;
  }

  return (
    <Wrap>
      <Head kicker="Command" title="Scripture Gym Curriculum"
        sub="The official muscle groups & verses every guy sees. Locked to you alone — guys can still build their own personal groups elsewhere in the app."
        right={<Btn kind="ghost" onClick={loadGroups}><RefreshCw size={14} /> Refresh</Btn>} />

      {proposals.length > 0 && (
        <>
          <div style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: T.bronze, marginBottom: 10 }}>
            Pending Proposals ({proposals.length})
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
            {proposals.map(p => (
              <Card key={p.id} pad={16} style={{ border: `1px solid ${T.bronze}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.body, fontSize: 14, color: T.cream, fontWeight: 700 }}>
                      {p.proposal_type === "muscle_group" ? p.payload.name : p.payload.reference}
                    </div>
                    <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2, marginTop: 2 }}>
                      {p.proposal_type === "muscle_group"
                        ? (p.payload.description || "New muscle group")
                        : `→ ${p.payload.muscle_group_name || "unknown group"}`}
                    </div>
                    {p.proposal_type === "verse" && (
                      <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 12.5, color: T.muted, margin: "8px 0 0" }}>
                        "{p.payload.verse_text}"
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Btn onClick={() => approve(p)} disabled={reviewingId === p.id}>
                      {reviewingId === p.id ? "…" : "Approve"}
                    </Btn>
                    <Btn kind="ghost" onClick={() => reject(p)} disabled={reviewingId === p.id}>Reject</Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card pad={18} style={{ marginBottom: 18 }}>
        <Field label="Muscle Group Name" />
        <input style={inputBase} value={newGroup.name}
          onChange={e => setNewGroup(n => ({ ...n, name: e.target.value }))} placeholder="e.g. Spiritual Warfare" />
        <div style={{ marginTop: 12 }}>
          <Field label="Description (optional)" />
          <input style={inputBase} value={newGroup.description}
            onChange={e => setNewGroup(n => ({ ...n, description: e.target.value }))} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn onClick={addGroup} disabled={saving}><Plus size={14} /> {saving ? "Adding…" : "Add Muscle Group"}</Btn>
        </div>
      </Card>

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : groups.length === 0 ? <Empty>No official muscle groups yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {groups.map(g => (
            <Card key={g.id} pad={16} onClick={() => setSelectedGroup(g)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div>
                <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream, fontWeight: 600 }}>{g.name}</div>
                <div style={{ fontFamily: T.body, fontSize: 12, color: T.muted2, marginTop: 2 }}>
                  {g.verseCount} verse{g.verseCount === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={(e) => { e.stopPropagation(); deleteGroup(g); }}
                  style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={15} /></button>
                <ChevronRight size={16} color={T.muted2} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

function VerseEditor({ group, profile, onBack }) {
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [draft, setDraft] = useState({ reference: "", verse_text: "", translation: "BSB" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("verses").select("*")
      .eq("muscle_group_id", group.id).order("display_order", { ascending: true });
    if (error) setErr(error.message); else { setVerses(data || []); setErr(null); }
    setLoading(false);
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const addVerse = async () => {
    if (!draft.reference.trim() || !draft.verse_text.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("verses").insert({
      muscle_group_id: group.id, reference: draft.reference, verse_text: draft.verse_text,
      translation: draft.translation || "BSB", display_order: verses.length + 1, created_by: profile?.id,
    });
    setSaving(false);
    if (!error) {
      logUpdate(profile?.email || "owner", "Verse added", `${draft.reference} → ${group.name}`);
      setDraft({ reference: "", verse_text: "", translation: "BSB" });
      load();
    }
  };

  const startEdit = (v) => { setEditingId(v.id); setEditDraft({ reference: v.reference, verse_text: v.verse_text, translation: v.translation }); };
  const saveEdit = async (id) => {
    await supabase.from("verses").update(editDraft).eq("id", id);
    logUpdate(profile?.email || "owner", "Verse edited", editDraft.reference);
    setEditingId(null);
    load();
  };
  const deleteVerse = async (v) => {
    if (!window.confirm(`Delete ${v.reference}?`)) return;
    await supabase.from("verses").delete().eq("id", v.id);
    logUpdate(profile?.email || "owner", "Verse deleted", v.reference);
    load();
  };

  return (
    <Wrap>
      <Head kicker="Command" title={group.name} sub={`${verses.length} verse${verses.length === 1 ? "" : "s"} in this muscle group`}
        right={<Btn kind="ghost" onClick={onBack}><ChevronLeft size={14} /> Back to Groups</Btn>} />

      <Card pad={18} style={{ marginBottom: 18 }}>
        <Field label="Reference" />
        <input style={inputBase} value={draft.reference}
          onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} placeholder="e.g. Romans 8:1" />
        <div style={{ marginTop: 12 }}>
          <Field label="Verse Text" />
          <textarea rows={3} style={{ ...inputBase, resize: "vertical" }} value={draft.verse_text}
            onChange={e => setDraft(d => ({ ...d, verse_text: e.target.value }))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Translation" />
          <input style={inputBase} value={draft.translation}
            onChange={e => setDraft(d => ({ ...d, translation: e.target.value }))} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn onClick={addVerse} disabled={saving}><Plus size={14} /> {saving ? "Adding…" : "Add Verse"}</Btn>
        </div>
      </Card>

      {err && <ErrBox msg={err} />}
      {loading ? <Loading /> : verses.length === 0 ? <Empty>No verses in this group yet.</Empty> : (
        <div style={{ display: "grid", gap: 10 }}>
          {verses.map(v => (
            <Card key={v.id} pad={16}>
              {editingId === v.id ? (
                <>
                  <input style={inputBase} value={editDraft.reference}
                    onChange={e => setEditDraft(d => ({ ...d, reference: e.target.value }))} />
                  <textarea rows={3} style={{ ...inputBase, marginTop: 8, resize: "vertical" }} value={editDraft.verse_text}
                    onChange={e => setEditDraft(d => ({ ...d, verse_text: e.target.value }))} />
                  <input style={{ ...inputBase, marginTop: 8 }} value={editDraft.translation}
                    onChange={e => setEditDraft(d => ({ ...d, translation: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn onClick={() => saveEdit(v.id)}><Save size={13} /> Save</Btn>
                    <Btn kind="ghost" onClick={() => setEditingId(null)}>Cancel</Btn>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.body, fontSize: 14, color: T.cream, fontWeight: 700 }}>
                      {v.reference} <span style={{ fontFamily: T.reg, fontSize: 10, color: T.muted2, textTransform: "uppercase" }}>({v.translation})</span>
                    </div>
                    <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 13.5, color: T.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
                      "{v.verse_text}"
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button onClick={() => startEdit(v)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Pencil size={14} /></button>
                    <button onClick={() => deleteVerse(v)} style={{ background: "none", border: "none", color: T.muted2, cursor: "pointer" }}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Wrap>
  );
}

/* ===========================================================================
   ADMIN ROUTER
   ========================================================================= */
export function AdminScreen({ view, profile }) {
  if (view === "admin_roster") return <Roster />;
  if (view === "admin_users") return <AdminUsers profile={profile} />;
  if (view === "admin_memories") return <Memories profile={profile} />;
  if (view === "admin_notepad") return <Notepad profile={profile} />;
  if (view === "gideon") return <Gideon />;
  if (view === "admin_robots") return <Robots profile={profile} />;
  if (view === "admin_constitution") return <Constitution />;
  if (view === "admin_scripture_gym") return <CurriculumEditor profile={profile} />;
  return null;
}

/* ===========================================================================
   SYSTEMS  (hub + sub-pages — scaffold for Larry to wire up)
   ========================================================================= */
const PlaceholderModule = ({ icon: Icon, title, blurb, ideas }) => (
  <Wrap>
    <Head kicker="Systems" title={title} sub={blurb} />
    <Card pad={22} style={{ textAlign: "center", marginBottom: 14 }}>
      <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 12, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle,rgba(156,106,36,.10),transparent 70%)" }}>
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
