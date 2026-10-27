import React from "react";
import { Card } from "./ui.jsx";
import {
  LEVEL_COLORS, ROLE_LABEL, BADGES, SCHEME_BLURB, FRONT_BY_SCHEME, coachBonusMap,
} from "../engine/coachesGen.js";

// Cartão de coordenador reutilizado na Comissão Técnica e no Mercado de Técnicos.

const POS_ORDER = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

function LevelBadge({ level, size = 34 }) {
  const color = LEVEL_COLORS[level] || "#94a3b8";
  return (
    <div className="rounded-lg flex items-center justify-center shrink-0 border font-black"
      style={{ width: size, height: size, color, borderColor: color + "66", background: color + "1a", fontSize: size * 0.5 }}>
      {level}
    </div>
  );
}

// ["QB +2 STA", "WR/TE +1 RTE", ...] agrupando posições com o mesmo bônus.
function bonusChips(coach) {
  const map = coachBonusMap(coach, true), seen = {};   // nominal: o que a reputação promete
  POS_ORDER.forEach((pos) => Object.entries(map[pos] || {}).forEach(([k, v]) => {
    const key = `${k}:${v}`;
    (seen[key] ||= { k, v, pos: [] }).pos.push(pos);
  }));
  return Object.values(seen).map((s) => ({ text: `${s.pos.join("/")} ${s.v > 0 ? "+" : ""}${s.v} ${s.k}`, neg: s.v < 0 }));
}

function Chips({ coach }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {bonusChips(coach).map((b) => (
        <span key={b.text} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${b.neg ? "text-red-300 border-red-400/30 bg-red-400/10" : "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"}`}>{b.text}</span>
      ))}
    </div>
  );
}

function BadgePills({ badges }) {
  if (!badges?.length) return <div className="text-[10px] text-slate-600 mt-2">Sem badges.</div>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {badges.map((id) => BADGES[id] && (
        <span key={id} title={BADGES[id].desc} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">{BADGES[id].icon} {BADGES[id].name}</span>
      ))}
    </div>
  );
}

// impact: { OL: 1.2, QB: -0.3 } = variação de OVR efetivo dos titulares por setor
function ImpactRow({ impact }) {
  const rows = Object.entries(impact || {}).filter(([, v]) => Math.abs(v) >= 0.1);
  if (!rows.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] text-slate-500 mb-1">Impacto imediato nos titulares (OVR efetivo)</div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(([pos, v]) => (
          <span key={pos} className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${v > 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{pos} {v > 0 ? "+" : ""}{v.toFixed(1)}</span>
        ))}
      </div>
    </div>
  );
}

function CoachCard({ coach, impact, extraInfo, children }) {
  const front = coach.role === "DC" ? FRONT_BY_SCHEME[coach.scheme] : null;
  return (
    <Card className="mb-3">
      <div className="flex items-start gap-3">
        <LevelBadge level={coach.level} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{coach.name}</span>
            {coach.formerHC && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">Ex-Head Coach</span>}
          </div>
          <div className="text-[11px] text-slate-500">{ROLE_LABEL[coach.role]} · {coach.age} anos</div>
          <div className="text-xs mt-1"><span className="font-semibold text-sky-300">{coach.scheme}</span>{front && <span className="text-slate-500"> · front {front}</span>}</div>
          <div className="text-[11px] text-slate-500">{SCHEME_BLURB[coach.scheme]}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums">${coach.salary.toFixed(1)}M</div>
          {coach.teamAbbr && <div className="text-[10px] text-slate-500">{coach.years} ano(s)</div>}
        </div>
      </div>
      <Chips coach={coach} />
      <div className="text-[9px] text-slate-600 mt-1">Bônus pela reputação (nível). O rendimento real varia a cada temporada.</div>
      <BadgePills badges={coach.badges} />
      {extraInfo}
      {coach.lastReport && coach.teamAbbr && (
        <div className={`text-[11px] mt-2 ${coach.lastReport.key === "up" ? "text-emerald-300" : coach.lastReport.key === "down" ? "text-red-300" : "text-slate-400"}`}>
          {coach.lastReport.icon} Última temporada ({coach.lastReport.year}): {coach.lastReport.text}
        </div>
      )}
      {(coach.eliteYears || 0) > 0 && <div className="text-[10px] text-amber-300 mt-2">⭐ {coach.eliteYears} ano(s) em alto nível (3 seguidos = promoção)</div>}
      <ImpactRow impact={impact} />
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

export { CoachCard, LevelBadge, BadgePills, ImpactRow };
