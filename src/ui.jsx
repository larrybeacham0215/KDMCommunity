import React from "react";

/* Shared design tokens — Larry Beacham brand (obsidian / bronze / ember). */
export const T = {
  obsidian: "#0a0907",
  obsidian2: "#100e0b",
  surface: "#16130d",
  surface2: "#1e1810",
  line: "rgba(216,168,92,.18)",
  lineSoft: "rgba(216,168,92,.10)",
  bronze: "#c8862e",
  bronzeLt: "#f1c878",
  bronzeGlow: "#e7ab4c",
  ember: "#9a2d16",
  emberLt: "#d4502b",
  emberHot: "#ff6a3c",
  cream: "#f7f1e6",
  muted: "#a99d89",
  muted2: "#6e6557",
  gold: "linear-gradient(120deg,#f6d488 0%,#c8862e 45%,#d4502b 100%)",
  reg: "'Cinzel',Georgia,serif",
  display: "'Anton',Impact,sans-serif",
  serif: "'Fraunces',Georgia,serif",
  body: "'Hanken Grotesk',system-ui,sans-serif",
};

export function Crest({ size = 40 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d488" />
          <stop offset=".5" stopColor="#c8862e" />
          <stop offset="1" stopColor="#d4502b" />
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
    ? { ...base, background: T.gold, color: "#1a1206", boxShadow: "0 6px 26px rgba(200,134,46,.28)" }
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

export const Card = ({ children, pad = 22, style }) => (
  <div style={{
    background: `linear-gradient(180deg,${T.surface},${T.obsidian2})`,
    border: `1px solid ${T.line}`, borderRadius: 4, padding: pad, ...style,
  }}>{children}</div>
);

/* Small inputs reused by admin forms */
export const inputBase = {
  width: "100%", background: T.obsidian, border: `1px solid ${T.line}`, borderRadius: 2,
  color: T.cream, padding: "12px 14px", fontFamily: T.body, fontSize: 14.5, outline: "none",
};
export const Field = ({ label }) => (
  <label style={{ fontFamily: T.reg, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.muted, display: "block", marginBottom: 6 }}>{label}</label>
);
