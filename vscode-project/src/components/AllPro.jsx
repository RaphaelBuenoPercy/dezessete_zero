import React, { useState } from "react";
import { Card, PosPill, TeamLogo } from "./ui.jsx";

// All-Pro de uma temporada: 1º e 2º time (22 jogadores cada). awards vem de career.lastSeasonAwards
// ou do arquivo histórico. Saves antigos só têm `allPro` (um por posição) e aparecem como 1º time.

const GROUPS = [
  ["QB", "Quarterback"], ["RB", "Running back"], ["WR", "Wide receivers"], ["TE", "Tight end"], ["OL", "Linha ofensiva"],
  ["DL", "Linha defensiva"], ["LB", "Linebackers"], ["CB", "Cornerbacks"], ["S", "Safeties"], ["K", "Kicker"], ["P", "Punter"],
];

function normalize(awards) {
  if (awards?.allProTeams) return awards.allProTeams;
  if (awards?.allPro) {
    const first = {};
    Object.entries(awards.allPro).forEach(([pos, a]) => { if (a) first[pos] = [a]; });
    return { first, second: {} };
  }
  return null;
}

function AllProTeams({ awards, onOpenPlayer, title }) {
  const [which, setWhich] = useState("first");
  const teams = normalize(awards);
  if (!teams) return null;
  const team = teams[which] || {};
  const hasSecond = Object.keys(teams.second || {}).length > 0;
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-400 font-bold">{title || `All-Pro ${awards.year}`}</div>
        <div className="flex gap-1">
          {[["first", "1º time"], ["second", "2º time"]].map(([k, l]) => (
            <button key={k} disabled={k === "second" && !hasSecond} onClick={() => setWhich(k)}
              className={`text-[11px] px-2 py-1 rounded-md ${which === k ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"} disabled:opacity-30`}>{l}</button>
          ))}
        </div>
      </div>
      {GROUPS.map(([pos, label]) => (team[pos] || []).length > 0 && (
        <div key={pos} className="mb-2 last:mb-0">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
          {team[pos].map((a) => (
            <button key={a.playerId} onClick={() => onOpenPlayer?.(a.playerId, a.teamAbbr)}
              className="w-full flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0 hover:text-sky-300 text-left">
              <span className="flex items-center gap-2 min-w-0"><PosPill pos={pos} /><span className="truncate">{a.name}</span></span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0"><TeamLogo abbr={a.teamAbbr} size={16} />{a.ovr}</span>
            </button>
          ))}
        </div>
      ))}
    </Card>
  );
}

export { AllProTeams };
