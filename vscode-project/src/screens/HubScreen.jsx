import React from "react";
import { CAP, TEAM_META } from "../data/teams.js";
import { capUsed } from "../engine/playerGen.js";
import { moraleLabel } from "../season/morale.js";
import { rivalryTier, headToHeadLine } from "../season/rivalries.js";
import { isExpiring } from "../season/contracts.js";
import { teamScore, winProbability } from "../season/powerRankings.js";
import { Bar, Card, Btn, TeamLogo } from "../components/ui.jsx";
import { LevelBadge } from "../components/CoachCard.jsx";

// The main dashboard shown between weeks: next game, standings blurb,
// news feed, cap room, and the season/offseason action buttons.

function HubScreen({ career, myTeam, go, onPlayWeek, onSimPlayoffRound, onSimSeason, onDismissAlert, onDismissNotice, onOpenTeam }) {
  const tm = TEAM_META.find((t) => t.abbr === myTeam.abbr);
  const round = career.schedule[career.week - 1];
  const nextGame = round?.find((g) => g.home === myTeam.abbr || g.away === myTeam.abbr);
  const oppAbbr = nextGame ? (nextGame.home === myTeam.abbr ? nextGame.away : nextGame.home) : null;
  const oppTeam = oppAbbr ? TEAM_META.find((t) => t.abbr === oppAbbr) : null;
  const isHome = nextGame ? nextGame.home === myTeam.abbr : true;
  const oppTeamFull = oppAbbr ? career.leagueTeams[oppAbbr] : null;
  const isDivision = oppTeamFull ? (oppTeamFull.conf === tm.conf && oppTeamFull.div === tm.div) : false;
  const rivalRecord = oppAbbr ? career.rivalries?.[oppAbbr] : null;
  const nextRivalry = oppAbbr ? rivalryTier(rivalRecord, isDivision) : null;
  const nextH2H = rivalRecord ? headToHeadLine(rivalRecord, myTeam.abbr) : null;
  const myWinProb = nextGame && oppTeamFull
    ? Math.round((isHome ? winProbability(teamScore(myTeam), teamScore(oppTeamFull)) : 1 - winProbability(teamScore(oppTeamFull), teamScore(myTeam))) * 100)
    : null;
  const eventsPending = (career.pendingEvents?.length || 0) > 0;
  const gamePending = !!(career.lastGame && (career.gameRevealCount ?? 0) < career.lastGame.log.length) || eventsPending;
  const expiringCount = myTeam.roster.filter(isExpiring).length;
  const avgMorale = Math.round(myTeam.roster.reduce((s, p) => s + (p.morale ?? 65), 0) / myTeam.roster.length);
  const moraleRead = moraleLabel(avgMorale);

  return (
    <div className="pb-24">
      <button onClick={() => onOpenTeam(myTeam.abbr)} className="flex items-center gap-3 mb-4 text-left">
        <TeamLogo abbr={myTeam.abbr} size={44} />
        <div>
          <div className="text-lg font-black leading-tight">{tm.city} {tm.name}</div>
          <div className="text-xs text-slate-500">{career.year} · {myTeam.wins}-{myTeam.losses}{myTeam.ties ? `-${myTeam.ties}` : ""}</div>
        </div>
      </button>
      {(career.eventNotices || []).map((n) => (
        <Card key={n.id} className={`mb-3 ${n.tone === "good" ? "border-emerald-400/40" : n.tone === "bad" ? "border-red-500/50" : "border-white/10"}`}>
          <div className="text-sm mb-2">{n.text}</div>
          <Btn variant="ghost" className="w-full" onClick={() => onDismissNotice(n.id)}>Ok</Btn>
        </Card>
      ))}
      {(career.activePromises || []).length > 0 && (
        <Card className="mb-3 border-amber-400/40">
          <div className="text-xs text-amber-300 font-semibold mb-1">🤝 Promessas em aberto</div>
          {career.activePromises.map((p) => (
            <div key={p.id} className="text-xs text-slate-300 py-0.5">• {p.text}{p.kind === "streak" ? ` (faltam ${p.remaining})` : ""}</div>
          ))}
          <div className="text-[10px] text-slate-500 mt-1">Cumprir rende recompensas; quebrar tem consequências.</div>
        </Card>
      )}
      {(career.staffAlerts || []).map((a) => (
        <Card key={a.id} className={`mb-3 ${a.kind === "poached" ? "border-red-500/60" : "border-amber-400/40"}`}>
          <div className="text-sm mb-3">{a.text}</div>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => go("coachmarket")}>Mercado de técnicos</Btn>
            <Btn variant="ghost" onClick={() => onDismissAlert(a.id)}>Dispensar aviso</Btn>
          </div>
        </Card>
      ))}
      {gamePending && (
        <Card className="mb-4 border-amber-400/40">
          <div className="text-sm font-semibold mb-1">🏈 Você tem um jogo em andamento</div>
          <div className="text-xs text-slate-400 mb-3">Termine de assistir as jogadas antes de seguir em frente.</div>
          <Btn className="w-full" onClick={() => go("game")}>Voltar ao jogo</Btn>
        </Card>
      )}
      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-1">Confiança do dono</div>
        <Bar value={myTeam.ownerConfidence} max={100} color="#f59e0b" />
        <div className="flex justify-between text-xs text-slate-500 mt-1 mb-3">
          <span>{myTeam.ownerConfidence}/100</span>
          {myTeam.ownerConfidence < 25 && <span className="text-red-400 font-semibold">Seu emprego está em risco!</span>}
        </div>
        <div className="text-xs text-slate-400 mb-1">Apoio da torcida</div>
        <Bar value={myTeam.fanSupport} max={100} color="#38bdf8" />
        <div className="flex justify-between text-xs text-slate-500 mt-1 mb-3">
          <span>{myTeam.fanSupport}/100</span>
        </div>
        <div className="text-xs text-slate-400 mb-1">Moral do elenco</div>
        <Bar value={avgMorale} max={100} color={moraleRead.color} />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{avgMorale}/100</span>
          <span className="font-semibold" style={{ color: moraleRead.color }}>{moraleRead.label}</span>
        </div>
      </Card>

      <button onClick={() => go("staff")} className="w-full text-left mb-4">
        <Card>
          <div className="text-xs text-slate-400 mb-2">🧢 Comissão técnica</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {["OC", "DC", "SC"].map((r) => {
              const co = myTeam.coaches?.[r];
              return (
                <div key={r} className="flex items-center gap-2 min-w-0">
                  {co ? <LevelBadge level={co.level} size={26} /> : <div className="w-[26px] h-[26px] rounded-lg border border-red-400/40 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-slate-500 text-[10px]">{r}</div>
                    <div className="truncate">{co ? co.name : "Vaga"}</div>
                    {co && <div className="truncate text-[10px] text-slate-500">{co.scheme}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </button>

      {career.phase === "season" && (
        <Card className="mb-4">
          {nextGame ? (
            <>
              <div className="text-xs text-slate-400 mb-2">Semana {career.week} de 17</div>
              <button onClick={() => onOpenTeam(oppAbbr)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="text-xs text-slate-500">{isHome ? "Em casa vs" : "Fora contra"}</div>
                  <div className="font-black text-xl">{oppTeam.city} {oppTeam.name}</div>
                  {nextRivalry && (
                    <div className="text-xs font-semibold mt-1" style={{ color: nextRivalry.color }}>
                      🔥 {nextRivalry.label}{nextH2H ? ` · ${nextH2H}` : ""}
                    </div>
                  )}
                  {myWinProb !== null && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      📊 Mídia dá <span className={myWinProb >= 50 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{myWinProb}%</span> de chance pra vocês
                    </div>
                  )}
                </div>
                <TeamLogo abbr={oppAbbr} size={44} />
              </button>
              <Btn className="w-full mt-4 py-3" color={tm.c1} disabled={gamePending} onClick={onPlayWeek}>Jogar semana {career.week}</Btn>
              <Btn variant="ghost" className="w-full mt-2" disabled={gamePending} onClick={onSimSeason}>⏩ Simular temporada inteira</Btn>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="font-bold mb-2">Temporada regular encerrada!</div>
              <Btn disabled={gamePending} onClick={onPlayWeek}>Ver classificação final e playoffs</Btn>
            </div>
          )}
        </Card>
      )}

      {career.phase === "playoffs" && (
        <Card className="mb-4">
          <div className="font-bold mb-2">🏆 Playoffs — {career.playoffs.roundLabel}</div>
          <div className="text-sm text-slate-300 mb-3">{career.playoffs.champion ? `Campeão: ${TEAM_META.find(t=>t.abbr===career.playoffs.champion)?.name}!` : "Confira o chaveamento em Classificação."}</div>
          {!career.playoffs.champion && (
            <div className="space-y-2">
              <Btn className="w-full" disabled={gamePending} onClick={onSimPlayoffRound}>Simular rodada</Btn>
              <Btn variant="ghost" className="w-full" disabled={gamePending} onClick={onSimSeason}>⏩ Simular até o fim da temporada</Btn>
            </div>
          )}
          {career.playoffs.champion && <Btn disabled={gamePending} onClick={onSimPlayoffRound}>Avançar para a offseason</Btn>}
        </Card>
      )}

      {career.phase === "offseason" && (
        <Card className="mb-4">
          <div className="font-bold mb-2">🛠️ Offseason {career.year}</div>
          <p className="text-sm text-slate-400 mb-3">Cuide da free agency, do draft e das trocas antes de avançar para a próxima temporada.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Btn variant="ghost" onClick={() => go("freeagency")}>Free Agency</Btn>
            <Btn variant="ghost" onClick={() => go("draft")}>Draft</Btn>
          </div>
          <Btn variant="ghost" className="w-full mb-2" onClick={() => go("coachmarket")}>Mercado de técnicos</Btn>
          <Btn variant="ghost" className="w-full mb-3" onClick={() => go("contracts")}>
            Contratos{expiringCount > 0 ? ` (${expiringCount} vencendo)` : ""}
          </Btn>
          <Btn className="w-full" color={tm.c1} onClick={onPlayWeek}>Avançar para {career.year + 1}</Btn>
        </Card>
      )}

      {career.phase === "offseason" && career.lastSeasonAwards && (
        <Card className="mb-4 border-amber-400/30">
          <div className="font-bold mb-2">🏆 Prêmios da temporada {career.lastSeasonAwards.year}</div>
          <div className="space-y-1.5 text-sm">
            {[
              ["MVP", career.lastSeasonAwards.mvp],
              ["Ataque do ano", career.lastSeasonAwards.opoy],
              ["Defesa do ano", career.lastSeasonAwards.dpoy],
              ["Novato ofensivo", career.lastSeasonAwards.oroy],
              ["Novato defensivo", career.lastSeasonAwards.droy],
            ].filter(([, a]) => a).map(([label, a]) => (
              <button key={label} onClick={() => onOpenTeam(a.teamAbbr)} className="w-full flex items-center justify-between text-left">
                <span className="text-slate-400 text-xs">{label}</span>
                <span className="flex items-center gap-1.5"><TeamLogo abbr={a.teamAbbr} size={16} />{a.name}</span>
              </button>
            ))}
            {career.lastSeasonAwards.coachOfYear && (
              <div className="pt-1.5 mt-1.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-slate-400 text-xs">Melhor campanha</span>
                <span className="flex items-center gap-1.5">
                  <TeamLogo abbr={career.lastSeasonAwards.coachOfYear.teamAbbr} size={16} />
                  {career.lastSeasonAwards.coachOfYear.teamAbbr} ({career.lastSeasonAwards.coachOfYear.wins}-{career.lastSeasonAwards.coachOfYear.losses})
                  {career.lastSeasonAwards.coachOfYear.teamAbbr === myTeam.abbr && <span className="text-amber-400 font-bold"> · você!</span>}
                </span>
              </div>
            )}
          </div>
          <Btn variant="ghost" className="w-full mt-3" onClick={() => go("honors")}>🏆 Ver a cerimônia do NFL Honors</Btn>
        </Card>
      )}

      <Btn variant="ghost" className="w-full mb-4" onClick={() => go("history")}>📚 Histórico de temporadas</Btn>

      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-2">Cap space</div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black tabular-nums">${(CAP - capUsed(myTeam.roster)).toFixed(1)}M</span>
          <span className="text-xs text-slate-500">de ${CAP}M usados</span>
        </div>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 mb-2">Últimas notícias</div>
        <div className="space-y-1 text-sm text-slate-300">
          {[...career.news].slice(-6).reverse().map((n, i) => <div key={i} className="border-b border-white/5 pb-1 last:border-0">{n}</div>)}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   ROSTER
   ============================================================ */


export { HubScreen };
