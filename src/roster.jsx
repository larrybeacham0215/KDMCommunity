import React, { useState, useEffect, useCallback } from "react";
import { ClipboardList, RefreshCw, Link2, AlertTriangle } from "lucide-react";
import { T, Eyebrow, Card, Btn, inputBase } from "./ui";
import { supabase } from "./dataService";

/* ===========================================================================
   THE ROSTER — what Larry looks at before Monday night.

   Sorted by how long a man has been quiet, loudest problem first. The point is
   not a dashboard; it is being able to say "Marcus, you've been quiet since the
   3rd — what's going on?" to a man's face, having already known the answer.
   ========================================================================= */

const QUIET = (d) => {
  if (d === null || d === undefined) return { label: "Never started", tone: "stop" };
  if (d === 0) return { label: "Today", tone: "ok" };
  if (d <= 2) return { label: `${d}d ago`, tone: "ok" };
  if (d <= 6) return { label: `${d}d quiet`, tone: "warn" };
  return { label: `${d}d quiet`, tone: "stop" };
};

const TONE = {
  ok:   { fg: "#2F6B49", bd: "rgba(47,107,73,.38)",  bg: "rgba(47,107,73,.09)" },
  warn: { fg: T.bronze,  bd: "rgba(156,106,36,.42)", bg: "rgba(156,106,36,.10)" },
  stop: { fg: "#A8462C", bd: "rgba(168,70,44,.40)",  bg: "rgba(168,70,44,.09)" },
};

function Pill({ tone, children }) {
  const c = TONE[tone] || TONE.warn;
  return (
    <span style={{
      display: "inline-block", fontFamily: T.reg, fontSize: 10, fontWeight: 700,
      letterSpacing: ".12em", textTransform: "uppercase", padding: "4px 9px",
      borderRadius: 20, whiteSpace: "nowrap",
      color: c.fg, border: `1px solid ${c.bd}`, background: c.bg,
    }}>{children}</span>
  );
}

export function Roster() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("gym_roster");
    if (error) { setErr(error.message); return; }
    if (data && data.error) { setErr(data.error); return; }
    setErr(null); setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pair = async (userId, partnerId) => {
    setBusy(true);
    await supabase.rpc("set_partner", { p_user: userId, p_partner: partnerId || null });
    await load(); setBusy(false);
  };

  if (err) return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Card pad={16} style={{ border: `1px solid ${TONE.stop.bd}` }}>
        <div style={{ display: "flex", gap: 9, color: "#A8462C" }}>
          <AlertTriangle size={16} /> <span style={{ color: T.cream }}>{err}</span>
        </div>
      </Card>
    </div>
  );
  if (!rows) return <div style={{ padding: 40, textAlign: "center", color: T.muted2 }}>Loading the roster…</div>;

  const quiet   = rows.filter(r => r.days_quiet === null || r.days_quiet >= 7);
  const slipping= rows.filter(r => r.days_quiet !== null && r.days_quiet >= 3 && r.days_quiet < 7);
  const active  = rows.filter(r => r.days_quiet !== null && r.days_quiet < 3);

  const Row = ({ r }) => {
    const q = QUIET(r.days_quiet);
    return (
      <div style={{
        display: "grid", gridTemplateColumns: "1.5fr 1fr 74px 74px 1.3fr",
        gap: 12, alignItems: "center", padding: "13px 0",
        borderBottom: `1px solid ${T.lineSoft}`,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.body, fontSize: 14.5, color: T.cream }}>{r.full_name}</div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted2 }}>
            {r.role === "owner" ? "Super Admin · " : ""}joined {r.joined}
          </div>
        </div>
        <div><Pill tone={q.tone}>{q.label}</Pill></div>
        <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted, textAlign: "center" }}>
          {r.reps_7d}<span style={{ color: T.muted2, fontSize: 11 }}>/7</span>
        </div>
        <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted, textAlign: "center" }}>
          {r.memorized}
        </div>
        <div>
          <select
            value={rows.find(x => x.full_name === r.partner_name)?.id || ""}
            onChange={e => pair(r.id, e.target.value)}
            disabled={busy}
            style={{ ...inputBase, padding: "7px 9px", fontSize: 12.5, appearance: "none" }}>
            <option value="">No partner</option>
            {rows.filter(x => x.id !== r.id).map(x => (
              <option key={x.id} value={x.id}>{x.full_name}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const Group = ({ title, note, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".2em",
          textTransform: "uppercase", color: T.bronze }}>{title}</span>
        <span style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted2 }}>{note}</span>
      </div>
      <Card pad={18}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.5fr 1fr 74px 74px 1.3fr", gap: 12,
          fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase",
          color: T.muted2, paddingBottom: 9, borderBottom: `1px solid ${T.line}`,
        }}>
          <div>Man</div><div>Last active</div>
          <div style={{ textAlign: "center" }}>Reps</div>
          <div style={{ textAlign: "center" }}>Mem</div>
          <div>Partner</div>
        </div>
        {items.map(r => <Row key={r.id} r={r} />)}
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        gap: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow>The Roster</Eyebrow>
          <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 4px" }}>
            Who trained. Who went quiet.
          </h2>
          <p style={{ fontFamily: T.body, color: T.muted, fontSize: 14.5, margin: 0, maxWidth: "58ch" }}>
            Read this before Monday. The men at the top are the ones to ask about by name.
          </p>
        </div>
        <Btn kind="ghost" onClick={load}><RefreshCw size={14} /> Refresh</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 26px" }}>
        {[["Active", active.length, "ok"], ["Slipping", slipping.length, "warn"], ["Quiet", quiet.length, "stop"]]
          .map(([l, n, t]) => (
          <Card key={l} pad={14} style={{ flex: "1 1 140px", textAlign: "center" }}>
            <div style={{ fontFamily: T.display, fontSize: 26, color: TONE[t].fg }}>{n}</div>
            <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".18em",
              textTransform: "uppercase", color: T.muted2, marginTop: 4 }}>{l}</div>
          </Card>
        ))}
      </div>

      <Group title="Ask about these men" note="quiet a week or more, or never started" items={quiet} />
      <Group title="Slipping" note="3 to 6 days" items={slipping} />
      <Group title="Training" note="active in the last two days" items={active} />

      <Card pad={16} style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Link2 size={16} color={T.bronze} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <div style={{ fontFamily: T.body, fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>
            Pairing two men links them both ways — each sees the other's week on his Forge.
            Accountability that only runs one direction is surveillance.
          </div>
        </div>
      </Card>
    </div>
  );
}
