import React from "react";
import { clamp } from "../lib/rng.js";
import { SUB_ATTRS, ATTR_LABELS } from "../data/rosterSlots.js";
import { TEAM_META } from "../data/teams.js";
import { moraleLabel } from "../season/morale.js";

// Small reusable visual building blocks used across every screen
// (cards, buttons, bars, the team crest, player rows...), plus the
// top bar and bottom tab navigation.

function Bar({ value, max = 99, color = "#22c55e" }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${clamp((value / max) * 100, 3, 100)}%`, background: color }} />
    </div>
  );
}
function Card({ children, className = "" }) {
  return <div className={`rounded-lg border border-white/10 bg-[#121a2c] p-4 ${className}`}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", disabled, className = "", color }) {
  const base = "px-4 py-2 rounded-md font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "text-white hover:brightness-110",
    ghost: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
    danger: "bg-red-600/80 text-white hover:bg-red-600",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} onClick={onClick} disabled={disabled}
      style={variant === "primary" ? { background: color || "#2563eb" } : undefined}>
      {children}
    </button>
  );
}
// Darken/lighten a hex color by percent (negative = darker), used to build a
// subtle gradient for the team crest without needing any external assets.
function shadeColor(hex, percent) {
  if (!hex) return "#334155";
  const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100;
  const R = f >> 16, G = (f >> 8) & 0x00ff, B = f & 0x0000ff;
  return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

// Carrega automaticamente todas as logos existentes em src/components/logos
const teamLogos = import.meta.glob("./logos/*.png", {
  eager: true,
  import: "default",
});

function TeamLogo({ abbr, size = 28 }) {
  const t = TEAM_META.find((x) => x.abbr === abbr);

  if (!t) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-white/10 shrink-0"
      />
    );
  }

  // Procura a logo correspondente ao abbreviation
  const logoPath = `./logos/${abbr}.png`;
  const logo = teamLogos[logoPath];

  // =========================================================
  // LOGO REAL
  // =========================================================
  if (logo) {
    return (
      <img
        src={logo}
        alt={abbr}
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
    );
  }

  // =========================================================
  // FALLBACK — CREST GERADA
  // =========================================================
  const gid = `crest-${abbr}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shadeColor(t.c1, 18)} />
          <stop offset="100%" stopColor={shadeColor(t.c1, -22)} />
        </linearGradient>
      </defs>

      <path
        d="M20 1 L37 7 V21 C37 32 30 40 20 43 C10 40 3 32 3 21 V7 Z"
        fill={`url(#${gid})`}
        stroke={t.c2}
        strokeWidth="2"
      />

      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fill="#fff"
        fontFamily="system-ui, sans-serif"
        style={{ letterSpacing: "-0.5px" }}
      >
        {abbr}
      </text>
    </svg>
  );
}

function PosPill({ pos }) {
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">{pos}</span>;
}
function primaryStatLine(p) {
  const s = p.seasonStats || {};
  if (p.pos === "QB" && s.passYards) {
    const compPct = s.passAttempts ? Math.round((s.passCompletions || 0) / s.passAttempts * 100) : 0;
    return `${s.passYards} jds, ${compPct}% comp, ${s.passTD || 0} TD, ${s.interceptionsThrown || 0} INT`;
  }
  if (p.pos === "RB" && s.rushYards) {
    const ypc = s.rushAttempts ? (s.rushYards / s.rushAttempts).toFixed(1) : "0.0";
    return `${s.rushYards} jds, ${ypc} ypc, ${s.rushTD || 0} TD`;
  }
  if ((p.pos === "WR" || p.pos === "TE") && s.receivingYards) return `${s.targets || s.receptions || 0} alvos, ${s.receptions || 0} rec, ${s.receivingYards} jds, ${s.receivingTD || 0} TD`;
  if ((p.pos === "DL" || p.pos === "LB") && (s.tackles || s.sacks || s.qbHits || s.qbHurries)) return `${s.tackles || 0} tackles, ${s.sacks || 0} sacks${s.tacklesForLoss ? `, ${s.tacklesForLoss} TFL` : ""}, ${s.qbHits || 0} QB hits`;
  if ((p.pos === "CB" || p.pos === "S") && (s.tackles || s.interceptions || s.passesDefended)) return `${s.tackles || 0} tackles, ${s.interceptions || 0} INT, ${s.passesDefended || 0} PD`;
  if (p.pos === "OL" && (s.pressuresAllowed || s.runBlockSnaps)) {
    const parts = [];
    if (s.pressuresAllowed) parts.push(`${s.pressuresAllowed} pressões sofridas${s.sacksAllowed ? ` (${s.sacksAllowed} sacks)` : ""}`);
    if (s.runBlockSnaps) parts.push(`corrida: ${s.runBlockWins || 0}-${s.runStuffsAllowed || 0} nos duelos`);
    return parts.join(" · ");
  }
  if (p.pos === "K" && s.fgAttempts) {
    const pct = Math.round((s.fgMade || 0) / s.fgAttempts * 100);
    const p40 = s.fgAttempts40 ? ` · 40+: ${s.fgMade40 || 0}/${s.fgAttempts40}` : "";
    const p50 = s.fgAttempts50 ? ` · 50+: ${s.fgMade50 || 0}/${s.fgAttempts50}` : "";
    return `${s.fgMade || 0}/${s.fgAttempts} FG (${pct}%)${p40}${p50}`;
  }
  if (p.pos === "P" && s.punts) return `${s.punts} punts, ${Math.round((s.puntYards || 0) / s.punts)} jds/punt`;
  return null;
}

