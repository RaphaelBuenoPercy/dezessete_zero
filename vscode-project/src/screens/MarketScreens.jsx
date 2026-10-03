import React, { useState } from "react";
import { clamp } from "../lib/rng.js";
import { CAP, TEAM_META } from "../data/teams.js";
import { SUB_ATTRS } from "../data/rosterSlots.js";
import { capUsed, playerValue } from "../engine/playerGen.js";
import { scoreTeamForFreeAgent, teamNeeds } from "../season/freeAgencyAI.js";
import { scoreOffer, rankOffers } from "../season/negotiation.js";
import { ovrGrade, gradeColor, scoutingReport, fitForTeam, pickValueRead } from "../season/scouting.js";
import { resolvePickOwner, teamPicks, pickTradeValue, pickLabel } from "../season/picks.js";
import { STAT_CATEGORIES, RATIO_STATS, statRatioValue, formatStatValue, leagueLeaders } from "../season/stats.js";
import { buildTierList } from "../season/powerRankings.js";
import { GAME_RECORD_CATS, SEASON_RECORD_CATS } from "../season/records.js";
import { Bar, Card, Btn, shadeColor, TeamLogo, PosPill, OvrBadge, AttrBars, DevTag, devLabel } from "../components/ui.jsx";

// The four "front office" screens: Free Agency, Draft, Trade Center and
// league Stats, each with its own detail/card sub-components.

// What a free agent is shopping for, as a couple of short human-readable
// tags — derived from their generated priority weights plus climate/home
// team ties — so the user understands why a rival might land them.
const PRIORITY_LABELS = {
  money: "Foco em contrato milionário",
  winning: "Motivado por título",
  playingTime: "Busca minutos em quadra",
  climate: "Liga pro clima da cidade",
  fanSupport: "Valoriza torcida apaixonada",
  market: "Quer holofote de mercado grande",
};
const CLIMATE_LABELS = { warm: "Prefere clima quente", cold: "Prefere clima frio", mild: "Prefere clima ameno" };

function desireTags(player) {
  const tags = [];
  if (player.priorities) {
    const sorted = Object.entries(player.priorities).sort((a, b) => b[1] - a[1]);
    if (sorted[0]) tags.push(PRIORITY_LABELS[sorted[0][0]]);
    if (sorted[1] && sorted[1][1] > 0.18) tags.push(PRIORITY_LABELS[sorted[1][0]]);
  }
  if (CLIMATE_LABELS[player.climatePref]) tags.push(CLIMATE_LABELS[player.climatePref]);
  return tags.filter(Boolean);
}

function homeTeamLabel(player) {
  if (!player.homeTeam) return null;
  const t = TEAM_META.find((tm) => tm.abbr === player.homeTeam);
  return t ? `Tem ligação com o ${t.city} ${t.name}` : null;
}

function DesireTags({ player }) {
  const tags = [...desireTags(player), homeTeamLabel(player)].filter(Boolean);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map((t, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">{t}</span>
      ))}
    </div>
  );
}

/* ============================================================
   NEGOTIATION STATUS — reads a player's live faMarket record (rival
   offers, decision countdown, whether the user is in front) and turns it
   into short badges/labels reused across the list and detail screens.
   ============================================================ */

// Where the user's own offer stands against whatever else is on the table
// for this player right now — the core "how's it going" read.
function negotiationRead(player, negotiation, leagueTeams, myAbbr) {
  if (!negotiation || negotiation.offers.length === 0) {
    const score = scoreTeamForFreeAgent(player, leagueTeams[myAbbr]);
    const level = score > 0.62 ? { label: "Interesse alto no seu time", color: "#4ade80" }
      : score > 0.42 ? { label: "Interesse médio no seu time", color: "#fbbf24" }
      : { label: "Interesse baixo no seu time", color: "#f87171" };
    return { ...level, ranked: [], myOffer: null, rivalCount: 0, decisionIn: null };
  }
  const ranked = rankOffers(player, negotiation, leagueTeams);
  const myOffer = ranked.find((o) => o.teamAbbr === myAbbr) || null;
  const rivalCount = ranked.filter((o) => o.teamAbbr !== myAbbr).length;
  let label, color;
  if (!myOffer) {
    label = rivalCount === 1 ? "1 time negociando" : `${rivalCount} times negociando`;
    color = "#fbbf24";
  } else if (ranked[0].teamAbbr === myAbbr) {
    label = rivalCount > 0 ? "Você lidera a negociação" : "Sua proposta está na mesa";
    color = "#4ade80";
  } else {
    const leader = TEAM_META.find((t) => t.abbr === ranked[0].teamAbbr);
    label = `Perdendo para o ${leader?.abbr || ranked[0].teamAbbr}`;
    color = "#f87171";
  }
  return { label, color, ranked, myOffer, rivalCount, decisionIn: negotiation.decisionIn };
}

function StatusBadge({ read }) {
  return <span className="text-[10px] font-semibold" style={{ color: read.color }}>{read.label}</span>;
}

function DecisionClock({ decisionIn }) {
  if (decisionIn === null || decisionIn === undefined) return null;
  return (
    <span className="text-[10px] text-slate-500">
      {decisionIn <= 0 ? "pode decidir a qualquer momento" : `decide em ~${decisionIn} rodada(s) de mercado`}
    </span>
  );
}

// How likely a hypothetical offer looks to win, given whatever else is
// already on the table — used to give live feedback as the user drags the
// contract sliders around, before they actually submit anything.
function chanceRead(player, myTeam, offer, rivalRanked) {
  const myScore = scoreOffer(player, myTeam, offer);
  if (!rivalRanked.length) {
    if (myScore > 0.65) return { label: "Proposta forte", color: "#4ade80" };
    if (myScore > 0.45) return { label: "Proposta razoável", color: "#fbbf24" };
    return { label: "Proposta fraca", color: "#f87171" };
  }
  const diff = myScore - rivalRanked[0].score;
  if (diff > 0.08) return { label: "Você estaria na frente", color: "#4ade80" };
  if (diff > -0.08) return { label: "Disputa apertada", color: "#fbbf24" };
  return { label: "Perdendo terreno", color: "#f87171" };
}

function NegotiationLog({ log }) {
  if (!log || !log.length) return null;
  return (
    <Card className="mb-3">
      <div className="text-sm font-semibold mb-2">Bastidores da negociação</div>
      <div className="space-y-1 text-xs text-slate-400">
        {[...log].reverse().map((line, i) => <div key={i} className="border-b border-white/5 pb-1 last:border-0">{line}</div>)}
      </div>
    </Card>
  );
}

