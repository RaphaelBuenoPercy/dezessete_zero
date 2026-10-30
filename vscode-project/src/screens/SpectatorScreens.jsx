import React from "react";
import { Card, Btn, TeamLogo } from "../components/ui.jsx";
import { TEAM_META } from "../data/teams.js";

// ============================================================
// MODO ESPECTADOR: carreira sem time (career.spectator = true, career.teamAbbr = null).
// A liga inteira roda sozinha (jogos, playoffs, free agency, draft, aposentadorias...).
// ============================================================

// Time "fantasma" passado às telas que esperam um myTeam: nunca bate com nenhum time real.
const SPECTATOR_STUB = {
  abbr: "__SPEC__", conf: "", div: "", city: "", name: "", scheme: "4-3", roster: [], picks: [], coaches: {},
  wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, ownerConfidence: 100, fanSupport: 50,
};

const teamName = (abbr) => { const t = TEAM_META.find((x) => x.abbr === abbr); return t ? `${t.city} ${t.name}` : abbr; };
const PHASE_LABEL = (c) => c.phase === "season" ? `Semana ${c.week} de 17` : c.phase === "playoffs" ? `Playoffs · ${c.playoffs?.roundLabel || ""}` : "Offseason";

function SpectatorTopBar({ career, onExit, disabled }) {
  return (
    <div className="sticky top-0 z-10">
      <div className="h-1.5 bg-gradient-to-r from-sky-500 to-violet-500" />
      <div className="bg-[#0B1220]/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div>
          <div className="text-xs text-slate-400">👁️ Modo espectador</div>
          <div className="font-black text-lg tracking-tight">Temporada {career.year}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">{PHASE_LABEL(career)}</div>
          <button disabled={disabled} onClick={onExit} className="text-xs text-slate-400 hover:text-white underline disabled:opacity-40">Sair para o menu</button>
        </div>
      </div>
    </div>
  );
}

function SpectatorScreen({ career, busy, onStep, onSimToEnd, onSimSeasons, onFork, onOpenTeam, go }) {
  const archive = Object.values(career.seasonArchive || {}).sort((a, b) => b.year - a.year);
  const titles = {};
  archive.forEach((a) => { if (a.champion) titles[a.champion] = (titles[a.champion] || 0) + 1; });
  const topTitles = Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const standings = Object.values(career.leagueTeams)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa)).slice(0, 5);
  const midSeason = career.phase === "season" || career.phase === "playoffs";

  return (
    <div className="pb-24">
      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">Controles</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Btn variant="ghost" disabled={busy} onClick={onStep}>{career.phase === "offseason" ? "Avançar offseason" : "Avançar 1 semana"}</Btn>
          <Btn variant="ghost" disabled={busy || !midSeason} onClick={onSimToEnd}>Até o fim da temporada</Btn>
        </div>
        <div className="text-xs text-slate-400 mb-1.5">Simular temporadas completas</div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 5, 10, 25].map((n) => <Btn key={n} disabled={busy} onClick={() => onSimSeasons(n)}>{n}</Btn>)}
        </div>
        <div className="text-[10px] text-slate-500 mt-2">Cada temporada inclui jogos, playoffs, free agency, draft e aposentadorias. Dá para cancelar durante a simulação.</div>
      </Card>

      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">🔀 Realidades alternativas</div>
        <div className="text-xs text-slate-300 mb-2">Copia esta liga, neste exato momento, para um novo save. Cada cópia segue um futuro diferente (sorteios diferentes), então dá para comparar como o Top 100 e os campeões se comportam.</div>
        <Btn variant="ghost" className="w-full" disabled={busy} onClick={onFork}>Bifurcar realidade</Btn>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Btn variant="ghost" onClick={() => go("stats")}>📊 Líderes e Top 100</Btn>
        <Btn variant="ghost" onClick={() => go("history")}>📚 Temporadas passadas</Btn>
      </div>

      {midSeason && (
        <Card className="mb-3">
          <div className="text-xs text-slate-400 mb-2">Melhores campanhas agora</div>
          {standings.map((t) => (
            <button key={t.abbr} onClick={() => onOpenTeam(t.abbr)} className="w-full flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="flex items-center gap-2"><TeamLogo abbr={t.abbr} size={20} />{teamName(t.abbr)}</span>
              <span className="tabular-nums text-slate-300">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</span>
            </button>
          ))}
        </Card>
      )}

      {topTitles.length > 0 && (
        <Card className="mb-3">
          <div className="text-xs text-slate-400 mb-2">🏆 Mais títulos nesta realidade</div>
          {topTitles.map(([abbr, n]) => (
            <button key={abbr} onClick={() => onOpenTeam(abbr)} className="w-full flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="flex items-center gap-2"><TeamLogo abbr={abbr} size={20} />{teamName(abbr)}</span>
              <span className="tabular-nums font-semibold text-amber-400">{n}</span>
            </button>
          ))}
        </Card>
      )}

      {archive.length > 0 && (
        <Card>
          <div className="text-xs text-slate-400 mb-2">Campeões do Super Bowl</div>
          {archive.slice(0, 15).map((a) => (
            <div key={a.year} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-slate-500 tabular-nums">{a.year}</span>
              {a.champion ? <button onClick={() => onOpenTeam(a.champion)} className="flex items-center gap-2"><TeamLogo abbr={a.champion} size={18} />{a.champion}</button> : <span className="text-slate-600">—</span>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// Seção do menu inicial (abaixo do MenuScreen): criar liga de espectador e abrir as já salvas.
function SpectatorMenuSection({ saves, onStart, onLoad, onDelete }) {
  return (
    <div className="bg-[#0B1220] text-slate-100 px-4 pb-10">
      <div className="max-w-lg mx-auto">
        <Card>
          <div className="font-bold mb-1">👁️ Modo espectador</div>
          <div className="text-xs text-slate-400 mb-3">Comece sem time, acompanhe a liga e simule várias temporadas rapidamente para ver realidades alternativas.</div>
          <Btn className="w-full" onClick={onStart}>Nova liga de espectador</Btn>
          {saves.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-slate-500 mb-1">Ligas salvas</div>
              {saves.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-sm">
                  <button onClick={() => onLoad(s.id)} className="text-left hover:text-sky-300">
                    {s.label} <span className="text-xs text-slate-500">· {s.year}{s.titles ? ` · ${s.titles} temporada(s) simulada(s)` : ""}</span>
                  </button>
                  <button onClick={() => onDelete(s.id)} className="text-xs text-red-400 hover:text-red-300">Apagar</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export { SPECTATOR_STUB, SpectatorTopBar, SpectatorScreen, SpectatorMenuSection };