function PlayerRow({ p, right, showStats, showMorale, onOpenPlayer }) {
  const statLine = showStats ? primaryStatLine(p) : null;
  const morale = showMorale ? moraleLabel(p.morale ?? 65) : null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <PosPill pos={p.pos} />
          {onOpenPlayer ? (
            <button onClick={() => onOpenPlayer(p.id)} className="truncate text-sm text-slate-100 hover:text-sky-300 hover:underline text-left">{p.name}</button>
          ) : (
            <span className="truncate text-sm text-slate-100">{p.name}</span>
          )}
          {p.accolades?.length > 0 && <span className="text-[10px] text-amber-400 font-semibold shrink-0" title={p.accolades.join(", ")}>🏆{p.accolades.length > 1 ? `×${p.accolades.length}` : ""}</span>}
          {p.injuredWeeks > 0 && <span className="text-[10px] text-red-400 font-semibold">LESIONADO ({p.injuredWeeks}sem)</span>}
          <span className="text-[11px] text-slate-500">idade {p.age}</span>
        </div>
        {statLine && <div className="text-[11px] text-slate-500 mt-0.5">{statLine}</div>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {morale && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: morale.color }} title={`Moral: ${morale.label}`} />}
        <span className="text-xs text-slate-400 tabular-nums">${p.salary.toFixed(1)}M</span>
        <span className="font-bold tabular-nums text-sm w-7 text-right" style={{ color: p.ovr >= 85 ? "#4ade80" : p.ovr >= 70 ? "#fbbf24" : "#94a3b8" }}>{p.ovr}</span>
        {right}
      </div>
    </div>
  );
}
// Small rating badge (colored box, not a full circle) used on the richer
// Free Agency / Draft / Trade cards where a plain number felt too flat.
function OvrBadge({ ovr, size = 40 }) {
  const color = ovr >= 85 ? "#4ade80" : ovr >= 70 ? "#fbbf24" : "#94a3b8";
  return (
    <div className="rounded-lg flex flex-col items-center justify-center shrink-0 border"
      style={{ width: size, height: size, borderColor: color + "55", background: color + "1a" }}>
      <div className="font-black tabular-nums leading-none" style={{ color, fontSize: size * 0.34 }}>{ovr}</div>
      <div className="text-[8px] text-slate-500 uppercase tracking-wide leading-none mt-1">ovr</div>
    </div>
  );
}

// Grid de barras com TODOS os atributos do jogador (2 colunas até 4 atributos,
// 3 colunas acima disso). `top` mostra só os N maiores (útil em cards compactos
// de Free Agency/Draft/Trocas). O título (toque/hover) traz o nome completo.
function AttrBars({ pos, attrs, top }) {
  if (!attrs) return null;
  let keys = (SUB_ATTRS[pos] || Object.keys(attrs)).filter((k) => attrs[k] != null);
  if (!keys.length) return null;
  if (top) keys = [...keys].sort((a, b) => attrs[b] - attrs[a]).slice(0, top);
  const cols = keys.length <= 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-x-3 gap-y-1.5 mt-1.5`}>
      {keys.map((k) => (
        <div key={k} title={ATTR_LABELS[k] || k}>
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5"><span>{k}</span><span className="tabular-nums">{attrs[k]}</span></div>
          <Bar value={attrs[k]} max={99} color="#38bdf8" />
        </div>
      ))}
    </div>
  );
}

function DevTag({ dev }) {
  if (!dev) return null;
  const color = dev === "rising" ? "#4ade80" : dev === "declining" ? "#f87171" : "#94a3b8";
  const arrow = dev === "rising" ? "↑" : dev === "declining" ? "↓" : "→";
  return <span className="text-[10px] font-semibold shrink-0" style={{ color }}>{arrow} {devLabel(dev)}</span>;
}


function devLabel(dev) {
  return dev === "rising" ? "Em ascensão" : dev === "declining" ? "Em declínio" : "Estável";
}

function TopBar({ team, career, go, screen }) {
  const tm = TEAM_META.find((t) => t.abbr === team.abbr);
  return (
    <div className="sticky top-0 z-10">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tm.c1}, ${tm.c2})` }} />
      <div className="bg-[#0B1220]/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">Técnico {career.coachName} · {career.year}</div>
          <div className="font-black text-lg tracking-tight truncate">{tm.city} {tm.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-400">Temporada</div>
          <div className="font-bold tabular-nums">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
const NAV = [
  { key: "hub", label: "Painel", icon: "🛡️" },
  { key: "game", label: "Jogo", icon: "🏈" },
  { key: "roster", label: "Elenco", icon: "👥" },
  { key: "depth", label: "Escalação", icon: "📋" },
  { key: "tactics", label: "Táticas", icon: "🎯" },
  { key: "schedule", label: "Classificação", icon: "📅" },
  { key: "results", label: "Resultados", icon: "🏟️" },
  { key: "trade", label: "Trocas", icon: "🔄" },
  { key: "stats", label: "Stats", icon: "📊" },
];
function BottomNav({ screen, go, disabled, hasUnwatchedGame }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#0B1220]/97 backdrop-blur border-t border-white/10 flex justify-around py-1.5 z-20 overflow-x-auto">
      {NAV.map((n) => {
        const active = screen === n.key;
        return (
          <button key={n.key} disabled={disabled} onClick={() => go(n.key)}
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px] shrink-0 ${active ? "text-white" : "text-slate-500"} disabled:opacity-30`}>
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
            {n.key === "game" && hasUnwatchedGame && <span className="absolute top-0 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />}
          </button>
        );
      })}
    </div>
  );
}


export { Bar, Card, Btn, shadeColor, TeamLogo, PosPill, primaryStatLine, PlayerRow,
  OvrBadge, AttrBars, DevTag, devLabel, TopBar, NAV, BottomNav };