function RivalOffers({ ranked, myAbbr }) {
  const rivals = ranked.filter((o) => o.teamAbbr !== myAbbr);
  if (!rivals.length) return null;
  return (
    <Card className="mb-3">
      <div className="text-sm font-semibold mb-2">Propostas rivais na mesa</div>
      <div className="space-y-1.5">
        {rivals.map((o, i) => (
          <div key={o.teamAbbr} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-4">{i + (ranked[0].teamAbbr === myAbbr ? 2 : 1)}º</span>
              <TeamLogo abbr={o.teamAbbr} size={20} /><span>{o.teamAbbr}</span>
            </div>
            <span className="text-slate-400 tabular-nums text-xs">{o.years} ano(s) · ${o.salary.toFixed(1)}M/ano</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// After a negotiation resolves, the player disappears from the pool. Look
// up how it ended so the detail screen can close the loop with a proper
// win/loss beat instead of a flat "not available anymore".
function ResolvedOutcome({ playerId, career, myTeam, onBack }) {
  const outcome = (career.freeAgencyActivity || []).find((a) => a.playerId === playerId);
  const won = outcome?.teamAbbr === myTeam.abbr;
  return (
    <div className="pb-24">
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
      <Card className={won ? "border-emerald-400/40" : undefined}>
        {outcome ? (
          won ? (
            <div className="text-sm text-slate-200">
              <div className="font-bold text-emerald-400 mb-1">✓ Negócio fechado!</div>
              {outcome.name} assinou com você — {outcome.years} ano(s), ${outcome.salary.toFixed(1)}M/ano.
            </div>
          ) : (
            <div className="text-sm text-slate-300">
              {outcome.name} assinou com {TEAM_META.find((t) => t.abbr === outcome.teamAbbr)?.name || outcome.teamAbbr} {outcome.reason} — sua proposta não venceu desta vez.
            </div>
          )
        ) : (
          <div className="text-sm text-slate-400">Este agente livre já foi assinado ou não está mais disponível.</div>
        )}
      </Card>
    </div>
  );
}

function FreeAgentDetailScreen({ playerId, career, myTeam, onBack, onOffer, onWithdraw }) {
  const player = career.freeAgentPool.find((p) => p.id === playerId);
  const negotiation = career.faMarket?.[playerId];
  const [offerYears, setOfferYears] = useState(player?.askingYears || 2);
  const [offerSalary, setOfferSalary] = useState(player?.salary || 1);

  if (!player) return <ResolvedOutcome playerId={playerId} career={career} myTeam={myTeam} onBack={onBack} />;

  const subAttrs = SUB_ATTRS[player.pos] || [];
  const capRoom = CAP - capUsed(myTeam.roster);
  const targetSlot = myTeam.roster.filter((r) => r.pos === player.pos).sort((a, b) => a.ovr - b.ovr)[0];
  const upgrade = targetSlot ? player.ovr - targetSlot.ovr : null;
  const read = negotiationRead(player, negotiation, career.leagueTeams, myTeam.abbr);
  const rivalRanked = read.ranked.filter((o) => o.teamAbbr !== myTeam.abbr);
  const salaryMin = Math.max(0.8, Math.round(player.salary * 0.6 * 10) / 10);
  const salaryMax = Math.max(salaryMin + 0.5, Math.min(capRoom, Math.round(player.salary * 1.8 * 10) / 10));
  const clampedSalary = clamp(offerSalary, salaryMin, salaryMax);
  const chance = chanceRead(player, myTeam, { years: offerYears, salary: clampedSalary }, rivalRanked);
  const affordable = clampedSalary <= capRoom;

  return (
    <div className="pb-24">
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
      <div className="flex items-center gap-3 mb-4">
        <OvrBadge ovr={player.ovr} size={56} />
        <div>
          <div className="text-2xl font-black leading-tight">{player.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
            <PosPill pos={player.pos} /><span>Agente livre · sem contrato</span>
          </div>
          <div className="mt-1 flex items-center gap-2"><StatusBadge read={read} /><DecisionClock decisionIn={read.decisionIn} /></div>
        </div>
      </div>
      <DesireTags player={player} />
      <div className="mb-2" />
      <Card className="mb-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><div className="text-slate-500 text-[11px]">Overall</div><div className="font-bold text-lg">{player.ovr}</div></div>
          <div><div className="text-slate-500 text-[11px]">Idade</div><div className="font-bold text-lg">{player.age}</div></div>
          <div><div className="text-slate-500 text-[11px]">Pede</div><div className="font-bold text-lg">${player.salary.toFixed(1)}M</div></div>
          <div><div className="text-slate-500 text-[11px]">Anos</div><div className="font-bold text-lg">{player.askingYears}</div></div>
        </div>
      </Card>
      {subAttrs.length === 2 && (
        <Card className="mb-3">
          <div className="text-sm font-semibold mb-2">Atributos</div>
          {subAttrs.map((a) => (
            <div key={a} className="mb-2 last:mb-0">
              <div className="flex justify-between text-xs mb-1"><span>{a}</span><span>{player.attrs[a]}</span></div>
              <Bar value={player.attrs[a]} max={99} color="#38bdf8" />
            </div>
          ))}
        </Card>
      )}

      <RivalOffers ranked={read.ranked} myAbbr={myTeam.abbr} />
      <NegotiationLog log={negotiation?.log} />

      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Sua proposta</div>
        <div className="text-xs text-slate-400 mb-1.5">Anos de contrato</div>
        <div className="flex gap-1.5 mb-3">
          {[1, 2, 3, 4, 5].map((y) => (
            <button key={y} onClick={() => setOfferYears(y)}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold border ${offerYears === y ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Salário anual</span>
          <span className="font-bold tabular-nums text-slate-200">${clampedSalary.toFixed(1)}M</span>
        </div>
        <input type="range" min={salaryMin} max={salaryMax} step={0.1} value={clampedSalary}
          onChange={(e) => setOfferSalary(Number(e.target.value))} className="w-full accent-sky-400 mb-1" />
        <div className="flex justify-between text-[10px] text-slate-500 mb-3">
          <span>${salaryMin.toFixed(1)}M</span><span>${salaryMax.toFixed(1)}M</span>
        </div>
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-slate-500">Cap disponível: <span className="text-slate-300 tabular-nums">${capRoom.toFixed(1)}M</span></span>
          <span className="font-semibold" style={{ color: chance.color }}>{chance.label}</span>
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1" variant={affordable ? "primary" : "ghost"} disabled={!affordable}
            onClick={() => onOffer(player, { years: offerYears, salary: clampedSalary })}>
            {read.myOffer ? "Revisar proposta" : "Enviar proposta"}
          </Btn>
          {read.myOffer && <Btn variant="ghost" onClick={() => onWithdraw(player.id)}>Retirar</Btn>}
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold mb-2">Curiosidades</div>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Perfil de desenvolvimento: <span className="text-slate-200">{devLabel(player.dev)}</span></li>
          {targetSlot && (
            <li>
              No seu elenco, substituiria <span className="text-slate-200">{targetSlot.name}</span> ({targetSlot.ovr} OVR)
              {upgrade > 0 && <span className="text-green-400 font-semibold"> · upgrade +{upgrade}</span>}
              {upgrade < 0 && <span className="text-red-400 font-semibold"> · rebaixa {upgrade}</span>}
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function FreeAgentCard({ p, targetSlot, career, myTeam, onOffer, onOpenPlayer }) {
  const upgrade = targetSlot ? p.ovr - targetSlot.ovr : null;
  const capRoom = CAP - capUsed(myTeam.roster);
  const negotiation = career.faMarket?.[p.id];
  const read = negotiationRead(p, negotiation, career.leagueTeams, myTeam.abbr);
  const affordable = capRoom >= p.salary;
  return (
    <Card className="mb-3">
      <div className="flex items-start gap-3">
        <OvrBadge ovr={p.ovr} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PosPill pos={p.pos} />
            {onOpenPlayer ? (
              <button onClick={() => onOpenPlayer(p.id)} className="font-semibold text-sm truncate hover:text-sky-300 hover:underline text-left">{p.name}</button>
            ) : (
              <span className="font-semibold text-sm truncate">{p.name}</span>
            )}
            <DevTag dev={p.dev} />
            {p.formerTeam && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">ex-{p.formerTeam}</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            idade {p.age} · pede {p.askingYears} ano(s) · <span className="text-slate-300 font-medium">${p.salary.toFixed(1)}M/ano</span>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap"><StatusBadge read={read} /><DecisionClock decisionIn={read.decisionIn} /></div>
          <DesireTags player={p} />
          <AttrBars pos={p.pos} attrs={p.attrs} />
          {targetSlot && (
            <div className="text-[11px] text-slate-500 mt-2">
              substituiria <span className="text-slate-300">{targetSlot.name}</span> <span className="text-slate-500">({targetSlot.ovr} OVR)</span>
              {upgrade > 0 && <span className="text-green-400 font-semibold"> · upgrade +{upgrade}</span>}
              {upgrade < 0 && <span className="text-red-400 font-semibold"> · rebaixa {upgrade}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Btn className="flex-1" variant={affordable ? "primary" : "ghost"} disabled={!affordable}
          onClick={() => onOffer(p, { years: p.askingYears, salary: p.salary })}>
          {read.myOffer ? "Atualizar para a pedida" : affordable ? "Propor na pedida" : "Cap insuficiente"}
        </Btn>
        {onOpenPlayer && <Btn variant="ghost" onClick={() => onOpenPlayer(p.id)}>Negociar</Btn>}
      </div>
    </Card>
  );
}

function FreeAgencyScreen({ career, myTeam, onOffer, onOpenPlayer, onAdvanceMarket }) {
  const [posFilter, setPosFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState("ovr");
  const cap = CAP - capUsed(myTeam.roster);

  const positions = ["Todos", ...Array.from(new Set(career.freeAgentPool.map((p) => p.pos)))];
  let pool = posFilter === "Todos" ? career.freeAgentPool : career.freeAgentPool.filter((p) => p.pos === posFilter);
  pool = [...pool].sort((a, b) => sortBy === "ovr" ? b.ovr - a.ovr : sortBy === "salary" ? a.salary - b.salary : a.age - b.age);
  const recentActivity = (career.freeAgencyActivity || []).slice(0, 6);
  const inNegotiation = career.freeAgentPool.filter((p) => (career.faMarket?.[p.id]?.offers.length || 0) > 0).length;

  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Free Agency</h2>
      <p className="text-xs text-slate-500 mb-4">
        {career.freeAgentPool.length} agente(s) livre(s) no mercado{inNegotiation > 0 ? ` · ${inNegotiation} em negociação ativa` : ""}. Os outros times também estão negociando — cada jogador pesa clima, dinheiro, chances de jogar, torcida e mais na hora de escolher, e pode fechar com um rival se você demorar demais.
      </p>

      <Card className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Cap disponível</span>
          <span className={`font-bold tabular-nums ${cap < 10 ? "text-red-400" : "text-slate-200"}`}>${cap.toFixed(1)}M <span className="text-slate-500 font-normal">de ${CAP}M</span></span>
        </div>
        <Bar value={cap} max={CAP} color={cap < 10 ? "#f87171" : "#4ade80"} />
      </Card>

      {recentActivity.length > 0 && (
        <Card className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Atividade recente do mercado</div>
          <div className="space-y-1">
            {recentActivity.map((s, i) => (
              <div key={i} className="text-sm py-1 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <TeamLogo abbr={s.teamAbbr} size={18} />
                  <PosPill pos={s.pos} />
                  <span className="truncate flex-1">{s.name}</span>
                  <span className="text-slate-500 tabular-nums text-xs">{s.ovr}</span>
                </div>
                {s.reason && <div className="text-[10px] text-slate-500 mt-0.5 ml-6">{s.years} ano(s) · ${s.salary?.toFixed(1)}M/ano {s.reason}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Btn variant="ghost" className="w-full mb-4" onClick={onAdvanceMarket}>Avançar mercado (outros times negociam)</Btn>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
        {positions.map((pos) => (
          <button key={pos} onClick={() => setPosFilter(pos)}
            className={`text-[11px] px-2.5 py-1 rounded-md border shrink-0 ${posFilter === pos ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
            {pos}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] text-slate-500">Ordenar:</span>
        {[["ovr", "Melhor OVR"], ["salary", "Mais barato"], ["age", "Mais jovem"]].map(([k, label]) => (
          <button key={k} onClick={() => setSortBy(k)}
            className={`text-[11px] ${sortBy === k ? "text-sky-300 font-semibold underline" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {pool.length === 0 && <Card><div className="text-sm text-slate-400">Nenhum agente livre nessa posição.</div></Card>}
      {pool.map((p) => {
        const targetSlot = myTeam.roster.filter((r) => r.pos === p.pos).sort((a, b) => a.ovr - b.ovr)[0];
        return <FreeAgentCard key={p.id} p={p} targetSlot={targetSlot} career={career} myTeam={myTeam} onOffer={onOffer} onOpenPlayer={onOpenPlayer} />;
      })}
    </div>
  );
}

/* ============================================================
   DRAFT
   ============================================================ */

// Full detail page for a draft prospect — attrs, projection, and a draft
// button that only lights up when it's actually the user's pick.
function GradeBadge({ grade }) {
  const c = gradeColor(grade);
  return (
    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ color: c, background: c + "1a", border: `1px solid ${c}55` }}>
      {grade}
    </span>
  );
}

function ScoutingBlurb({ report, className = "" }) {
  if (!report?.strength) return null;
  return (
    <div className={`text-[11px] text-slate-500 mt-0.5 ${className}`}>
      Destaque: <span className="text-slate-300">{report.strength}</span>
      {report.concern && <> · Atenção: <span className="text-amber-400">{report.concern}</span></>}
    </div>
  );
}

// Top current needs for whichever team we're looking at — reused for both
// the on-the-clock hero (predicting what a rival might do) and the
// detail page (judging a prospect against your own roster).
function TeamNeedsStrip({ team }) {
  if (!team) return null;
  const needs = teamNeeds(team).slice(0, 4);
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {needs.map((n, i) => {
        const color = n.bestOvr < 60 ? "#f87171" : n.bestOvr < 72 ? "#fbbf24" : "#94a3b8";
        const ovrLabel = n.bestOvr === 0 ? "sem ninguém" : `${n.bestOvr} OVR`;
        return (
          <span key={n.pos} className="text-[10px] font-semibold px-1.5 py-0.5 rounded border" style={{ color, borderColor: color + "55", background: color + "14" }}>
            {i === 0 ? "🎯 " : ""}{n.pos} ({ovrLabel})
          </span>
        );
      })}
    </div>
  );
}

// How many picks stand between the current slot and the user's next turn
// on the clock — 0 means "you're up right now".
function picksUntilMine(order, futurePicks, draftYear, idx, myAbbr, totalPicks) {
  for (let k = 0; k < order.length; k++) {
    const i = idx + k;
    if (i >= totalPicks) return null;
    const round = Math.floor(i / order.length) + 1;
    if (resolvePickOwner(futurePicks, order, draftYear, round, i) === myAbbr) return k;
  }
  return null;
}

// The full-screen "we're on the clock" moment right after a pick is made
// from the board — grade, fit, and scouting blurb all in one dramatic beat.
function PickAnnouncement({ player, round, myTeam, onClose }) {
  if (!player) return null;
  const grade = ovrGrade(player.ovr);
  const fit = fitForTeam(player, myTeam);
  const report = scoutingReport(player);
  const value = pickValueRead(player.draftRound, round);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-30 p-4">
      <div className="bg-[#131B2E] border border-white/10 rounded-lg p-6 w-full max-w-md text-center">
        <div className="text-[11px] text-slate-400 mb-3 uppercase tracking-wide">Rodada {round} · O {myTeam.abbr} escolhe</div>
        <div className="flex justify-center"><OvrBadge ovr={player.ovr} size={72} /></div>
        <div className="text-2xl font-black mt-3">{player.name}</div>
        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          <PosPill pos={player.pos} />
          <GradeBadge grade={grade} />
          <span className="text-[11px] font-semibold" style={{ color: value.color }}>{value.label}</span>
        </div>
        <div className="text-xs mt-2 font-medium" style={{ color: fit.color }}>{fit.label}</div>
        <ScoutingBlurb report={report} className="text-center mt-2" />
        <Btn className="w-full mt-5" onClick={onClose}>Continuar draft</Btn>
      </div>
    </div>
  );
}

function ProspectDetailScreen({ playerId, career, myTeam, onBack, onDraftPick }) {
  const player = career.draftClass?.find((p) => p.id === playerId);
  if (!player) {
    return (
      <div className="pb-24">
        <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
        <Card><div className="text-sm text-slate-400">Este prospect já foi draftado por outro time.</div></Card>
      </div>
    );
  }
  const subAttrs = SUB_ATTRS[player.pos] || [];
  const order = career.draftOrder;
  const round = Math.floor(career.draftPickIndex / order.length) + 1;
  const onClock = resolvePickOwner(career.futurePicks, order, career.year + 1, round, career.draftPickIndex);
  const isMe = onClock === myTeam.abbr;
  const grade = ovrGrade(player.ovr);
  const fit = fitForTeam(player, myTeam);
  const report = scoutingReport(player);
  const value = pickValueRead(player.draftRound, round);
  const targetSlot = myTeam.roster.filter((r) => r.pos === player.pos).sort((a, b) => a.ovr - b.ovr)[0];
  const upgrade = targetSlot ? player.ovr - targetSlot.ovr : null;

  return (
    <div className="pb-24">
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
      <div className="flex items-center gap-3 mb-2">
        <OvrBadge ovr={player.ovr} size={56} />
        <div>
          <div className="text-2xl font-black leading-tight">{player.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
            <PosPill pos={player.pos} /><GradeBadge grade={grade} /><span>projeção rodada {player.draftRound}</span>
          </div>
          <div className="mt-1 text-xs font-medium" style={{ color: fit.color }}>{fit.label}</div>
        </div>
      </div>
      <ScoutingBlurb report={report} />
      <div className="mb-2" />
      <Card className="mb-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-slate-500 text-[11px]">Projeção OVR</div><div className="font-bold text-lg">{player.ovr}</div></div>
          <div><div className="text-slate-500 text-[11px]">Idade</div><div className="font-bold text-lg">{player.age}</div></div>
          <div><div className="text-slate-500 text-[11px]">Rodada</div><div className="font-bold text-lg">{player.draftRound}</div></div>
        </div>
      </Card>
      {subAttrs.length === 2 && (
        <Card className="mb-3">
          <div className="text-sm font-semibold mb-2">Atributos</div>
          {subAttrs.map((a) => (
            <div key={a} className="mb-2 last:mb-0">
              <div className="flex justify-between text-xs mb-1"><span>{a}</span><span>{player.attrs[a]}</span></div>
              <Bar value={player.attrs[a]} max={99} color="#38bdf8" />
            </div>
          ))}
        </Card>
      )}
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Curiosidades</div>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Contrato de novato: <span className="text-slate-200">4 anos · ${player.salary.toFixed(1)}M/ano</span></li>
          <li>Se draftado agora (rodada {round}): <span style={{ color: value.color }}>{value.label}</span></li>
          {targetSlot && (
            <li>
              No seu elenco, substituiria <span className="text-slate-200">{targetSlot.name}</span> ({targetSlot.ovr} OVR)
              {upgrade > 0 && <span className="text-green-400 font-semibold"> · upgrade +{upgrade}</span>}
              {upgrade < 0 && <span className="text-red-400 font-semibold"> · rebaixa {upgrade}</span>}
            </li>
          )}
        </ul>
      </Card>
      {isMe ? (
        <Btn className="w-full" onClick={() => onDraftPick(player)}>Draftar {player.name.split(" ").slice(-1)[0]}</Btn>
      ) : (
        <div className="text-center text-xs text-slate-500 py-2">Só é possível draftar quando for a sua vez.</div>
      )}
    </div>
  );
}

function ProspectCard({ p, myTeam, isMe, onDraftPick, onOpenPlayer }) {
  const grade = ovrGrade(p.ovr);
  const fit = fitForTeam(p, myTeam);
  const report = scoutingReport(p);
  return (
    <Card className="mb-3">
      <div className="flex items-start gap-3">
        <OvrBadge ovr={p.ovr} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PosPill pos={p.pos} />
            {onOpenPlayer ? (
              <button onClick={() => onOpenPlayer(p.id)} className="font-semibold text-sm truncate hover:text-sky-300 hover:underline text-left">{p.name}</button>
            ) : (
              <span className="font-semibold text-sm truncate">{p.name}</span>
            )}
            <GradeBadge grade={grade} />
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-slate-400">Rodada {p.draftRound}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">idade {p.age} · projeção OVR {p.ovr}</div>
          <div className="text-[11px] font-medium mt-1" style={{ color: fit.color }}>{fit.label}</div>
          <ScoutingBlurb report={report} />
          <AttrBars pos={p.pos} attrs={p.attrs} />
        </div>
      </div>
      {isMe && <Btn className="w-full mt-3" onClick={() => onDraftPick(p)}>Draftar {p.name.split(" ").slice(-1)[0]}</Btn>}
    </Card>
  );
}

function DraftRecap({ career, myTeam }) {
  const mine = (career.draftHistory || []).filter((h) => h.teamAbbr === myTeam.abbr);
  if (!mine.length) {
    return <Card><div className="text-sm text-slate-400">Você não fez nenhuma escolha nesse draft.</div></Card>;
  }
  const reads = mine.map((h) => (h.projectedRound ? pickValueRead(h.projectedRound, h.round) : null));
  const steals = reads.filter((r) => r?.label === "ROUBADA!" || r?.label === "Ótimo valor").length;
  return (
    <Card>
      <div className="text-sm font-semibold mb-1">Sua classe de {career.year}</div>
      <div className="text-xs text-slate-500 mb-3">
        {mine.length} escolha(s){steals > 0 ? ` · ${steals} de bom valor ou mais` : ""}.
      </div>
      <div className="space-y-1.5">
        {mine.map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0">
            <span className="text-[10px] text-slate-500 w-10 tabular-nums shrink-0">{h.round}.{String(h.pick).padStart(2, "0")}</span>
            <PosPill pos={h.pos} />
            <span className="truncate flex-1">{h.name}</span>
            <span className="text-slate-500 tabular-nums text-xs">{h.ovr}</span>
            {reads[i] && <span className="text-[10px] font-semibold shrink-0" style={{ color: reads[i].color }}>{reads[i].label}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function DraftScreen({ career, myTeam, onDraftPick, onSimToMyPick, onOpenPlayer }) {
  const [posFilter, setPosFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState("rank");
  const [justPicked, setJustPicked] = useState(null);
  const order = career.draftOrder;
  const draftYear = career.year + 1;
  const idx = career.draftPickIndex;
  const totalPicks = order.length * 7;
  const round = Math.floor(idx / order.length) + 1;
  const pickInRound = (idx % order.length) + 1;
  const onClock = resolvePickOwner(career.futurePicks, order, draftYear, round, idx);
  const isMe = onClock === myTeam.abbr;
  const clockTeam = TEAM_META.find((t) => t.abbr === onClock);
  const untilMine = picksUntilMine(order, career.futurePicks, draftYear, idx, myTeam.abbr, totalPicks);

  function handleDraft(p) {
    onDraftPick(p);
    setJustPicked({ ...p, atRound: round });
  }

  if (idx >= totalPicks) {
    return (
      <div className="pb-24">
        <Card className="text-center py-8 mb-4">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-black text-lg mb-1">Draft encerrado!</div>
          <div className="text-sm text-slate-400">Confira os novatos no seu elenco.</div>
        </Card>
        <DraftRecap career={career} myTeam={myTeam} />
      </div>
    );
  }

  const steals = (career.draftHistory || [])
    .filter((h) => h.projectedRound && pickValueRead(h.projectedRound, h.round).label === "ROUBADA!")
    .slice(-4).reverse();

  const posCounts = {};
  career.draftClass.forEach((p) => { posCounts[p.pos] = (posCounts[p.pos] || 0) + 1; });
  const positions = ["Todos", ...Array.from(new Set(career.draftClass.map((p) => p.pos)))];
  let filtered = posFilter === "Todos" ? career.draftClass : career.draftClass.filter((p) => p.pos === posFilter);
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "fit") {
      const fa = fitForTeam(a, myTeam).rank ?? 99, fb = fitForTeam(b, myTeam).rank ?? 99;
      if (fa !== fb) return fa - fb;
    }
    return b.ovr - a.ovr;
  });
  const top = filtered.slice(0, 12);
  const recent = [...(career.draftHistory || [])].slice(-6).reverse();

  return (
    <div className="pb-24">
      <PickAnnouncement player={justPicked} round={justPicked?.atRound} myTeam={myTeam} onClose={() => setJustPicked(null)} />
      <h2 className="text-xl font-black mb-1">Draft {career.year}</h2>
      <p className="text-xs text-slate-500 mb-3">Pick {idx + 1} de {totalPicks} · Rodada {round}, escolha {pickInRound}</p>
      <div className="mb-4">
        <Bar value={idx} max={totalPicks} color="#38bdf8" />
      </div>

      <div className="rounded-lg border border-white/10 p-4 mb-4 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${shadeColor(clockTeam?.c1 || "#1e293b", -30)}, ${shadeColor(clockTeam?.c1 || "#1e293b", -65)})` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-white/60 uppercase tracking-wide">No relógio agora</div>
          {isMe && <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-500/25 text-emerald-300 shrink-0">SUA VEZ</span>}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <TeamLogo abbr={onClock} size={48} />
          <div className="min-w-0">
            <div className="font-black text-xl text-white truncate">{clockTeam?.city} {clockTeam?.name}</div>
            {!isMe && <div className="text-xs text-white/50">{untilMine === 0 ? "próxima escolha é sua!" : untilMine ? `faltam ${untilMine} pick(s) até sua vez` : ""}</div>}
          </div>
        </div>
        <TeamNeedsStrip team={career.leagueTeams[onClock]} />
        {!isMe && <Btn className="w-full mt-3" onClick={onSimToMyPick}>Simular até minha próxima escolha</Btn>}
      </div>

      {steals.length > 0 && (
        <Card className="mb-4 border-emerald-400/30">
          <div className="text-xs text-emerald-400 font-semibold mb-2">💎 Roubadas do draft</div>
          <div className="space-y-1">
            {steals.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                <TeamLogo abbr={h.teamAbbr} size={16} /><PosPill pos={h.pos} />
                <span className="truncate flex-1">{h.name}</span>
                <span className="text-[10px] text-slate-500 shrink-0">pick {h.round}.{String(h.pick).padStart(2, "0")} · projeção R{h.projectedRound}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recent.length > 0 && (
        <Card className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Últimas escolhas</div>
          <div className="space-y-1">
            {recent.map((h, i) => {
              const val = h.projectedRound ? pickValueRead(h.projectedRound, h.round) : null;
              return (
                <div key={i} className={`flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0 ${h.teamAbbr === myTeam.abbr ? "text-white font-semibold" : "text-slate-300"}`}>
                  <span className="text-[10px] text-slate-500 w-10 tabular-nums shrink-0">{h.round}.{String(h.pick).padStart(2, "0")}</span>
                  <TeamLogo abbr={h.teamAbbr} size={18} />
                  <PosPill pos={h.pos} />
                  <span className="truncate flex-1">{h.name}</span>
                  <span className="text-slate-500 tabular-nums text-xs shrink-0">{h.ovr}</span>
                  {val && <span className="text-[10px] font-semibold shrink-0" style={{ color: val.color }}>{val.label}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
        {positions.map((pos) => (
          <button key={pos} onClick={() => setPosFilter(pos)}
            className={`text-[11px] px-2.5 py-1 rounded-md border shrink-0 ${posFilter === pos ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
            {pos}{pos !== "Todos" ? ` (${posCounts[pos] || 0})` : ""}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] text-slate-500">Ordenar:</span>
        {[["rank", "Melhor disponível"], ["fit", "Meu encaixe"]].map(([k, label]) => (
          <button key={k} onClick={() => setSortBy(k)}
            className={`text-[11px] ${sortBy === k ? "text-sky-300 font-semibold underline" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-400 mb-2">Melhores disponíveis</div>
      {top.map((p) => <ProspectCard key={p.id} p={p} myTeam={myTeam} isMe={isMe} onDraftPick={handleDraft} onOpenPlayer={onOpenPlayer} />)}
    </div>
  );
}

/* ============================================================
   TRADE CENTER
   ============================================================ */

/* ============================================================
   STATS
   ============================================================ */

function PowerRankingsPanel({ career, myTeam, onOpenTeam }) {
  const ranked = career.powerRankings?.length ? career.powerRankings : null;
  if (!ranked) return <Card><div className="text-sm text-slate-400">As power rankings aparecem depois da primeira semana jogada.</div></Card>;
  return (
    <>
      {career.hotTake && (
        <Card className="mb-4 border-amber-400/30">
          <div className="text-xs text-amber-400 font-semibold mb-1">🎙️ Hot take da semana</div>
          <div className="text-sm text-slate-300 italic">{career.hotTake}</div>
        </Card>
      )}
      <Card>
        <div className="text-xs text-slate-400 mb-2">📊 Power Rankings — semana {career.week > 1 ? career.week - 1 : 1}</div>
        <div className="space-y-1">
          {ranked.map((t) => (
            <button key={t.abbr} onClick={() => onOpenTeam(t.abbr)}
              className={`w-full flex items-center gap-2 text-sm py-1.5 border-b border-white/5 last:border-0 text-left ${t.abbr === myTeam.abbr ? "text-white font-semibold" : "text-slate-300"}`}>
              <span className="text-xs text-slate-500 w-5 tabular-nums">{t.rank}</span>
              <TeamLogo abbr={t.abbr} size={22} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span>{t.abbr}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</span>
                  {t.delta > 0 && <span className="text-[10px] text-emerald-400 font-semibold">▲{t.delta}</span>}
                  {t.delta < 0 && <span className="text-[10px] text-red-400 font-semibold">▼{Math.abs(t.delta)}</span>}
                </div>
                <div className="text-[10px] text-slate-500 truncate">{t.blurb}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

const TIER_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

function TierListPanel({ career, myTeam, onOpenPlayer }) {
  const [pos, setPos] = useState("QB");
  const tiers = buildTierList(career.leagueTeams, pos);
  return (
    <>
      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">Posição</div>
        <div className="flex flex-wrap gap-1.5">
          {TIER_POSITIONS.map((p) => (
            <button key={p} onClick={() => setPos(p)}
              className={`text-[11px] px-2 py-1 rounded-md border ${pos === p ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
              {p}
            </button>
          ))}
        </div>
      </Card>
      {!tiers.length && <Card><div className="text-sm text-slate-400">Sem estatísticas suficientes nessa posição ainda.</div></Card>}
      {tiers.map((t) => (
        <Card key={t.key} className="mb-3">
          <div className="text-sm font-bold mb-2" style={{ color: t.color }}>{t.label}</div>
          <div className="space-y-1">
            {t.players.map(({ p, teamAbbr }) => (
              <button key={p.id} onClick={() => onOpenPlayer(p.id, teamAbbr)}
                className={`w-full flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0 text-left hover:text-sky-300 ${teamAbbr === myTeam.abbr ? "font-semibold text-white" : "text-slate-300"}`}>
                <span className="flex items-center gap-2 min-w-0"><TeamLogo abbr={teamAbbr} size={16} /><span className="truncate">{p.name}</span></span>
                <span className="text-[10px] text-slate-500 shrink-0 ml-2">{teamAbbr}</span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}


function RecordsPanel({ career, onOpenPlayer }) {
  const records = career.leagueRecords || { single_game: {}, single_season: {} };
  const [scope, setScope] = useState("game");
  const cats = scope === "game" ? GAME_RECORD_CATS : SEASON_RECORD_CATS;
  const bucket = scope === "game" ? records.single_game : records.single_season;
  return (
    <>
      <Card className="mb-3 !p-2">
        <div className="flex gap-2">
          <button onClick={() => setScope("game")} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${scope === "game" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-white/5 text-slate-400 border border-transparent"}`}>Recordes de jogo</button>
          <button onClick={() => setScope("season")} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${scope === "season" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-white/5 text-slate-400 border border-transparent"}`}>Recordes de temporada</button>
        </div>
      </Card>
      {cats.map(({ key, label }) => {
        const r = bucket[key];
        return (
          <Card key={key} className="mb-3">
            <div className="text-xs text-slate-400 mb-1.5">{label}</div>
            {r ? (
              <button onClick={() => onOpenPlayer(r.playerId, r.teamAbbr)} className="w-full flex items-center justify-between text-left hover:text-sky-300">
                <span className="flex items-center gap-2"><TeamLogo abbr={r.teamAbbr} size={22} /><PosPill pos={r.pos} />{r.playerName}</span>
                <div className="text-right">
                  <div className="font-black text-lg tabular-nums">{r.value}</div>
                  <div className="text-[10px] text-slate-500">{r.year}{r.week ? ` · ${typeof r.week === "number" ? `sem. ${r.week}` : r.week}` : ""}</div>
                </div>
              </button>
            ) : (
              <div className="text-sm text-slate-500">Ainda sem recorde registrado.</div>
            )}
          </Card>
        );
      })}
    </>
  );
}

function StatsScreen({ career, myTeam, onOpenPlayer, onOpenTeam }) {
  const [tab, setTab] = useState("leaders");
  const [cat, setCat] = useState("passYards");
  const catDef = STAT_CATEGORIES.find((c) => c.key === cat);
  const leaders = leagueLeaders(career.leagueTeams, cat, 8);
  const myLeaders = STAT_CATEGORIES.map((c) => {
    const ratio = RATIO_STATS[c.key];
    let top = null, topVal = null;
    myTeam.roster.forEach((p) => {
      const v = ratio ? statRatioValue(p, c.key) : (p.seasonStats?.[c.key] || null);
      if (v !== null && v !== undefined && (topVal === null || v > topVal)) { topVal = v; top = p; }
    });
    return { c, top, topVal };
  }).filter((r) => r.top);
  const awards = career.lastSeasonAwards;
  const hallOfFame = [...(career.hallOfFame || [])].reverse();

  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Estatísticas</h2>
      <p className="text-xs text-slate-500 mb-4">Acumulado da temporada {career.year}.</p>

      <div className="flex gap-1.5 mb-4">
        {[["leaders", "Líderes"], ["power", "Power Rankings"], ["tiers", "Tier Lists"], ["records", "Recordes"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-md border ${tab === k ? "bg-white text-black border-white" : "border-white/15 text-slate-400"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "power" && <PowerRankingsPanel career={career} myTeam={myTeam} onOpenTeam={onOpenTeam} />}
      {tab === "tiers" && <TierListPanel career={career} myTeam={myTeam} onOpenPlayer={onOpenPlayer} />}
      {tab === "records" && <RecordsPanel career={career} onOpenPlayer={onOpenPlayer} />}

      {tab === "leaders" && <>
      {awards && (
        <Card className="mb-4 border-amber-400/30">
          <div className="text-xs text-amber-400 font-semibold mb-2">🏆 Prêmios de {awards.year}</div>
          <div className="space-y-1">
            {[["MVP", awards.mvp], ["Ataque do ano", awards.opoy], ["Defesa do ano", awards.dpoy], ["Novato ofensivo", awards.oroy], ["Novato defensivo", awards.droy]]
              .filter(([, a]) => a)
              .map(([label, a]) => (
                <div key={label} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-slate-500 text-xs">{label}</span>
                  <span className="flex items-center gap-1.5"><PosPill pos={a.pos} />{a.name} <span className="text-slate-500 text-[10px]">{a.teamAbbr}</span></span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {hallOfFame.length > 0 && (
        <Card className="mb-4">
          <div className="text-xs text-slate-400 font-semibold mb-2">🏛️ Hall da Fama</div>
          <div className="space-y-1.5">
            {hallOfFame.slice(0, 6).map((r, i) => (
              <div key={i} className="text-sm py-1 border-b border-white/5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><PosPill pos={r.pos} />{r.name}</span>
                  <span className="text-[10px] text-slate-500">{r.seasonsPlayed} temp. · aposentou {r.retiredYear}</span>
                </div>
                {r.accolades?.length > 0 && <div className="text-[10px] text-amber-400 mt-0.5">{r.accolades.join(" · ")}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-2">Líderes do seu time</div>
        {myLeaders.length === 0 && <div className="text-sm text-slate-500">Ainda sem estatísticas — jogue uma semana.</div>}
        <div className="space-y-1.5">
          {myLeaders.map(({ c, top, topVal }) => (
            <div key={c.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{c.label}</span>
              <span className="font-semibold">
                <button onClick={() => onOpenPlayer(top.id, myTeam.abbr)} className="hover:text-sky-300 hover:underline">{top.name}</button>
                {" "}<span className="text-slate-500 tabular-nums">({formatStatValue(c.key, topVal)})</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">Categoria</div>
        <div className="flex flex-wrap gap-1.5">
          {STAT_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`text-[11px] px-2 py-1 rounded-md border ${cat === c.key ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 mb-2">Líderes da liga — {catDef.label}</div>
        {leaders.length === 0 && <div className="text-sm text-slate-500">Sem dados ainda.</div>}
        {leaders.map((row, i) => (
          <div key={row.player.id} className={`flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 ${row.teamAbbr === myTeam.abbr ? "text-white font-semibold" : "text-slate-300"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-4">{i + 1}</span>
              <PosPill pos={row.player.pos} />
              <button onClick={() => onOpenPlayer(row.player.id, row.teamAbbr)} className="truncate text-sm hover:text-sky-300 hover:underline text-left">{row.player.name}</button>
              <span className="text-[11px] text-slate-500">{row.teamAbbr}</span>
            </div>
            <span className="tabular-nums text-sm">{formatStatValue(cat, row.value)}</span>
          </div>
        ))}
      </Card>
      </>}
    </div>
  );
}

// A single toggleable row in an asset picker — a player or a future pick,
// shown with its trade value and a highlight when it's part of the offer.
function AssetToggleRow({ label, sub, value, selected, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md border mb-1 last:mb-0 ${selected ? "border-sky-400 bg-sky-400/10" : "border-white/10 hover:bg-white/5"}`}>
      <div className="min-w-0">
        <div className="text-xs font-semibold truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums shrink-0 ml-2">{value.toFixed(0)}</span>
    </button>
  );
}

// One side of the trade sheet: a team's roster and tradeable picks, tabbed,
// each entry toggling in/out of the offer.
function TradeSide({ title, teamAbbr, roster, picks, currentYear, selectedPlayerIds, selectedPickIds, onTogglePlayer, onTogglePick }) {
  const [tab, setTab] = useState("players");
  return (
    <Card>
      <div className="flex items-center gap-2 mb-2"><TeamLogo abbr={teamAbbr} size={18} /><span className="text-xs text-slate-400">{title}</span></div>
      <div className="flex gap-1.5 mb-2">
        {[["players", "Jogadores"], ["picks", `Picks (${picks.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-[10px] px-2 py-1 rounded-md border ${tab === k ? "bg-white text-black border-white" : "border-white/15 text-slate-400"}`}>{l}</button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto">
        {tab === "players" && [...roster].sort((a, b) => b.ovr - a.ovr).map((p) => (
          <AssetToggleRow key={p.id} label={`${p.pos} ${p.name}`} sub={`${p.ovr} OVR · idade ${p.age}`}
            value={playerValue(p)} selected={selectedPlayerIds.includes(p.id)} onClick={() => onTogglePlayer(p)} />
        ))}
        {tab === "picks" && picks.map((pk) => (
          <AssetToggleRow key={pk.id} label={pickLabel(pk)} sub={pk.originalAbbr !== teamAbbr ? `via ${pk.originalAbbr}` : null}
            value={pickTradeValue(pk.round, pk.year, currentYear)} selected={selectedPickIds.includes(pk.id)} onClick={() => onTogglePick(pk)} />
        ))}
        {tab === "picks" && picks.length === 0 && <div className="text-[11px] text-slate-500 py-2">Sem picks futuras disponíveis.</div>}
      </div>
    </Card>
  );
}

function TradeScreen({ myTeam, career, onTrade }) {
  const otherAbbrs = Object.keys(career.leagueTeams).filter((a) => a !== myTeam.abbr);
  const [targetAbbr, setTargetAbbr] = useState(otherAbbrs[0]);
  const [myPlayerIds, setMyPlayerIds] = useState([]);
  const [myPickIds, setMyPickIds] = useState([]);
  const [theirPlayerIds, setTheirPlayerIds] = useState([]);
  const [theirPickIds, setTheirPickIds] = useState([]);
  const target = career.leagueTeams[targetAbbr];
  const myPicksAvail = teamPicks(career.futurePicks, myTeam.abbr);
  const theirPicksAvail = teamPicks(career.futurePicks, targetAbbr);

  function resetSelection() { setMyPlayerIds([]); setMyPickIds([]); setTheirPlayerIds([]); setTheirPickIds([]); }
  function pickTarget(abbr) { setTargetAbbr(abbr); resetSelection(); }
  function toggle(setList, id) { setList((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }

  const myPlayers = myTeam.roster.filter((p) => myPlayerIds.includes(p.id));
  const theirPlayers = target.roster.filter((p) => theirPlayerIds.includes(p.id));
  const myPicks = myPicksAvail.filter((pk) => myPickIds.includes(pk.id));
  const theirPicks = theirPicksAvail.filter((pk) => theirPickIds.includes(pk.id));

  const myVal = myPlayers.reduce((s, p) => s + playerValue(p), 0) + myPicks.reduce((s, pk) => s + pickTradeValue(pk.round, pk.year, career.year), 0);
  const theirVal = theirPlayers.reduce((s, p) => s + playerValue(p), 0) + theirPicks.reduce((s, pk) => s + pickTradeValue(pk.round, pk.year, career.year), 0);
  const totalVal = myVal + theirVal || 1;
  const hasAssets = (myPlayers.length + myPicks.length > 0) && (theirPlayers.length + theirPicks.length > 0);
  const fair = hasAssets && theirVal <= myVal * 1.15;
  const needs = teamNeeds(target).slice(0, 3);

  function submit() {
    onTrade({ players: myPlayers, picks: myPicks }, { players: theirPlayers, picks: theirPicks }, targetAbbr, fair);
    resetSelection();
  }

  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Central de trocas</h2>
      <p className="text-xs text-slate-500 mb-4">Monte a proposta com jogadores de qualquer posição e picks futuras — até 3 anos à frente.</p>

      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">Negociar com</div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {otherAbbrs.map((a) => {
            const active = a === targetAbbr;
            return (
              <button key={a} onClick={() => pickTarget(a)}
                className={`flex flex-col items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-md border ${active ? "border-white bg-white/10" : "border-white/10"}`}>
                <TeamLogo abbr={a} size={26} />
                <span className={`text-[10px] ${active ? "text-white font-semibold" : "text-slate-400"}`}>{a}</span>
              </button>
            );
          })}
        </div>
        {needs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] text-slate-500">Necessidades do {targetAbbr}:</span>
            {needs.map((n) => <span key={n.pos} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{n.pos}</span>)}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <TradeSide title="Você oferece" teamAbbr={myTeam.abbr} roster={myTeam.roster} picks={myPicksAvail} currentYear={career.year}
          selectedPlayerIds={myPlayerIds} selectedPickIds={myPickIds}
          onTogglePlayer={(p) => toggle(setMyPlayerIds, p.id)} onTogglePick={(pk) => toggle(setMyPickIds, pk.id)} />
        <TradeSide title="Você recebe" teamAbbr={targetAbbr} roster={target.roster} picks={theirPicksAvail} currentYear={career.year}
          selectedPlayerIds={theirPlayerIds} selectedPickIds={theirPickIds}
          onTogglePlayer={(p) => toggle(setTheirPlayerIds, p.id)} onTogglePick={(pk) => toggle(setTheirPickIds, pk.id)} />
      </div>

      {(myPlayers.length + myPicks.length + theirPlayers.length + theirPicks.length) > 0 && (
        <Card className="mb-3">
          <div className="text-xs text-slate-400 mb-2">Balanço da troca</div>
          <div className="flex items-center gap-3 text-sm mb-2">
            <span className="w-14 text-right tabular-nums text-sky-300 font-semibold">{myVal.toFixed(0)}</span>
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div className="h-full bg-sky-400" style={{ width: `${(myVal / totalVal) * 100}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${(theirVal / totalVal) * 100}%` }} />
            </div>
            <span className="w-14 tabular-nums text-amber-300 font-semibold">{theirVal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mb-2">
            <span>Você envia ({myPlayers.length + myPicks.length})</span><span>Você recebe ({theirPlayers.length + theirPicks.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {myPlayers.map((p) => <span key={"p" + p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-300 border border-sky-400/30">{p.name}</span>)}
            {myPicks.map((pk) => <span key={"pk" + pk.id} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/10 text-sky-300 border border-sky-400/30">{pickLabel(pk)}</span>)}
            {theirPlayers.map((p) => <span key={"tp" + p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">{p.name}</span>)}
            {theirPicks.map((pk) => <span key={"tpk" + pk.id} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">{pickLabel(pk)}</span>)}
          </div>
          {hasAssets && (
            <div className={`text-center text-xs font-semibold py-1.5 rounded-md ${fair ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {fair ? "✓ Proposta equilibrada — tendência de aceite" : "✗ Muito desequilibrada — tendência de recusa"}
            </div>
          )}
        </Card>
      )}

      <Btn className="w-full mb-4" disabled={!hasAssets} onClick={submit}>Propor troca</Btn>

      {career.tradeHistory?.length > 0 && (
        <Card>
          <div className="text-xs text-slate-400 mb-2">Trocas recentes</div>
          <div className="space-y-2">
            {career.tradeHistory.slice(0, 6).map((t, i) => (
              <div key={i} className="text-xs border-b border-white/5 pb-1.5 last:border-0">
                <div className="flex items-center gap-1.5 text-slate-400 mb-0.5"><TeamLogo abbr={t.targetAbbr} size={14} /><span>{t.year} · com {t.targetAbbr}</span></div>
                <div className="text-slate-300">Enviou: {t.sent}</div>
                <div className="text-slate-300">Recebeu: {t.received}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}


export { FreeAgentDetailScreen, FreeAgentCard, FreeAgencyScreen, ProspectDetailScreen,
  ProspectCard, DraftScreen, StatsScreen, TradeScreen };
