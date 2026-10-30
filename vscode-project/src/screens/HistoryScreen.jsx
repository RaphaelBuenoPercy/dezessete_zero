import React, { useState } from "react";
import { Card, TeamLogo } from "../components/ui.jsx";
import { STAT_CATEGORIES, formatStatValue } from "../season/stats.js";
import { ResultsScreen, PlayoffPicture } from "./SeasonScreens.jsx";

// Histórico de temporadas passadas. Reaproveita ResultsScreen (jogos + box scores
// + playoffs) montando um "career de visualização" com o schedule/playoffs
// arquivados — por isso as telas existentes não precisam saber de histórico.

const DIVS = [["AFC","East"],["AFC","North"],["AFC","South"],["AFC","West"],["NFC","East"],["NFC","North"],["NFC","South"],["NFC","West"]];
const TABS = [["results", "Jogos"], ["standings", "Tabela"], ["leaders", "Líderes"], ["awards", "Prêmios"]];

function Standings({ a, onOpenTeam }) {
  const divTeams = (conf, div) => Object.values(a.teams).filter((t) => t.conf === conf && t.div === div)
    .sort((x, y) => (y.wins - y.losses) - (x.wins - x.losses) || (y.pf - y.pa) - (x.pf - x.pa));
  return (
    <div>
      <PlayoffPicture playoffs={a.playoffs} onOpenTeam={onOpenTeam} />
      <div className="grid grid-cols-1 gap-3">
        {DIVS.map(([conf, div]) => (
          <Card key={conf + div}>
            <div className="text-xs text-slate-400 mb-1">{conf} {div}</div>
            {divTeams(conf, div).map((t, i) => (
              <button key={t.abbr} onClick={() => onOpenTeam(t.abbr)}
                className={`w-full flex items-center justify-between text-sm py-1.5 ${i > 0 ? "border-t border-white/5" : ""} ${t.abbr === a.myAbbr ? "font-bold text-white" : "text-slate-300"}`}>
                <div className="flex items-center gap-2"><TeamLogo abbr={t.abbr} size={22} /><span>{t.abbr}</span></div>
                <span className="tabular-nums">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} <span className="text-slate-500">({t.pf}-{t.pa})</span></span>
              </button>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Leaders({ a, onOpenPlayer }) {
  const [key, setKey] = useState(STAT_CATEGORIES[0].key);
  const rows = a.leaders?.[key] || [];
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {STAT_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setKey(c.key)}
            className={`text-[11px] px-2.5 py-1 rounded-md border shrink-0 ${key === c.key ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <Card>
        {!rows.length && <div className="text-sm text-slate-400">Sem dados nesta categoria.</div>}
        {rows.map((r, i) => (
          <button key={r.id} onClick={() => onOpenPlayer?.(r.id, r.teamAbbr)}
            className={`w-full flex items-center justify-between text-sm py-1.5 text-left ${i > 0 ? "border-t border-white/5" : ""}`}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-slate-500 w-4 text-xs tabular-nums">{i + 1}</span>
              <TeamLogo abbr={r.teamAbbr} size={18} />
              <span className="truncate">{r.name} <span className="text-slate-500">({r.pos})</span></span>
            </span>
            <span className="tabular-nums font-semibold shrink-0 ml-2">{formatStatValue(key, r.value)}</span>
          </button>
        ))}
      </Card>
    </div>
  );
}

function Awards({ a, onOpenPlayer }) {
  const aw = a.awards;
  if (!aw) return <Card><div className="text-sm text-slate-400">Sem prêmios registrados.</div></Card>;
  const rows = [
    ["🏅 MVP", aw.mvp], ["⭐ Melhor Ataque", aw.opoy], ["🛡️ Melhor Defesa", aw.dpoy],
    ["🌟 Novato Ofensivo", aw.oroy], ["🌟 Novato Defensivo", aw.droy],
  ];
  return (
    <Card>
      {rows.map(([label, p], i) => p && (
        <button key={label} onClick={() => onOpenPlayer?.(p.playerId, p.teamAbbr)}
          className={`w-full flex items-center justify-between text-sm py-1.5 text-left ${i > 0 ? "border-t border-white/5" : ""}`}>
          <span className="text-slate-400 text-xs">{label}</span>
          <span className="flex items-center gap-2"><TeamLogo abbr={p.teamAbbr} size={18} />{p.name} <span className="text-slate-500">({p.pos})</span></span>
        </button>
      ))}
      {aw.coachOfYear && (
        <div className="flex items-center justify-between text-sm py-1.5 border-t border-white/5">
          <span className="text-slate-400 text-xs">📋 Técnico do Ano</span>
          <span className="flex items-center gap-2"><TeamLogo abbr={aw.coachOfYear.teamAbbr} size={18} />{aw.coachOfYear.teamAbbr} ({aw.coachOfYear.wins}-{aw.coachOfYear.losses})</span>
        </div>
      )}
    </Card>
  );
}

function HistoryScreen({ career, onOpenTeam, onOpenPlayer }) {
  const years = Object.keys(career.seasonArchive || {}).map(Number).sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const [tab, setTab] = useState("results");

  if (!years.length) {
    return (
      <div className="pb-24">
        <h2 className="text-xl font-black mb-3">Histórico</h2>
        <Card><div className="text-sm text-slate-400">As temporadas passadas aparecem aqui depois que você avançar para o próximo ano.</div></Card>
      </div>
    );
  }

  const a = career.seasonArchive[year] || career.seasonArchive[years[0]];
  const rec = a.myRecord;
  // career "de visualização": o ResultsScreen lê schedule/playoffs/phase daqui
  const view = { ...career, year: a.year, phase: "offseason", schedule: a.schedule, playoffs: a.playoffs, leagueTeams: a.teams, isArchive: true };

  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-3">Histórico</h2>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {years.map((y) => (
          <button key={y} onClick={() => setYear(y)}
            className={`text-xs px-3 py-1.5 rounded-md border shrink-0 ${a.year === y ? "bg-white text-black border-white font-semibold" : "border-white/15 text-slate-300"}`}>
            {y}
          </button>
        ))}
      </div>

      <Card className="mb-3">
        <div className="flex items-center justify-between text-sm">
          {a.myAbbr ? <span>Seu time: <b>{a.myAbbr}</b> {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ""}</span> : <span className="text-slate-400">Temporada {a.year}</span>}
          {a.champion && <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">🏆 <TeamLogo abbr={a.champion} size={18} />{a.champion}</span>}
        </div>
        {a.boxPruned && <div className="text-[11px] text-slate-500 mt-1">Box scores desta temporada foram removidos para economizar espaço.</div>}
      </Card>

      <div className="flex gap-1 mb-3">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 text-xs py-1.5 rounded-md ${tab === k ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "results" && <ResultsScreen key={a.year} career={view} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />}
      {tab === "standings" && <Standings a={a} onOpenTeam={onOpenTeam} />}
      {tab === "leaders" && <Leaders a={a} onOpenPlayer={onOpenPlayer} />}
      {tab === "awards" && <Awards a={a} onOpenPlayer={onOpenPlayer} />}
    </div>
  );
}

export { HistoryScreen };
