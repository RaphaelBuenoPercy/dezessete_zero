import React, { useState } from "react";
import { clamp } from "../lib/rng.js";
import { CAP } from "../data/teams.js";
import { capUsed } from "../engine/playerGen.js";
import { DEFAULT_PERSONNEL } from "../engine/simulation.js";
import { moraleLabel } from "../season/morale.js";
import { isExpiring, extensionAsk } from "../season/contracts.js";
import { Card, Btn, TeamLogo, PlayerRow } from "../components/ui.jsx";

// Elenco, escalação (depth chart + formation diagram) e táticas — as
// três telas de gestão do próprio time.

// Quick "who matters right now" read: best player on each side of the
// ball, plus whoever's morale is most out of the ordinary — a narrative
// hook into the roster instead of just an alphabetic/position dump.
function RosterLeadersCard({ myTeam }) {
  const offense = [...myTeam.roster].filter((p) => ["QB", "RB", "WR", "TE", "OL"].includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0];
  const defense = [...myTeam.roster].filter((p) => ["DL", "LB", "CB", "S"].includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0];
  const byMorale = [...myTeam.roster].sort((a, b) => (a.morale ?? 65) - (b.morale ?? 65));
  const unhappiest = byMorale[0];
  const happiest = byMorale[byMorale.length - 1];
  return (
    <Card className="mb-4">
      <div className="text-xs text-slate-400 mb-2">Núcleo do time</div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-1">
        {offense && <div><span className="text-slate-500">Líder ofensivo</span><div className="text-slate-200 font-semibold truncate">{offense.name} <span className="text-slate-500 font-normal">({offense.ovr})</span></div></div>}
        {defense && <div><span className="text-slate-500">Líder defensivo</span><div className="text-slate-200 font-semibold truncate">{defense.name} <span className="text-slate-500 font-normal">({defense.ovr})</span></div></div>}
      </div>
      {unhappiest && (unhappiest.morale ?? 65) < 35 && (
        <div className="text-xs text-red-400 mt-2 pt-2 border-t border-white/5">😠 {unhappiest.name} está com moral baixa ({unhappiest.morale}/100).</div>
      )}
      {happiest && (happiest.morale ?? 65) >= 80 && happiest.id !== unhappiest?.id && (
        <div className="text-xs text-emerald-400 mt-1">😊 {happiest.name} está em alta ({happiest.morale}/100).</div>
      )}
    </Card>
  );
}

const ROSTER_SORTS = {
  ovr: (a, b) => b.ovr - a.ovr,
  morale: (a, b) => (b.morale ?? 65) - (a.morale ?? 65),
  age: (a, b) => a.age - b.age,
  salary: (a, b) => b.salary - a.salary,
};

function RosterScreen({ myTeam, onOpenPlayer }) {
  const [sortBy, setSortBy] = useState("ovr");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const groups = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];
  const injuredCount = myTeam.roster.filter((p) => p.injuredWeeks > 0).length;
  const avgMorale = Math.round(myTeam.roster.reduce((s, p) => s + (p.morale ?? 65), 0) / myTeam.roster.length);
  const decoratedCount = myTeam.roster.filter((p) => p.accolades?.length > 0).length;
  const moraleRead = moraleLabel(avgMorale);
  const hasAnyIssue = myTeam.roster.some((p) => p.injuredWeeks > 0 || (p.morale ?? 65) < 35);

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 mb-1">
        <TeamLogo abbr={myTeam.abbr} size={26} />
        <h2 className="text-xl font-black">Elenco</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">{myTeam.roster.length} jogadores · cap usado ${capUsed(myTeam.roster).toFixed(1)}M / ${CAP}M</p>

      <RosterLeadersCard myTeam={myTeam} />

      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[11px] text-slate-500">Lesionados</div><div className={`font-bold text-lg ${injuredCount > 0 ? "text-red-400" : "text-slate-200"}`}>{injuredCount}</div></div>
          <div><div className="text-[11px] text-slate-500">Moral média</div><div className="font-bold text-lg" style={{ color: moraleRead.color }}>{avgMorale}</div></div>
          <div><div className="text-[11px] text-slate-500">Condecorados</div><div className="font-bold text-lg text-amber-400">{decoratedCount}</div></div>
        </div>
      </Card>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-[11px] text-slate-500">Ordenar:</span>
        {[["ovr", "OVR"], ["morale", "Moral"], ["age", "Idade"], ["salary", "Salário"]].map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)} className={`text-[11px] px-2 py-0.5 rounded-md ${sortBy === k ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"}`}>{l}</button>
        ))}
        <button onClick={() => setOnlyIssues((v) => !v)} className={`text-[11px] px-2 py-0.5 rounded-md ml-auto ${onlyIssues ? "bg-red-500/20 text-red-300" : "bg-white/5 text-slate-400"}`}>
          Só problemas
        </button>
      </div>

      {groups.map((pos) => {
        let players = myTeam.roster.filter((p) => p.pos === pos);
        if (onlyIssues) players = players.filter((p) => p.injuredWeeks > 0 || (p.morale ?? 65) < 35);
        players = [...players].sort(ROSTER_SORTS[sortBy]);
        if (!players.length) return null;
        return (
          <Card key={pos} className="mb-3">
            <div className="text-xs text-slate-400 mb-1">{pos}</div>
            {players.map((p) => <PlayerRow key={p.id} p={p} showStats showMorale onOpenPlayer={onOpenPlayer} />)}
          </Card>
        );
      })}
      {onlyIssues && !hasAnyIssue && (
        <Card><div className="text-sm text-slate-400">Nenhum problema no elenco agora — tudo tranquilo. 👍</div></Card>
      )}
    </div>
  );
}

