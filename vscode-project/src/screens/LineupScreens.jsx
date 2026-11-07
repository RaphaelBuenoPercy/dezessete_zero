import React, { useMemo, useRef, useState } from "react";
import { CAP } from "../data/teams.js";
import { ATTR_LABELS } from "../data/rosterSlots.js";
import { capUsed } from "../engine/playerGen.js";
import { moraleLabel } from "../season/morale.js";
import { isExpiring } from "../season/contracts.js";
import {
  GROUPS, GROUP_LABEL, OFFENSE_GROUPS, DEFENSE_GROUPS, isStarterSlot, sideOfSlot, depthGroups, groupStrength,
  candidatesFor, topAttrs, lineupAlerts, ovrColor, ageColor,
} from "../season/lineup.js";
import { Card, TeamLogo, PosPill, DevTag, primaryStatLine } from "../components/ui.jsx";

// Elenco e escalação. A escalação gira em torno do campo: toque num jogador para abrir a ficha do
// slot, ver quem pode ocupá-lo (com a diferença de OVR) e trocar na hora. Os alertas apontam o que
// merece atenção e o ranking dos setores mostra onde o time é forte ou fraco frente à liga.

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const lastName = (full) => full.split(" ").slice(-1)[0];

function OvrChip({ ovr, big }) {
  const c = ovrColor(ovr);
  return (
    <span className={`inline-flex items-center justify-center rounded-md font-black tabular-nums shrink-0 ${big ? "w-11 h-9 text-lg" : "w-9 h-7 text-sm"}`}
      style={{ color: c, background: c + "1f", border: `1px solid ${c}55` }}>{ovr}</span>
  );
}

function MoraleDot({ morale }) {
  const m = moraleLabel(morale ?? 65);
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} title={`Moral: ${m.label}`} aria-label={`Moral ${m.label}`} />;
}

function rankTone(rank, total) {
  if (!rank || !total) return "#94a3b8";
  return rank <= Math.ceil(total * 0.2) ? "#4ade80" : rank > Math.floor(total * 0.7) ? "#f87171" : "#cbd5e1";
}

