import React, { useState, useEffect } from "react";
import { clamp } from "../lib/rng.js";
import { TEAM_META } from "../data/teams.js";
import { rivalryTier } from "../season/rivalries.js";
import { buildWeeklyRecap } from "../season/weeklyRecap.js";
import { Card, Btn, TeamLogo, primaryStatLine } from "../components/ui.jsx";

// Calendário/classificação, resultados rodada-a-rodada com box score,
// a tela de jogo ao vivo (com o minicampo) e o modal de coletiva.

// Full playoff picture: every completed round (with final scores) plus a
// preview of the round currently being played. Stays visible through the
// whole offseason too, so getting eliminated early doesn't mean losing
// track of who's still alive.
function MatchRow({ m, onOpenTeam }) {
  if (!m) return null;
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <button onClick={() => m.a && onOpenTeam(m.a.abbr)} className={`flex items-center gap-1.5 ${m.winner === m.a?.abbr ? "text-green-400 font-semibold" : "text-slate-300"}`}>
        {m.a && <TeamLogo abbr={m.a.abbr} size={18} />}{m.a ? `${m.a.abbr}${m.a.seed ? ` (${m.a.seed})` : ""}` : "BYE"}
      </button>
      <span className="tabular-nums text-xs text-slate-400">{m.score ? `${m.score[m.a?.abbr]}-${m.score[m.b?.abbr]}` : "vs"}</span>
      <button onClick={() => m.b && onOpenTeam(m.b.abbr)} className={`flex items-center gap-1.5 ${m.winner === m.b?.abbr ? "text-green-400 font-semibold" : "text-slate-300"}`}>
        {m.b ? `${m.b.abbr}${m.b.seed ? ` (${m.b.seed})` : ""}` : "BYE"}{m.b && <TeamLogo abbr={m.b.abbr} size={18} />}
      </button>
    </div>
  );
}

function RoundBlock({ label, afc, nfc, superBowl, onOpenTeam }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] text-slate-500 uppercase mb-1">{label}</div>
      {superBowl ? (
        <MatchRow m={superBowl} onOpenTeam={onOpenTeam} />
      ) : (
        ["afc", "nfc"].map((c) => (
          <div key={c} className="mb-1.5 last:mb-0">
            <div className="text-[10px] text-slate-600 font-semibold mb-0.5">{c.toUpperCase()}</div>
            {((c === "afc" ? afc : nfc) || []).map((m, i) => <MatchRow key={i} m={m} onOpenTeam={onOpenTeam} />)}
          </div>
        ))
      )}
    </div>
  );
}

function PlayoffPicture({ playoffs, onOpenTeam }) {
  if (!playoffs) return null;
  const rounds = [...(playoffs.rounds || [])];
  if (playoffs.roundLabel !== "Concluído") {
    if (playoffs.roundLabel === "Super Bowl") rounds.push({ label: "Super Bowl", superBowl: playoffs.superBowl });
    else rounds.push({ label: playoffs.roundLabel, afc: playoffs.afcBracket, nfc: playoffs.nfcBracket });
  }
  const champTeam = playoffs.champion && TEAM_META.find((t) => t.abbr === playoffs.champion);
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">🏆 Playoffs</div>
        {champTeam && <span className="text-xs text-amber-400 font-bold">Campeão: {champTeam.city} {champTeam.name}</span>}
      </div>
      {rounds.map((r, i) => <RoundBlock key={i} label={r.label} afc={r.afc} nfc={r.nfc} superBowl={r.superBowl} onOpenTeam={onOpenTeam} />)}
    </Card>
  );
}