/* ============================================================
   DEPTH CHART
   ============================================================ */

const RESERVE_SLOTS = new Set(["QB2", "RB2", "BEN1", "BEN2", "BEN3", "BEN4", "BEN5"]);

// Fixed coordinates (0-320 x, 0-210 y) for a base 11-personnel offensive
// look and a base 4-3/3-4 defensive shell, purely visual — the actual play
// logic doesn't care where the dot sits on this diagram. Spacing is chosen
// so no two dots (or a dot and a neighboring name label) ever overlap.
const OFFENSE_COORDS = {
  WR1: { x: 0, y: 110 }, LT: { x: 52, y: 110 }, LG: { x: 88, y: 110 }, C: { x: 124, y: 110 },
  RG: { x: 160, y: 110 }, RT: { x: 196, y: 110 }, TE1: { x: 230, y: 125 }, WR2: { x: 320, y: 110 },
  WR3: { x: 280, y: 125 },
  QB1: { x: 124, y: 160 }, RB1: { x: 162, y: 163 },
};
const DEFENSE_COORDS = {
  "4-3": {
    DE1: { x: 86, y: 34 }, DT1: { x: 130, y: 34 }, DT2: { x: 182, y: 34 }, DE2: { x: 226, y: 34 },
    LB3: { x: 100, y: 84 }, LB1: { x: 160, y: 94 }, LB2: { x: 210, y: 84 },
    CB3: { x: 278, y: 70 },
    CB1: { x: 15, y: 118 }, CB2: { x: 315, y: 118 },
    S1: { x: 118, y: 168 }, S2: { x: 198, y: 168 },
  },
  "3-4": {
    DE1: { x: 100, y: 34 }, NT1: { x: 160, y: 34 }, DE2: { x: 220, y: 34 },
    LB3: { x: 70, y: 84 }, LB1: { x: 140, y: 84 }, LB2: { x: 190, y: 84 }, LB4: { x: 246, y: 84 },
    CB3: { x: 286, y: 70 },
    CB1: { x: 24, y: 118 }, CB2: { x: 304, y: 118 },
    S1: { x: 118, y: 168 }, S2: { x: 198, y: 168 },
  },
};

function FormationDot({ label, name, x, y, color, injured }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {injured && <circle r="14" fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="2,2" />}
      <circle r="11" fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <text textAnchor="middle" y="4" fontSize="9" fontWeight="800" fill="#0B1220" fontFamily="system-ui, sans-serif">{label}</text>
      <text textAnchor="middle" y="22" fontSize="8" fill={injured ? "#f87171" : "#cbd5e1"} fontFamily="system-ui, sans-serif">{name}</text>
    </g>
  );
}

