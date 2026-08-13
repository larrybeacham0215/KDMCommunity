import React from "react";

/* Shared design tokens — Larry Beacham brand (obsidian / bronze / ember). */
/* ---------------------------------------------------------------------------
   DESIGN TOKENS — light theme ("the forge in daylight"), matching the homepage.

   NAMING NOTE: these keys were written for the original dark theme and are kept
   so the ~6,000 lines that reference them keep working. Read them by ROLE, not
   by name: `obsidian` is the page ground, `cream` is the primary text colour.
   Flipping the values here flips the entire app.
   ------------------------------------------------------------------------- */
export const T = {
  obsidian:  "#F8F7F4",              // page ground — bone paper
  obsidian2: "#EEEBE4",              // alternating band — limestone
  surface:   "#FDFCFA",              // card
  surface2:  "#F3F1EA",              // recessed card
  line:      "#DDD8CE",              // hairline rule
  lineSoft:  "#E7E3D9",              // faintest rule
  bronze:    "#9C6A24",              // accent — darkened for contrast on light
  bronzeLt:  "#B8802E",
  bronzeGlow:"#C08B3A",
  ember:     "#A8462C",              // streak / heat
  emberLt:   "#B4553F",
  emberHot:  "#C2542E",
  cream:     "#1A1D21",              // PRIMARY TEXT — graphite, not cream
  muted:     "#565E68",              // secondary text — steel
  muted2:    "#8A8578",              // tertiary / captions
  gold:      "#9C6A24",              // solid, matching the homepage button
  onGold:    "#FCFAF6",              // text that sits on a gold fill
  ok:        "#3F7D57",              // success, legible on paper
  reg:   "'Manrope',system-ui,sans-serif",
  display: "'Anton',Impact,sans-serif",
  serif: "'Fraunces',Georgia,serif",
  body:  "'Manrope',system-ui,sans-serif",
};

export function Crest({ size = 40 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B8802E" />
          <stop offset=".5" stopColor="#9C6A24" />
          <stop offset="1" stopColor="#A8462C" />
        </linearGradient>
      </defs>
      <path d="M32 3 L57 13 V31 C57 47 46 56 32 61 C18 56 7 47 7 31 V13 Z"
        fill="none" stroke="url(#cg)" strokeWidth="2" />
      <path d="M32 16 V46 M22 26 H42" stroke="url(#cg)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="22" r="2.4" fill="url(#cg)" />
    </svg>
  );
}

export const Eyebrow = ({ children }) => (
  <span style={{
    fontFamily: T.reg, fontSize: 11, letterSpacing: ".28em", textTransform: "uppercase",
    color: T.bronze, display: "inline-flex", alignItems: "center", gap: 8,
  }}>
    <span style={{ width: 22, height: 1, background: T.bronze, opacity: .6 }} />
    {children}
  </span>
);

export function Btn({ children, onClick, kind = "solid", full, type = "button", disabled }) {
  const base = {
    fontFamily: T.reg, fontWeight: 600, fontSize: 13, letterSpacing: ".06em",
    padding: "13px 22px", borderRadius: 2, cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
    width: full ? "100%" : "auto", border: "1px solid transparent",
    transition: "transform .15s, filter .2s", opacity: disabled ? .5 : 1,
  };
  const styles = kind === "solid"
    ? { ...base, background: T.gold, color: "#FCFAF6", boxShadow: "0 6px 26px rgba(200,134,46,.28)" }
    : { ...base, background: "transparent", color: T.bronzeLt, border: `1px solid ${T.line}` };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={styles}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = "translateY(1px)")}
      onMouseUp={e => (e.currentTarget.style.transform = "translateY(0)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
      {children}
    </button>
  );
}

export const Card = ({ children, pad = 22, style, ...rest }) => (
  <div style={{
    background: `linear-gradient(180deg,${T.surface},${T.obsidian2})`,
    border: `1px solid ${T.line}`, borderRadius: 4, padding: pad, ...style,
  }} {...rest}>{children}</div>
);

/* Small inputs reused by admin forms */
export const inputBase = {
  width: "100%", background: T.obsidian, border: `1px solid ${T.line}`, borderRadius: 2,
  color: T.cream, padding: "12px 14px", fontFamily: T.body, fontSize: 16, outline: "none",
};
export const Field = ({ label }) => (
  <label style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.muted, display: "block", marginBottom: 6 }}>{label}</label>
);

/* Greetings use the first name only. "Welcome back, Larry Beacham." reads like a
   form letter; "Welcome back, Larry." reads like someone who knows him. The full
   name still lives on the profile and the roster — this is only for address.
   Mirrors firstName() in the gym-mailer function so app and email agree. */
export function firstName(full) {
  const raw = String(full ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.split("@")[0];
  const parts = raw.replace(/,+$/, "").split(/\s+/)
    .filter((w, i) => !(i === 0 && /^(mr|mrs|ms|dr|pastor|rev|sr|fr|bro|coach)\.?$/i.test(w)));
  if (!parts.length) return "";
  if (parts.every(w => w.replace(/\./g, "").length === 1)) {
    return parts.map(w => w.replace(/\./g, "").toUpperCase()).join("");
  }
  const f = parts[0].replace(/,+$/, "");
  if (f.length > 3 && f === f.toUpperCase()) return f[0] + f.slice(1).toLowerCase();
  if (f === f.toLowerCase()) return f[0].toUpperCase() + f.slice(1);
  return f;
}
