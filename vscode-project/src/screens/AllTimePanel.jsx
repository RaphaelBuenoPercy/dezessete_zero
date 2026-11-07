import React, { useMemo, useState } from "react";
import { Card, PosPill, TeamLogo } from "../components/ui.jsx";
import { CATEGORY, POS_GROUPS, buildActiveIndex, getAllTimeList } from "../season/allTime.js";

// Aba "Histórico" do StatsScreen: líderes de toda a história do save (ativos + aposentados).
// Os dados vêm do Top 100 guardado em career.allTimeLeaders; a lista é memoizada e só
// recalcula quando muda o filtro ou a semana/ano.

const GROUPS = Object.keys(POS_GROUPS);
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");

function AllTimePanel({ career, onOpenPlayer }) {
  const [group, setGroup] = useState("QB");
  const [cat, setCat] = useState(POS_GROUPS.QB.categories[0]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [limit, setLimit] = useState(25);

  const index = useMemo(() => buildActiveIndex(career), [career.year, career.week, career.phase]);
  const rows = useMemo(
    () => getAllTimeList(career, cat, { group, activeOnly, limit, index }),
    [career.allTimeLeaders, index, cat, group, activeOnly, limit],
  );
  const def = CATEGORY[cat];
  const pickGroup = (g) => { setGroup(g); setCat(POS_GROUPS[g].categories[0]); setLimit(25); };

  return (
    <div>
      <div className="flex gap-1.5 mb-2 overflow-x-auto">
        {GROUPS.map((g) => (
          <button key={g} onClick={() => pickGroup(g)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border shrink-0 ${group === g ? "bg-white text-black border-white" : "border-white/15 text-slate-400"}`}>{g}</button>
        ))}
      </div>
      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
        {POS_GROUPS[group].categories.map((k) => (
          <button key={k} onClick={() => { setCat(k); setLimit(25); }}
            className={`text-[11px] px-2.5 py-1 rounded-md border shrink-0 ${cat === k ? "bg-sky-400/20 text-sky-200 border-sky-400/40" : "border-white/15 text-slate-400"}`}>{CATEGORY[k].label}</button>
        ))}
      </div>
      <div className="flex gap-1 mb-3">
        {[[false, "Todos os tempos"], [true, "Apenas ativos"]].map(([v, l]) => (
          <button key={String(v)} onClick={() => setActiveOnly(v)}
            className={`flex-1 text-xs py-1.5 rounded-md ${activeOnly === v ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"}`}>{l}</button>
        ))}
      </div>

      <Card>
        <div className="text-xs text-slate-400 mb-2">{def.label} · {activeOnly ? "jogadores em atividade" : "história da liga neste save"}</div>
        {rows.length === 0 && <div className="text-sm text-slate-500">Sem registros ainda. O histórico se forma conforme as temporadas passam.</div>}
        {rows.map((r, i) => {
          const canOpen = !r.isRetired && r.teamAbbr && onOpenPlayer;
          return (
            <div key={r.playerId} className={`flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 ${r.isRetired ? "text-slate-500" : ""}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-7 text-xs tabular-nums ${i === 0 && !r.isRetired ? "text-amber-400 font-bold" : "text-slate-500"}`}>{i + 1}º</span>
                <PosPill pos={r.pos} />
                {canOpen
                  ? <button onClick={() => onOpenPlayer(r.playerId, r.teamAbbr)} className="truncate text-sm text-left hover:text-sky-300 hover:underline">{r.name}</button>
                  : <span className="truncate text-sm">{r.name}</span>}
                {r.isRetired ? <span className="text-[10px] shrink-0" title="Aposentado">🏛️</span> : r.teamAbbr && <TeamLogo abbr={r.teamAbbr} size={16} />}
              </div>
              <span className={`tabular-nums text-sm font-semibold shrink-0 ml-2 ${r.isRetired ? "text-slate-500" : "text-slate-100"}`}>{fmt(r.value)}</span>
            </div>
          );
        })}
        {rows.length >= limit && limit < 100 && (
          <button onClick={() => setLimit(100)} className="w-full text-xs text-slate-400 hover:text-white pt-3">Mostrar até o Top 100</button>
        )}
      </Card>
      <p className="text-[10px] text-slate-600 mt-2">🏛️ = aposentado ou fora da liga. Ativos mostram o total da carreira + a temporada em andamento.</p>
    </div>
  );
}

export { AllTimePanel };