// A compact field diagram of the starting offense or defense, drawn from
// each starter's slot on the depth chart — the visual companion to the list
// view below it, so you can see the shape of the unit at a glance.
function FormationField({ myTeam, side }) {
  const coords = side === "offense" ? OFFENSE_COORDS : DEFENSE_COORDS[myTeam.scheme] || DEFENSE_COORDS["4-3"];
  const color = side === "offense" ? "#38bdf8" : "#f97316";
  const lastName = (full) => full.split(" ").slice(-1)[0];
  return (
    <svg viewBox="0 0 320 210" className="w-full h-52 rounded-md" style={{ background: "#0d2818" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1={0} y1={25 + i * 34} x2={320} y2={25 + i * 34} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      <line x1={0} y1={10} x2={320} y2={10} stroke="rgba(56,189,248,0.5)" strokeWidth="1.5" strokeDasharray="4,3" />
      {Object.entries(coords).map(([slot, pos]) => {
        const p = myTeam.roster.find((pl) => pl.slot === slot);
        if (!p) return null;
        return <FormationDot key={slot} label={slot.replace(/[0-9]/g, "") || slot} name={lastName(p.name)} x={pos.x} y={pos.y} color={color} injured={p.injuredWeeks > 0} />;
      })}
    </svg>
  );
}

function DepthChartScreen({ myTeam, onSwap, onAutoSort }) {
  const [side, setSide] = useState("offense");
  const dlSlots = myTeam.scheme === "3-4" ? ["DE1", "DE2", "NT1"] : ["DE1", "DE2", "DT1", "DT2"];
  const lbSlots = myTeam.scheme === "3-4" ? ["LB1", "LB2", "LB3", "LB4"] : ["LB1", "LB2", "LB3"];
  const groupSlots = {
    "Quarterbacks": ["QB1", "QB2"],
    "Corredores": ["RB1", "RB2"],
    "Recebedores": ["WR1", "WR2", "WR3", "TE1"],
    "Linha ofensiva": ["LT", "LG", "C", "RG", "RT"],
    [`Linha defensiva (${myTeam.scheme})`]: dlSlots,
    "Linebackers": lbSlots,
    "Defesa secundária": ["CB1", "CB2", "CB3 (nickel)", "S1", "S2"],
    "Special teams": ["K1", "P1"],
    "Banco": ["BEN1", "BEN2", "BEN3", "BEN4", "BEN5"],
  };
  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-black">Escalação</h2>
        {onAutoSort && <button onClick={onAutoSort} className="text-[11px] font-semibold text-sky-400 px-2 py-1 rounded-md border border-sky-400/30 bg-sky-400/10">⚡ Auto-organizar por OVR</button>}
      </div>
      <p className="text-xs text-slate-500 mb-1">Esquema defensivo: <span className="text-slate-200 font-semibold">{myTeam.scheme}</span></p>
      <p className="text-xs text-slate-500 mb-3">Toque em um jogador e depois em outro da mesma posição para trocar de ordem.</p>
      <Card className="mb-4 !p-2">
        <div className="flex gap-2 mb-2">
          <button onClick={() => setSide("offense")} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${side === "offense" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-white/5 text-slate-400 border border-transparent"}`}>Ataque em campo</button>
          <button onClick={() => setSide("defense")} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${side === "defense" ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "bg-white/5 text-slate-400 border border-transparent"}`}>Defesa em campo</button>
        </div>
        <FormationField myTeam={myTeam} side={side} />
        <div className="text-[10px] text-slate-500 mt-1.5 text-center">Anel tracejado vermelho = jogador lesionado</div>
      </Card>
      {Object.entries(groupSlots).map(([label, slots]) => (
        <Card key={label} className="mb-3">
          <div className="text-xs text-slate-400 mb-1">{label}</div>
          {slots.map((rawKey) => {
            const slotKey = rawKey.replace(" (nickel)", "");
            const p = myTeam.roster.find((pl) => pl.slot === slotKey);
            if (!p) return null;
            const isReserve = RESERVE_SLOTS.has(slotKey);
            return <PlayerRow key={slotKey} p={p} showMorale right={
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isReserve ? "bg-white/5 text-slate-400" : "bg-green-500/15 text-green-400"}`}>
                  {isReserve ? "reserva" : "titular"}
                </span>
                <button onClick={() => onSwap(slotKey)} className="text-[11px] text-blue-400 font-semibold px-1">trocar</button>
              </div>
            } />;
          })}
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   TACTICS
   ============================================================ */

