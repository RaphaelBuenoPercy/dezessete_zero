import { clamp } from "../lib/rng.js";

// ============================================================
// POWER RANKINGS, TIER LISTS & MEDIA PREDICTIONS
//
// A weekly "power rankings" media segment for the whole league (1-32,
// with movement arrows and a one-line take), position tier lists built
// from the same value formula the season awards use, and a lightweight
// pre-game win-probability prediction the media publishes before your
// games — tracked over the season so beating the odds means something.
// ============================================================

function teamScore(t) {
  const played = t.wins + t.losses + t.ties;
  const winPct = played ? (t.wins + t.ties * 0.5) / played : 0.5;
  return winPct * 100 + (t.pf - t.pa) * 0.25;
}

function computePowerRankings(leagueTeams) {
  return Object.values(leagueTeams)
    .map((t) => ({ abbr: t.abbr, score: teamScore(t), wins: t.wins, losses: t.losses, ties: t.ties, pf: t.pf, pa: t.pa }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

function rankingMap(ranked) {
  const m = {};
  ranked.forEach((t) => { m[t.abbr] = t.rank; });
  return m;
}

const BLURBS = {
  surging: ["embalado, subindo com tudo na tabela.", "em ascensão clara nas últimas semanas.", "ninguém quer enfrentar esse time agora."],
  falling: ["em queda livre — algo precisa mudar.", "murchando semana após semana.", "os problemas estão aparecendo."],
  steady_top: ["mantendo o topo com consistência.", "sem sustos, seguindo forte."],
  steady_bottom: ["ainda patinando no fundo da tabela.", "temporada difícil, sem sinais de melhora."],
  steady_mid: ["um time de meio de tabela, sem grandes emoções.", "nem favorito nem zebra — só ali."],
};
function movementBlurb(rank, prevRank, rng) {
  const delta = prevRank != null ? prevRank - rank : 0; // positive = moved up
  let pool;
  if (delta >= 3) pool = BLURBS.surging;
  else if (delta <= -3) pool = BLURBS.falling;
  else if (rank <= 6) pool = BLURBS.steady_top;
  else if (rank >= 27) pool = BLURBS.steady_bottom;
  else pool = BLURBS.steady_mid;
  return pool[Math.floor(rng() * pool.length)];
}

// This week's full 1-32 board, with movement vs `prevRankingMap` (an
// {abbr: rank} snapshot from last week's board, or null the first time).
function buildPowerRankings(leagueTeams, prevRankingMap, rng) {
  return computePowerRankings(leagueTeams).map((t) => {
    const prevRank = prevRankingMap ? prevRankingMap[t.abbr] ?? null : null;
    return { ...t, prevRank, delta: prevRank != null ? prevRank - t.rank : 0, blurb: movementBlurb(t.rank, prevRank, rng) };
  });
}

const HOT_TAKES = [
  (abbr) => `"${abbr} não vence um jogo grande há tempos — dá pra confiar nesse time nos playoffs?"`,
  (abbr) => `"O ataque do ${abbr} é bonito de assistir, mas defesa é o que ganha título."`,
  (abbr) => `"Ninguém está falando do ${abbr}, e talvez devesse."`,
  (abbr) => `"O ${abbr} vive das costas de um jogador só — e se ele se lesionar?"`,
  (abbr) => `"É hora da diretoria do ${abbr} pensar em mudanças."`,
];
// A deliberately spicy, low-stakes opinion about a mid-table team — purely
// flavor, no mechanical effect, just the "media segment" feel.
function hotTake(ranked, rng) {
  const pool = ranked.slice(2, Math.max(3, ranked.length - 2));
  const t = pool[Math.floor(rng() * pool.length)] || ranked[0];
  const gen = HOT_TAKES[Math.floor(rng() * HOT_TAKES.length)];
  return gen(t.abbr);
}

// Rough win probability from the same power-ranking scores, logistic
// curve, home field worth a few points.
function winProbability(scoreHome, scoreAway, homeFieldBonus = 3) {
  const diff = (scoreHome + homeFieldBonus) - scoreAway;
  return clamp(1 / (1 + Math.pow(10, -diff / 12)), 0.05, 0.95);
}

// ------------------------------------------------------------
// Position tier lists — same value formula the season awards use,
// bucketed into S/A/B/C/D by percentile rather than a flat top-N list.
// ------------------------------------------------------------
function seasonValueScore(player, team) {
  const s = player.seasonStats || {};
  let prod = 0;
  if (player.pos === "QB") prod = (s.passYards || 0) * 0.04 + (s.passTD || 0) * 4 - (s.interceptionsThrown || 0) * 2;
  else if (player.pos === "RB") prod = (s.rushYards || 0) * 0.1 + (s.rushTD || 0) * 6 + (s.receivingYards || 0) * 0.06 + (s.receivingTD || 0) * 4;
  else if (player.pos === "WR" || player.pos === "TE") prod = (s.receivingYards || 0) * 0.08 + (s.receptions || 0) * 0.5 + (s.receivingTD || 0) * 6;
  else if (player.pos === "DL" || player.pos === "LB") prod = (s.sacks || 0) * 4 + (s.tackles || 0) * 0.5 + (s.tacklesForLoss || 0) * 1.2 + (s.forcedFumbles || 0) * 3;
  else if (player.pos === "CB" || player.pos === "S") prod = (s.interceptions || 0) * 6 + (s.passesDefended || 0) * 1.3 + (s.tackles || 0) * 0.4;
  else if (player.pos === "K") prod = (s.fgMade || 0) * 2;
  else if (player.pos === "P") prod = (s.punts || 0) * 0.15;
  else if (player.pos === "OL") prod = 40 - (s.sacksAllowed || 0) * 3 - (s.pressuresAllowed || 0) * 0.4;
  const played = team.wins + team.losses + team.ties;
  const winPct = played ? (team.wins + team.ties * 0.5) / played : 0.5;
  return prod * (0.7 + winPct * 0.6);
}

// Fixed headcounts, not percentiles — a position with 100 qualifying
// players (LB, DL) shouldn't flood "S" with ten guys just because it has
// more roster slots than, say, kicker. Everyone past the counted tiers
// still shows, just in D.
const TIERS = [
  { key: "S", label: "S — Elite", color: "#facc15", count: 5 },
  { key: "A", label: "A — Muito bom", color: "#4ade80", count: 8 },
  { key: "B", label: "B — Sólido", color: "#38bdf8", count: 10 },
  { key: "C", label: "C — Mediano", color: "#94a3b8", count: 10 },
  { key: "D", label: "D — Abaixo da média", color: "#f87171", count: Infinity },
];

// Every player at `pos` league-wide, best score first, sliced into fixed-
// size tiers (so "S" always means roughly the same number of players,
// whatever the position). Needs at least a handful of live stat lines to
// be meaningful.
function buildTierList(leagueTeams, pos) {
  const entries = [];
  Object.values(leagueTeams).forEach((t) => {
    t.roster.filter((p) => p.pos === pos).forEach((p) => {
      if (p.seasonStats && Object.values(p.seasonStats).some((v) => v)) entries.push({ p, teamAbbr: t.abbr, score: seasonValueScore(p, t) });
    });
  });
  entries.sort((a, b) => b.score - a.score);
  const tiers = TIERS.map((t) => ({ ...t, players: [] }));
  let i = 0;
  tiers.forEach((t) => {
    t.players = entries.slice(i, i + t.count);
    i += t.count;
  });
  return tiers.filter((t) => t.players.length > 0);
}

export { teamScore, computePowerRankings, buildPowerRankings, rankingMap, hotTake, winProbability, buildTierList, seasonValueScore };