// Um bloco por setor: média dos titulares, posição na liga e uma barra comparativa.
function SectorTiles({ strength, groups, active, onPick }) {
  if (!strength) return null;
  return (
    <div className={`grid gap-2 ${groups.length > 4 ? "grid-cols-5" : "grid-cols-4"}`}>
      {groups.map((g) => {
        const s = strength[g];
        const on = active === g;
        return (
          <button key={g} onClick={() => onPick?.(g)} aria-pressed={on}
            className={`rounded-lg border px-1.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${on ? "border-white/60 bg-white/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="text-[11px] text-slate-400 leading-none">{g}</div>
            <div className="text-lg font-black tabular-nums leading-tight" style={{ color: ovrColor(s.avg) }}>{s.avg ? Math.round(s.avg) : "–"}</div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-0.5"><div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, (s.avg - 50) * 2))}%`, background: ovrColor(s.avg) }} /></div>
            <div className="text-[10px] mt-1 tabular-nums" style={{ color: rankTone(s.rank, s.total) }}>{s.rank ? `${s.rank}º de ${s.total}` : ""}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   CAMPO
   ============================================================ */

// Coordenadas do campo (0-320 x, 0-210 y). Só visual; o motor lê os slots.
const OFFENSE_COORDS = {
  WR1: { x: 14, y: 110 }, LT: { x: 56, y: 110 }, LG: { x: 92, y: 110 }, C: { x: 128, y: 110 },
  RG: { x: 164, y: 110 }, RT: { x: 200, y: 110 }, TE1: { x: 238, y: 125 }, WR2: { x: 306, y: 110 },
  WR3: { x: 276, y: 128 }, QB1: { x: 128, y: 160 }, RB1: { x: 166, y: 166 },
};
const DEFENSE_COORDS = {
  "4-3": {
    DE1: { x: 86, y: 34 }, DT1: { x: 130, y: 34 }, DT2: { x: 182, y: 34 }, DE2: { x: 226, y: 34 },
    LB3: { x: 100, y: 84 }, LB1: { x: 160, y: 94 }, LB2: { x: 210, y: 84 }, CB3: { x: 278, y: 70 },
    CB1: { x: 15, y: 118 }, CB2: { x: 305, y: 118 }, S1: { x: 118, y: 168 }, S2: { x: 198, y: 168 },
  },
  "3-4": {
    DE1: { x: 100, y: 34 }, NT1: { x: 160, y: 34 }, DE2: { x: 220, y: 34 },
    LB3: { x: 70, y: 84 }, LB1: { x: 140, y: 84 }, LB2: { x: 190, y: 84 }, LB4: { x: 246, y: 84 }, CB3: { x: 286, y: 70 },
    CB1: { x: 24, y: 118 }, CB2: { x: 298, y: 118 }, S1: { x: 118, y: 168 }, S2: { x: 198, y: 168 },
  },
};

const LENSES = {
  ovr: { label: "Overall", color: (p) => ovrColor(p.ovr), legend: [["#4ade80", "85 ou mais"], ["#38bdf8", "75 a 84"], ["#fbbf24", "65 a 74"], ["#f87171", "abaixo de 65"]] },
  morale: { label: "Moral", color: (p) => moraleLabel(p.morale ?? 65).color, legend: [["#4ade80", "ótima"], ["#a3e635", "boa"], ["#fbbf24", "neutra"], ["#fb923c", "baixa"], ["#f87171", "péssima"]] },
  age: { label: "Idade", color: (p) => ageColor(p.age), legend: [["#4ade80", "até 25"], ["#38bdf8", "26 a 29"], ["#fbbf24", "30 a 32"], ["#f87171", "33 ou mais"]] },
};

function Dot({ slot, p, x, y, color, selected, onSelect }) {
  const injured = p.injuredWeeks > 0;
  const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(slot); } };
  return (
    <g transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={`${p.name}, ${slot}, overall ${p.ovr}${injured ? ", lesionado" : ""}`}
      onClick={() => onSelect(slot)} onKeyDown={key} style={{ cursor: "pointer", outline: "none" }}>
      <circle r="21" fill="transparent" />
      {selected && <circle r="17" fill="none" stroke="#fff" strokeWidth="2.5" />}
      {injured && <circle r="15" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="2.5,2" />}
      <circle r="12" fill={color} stroke="rgba(11,18,32,0.55)" strokeWidth="1.5" />
      <text textAnchor="middle" y="3.6" fontSize="10" fontWeight="900" fill="#0B1220" fontFamily="system-ui, sans-serif">{p.ovr}</text>
      <text textAnchor="middle" y="-16" fontSize="7" fill="rgba(226,232,240,0.55)" fontFamily="system-ui, sans-serif">{slot.replace(/[0-9]/g, "") || slot}</text>
      <text textAnchor="middle" y="24" fontSize="8" fontWeight={selected ? 700 : 400} fill={injured ? "#fca5a5" : selected ? "#fff" : "#cbd5e1"} fontFamily="system-ui, sans-serif">{lastName(p.name)}</text>
      {injured && <text textAnchor="middle" x="13" y="-8" fontSize="9" fontWeight="900" fill="#f87171">+</text>}
    </g>
  );
}

function FormationField({ team, side, lens, selected, onSelect }) {
  const coords = side === "offense" ? OFFENSE_COORDS : DEFENSE_COORDS[team.scheme] || DEFENSE_COORDS["4-3"];
  const colorOf = LENSES[lens].color;
  return (
    <svg viewBox="0 0 320 210" className="w-full rounded-lg" style={{ background: "linear-gradient(180deg,#0f2f1f,#0b2217)" }} role="group" aria-label={side === "offense" ? "Ataque em campo" : "Defesa em campo"}>
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="0" y={i * 30} width="320" height="15" fill="rgba(255,255,255,0.025)" />
      ))}
      <line x1="0" y1="72" x2="320" y2="72" stroke="rgba(255,255,255,0.07)" />
      <line x1="0" y1="140" x2="320" y2="140" stroke="rgba(255,255,255,0.07)" />
      <line x1="0" y1="104" x2="320" y2="104" stroke="rgba(56,189,248,0.55)" strokeWidth="1.5" strokeDasharray="5,3" />
      <text x="6" y="100" fontSize="7" fill="rgba(56,189,248,0.7)" fontFamily="system-ui, sans-serif">linha de scrimmage</text>
      {Object.entries(coords).map(([slot, pos]) => {
        const p = team.roster.find((pl) => pl.slot === slot);
        if (!p) return null;
        return <Dot key={slot} slot={slot} p={p} x={pos.x} y={pos.y} color={colorOf(p)} selected={selected === slot} onSelect={onSelect} />;
      })}
    </svg>
  );
}