// Ties the abstract sliders back to the user's actual personnel — cheap,
// derived entirely from attributes already on the roster, but it makes the
// tactics screen feel like it's reading *your* team instead of a generic
// settings panel.
function TacticalAdvice({ myTeam }) {
  const rb1 = myTeam.roster.find((p) => p.slot === "RB1"), rb2 = myTeam.roster.find((p) => p.slot === "RB2");
  const wr1 = myTeam.roster.find((p) => p.slot === "WR1"), wr3 = myTeam.roster.find((p) => p.slot === "WR3");
  const te1 = myTeam.roster.find((p) => p.slot === "TE1");
  const tips = [];
  if (rb1 && rb2 && rb2.attrs.SPD >= rb1.attrs.SPD - 3) tips.push(`${rb2.name} tem velocidade parecida com a de ${rb1.name} — dá pra dividir mais as corridas sem perder muito.`);
  if (rb1 && rb1.age >= 29) tips.push(`${rb1.name} já tem ${rb1.age} anos — mais rotação com o RB2 ajuda a poupar desgaste ao longo da temporada.`);
  if (wr1 && wr3 && wr1.ovr - wr3.ovr >= 15) tips.push(`${wr3.name} (WR3) é bem mais fraco que ${wr1.name} — talvez valha reduzir o 10 personnel.`);
  if (te1 && te1.attrs.BLK >= 78) tips.push(`${te1.name} bloqueia muito bem — 12 personnel tende a render bem com ele em campo.`);
  if (!tips.length) return null;
  return (
    <Card className="mb-3">
      <div className="text-sm font-semibold mb-2">💡 Sugestões pro seu elenco</div>
      <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
        {tips.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </Card>
  );
}

function TacticsScreen({ myTeam, tendencies, onChange }) {
  const personnel = tendencies.personnel ?? DEFAULT_PERSONNEL;
  const setPersonnel = (key, v) => {
    const others = ["p11", "p12", "p21"].filter((k) => k !== key).reduce((s, k) => s + (personnel[k] ?? 0), 0);
    const capped = clamp(v, 0, 100 - others);
    const p10 = clamp(100 - capped - others, 0, 100);
    onChange({ ...tendencies, personnel: { ...personnel, [key]: capped, p10 } });
  };
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Táticas</h2>
      <p className="text-xs text-slate-500 mb-4">Defina como seu time vai jogar nas próximas partidas.</p>
      {myTeam && <TacticalAdvice myTeam={myTeam} />}
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Estilo ofensivo</span><span className="text-slate-400">{Math.round(tendencies.passRatio*100)}% passe</span></div>
        <input type="range" min="20" max="85" value={Math.round(tendencies.passRatio*100)}
          onChange={(e) => onChange({ ...tendencies, passRatio: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Corrida pesada</span><span>Passe pesado</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Agressividade no 4º down / decisões</span><span className="text-slate-400">{Math.round(tendencies.aggressive*100)}%</span></div>
        <input type="range" min="0" max="100" value={Math.round(tendencies.aggressive*100)}
          onChange={(e) => onChange({ ...tendencies, aggressive: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Conservador (chuta sempre)</span><span>Agressivo (vai pro tudo ou nada)</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Rotação de corredores</span><span className="text-slate-400">{Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}% das corridas p/ RB2</span></div>
        <input type="range" min="0" max="50" value={Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}
          onChange={(e) => onChange({ ...tendencies, rb2CarryShare: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB1 carrega tudo</span><span>Divide bem com o RB2</span></div>
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Personnel (agrupamentos em campo)</div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>11 (1 RB, 1 TE, 3 WR) — padrão</span><span className="text-slate-400">{personnel.p11}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p11} onChange={(e) => setPersonnel("p11", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>12 (1 RB, 2 TE, 2 WR) — reforça bloqueio</span><span className="text-slate-400">{personnel.p12}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p12} onChange={(e) => setPersonnel("p12", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>21 (2 RB, 1 TE, 2 WR) — pesado, corrida</span><span className="text-slate-400">{personnel.p21}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p21} onChange={(e) => setPersonnel("p21", Number(e.target.value))} className="w-full" />
        </div>
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-white/10">
          <span>10 (1 RB, 0 TE, 4 WR) — formação leve/spread</span><span>{personnel.p10}% (resto automático)</span>
        </div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Formação ligeira (vazia) em 11 / 10 personnel</span><span className="text-slate-400">{tendencies.lightFormationShare ?? 20}%</span></div>
        <input type="range" min="0" max="60" value={tendencies.lightFormationShare ?? 20}
          onChange={(e) => onChange({ ...tendencies, lightFormationShare: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB sempre fica pra bloquear</span><span>RB solto como recebedor extra</span></div>
      </Card>
      <Card>
        <div className="text-sm text-slate-300 mb-2">Um perfil mais agressivo tenta mais 4ª descidas e FGs mais longos; um perfil conservador prioriza punt e field goals seguros.</div>
        <div className="text-sm text-slate-300 mb-2">Dar mais corridas ao RB2 poupa o RB1 (menos desgaste ao longo da temporada), mas o RB2 costuma render um pouco menos por jarda.</div>
        <div className="text-sm text-slate-300 mb-2">Personnel 12/21 traz um bloqueador extra (corrida mais forte, menos blitz sofrido), mas reduz as opções de rota — sem WR3 em campo. 10 personnel é o oposto: mais recebedores, porém corrida mais fraca.</div>
        <div className="text-sm text-slate-300">Formação vazia (só disponível em 11/10) manda o RB pra rota em vez de bloquear — mais um recebedor, mas qualquer blitz chega sem ninguém pra segurar.</div>
      </Card>
    </div>
  );
}


/* ============================================================
   CONTRACTS
   ============================================================ */

// Players in the final year of their deal. Each one asks for terms shaped
// by how they feel about the club — happy players discount, sour ones cost
// more, and a fed-up one won't sign at all. Anyone not extended leaves at
// the season rollover; "deixar ir" sends them to the market now, with a
// pull back toward your club.
function ContractsScreen({ myTeam, onExtend, onRelease, onBack }) {
  const expiring = myTeam.roster.filter(isExpiring).sort((a, b) => b.ovr - a.ovr);
  const used = capUsed(myTeam.roster);
  return (
    <div className="pb-24">
      {onBack && <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>}
      <h2 className="text-xl font-black mb-1">Contratos</h2>
      <p className="text-xs text-slate-500 mb-4">
        Cap usado ${used.toFixed(1)}M / ${CAP}M · {expiring.length} contrato(s) no último ano. Quem não renovar sai ao fim da temporada.
      </p>
      {!expiring.length && <Card><div className="text-sm text-slate-400">Nenhum contrato vencendo agora — o elenco está estável. 👍</div></Card>}
      {expiring.map((p) => {
        const ask = extensionAsk(p);
        const mood = moraleLabel(p.morale ?? 65);
        const fits = ask.willing && used - p.salary + ask.salary <= CAP;
        return (
          <Card key={p.id} className="mb-3">
            <PlayerRow p={p} showMorale />
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-500">Moral: <span style={{ color: mood.color }} className="font-semibold">{mood.label}</span></span>
              {ask.willing
                ? <span className="text-slate-300">Pede <span className="font-bold">${ask.salary.toFixed(1)}M</span> · {ask.years} ano(s)</span>
                : <span className="text-red-400 font-semibold">Recusa renovar</span>}
            </div>
            {ask.willing && ask.note && <div className="text-[11px] text-slate-500 mt-1">{ask.note}</div>}
            {!ask.willing && <div className="text-[11px] text-red-400/80 mt-1">{ask.reason}</div>}
            {ask.willing && !fits && <div className="text-[11px] text-amber-400 mt-1">Sem espaço no cap pra esse contrato.</div>}
            <div className="flex gap-2 mt-3">
              <Btn className="flex-1" disabled={!fits} onClick={() => onExtend(p.id)}>Renovar</Btn>
              <Btn variant="ghost" onClick={() => onRelease(p.id)}>Deixar ir</Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   SCHEDULE / STANDINGS / PLAYOFFS
   ============================================================ */


export { RosterScreen, DepthChartScreen, TacticsScreen, ContractsScreen };