// Every tracked rivalry with a real tier (division, playoff grudge, hot
// streak either way), most-played first — the "who are we actually mad
// at" view of the league.
function RivalriesCard({ career, myTeam, onOpenTeam }) {
  const entries = Object.entries(career.rivalries || {}).map(([abbr, r]) => {
    const oppMeta = career.leagueTeams[abbr];
    const isDivision = !!oppMeta && oppMeta.conf === myTeam.conf && oppMeta.div === myTeam.div;
    return { abbr, r, tier: rivalryTier(r, isDivision) };
  }).filter((e) => e.tier).sort((a, b) => b.r.meetings - a.r.meetings);
  if (!entries.length) return null;
  return (
    <Card className="mb-4">
      <div className="text-xs text-slate-400 mb-2">🔥 Rivalidades</div>
      <div className="space-y-1">
        {entries.map(({ abbr, r, tier }) => (
          <button key={abbr} onClick={() => onOpenTeam(abbr)} className="w-full flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2"><TeamLogo abbr={abbr} size={20} /><span>{abbr}</span></div>
            <div className="text-right">
              <div className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                {r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ""}{r.playoffMeetings > 0 ? ` · ${r.playoffMeetings} nos playoffs` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

// Opposing players who've had big individual games against you, most
// frequent offender first.
function NemesesCard({ career, onOpenPlayer }) {
  const list = career.nemeses || [];
  if (!list.length) return null;
  return (
    <Card className="mb-4">
      <div className="text-xs text-slate-400 mb-2">😈 Inimigos do time</div>
      <div className="space-y-1">
        {list.map((n, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
            <button onClick={() => onOpenPlayer?.(n.playerId, n.teamAbbr)} className="flex items-center gap-2 hover:text-sky-300 hover:underline text-left min-w-0">
              <TeamLogo abbr={n.teamAbbr} size={18} /><span className="truncate">{n.name}</span>
            </button>
            <span className="text-[10px] text-slate-500 shrink-0 ml-2 text-right">{n.games}x · {n.lastReason} ({n.lastYear})</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScheduleScreen({ career, myTeam, onOpenTeam, onOpenPlayer }) {
  const divTeams = (conf, div) => Object.values(career.leagueTeams).filter((t) => t.conf === conf && t.div === div)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  const divs = [["AFC","East"],["AFC","North"],["AFC","South"],["AFC","West"],["NFC","East"],["NFC","North"],["NFC","South"],["NFC","West"]];
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-3">Classificação</h2>
      <PlayoffPicture playoffs={career.playoffs} onOpenTeam={onOpenTeam} />
      <RivalriesCard career={career} myTeam={myTeam} onOpenTeam={onOpenTeam} />
      <NemesesCard career={career} onOpenPlayer={onOpenPlayer} />
      <div className="grid grid-cols-1 gap-3">
        {divs.map(([conf, div]) => (
          <Card key={conf + div}>
            <div className="text-xs text-slate-400 mb-1">{conf} {div}</div>
            {divTeams(conf, div).map((t, i) => (
              <button key={t.abbr} onClick={() => onOpenTeam(t.abbr)} className={`w-full flex items-center justify-between text-sm py-1.5 ${i > 0 ? "border-t border-white/5" : ""} ${t.abbr === myTeam.abbr ? "font-bold text-white" : "text-slate-300"}`}>
                <div className="flex items-center gap-2">
                  <TeamLogo abbr={t.abbr} size={22} />
                  <span>{t.abbr}</span>
                </div>
                <span className="tabular-nums">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} <span className="text-slate-500">({t.pf}-{t.pa})</span></span>
              </button>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ROUND-BY-ROUND RESULTS / BOX SCORES
   ============================================================ */

function bestBy(list, key) {
  return [...(list || [])].filter((p) => p.stats?.[key]).sort((a, b) => b.stats[key] - a.stats[key])[0];
}

function BoxScoreLine({ p, teamAbbr, onOpenPlayer }) {
  if (!p) return null;
  const line = primaryStatLine({ pos: p.pos, seasonStats: p.stats });
  if (!line) return null;
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-slate-300">
        {onOpenPlayer ? <button onClick={() => onOpenPlayer(p.id, teamAbbr)} className="hover:text-sky-300 hover:underline">{p.name}</button> : p.name}
        {" "}<span className="text-slate-500">({p.pos})</span>
      </span>
      <span className="text-slate-400 tabular-nums">{line}</span>
    </div>
  );
}

function TeamBoxScore({ abbr, list, onOpenTeam, onOpenPlayer }) {
  const passer = bestBy(list, "passYards");
  const rushers = [...(list || [])].filter((p) => p.stats?.rushYards).sort((a, b) => b.stats.rushYards - a.stats.rushYards).slice(0, 2);
  const receiver = bestBy(list, "receivingYards");
  const tackler = bestBy(list, "tackles");
  const sacker = bestBy(list, "sacks");
  const presser = bestBy(list, "qbHurries");
  const picker = bestBy(list, "interceptions");
  return (
    <div>
      <button onClick={() => onOpenTeam?.(abbr)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-1 hover:text-slate-200">
        <TeamLogo abbr={abbr} size={16} />{abbr}
      </button>
      <BoxScoreLine p={passer} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />
      {rushers.map((r) => <BoxScoreLine key={r.id} p={r} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />)}
      <BoxScoreLine p={receiver} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />
      <BoxScoreLine p={tackler} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />
      <BoxScoreLine p={sacker} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />
      {presser && presser.id !== sacker?.id && <BoxScoreLine p={presser} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />}
      <BoxScoreLine p={picker} teamAbbr={abbr} onOpenPlayer={onOpenPlayer} />
    </div>
  );
}

// One result card — reused for both regular-season and playoff games so
// they look and behave identically (same expand-for-box-score interaction).
function GameResultCard({ g, open, onToggle, onOpenTeam, onOpenPlayer }) {
  const homeWon = g.homeScore > g.awayScore;
  return (
    <Card>
      <div className="w-full flex items-center justify-between">
        <button onClick={() => onOpenTeam(g.away)} className={`flex items-center gap-2 text-sm ${!homeWon ? "font-bold text-white" : "text-slate-300"}`}>
          <TeamLogo abbr={g.away} size={24} />{g.away}{g.awaySeed ? <span className="text-[10px] text-slate-500">({g.awaySeed})</span> : null}
        </button>
        <button className="text-sm font-black tabular-nums" onClick={onToggle}>{g.awayScore} — {g.homeScore}</button>
        <button onClick={() => onOpenTeam(g.home)} className={`flex items-center gap-2 text-sm ${homeWon ? "font-bold text-white" : "text-slate-300"}`}>
          {g.homeSeed ? <span className="text-[10px] text-slate-500">({g.homeSeed})</span> : null}{g.home}<TeamLogo abbr={g.home} size={24} />
        </button>
      </div>
      {open && g.boxScore && (
        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
          <TeamBoxScore abbr={g.away} list={g.boxScore.away} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />
          <TeamBoxScore abbr={g.home} list={g.boxScore.home} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />
        </div>
      )}
    </Card>
  );
}

// Flattens one playoff bracket match into the same {home, away, homeScore,
// awayScore, boxScore} shape regular-season games use, so GameResultCard
// doesn't need to know the difference.
function matchToGame(m) {
  if (!m || !m.a || !m.b || !m.score) return null;
  return {
    home: m.a.abbr, away: m.b.abbr,
    homeScore: m.score[m.a.abbr], awayScore: m.score[m.b.abbr],
    boxScore: m.boxScore, homeSeed: m.a.seed, awaySeed: m.b.seed,
  };
}
function roundGames(round) {
  if (!round) return [];
  if (round.superBowl) return [matchToGame(round.superBowl)].filter(Boolean);
  return [...(round.afc || []), ...(round.nfc || [])].map(matchToGame).filter(Boolean);
}


// Around-the-league digest for one week: the best individual performance,
// which favorites got upset, and a few other stat lines worth knowing —
// built entirely from box scores every game already has, watched or not.
function WeeklyRecapCard({ recap, onOpenTeam, onOpenPlayer }) {
  if (!recap) return null;
  return (
    <Card className="mb-4">
      <div className="text-xs text-slate-400 mb-2">📰 Resumo da rodada · {recap.totalGames} jogo(s)</div>
      {recap.potw && (
        <button onClick={() => onOpenPlayer?.(recap.potw.id, recap.potw.teamAbbr)} className="w-full flex items-center justify-between text-left mb-2 pb-2 border-b border-white/5 hover:text-sky-300">
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo abbr={recap.potw.teamAbbr} size={20} />
            <div className="min-w-0">
              <div className="text-[10px] text-amber-400 font-semibold">⭐ Destaque da rodada</div>
              <div className="text-sm truncate">{recap.potw.name} <span className="text-slate-500">({recap.potw.pos})</span></div>
            </div>
          </div>
          <span className="text-xs text-slate-400 shrink-0 ml-2">{recap.potw.line}</span>
        </button>
      )}
      {recap.upsets.length > 0 && (
        <div className="mb-2 pb-2 border-b border-white/5">
          <div className="text-[10px] text-red-400 font-semibold mb-1">😱 Zebras da rodada</div>
          {recap.upsets.map((g, i) => {
            const winner = g.homeScore > g.awayScore ? g.home : g.away;
            return (
              <button key={i} onClick={() => onOpenTeam(winner)} className="w-full flex items-center justify-between text-xs py-1 hover:text-sky-300">
                <span className="flex items-center gap-1.5"><TeamLogo abbr={g.away} size={16} />{g.away} {g.awayScore}-{g.homeScore} {g.home}<TeamLogo abbr={g.home} size={16} /></span>
              </button>
            );
          })}
        </div>
      )}
      {recap.standouts.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 font-semibold mb-1">Outros destaques</div>
          <div className="space-y-1">
            {recap.standouts.slice(0, 5).map((s, i) => (
              <button key={i} onClick={() => onOpenPlayer?.(s.id, s.teamAbbr)} className="w-full flex items-center justify-between text-xs py-0.5 hover:text-sky-300 text-left">
                <span className="flex items-center gap-1.5 truncate min-w-0"><TeamLogo abbr={s.teamAbbr} size={14} /><span className="truncate">{s.name}</span></span>
                <span className="text-slate-500 shrink-0 ml-2">{s.line}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ResultsScreen({ career, onOpenTeam, onOpenPlayer }) {
  const [tab, setTab] = useState("season");
  const maxWeek = Math.min(17, Math.max(1, career.phase === "season" ? career.week - 1 : 17));
  const [week, setWeek] = useState(Math.max(1, maxWeek));
  const [openIdx, setOpenIdx] = useState(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const seasonGames = (career.schedule[week - 1] || []).filter((g) => g.homeScore !== undefined || g.awayScore !== undefined);

  const playoffRounds = career.playoffs?.rounds || [];
  const hasPlayoffs = playoffRounds.length > 0;
  const round = playoffRounds[Math.min(roundIdx, playoffRounds.length - 1)];
  const playoffGames = roundGames(round);

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-black">Resultados</h2>
        {hasPlayoffs && (
          <div className="flex items-center gap-1 text-xs">
            {[["season", "Temporada"], ["playoffs", "Playoffs"]].map(([k, label]) => (
              <button key={k} onClick={() => { setTab(k); setOpenIdx(null); }}
                className={`px-2 py-1 rounded-md ${tab === k ? "bg-white text-black font-semibold" : "bg-white/5 text-slate-400"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "season" && (
        <>
          <div className="flex items-center justify-end gap-2 text-sm mb-3">
            <button disabled={week <= 1} onClick={() => { setWeek((w) => w - 1); setOpenIdx(null); }} className="px-2 py-1 rounded-md bg-white/5 disabled:opacity-30">◀</button>
            <span className="tabular-nums">Semana {week}</span>
            <button disabled={week >= maxWeek} onClick={() => { setWeek((w) => w + 1); setOpenIdx(null); }} className="px-2 py-1 rounded-md bg-white/5 disabled:opacity-30">▶</button>
          </div>
          {!seasonGames.length && <Card><div className="text-sm text-slate-400">Nenhum jogo simulado ainda nesta semana.</div></Card>}
          <WeeklyRecapCard recap={buildWeeklyRecap(career.leagueTeams, seasonGames)} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />
          <div className="space-y-2">
            {seasonGames.map((g, i) => (
              <GameResultCard key={i} g={g} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        </>
      )}

      {tab === "playoffs" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
            {playoffRounds.map((r, i) => (
              <button key={i} onClick={() => { setRoundIdx(i); setOpenIdx(null); }}
                className={`text-[11px] px-2.5 py-1 rounded-md border shrink-0 ${roundIdx === i ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
                {r.label}
              </button>
            ))}
          </div>
          {!playoffGames.length && <Card><div className="text-sm text-slate-400">Nenhum jogo de playoff disputado ainda.</div></Card>}
          <div className="space-y-2">
            {playoffGames.map((g, i) => (
              <GameResultCard key={i} g={g} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} onOpenTeam={onOpenTeam} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   GAME SCREEN (play-by-play)
   ============================================================ */

const MINIFIELD_KIND_META = {
  run: { color: "#4ade80", label: "Corrida" },
  pass: { color: "#38bdf8", label: "Passe completo" },
  incomplete: { color: "#94a3b8", label: "Passe incompleto" },
  interception: { color: "#f87171", label: "Interceptação!" },
  sack: { color: "#f87171", label: "Sack" },
  fumble: { color: "#f87171", label: "Fumble!" },
  touchdown: { color: "#facc15", label: "TOUCHDOWN!" },
  "fieldgoal-good": { color: "#c084fc", label: "Field goal bom" },
  "fieldgoal-miss": { color: "#94a3b8", label: "Field goal errado" },
  punt: { color: "#94a3b8", label: "Punt" },
  kickoff: { color: "#94a3b8", label: "Pontapé inicial" },
  penalty: { color: "#fb923c", label: "Penalidade" },
  final: { color: "#64748b", label: "Fim de jogo" },
  injury: { color: "#f87171", label: "Lesão em campo" },
  info: { color: "#64748b", label: "" },
};

function isHighlightPlay(p) {
  if (!p) return false;
  if (["touchdown", "interception", "fumble", "sack", "fieldgoal-good", "injury"].includes(p.kind)) return true;
  if ((p.kind === "run" || p.kind === "pass") && (p.yards || 0) >= 20) return true;
  return false;
}

// Persistent header: score, quarter/clock, and a small football marker next
// to whichever team currently has the ball — the "what's the state of the
// game" strip that a broadcast never lets you lose sight of.
function Scoreboard({ g, homeT, awayT, liveScore, curPlay, finished }) {
  const possAbbr = curPlay?.offAbbr;
  return (
    <Card className="mb-3 !p-0 overflow-hidden">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${awayT.c1}, ${homeT.c1})` }} />
      <div className="p-4 text-center">
        <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-center gap-2">
          {finished ? <span className="font-bold text-slate-200 tracking-wide">FINAL</span> : (
            <>
              <span className="font-bold text-slate-200">Q{curPlay?.quarter ?? 1}</span>
              <span className="tabular-nums">{curPlay?.clock ?? "15:00"}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <TeamLogo abbr={g.away} size={38} />
              {!finished && possAbbr === g.away && <span className="absolute -right-2 -bottom-1 text-sm">🏈</span>}
            </div>
            <div className="text-xs text-slate-400">{awayT.abbr}</div>
            <div className="text-3xl font-black tabular-nums">{liveScore[g.away] ?? 0}</div>
          </div>
          <div className="text-slate-600 text-lg">—</div>
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <TeamLogo abbr={g.home} size={38} />
              {!finished && possAbbr === g.home && <span className="absolute -right-2 -bottom-1 text-sm">🏈</span>}
            </div>
            <div className="text-xs text-slate-400">{homeT.abbr}</div>
            <div className="text-3xl font-black tabular-nums">{liveScore[g.home] ?? 0}</div>
          </div>
        </div>
        {!finished && curPlay?.quarter === 4 && curPlay?.clock && Number(curPlay.clock.split(":")[0]) < 2 && Math.abs((liveScore[g.home] ?? 0) - (liveScore[g.away] ?? 0)) <= 8 && (
          <div className="text-[11px] font-bold text-amber-400 mt-2 animate-pulse">🔥 RETA FINAL</div>
        )}
      </div>
    </Card>
  );
}

// A brief, loud banner for the play that was JUST revealed, when it's the
// kind of thing a broadcast would cut to a replay for. Sits above the
// scrolling log so the biggest moments don't get lost in the play-by-play.
function ScoreEventBanner({ play }) {
  if (!play) return null;
  const big = play.kind === "touchdown" ? { emoji: "🎉", text: "TOUCHDOWN!", color: "#facc15" }
    : play.kind === "interception" ? { emoji: "🚨", text: "INTERCEPTAÇÃO!", color: "#f87171" }
    : play.kind === "fumble" ? { emoji: "🚨", text: "FUMBLE!", color: "#f87171" }
    : play.kind === "fieldgoal-good" ? { emoji: "🎯", text: "FIELD GOAL!", color: "#c084fc" }
    : play.kind === "sack" ? { emoji: "💥", text: "SACK!", color: "#f87171" }
    : play.kind === "injury" ? { emoji: "🏥", text: "LESÃO!", color: "#f87171" }
    : (play.kind === "run" || play.kind === "pass") && (play.yards || 0) >= 20 ? { emoji: "⚡", text: "JOGADÃO!", color: "#38bdf8" }
    : null;
  if (!big) return null;
  return (
    <div className="mb-3 rounded-lg border px-4 py-2.5 text-center font-black tracking-wide animate-pulse"
      style={{ borderColor: big.color + "66", background: big.color + "14", color: big.color }}>
      {big.emoji} {big.text}
    </div>
  );
}

// Compact 2D field: draws the line of scrimmage, the first-down marker, yard
// numbers, a red-zone tint, and an arrow showing the direction and length of
// the play that's currently revealed in the log, color-coded by outcome.
function MiniField({ play, offTeam, defTeam }) {
  if (!play) return null;
  const W = 320, H = 96, padX = 18;
  const fieldW = W - padX * 2;
  const toX = (yd) => padX + clamp(yd, 0, 100) / 100 * fieldW;
  const losX = toX(play.ballOn);
  const afterYd = clamp(play.ballOn + (play.yards || 0), 0, 100);
  const afterX = toX(afterYd);
  const fdX = play.distance > 0 ? toX(play.ballOn + play.distance) : null;
  const laneY = play.dir === "esquerda" ? 26 : play.dir === "direita" ? 70 : 48;
  const meta = MINIFIELD_KIND_META[play.kind] || MINIFIELD_KIND_META.info;
  const drawArrow = ["run", "pass", "sack", "fumble", "penalty"].includes(play.kind);
  const ballX = play.kind === "touchdown" ? toX(100) : afterX;
  const inRedZone = play.ballOn >= 80;
  return (
    <Card className="mb-3 !p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 rounded-md" style={{ background: "#0d2818" }}>
        <rect x={0} y={0} width={padX} height={H} fill={defTeam?.c1 || "#1e293b"} opacity="0.55" />
        <rect x={W - padX} y={0} width={padX} height={H} fill={offTeam?.c1 || "#1e293b"} opacity="0.55" />
        {inRedZone && <rect x={toX(80)} y={0} width={toX(100) - toX(80)} height={H} fill="#dc2626" opacity="0.12" />}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={toX(i * 10)} y1={6} x2={toX(i * 10)} y2={H - 6} stroke="rgba(255,255,255,0.18)" strokeWidth={i === 5 ? 1.5 : 1} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => {
          const yd = (i + 1) * 10;
          const num = yd <= 50 ? yd : 100 - yd;
          return <text key={i} x={toX(yd)} y={H - 10} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontWeight="700">{num}</text>;
        })}
        {fdX !== null && <line x1={fdX} y1={2} x2={fdX} y2={H - 2} stroke="#facc15" strokeWidth="2" />}
        <line x1={losX} y1={2} x2={losX} y2={H - 2} stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
        {drawArrow && (
          <line x1={losX} y1={laneY} x2={afterX} y2={laneY} stroke={meta.color} strokeWidth="4" strokeLinecap="round" markerEnd="url(#mf-arrow)" />
        )}
        <ellipse cx={ballX} cy={laneY} rx="6" ry="4" fill={meta.color} stroke="#0d2818" strokeWidth="1.5" />
        <defs>
          <marker id="mf-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={meta.color} />
          </marker>
        </defs>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
        <span>{play.offAbbr}{play.down ? ` · ${play.down}ª e ${play.distance > 0 ? play.distance : "gol"}` : ""}{play.personnel && play.personnel !== "11" ? ` · ${play.personnel} personnel` : ""}{inRedZone ? " · 🔴 red zone" : ""}</span>
        <span className="font-semibold" style={{ color: meta.color }}>
          {meta.label}{typeof play.yards === "number" && drawArrow ? ` (${play.yards > 0 ? "+" : ""}${play.yards} jds)` : ""}
        </span>
      </div>
    </Card>
  );
}

// End-of-game recap: every touchdown, turnover, sack and explosive play from
// the whole game in one scrollable reel, so the story of the game doesn't
// disappear the moment the final whistle blows.
function GameHighlights({ g }) {
  const notable = (g.plays || []).map((p, i) => ({ p, i })).filter(({ p }) => isHighlightPlay(p));
  if (!notable.length) return null;
  return (
    <Card className="mb-3">
      <div className="text-sm font-semibold mb-2">📽️ Melhores momentos</div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {notable.map(({ p, i }) => {
          const meta = MINIFIELD_KIND_META[p.kind] || MINIFIELD_KIND_META.info;
          const text = (g.log[i] || "").split(" — ").slice(1).join(" — ") || g.log[i];
          return (
            <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-white/5 last:border-0">
              <TeamLogo abbr={p.offAbbr} size={16} />
              <span className="text-slate-500 w-16 shrink-0 tabular-nums">Q{p.quarter} {p.clock}</span>
              <span className="flex-1" style={{ color: meta.color }}>{text}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GameScreen({ career, myTeam, go, onAdvance, onSkipToHighlight, onSimAll }) {
  const [auto, setAuto] = useState(false);
  const g = career.lastGame;
  const shown = g ? Math.min(g.log.length, career.gameRevealCount ?? g.log.length) : 0;
  const finished = g ? shown >= g.log.length : false;

  useEffect(() => {
    if (!auto || !g || finished) { if (finished) setAuto(false); return; }
    const t = setTimeout(() => onAdvance(), 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, finished, shown]);

  if (!g) return <div className="pb-24"><Card>Nenhum jogo simulado ainda.</Card></div>;
  const homeT = TEAM_META.find((t) => t.abbr === g.home), awayT = TEAM_META.find((t) => t.abbr === g.away);
  const liveScore = shown > 0 && g.scoreTimeline ? g.scoreTimeline[shown - 1] : { [g.home]: 0, [g.away]: 0 };
  const curPlay = g.plays && shown > 0 ? g.plays[shown - 1] : null;
  const curOffTeam = curPlay && TEAM_META.find((t) => t.abbr === curPlay.offAbbr);
  const curDefTeam = curPlay && TEAM_META.find((t) => t.abbr === curPlay.defAbbr);

  return (
    <div className="pb-24">
      <Scoreboard g={g} homeT={homeT} awayT={awayT} liveScore={liveScore} curPlay={curPlay} finished={finished} />
      {!finished && <ScoreEventBanner play={curPlay} />}
      {!finished && <MiniField play={curPlay} offTeam={curOffTeam} defTeam={curDefTeam} />}
      <Card className="mb-3 max-h-96 overflow-y-auto text-sm space-y-1.5">
        {g.log.slice(0, shown).map((l, i) => <div key={i} className="text-slate-300 border-b border-white/5 pb-1 last:border-0">{l}</div>)}
      </Card>
      {finished && <GameHighlights g={g} />}
      {!finished ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={onAdvance}>Avançar jogadas</Btn>
            <Btn variant="ghost" className="flex-1" onClick={onSkipToHighlight}>Pular pro próximo lance ⏩</Btn>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" className="flex-1" onClick={() => setAuto((a) => !a)}>
              {auto ? "⏸️ Pausar" : "▶️ Assistir automaticamente"}
            </Btn>
            <Btn variant="ghost" className="flex-1" onClick={onSimAll}>Simular jogo todo ⏭️</Btn>
          </div>
        </div>
      ) : (
        <Btn className="w-full" onClick={() => go("hub")}>Voltar ao painel</Btn>
      )}
    </div>
  );
}

function PressModal({ event, onChoose }) {
  if (!event) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-30 p-4">
      <div className="bg-[#131B2E] border border-white/10 rounded-lg p-5 w-full max-w-md">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs">
          🎙️ Coletiva de imprensa{event.reporter ? ` · ${event.reporter.name} (${event.reporter.outlet})` : ""}
        </div>
        <p className="mb-4 text-slate-100">{event.prompt}</p>
        <div className="space-y-2">
          {event.options.map((o, i) => (
            <button key={i} onClick={() => onChoose(o)} className="w-full text-left px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FREE AGENCY
   ============================================================ */

// Full detail page for a free agent — same visual language as the roster
// PlayerDetailScreen (attrs, "curiosities"), but adapted for someone who
// isn't on any team yet: no games/team info, just the scouting profile
// and a big sign button.

export { ScheduleScreen, ResultsScreen, GameScreen, PressModal };
