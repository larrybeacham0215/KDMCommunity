import React, { useState, useEffect, useCallback } from "react";
import { Route, CheckCircle2, Lock, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { T, Eyebrow, Card, Btn } from "./ui";
import { supabase } from "./dataService";

/* ===========================================================================
   THE PATH — eight weeks a man can see the end of.

   Weeks advance on the calendar, not on completion. A man who misses week 3 is
   behind, never locked out; programs that demand perfection are the ones men
   quit. "Done" is his own mark, kept separate from where the calendar has him.
   ========================================================================= */

const STATE_TONE = {
  current: { fg: T.bronzeLt, bd: "rgba(200,134,46,.45)", bg: "rgba(200,134,46,.10)" },
  past:    { fg: T.muted,    bd: T.lineSoft,             bg: "transparent" },
  ahead:   { fg: T.muted2,   bd: T.lineSoft,             bg: "transparent" },
  locked:  { fg: T.muted2,   bd: T.lineSoft,             bg: "transparent" },
};

function WeekRow({ w, open, onToggle, onComplete, busy }) {
  const tone = STATE_TONE[w.state] || STATE_TONE.ahead;
  const isCurrent = w.state === "current";
  return (
    <Card pad={0} style={{
      marginBottom: 10, overflow: "hidden",
      border: `1px solid ${isCurrent ? tone.bd : T.line}`,
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
        padding: "15px 18px", background: isCurrent ? tone.bg : "transparent",
        border: "none", cursor: "pointer", minHeight: 56,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flex: "0 0 auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${w.done ? "rgba(92,179,119,.5)" : tone.bd}`,
          background: w.done ? "rgba(92,179,119,.14)" : "transparent",
          color: w.done ? "#5cb377" : tone.fg,
          fontFamily: T.reg, fontSize: 13, fontWeight: 700,
        }}>
          {w.done ? <CheckCircle2 size={17} /> : w.state === "locked" ? <Lock size={14} /> : w.week_number}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontFamily: T.reg, fontSize: 9.5, letterSpacing: ".18em",
              textTransform: "uppercase", color: tone.fg }}>{w.theme}</span>
            {isCurrent && (
              <span style={{ fontFamily: T.reg, fontSize: 8.5, letterSpacing: ".16em",
                textTransform: "uppercase", color: T.bronzeLt, border: `1px solid ${tone.bd}`,
                borderRadius: 20, padding: "2px 8px" }}>This week</span>
            )}
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 16.5,
            color: w.state === "ahead" || w.state === "locked" ? T.muted : T.cream,
            lineHeight: 1.3 }}>{w.title}</div>
        </div>

        {open ? <ChevronDown size={17} color={T.muted2} /> : <ChevronRight size={17} color={T.muted2} />}
      </button>

      {open && (
        <div style={{ padding: "4px 18px 20px", borderTop: `1px solid ${T.lineSoft}` }}>
          <p style={{ fontFamily: T.body, fontSize: 14.5, lineHeight: 1.65, color: T.muted,
            margin: "14px 0 16px" }}>{w.premise}</p>

          {w.verse_text && (
            <div style={{ paddingLeft: 13, borderLeft: `2px solid ${T.lineSoft}`, margin: "0 0 16px" }}>
              <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 15.5, lineHeight: 1.55,
                color: T.bronzeLt, margin: "0 0 4px" }}>&ldquo;{w.verse_text}&rdquo;</p>
              <div style={{ fontFamily: T.reg, fontSize: 11.5, color: T.muted2 }}>{w.verse_ref}</div>
            </div>
          )}

          <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".2em",
            textTransform: "uppercase", color: T.bronze, marginBottom: 6 }}>The practice</div>
          <p style={{ fontFamily: T.body, fontSize: 15, lineHeight: 1.6, color: T.cream,
            margin: "0 0 16px" }}>{w.practice}</p>

          <div style={{ fontFamily: T.reg, fontSize: 10, letterSpacing: ".2em",
            textTransform: "uppercase", color: T.bronze, marginBottom: 6 }}>Bring this to the room</div>
          <p style={{ fontFamily: T.serif, fontSize: 15.5, fontStyle: "italic", lineHeight: 1.55,
            color: T.cream, margin: "0 0 18px" }}>{w.question}</p>

          {w.done ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#5cb377",
              fontFamily: T.reg, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>
              <CheckCircle2 size={16} /> Week complete
            </div>
          ) : w.state !== "locked" && w.state !== "ahead" ? (
            <Btn onClick={() => onComplete(w.week_number)} disabled={busy}>
              <CheckCircle2 size={15} /> Mark week {w.week_number} done
            </Btn>
          ) : (
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted2 }}>
              Opens in week {w.week_number}.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function PathScreen() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await supabase.rpc("get_path");
    if (d) {
      setData(d);
      const cur = (d.weeks || []).find(w => w.state === "current");
      setOpen(o => (o === null && cur ? cur.week_number : o));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const begin = async () => {
    setBusy(true); await supabase.rpc("start_path"); await load(); setBusy(false);
  };
  const complete = async (n) => {
    setBusy(true); await supabase.rpc("complete_path_week", { p_week: n }); await load(); setBusy(false);
  };

  if (!data) return (
    <div style={{ padding: 40, textAlign: "center", color: T.muted2 }}>
      <RefreshCw size={17} /> Loading…
    </div>
  );

  const { program, weeks = [], enrolled, current_week: cur } = data;
  const doneCount = weeks.filter(w => w.done).length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Eyebrow>The Path</Eyebrow>
      <h2 style={{ fontFamily: T.display, fontSize: 30, color: T.cream, margin: "10px 0 4px" }}>
        {program?.name}
      </h2>
      <p style={{ fontFamily: T.serif, fontStyle: "italic", color: T.bronzeLt, fontSize: 15.5,
        margin: "0 0 16px" }}>{program?.tagline}</p>

      {!enrolled ? (
        <Card pad={24}>
          <p style={{ fontFamily: T.body, fontSize: 15, lineHeight: 1.65, color: T.muted,
            margin: "0 0 18px" }}>{program?.description}</p>
          <div style={{ fontFamily: T.reg, fontSize: 10.5, letterSpacing: ".2em",
            textTransform: "uppercase", color: T.bronze, marginBottom: 10 }}>What you will work through</div>
          {weeks.map(w => (
            <div key={w.week_number} style={{ display: "flex", gap: 12, padding: "8px 0",
              borderBottom: `1px solid ${T.lineSoft}`, fontSize: 14, fontFamily: T.body }}>
              <span style={{ color: T.muted2, width: 22, flex: "0 0 auto" }}>{w.week_number}</span>
              <span style={{ color: T.cream, flex: 1 }}>{w.title}</span>
              <span style={{ color: T.muted2, fontSize: 12 }}>{w.theme}</span>
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            <Btn onClick={begin} disabled={busy}>
              <Route size={15} /> Begin the Path
            </Btn>
          </div>
          <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.muted2, margin: "12px 0 0" }}>
            Eight weeks from the day you start. Miss one and you are behind, not out.
          </p>
        </Card>
      ) : (
        <>
          <Card pad={18} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: T.display, fontSize: 21, color: T.cream }}>
                Week {cur} <span style={{ fontFamily: T.reg, fontSize: 13, color: T.muted }}>of {program?.weeks}</span>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted }}>
                {doneCount} marked complete
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {weeks.map(w => (
                <div key={w.week_number} style={{
                  flex: 1, height: 6, borderRadius: 2,
                  background: w.done ? "#5cb377"
                    : w.week_number === cur ? T.gold
                    : w.week_number < cur ? "rgba(200,134,46,.32)" : T.lineSoft,
                }} />
              ))}
            </div>
          </Card>

          {weeks.map(w => (
            <WeekRow key={w.week_number} w={w} busy={busy}
              open={open === w.week_number}
              onToggle={() => setOpen(open === w.week_number ? null : w.week_number)}
              onComplete={complete} />
          ))}
        </>
      )}
    </div>
  );
}