/* ============================================================
   FICHA DO SLOT (abre ao tocar num jogador)
   ============================================================ */

function SlotSheet({ team, slot, onClose, onSwapSlots, onOpenPlayer }) {
  const cur = team.roster.find((p) => p.slot === slot);
  const subs = useMemo(() => candidatesFor(team, slot), [team, slot]);
  if (!cur) return null;
  const best = subs[0];
  return (
    <Card className="mb-4 border-white/25">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">Slot {slot}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <OvrChip ovr={cur.ovr} big />
            <div className="min-w-0">
              <button onClick={() => onOpenPlayer?.(cur.id)} className="font-bold truncate text-left hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">{cur.name}</button>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                <PosPill pos={cur.pos} />
                <span>{cur.age} anos</span>
                {cur.injuredWeeks > 0 && <span className="text-red-400 font-semibold">lesionado, {cur.injuredWeeks} sem</span>}
                <MoraleDot morale={cur.morale} />
              </div>
            </div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar ficha do slot" className="text-slate-400 hover:text-white text-lg leading-none px-1">×</button>
      </div>

      <div className="text-xs text-slate-400 mt-3 mb-1">
        {subs.length ? `Quem pode jogar aqui (${subs.length})` : "Não há outro jogador dessa posição no elenco."}
      </div>
      {subs.map((c, i) => {
        const delta = c.ovr - cur.ovr;
        const slotLabel = c.slot ? (isStarterSlot(c.slot) ? `titular em ${c.slot}` : "reserva") : "sem slot";
        return (
          <div key={c.id} className="flex items-center gap-2 py-2 border-t border-white/5">
            <OvrChip ovr={c.ovr} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm truncate">{c.name}</span>
                {i === 0 && delta > 0 && <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-400/10 rounded px-1 shrink-0">melhor opção</span>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <span>{slotLabel}</span>
                <span>{c.age} anos</span>
                {topAttrs(c, 2).map((a) => <span key={a.k} title={ATTR_LABELS[a.k]} className="tabular-nums">{a.k} {a.v}</span>)}
                {c.injuredWeeks > 0 && <span className="text-red-400">lesionado</span>}
                <MoraleDot morale={c.morale} />
              </div>
            </div>
            <span className={`text-xs font-bold tabular-nums w-8 text-right shrink-0 ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"}`}>{delta > 0 ? "+" : ""}{delta}</span>
            <button onClick={() => onSwapSlots(slot, c.slot)} disabled={!c.slot}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-400/30 hover:bg-sky-500/25 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">Colocar aqui</button>
          </div>
        );
      })}
      {best && best.ovr > cur.ovr && (
        <div className="text-[11px] text-amber-300 mt-1">{best.name} tem {best.ovr - cur.ovr} de OVR a mais que o titular atual.</div>
      )}
    </Card>
  );
}

/* ============================================================
   ESCALAÇÃO
   ============================================================ */

function DepthRow({ team, slot, selected, betterBench, onPick }) {
  const p = team.roster.find((pl) => pl.slot === slot);
  if (!p) return null;
  const starter = isStarterSlot(slot);
  return (
    <button onClick={() => onPick(slot)} aria-pressed={selected}
      className={`w-full flex items-center gap-2 py-1.5 px-1.5 -mx-1.5 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${selected ? "bg-white/10" : "hover:bg-white/5"}`}>
      <span className="w-9 text-[11px] font-semibold text-slate-500 shrink-0">{slot}</span>
      <OvrChip ovr={p.ovr} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate">{p.name}</span>
        <span className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{p.age} anos</span>
          {topAttrs(p, 1).map((a) => <span key={a.k} className="tabular-nums">{a.k} {a.v}</span>)}
        </span>
      </span>
      {p.injuredWeeks > 0 && <span className="text-[10px] font-semibold text-red-400 shrink-0">lesão {p.injuredWeeks}s</span>}
      {betterBench && !starter && <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-400/10 rounded px-1 shrink-0">pode titularizar</span>}
      <MoraleDot morale={p.morale} />
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${starter ? "bg-green-500/15 text-green-400" : "bg-white/5 text-slate-400"}`}>{starter ? "titular" : "reserva"}</span>
    </button>
  );
}

function DepthChartScreen({ myTeam, career, onSwapSlots, onAutoSort, onOpenPlayer }) {
  const [side, setSide] = useState("offense");
  const [lens, setLens] = useState("ovr");
  const [selected, setSelected] = useState(null);
  const sheetRef = useRef(null);
  const strength = useMemo(() => (career ? groupStrength(career.leagueTeams, myTeam) : null), [career, myTeam]);
  const alerts = useMemo(() => lineupAlerts(myTeam), [myTeam]);
  const lists = useMemo(() => depthGroups(myTeam.scheme), [myTeam.scheme]);

  function pick(slot) {
    setSelected(slot);
    if (["QB1", "RB1", "WR1", "WR2", "WR3", "TE1", "LT", "LG", "C", "RG", "RT"].includes(slot)) setSide("offense");
    else if (!["K1", "P1", "QB2", "RB2"].includes(slot) && !slot.startsWith("BEN")) setSide(sideOfSlot(slot));
    requestAnimationFrame(() => sheetRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" }));
  }
  const betterBenchAt = (pos) => {
    const starters = myTeam.roster.filter((p) => p.pos === pos && isStarterSlot(p.slot));
    const minStarter = starters.length ? Math.min(...starters.map((p) => p.ovr)) : 0;
    return (p) => p.ovr > minStarter;
  };
  const groups = side === "offense" ? OFFENSE_GROUPS : DEFENSE_GROUPS;

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-black">Escalação</h2>
        {onAutoSort && <button onClick={onAutoSort} className="text-[11px] font-semibold text-sky-300 px-2.5 py-1.5 rounded-md border border-sky-400/30 bg-sky-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">Organizar por OVR</button>}
      </div>
      <p className="text-xs text-slate-500 mb-3">Esquema defensivo {myTeam.scheme}. Toque num jogador do campo ou da lista para ver quem pode substituí-lo.</p>

      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">{alerts.length ? "O que merece atenção" : "Situação da escalação"}</div>
        {alerts.length === 0 && <div className="text-sm text-emerald-300">Tudo em ordem: os titulares são os melhores disponíveis e ninguém está lesionado.</div>}
        <div className="space-y-1.5">
          {alerts.slice(0, 4).map((a, i) => (
            <button key={i} onClick={() => pick(a.slot)} className="w-full flex items-start gap-2 text-left text-[13px] leading-snug rounded-md px-2 py-1.5 bg-white/[0.04] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
              <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: a.tone === "bad" ? "#f87171" : "#fbbf24" }} />
              <span className="text-slate-200">{a.text}</span>
            </button>
          ))}
          {alerts.length > 4 && <div className="text-[11px] text-slate-500 px-2">E mais {alerts.length - 4} alerta(s) nas listas abaixo.</div>}
        </div>
      </Card>

      <Card className="mb-4 !p-2.5">
        <div className="flex gap-2 mb-2" role="tablist" aria-label="Unidade em campo">
          {[["offense", "Ataque", "sky"], ["defense", "Defesa", "orange"]].map(([k, label, c]) => (
            <button key={k} role="tab" aria-selected={side === k} onClick={() => setSide(k)}
              className={`flex-1 text-sm font-semibold py-2 rounded-md border ${side === k ? (c === "sky" ? "bg-sky-500/20 text-sky-200 border-sky-500/40" : "bg-orange-500/20 text-orange-200 border-orange-500/40") : "bg-white/5 text-slate-400 border-transparent"}`}>{label}</button>
          ))}
        </div>
        <SectorTiles strength={strength} groups={groups} onPick={(g) => document.getElementById(`grp-${{ TE: "WR", S: "CB" }[g] || g}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })} />
        <div className="mt-2.5">
          <FormationField team={myTeam} side={side} lens={lens} selected={selected} onSelect={pick} />
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[11px] text-slate-500">Cor dos jogadores</span>
          {Object.entries(LENSES).map(([k, l]) => (
            <button key={k} onClick={() => setLens(k)} aria-pressed={lens === k} className={`text-[11px] px-2 py-0.5 rounded-md ${lens === k ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"}`}>{l.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {LENSES[lens].legend.map(([c, t]) => <span key={t} className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{t}</span>)}
          <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full border border-dashed border-red-400" />lesionado</span>
        </div>
      </Card>

      <div ref={sheetRef}>
        {selected && <SlotSheet team={myTeam} slot={selected} onClose={() => setSelected(null)} onSwapSlots={onSwapSlots} onOpenPlayer={onOpenPlayer} />}
      </div>

      {lists.map(([label, slots]) => {
        const pos = myTeam.roster.find((p) => p.slot === slots[0])?.pos;
        const groupKey = label.startsWith("Linha defensiva") ? "DL" : label === "Linebackers" ? "LB" : label === "Linha ofensiva" ? "OL" : label === "Quarterbacks" ? "QB" : label === "Corredores" ? "RB" : label === "Recebedores" ? "WR" : label === "Secundária" ? "CB" : null;
        const better = pos ? betterBenchAt(pos) : () => false;
        return (
          <div key={label} id={groupKey ? `grp-${groupKey}` : undefined}>
          <Card className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-slate-400">{label}</div>
              {strength && groupKey && strength[groupKey].rank && <div className="text-[11px] tabular-nums" style={{ color: rankTone(strength[groupKey].rank, strength[groupKey].total) }}>{strength[groupKey].rank}º da liga</div>}
            </div>
            {slots.map((slot) => <DepthRow key={slot} team={myTeam} slot={slot} selected={selected === slot} betterBench={better(myTeam.roster.find((p) => p.slot === slot) || { ovr: 0 })} onPick={pick} />)}
          </Card>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   ELENCO
   ============================================================ */

const ROSTER_SORTS = {
  ovr: (a, b) => b.ovr - a.ovr,
  morale: (a, b) => (a.morale ?? 65) - (b.morale ?? 65),
  age: (a, b) => a.age - b.age,
  salary: (a, b) => b.salary - a.salary,
  contract: (a, b) => a.years - b.years,
};
const SORT_LABEL = { ovr: "Overall", morale: "Moral (menor primeiro)", age: "Idade", salary: "Salário", contract: "Contrato (vence antes)" };

function RosterRow({ p, onOpenPlayer }) {
  const starter = isStarterSlot(p.slot);
  const stat = primaryStatLine(p);
  const expiring = isExpiring(p);
  return (
    <button onClick={() => onOpenPlayer?.(p.id)} aria-label={`${p.name}, ${p.pos}, overall ${p.ovr}`}
      className="w-full flex items-center gap-2.5 py-2 border-t border-white/5 first:border-0 text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
      <OvrChip ovr={p.ovr} big />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate">{p.name}</span>
          {p.nickname && <span className="text-[11px] italic text-sky-400/80 truncate hidden sm:inline">"{p.nickname}"</span>}
          {p.accolades?.length > 0 && <span className="text-[10px] text-amber-400 shrink-0" title={p.accolades.join(", ")}>🏆{p.accolades.length > 1 ? p.accolades.length : ""}</span>}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap mt-0.5">
          <span className={starter ? "text-green-400" : ""}>{p.slot ? (starter ? `titular ${p.slot}` : "reserva") : "sem slot"}</span>
          <span>{p.age} anos</span>
          <span className={expiring ? "text-amber-400 font-semibold" : ""}>{p.years <= 1 ? "último ano" : `${p.years} anos`} de contrato</span>
          <DevTag dev={p.dev} />
        </span>
        {stat && <span className="block text-[11px] text-slate-400 mt-0.5 truncate">{stat}</span>}
        <span className="flex gap-2 mt-0.5">
          {topAttrs(p, 3).map((a) => <span key={a.k} title={ATTR_LABELS[a.k]} className="text-[10px] text-slate-500 tabular-nums">{a.k} <span className="text-slate-300">{a.v}</span></span>)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs tabular-nums text-slate-300">${p.salary.toFixed(1)}M</span>
        <span className="flex items-center gap-1.5">
          {p.injuredWeeks > 0 && <span className="text-[10px] font-semibold text-red-400">lesão {p.injuredWeeks}s</span>}
          <MoraleDot morale={p.morale} />
        </span>
      </span>
    </button>
  );
}

function RosterScreen({ myTeam, career, onOpenPlayer }) {
  const [sortBy, setSortBy] = useState("ovr");
  const [group, setGroup] = useState("ALL");
  const [filter, setFilter] = useState("all");
  const strength = useMemo(() => (career ? groupStrength(career.leagueTeams, myTeam) : null), [career, myTeam]);
  const roster = myTeam.roster;
  const used = capUsed(roster), free = CAP - used, usedPct = Math.min(100, (used / CAP) * 100);
  const injured = roster.filter((p) => p.injuredWeeks > 0).length;
  const expiring = roster.filter(isExpiring).length;
  const avgMorale = Math.round(roster.reduce((s, p) => s + (p.morale ?? 65), 0) / roster.length);
  const moraleRead = moraleLabel(avgMorale);
  const starters = roster.filter((p) => isStarterSlot(p.slot));
  const avgStarter = starters.length ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / starters.length) : 0;

  const passes = (p) => (filter === "issues" ? p.injuredWeeks > 0 || (p.morale ?? 65) < 35 : filter === "expiring" ? isExpiring(p) : true);
  const shown = group === "ALL" ? GROUPS : [group];

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 mb-3">
        <TeamLogo abbr={myTeam.abbr} size={28} />
        <div>
          <h2 className="text-xl font-black leading-tight">Elenco</h2>
          <div className="text-xs text-slate-500">{roster.length} jogadores, {starters.length} titulares</div>
        </div>
      </div>

      <Card className="mb-3">
        <div className="flex items-end justify-between mb-1.5">
          <div>
            <div className="text-xs text-slate-400">Folha salarial</div>
            <div className="text-lg font-black tabular-nums">${used.toFixed(1)}M <span className="text-xs font-normal text-slate-500">de ${CAP}M</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Cap livre</div>
            <div className={`text-lg font-black tabular-nums ${free < 5 ? "text-amber-400" : "text-emerald-400"}`}>${free.toFixed(1)}M</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden" role="img" aria-label={`Folha usa ${Math.round(usedPct)}% do cap`}>
          <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct > 95 ? "#f87171" : usedPct > 88 ? "#fbbf24" : "#38bdf8" }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center mt-3">
          <div><div className="text-lg font-black tabular-nums" style={{ color: ovrColor(avgStarter) }}>{avgStarter}</div><div className="text-[11px] text-slate-500">OVR dos titulares</div></div>
          <div><div className={`text-lg font-black tabular-nums ${injured ? "text-red-400" : "text-slate-200"}`}>{injured}</div><div className="text-[11px] text-slate-500">lesionados</div></div>
          <div><div className={`text-lg font-black tabular-nums ${expiring ? "text-amber-400" : "text-slate-200"}`}>{expiring}</div><div className="text-[11px] text-slate-500">contratos no fim</div></div>
          <div><div className="text-lg font-black tabular-nums" style={{ color: moraleRead.color }}>{avgMorale}</div><div className="text-[11px] text-slate-500">moral média</div></div>
        </div>
      </Card>

      {strength && (
        <Card className="mb-3 !p-2.5">
          <div className="text-xs text-slate-400 mb-2 px-0.5">Força por setor frente à liga</div>
          <div className="grid grid-cols-4 gap-2">
            {GROUPS.map((g) => {
              const s = strength[g], on = group === g;
              return (
                <button key={g} onClick={() => setGroup(on ? "ALL" : g)} aria-pressed={on}
                  className={`rounded-lg border px-1.5 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${on ? "border-white/60 bg-white/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className="flex items-baseline justify-between"><span className="text-[11px] text-slate-400">{g}</span><span className="text-sm font-black tabular-nums" style={{ color: ovrColor(s.avg) }}>{s.avg ? Math.round(s.avg) : "–"}</span></div>
                  <div className="text-[10px] tabular-nums" style={{ color: rankTone(s.rank, s.total) }}>{s.rank}º de {s.total}</div>
                </button>
              );
            })}
          </div>
          {group !== "ALL" && <button onClick={() => setGroup("ALL")} className="text-[11px] text-sky-300 mt-2 px-0.5">Mostrar todos os setores</button>}
        </Card>
      )}

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <label className="text-[11px] text-slate-500" htmlFor="roster-sort">Ordenar por</label>
        <select id="roster-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-slate-200">
          {Object.entries(SORT_LABEL).map(([k, l]) => <option key={k} value={k} className="bg-[#121a2c]">{l}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          {[["all", "Todos"], ["issues", "Problemas"], ["expiring", "Contrato no fim"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`text-[11px] px-2 py-1 rounded-md ${filter === k ? (k === "all" ? "bg-white text-black font-semibold" : "bg-amber-400/20 text-amber-200") : "bg-white/5 text-slate-400"}`}>{l}</button>
          ))}
        </div>
      </div>

      {shown.map((pos) => {
        const players = roster.filter((p) => p.pos === pos && passes(p)).sort(ROSTER_SORTS[sortBy]);
        if (!players.length) return null;
        const s = strength?.[pos];
        return (
          <Card key={pos} className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold">{GROUP_LABEL[pos]} <span className="text-xs font-normal text-slate-500">{players.length}</span></div>
              {s && s.avg > 0 && <div className="text-[11px] tabular-nums" style={{ color: rankTone(s.rank, s.total) }}>titulares {Math.round(s.avg)}, {s.rank}º da liga</div>}
            </div>
            {players.map((p) => <RosterRow key={p.id} p={p} onOpenPlayer={onOpenPlayer} />)}
          </Card>
        );
      })}
      {filter !== "all" && !roster.some(passes) && (
        <Card><div className="text-sm text-slate-400">{filter === "issues" ? "Nenhum jogador lesionado ou com moral baixa agora." : "Nenhum contrato termina neste ano."}</div></Card>
      )}
    </div>
  );
}

export { RosterScreen, DepthChartScreen };