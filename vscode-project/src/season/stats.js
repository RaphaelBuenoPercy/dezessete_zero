// League-leader stat categories and the leaderboard/formatting helpers
// used by the Stats screen and box scores.

const STAT_CATEGORIES = [
  { key: "passYards", label: "Jardas aéreas", pos: "QB" },
  { key: "passCompletionPct", label: "% de passes completos", pos: "QB" },
  { key: "passTD", label: "Passes para TD", pos: "QB" },
  { key: "rushYards", label: "Jardas terrestres", pos: "RB" },
  { key: "rushYPC", label: "Jardas por corrida (YPC)", pos: "RB" },
  { key: "rushTD", label: "Corridas para TD", pos: "RB" },
  { key: "receptions", label: "Recepções", pos: null },
  { key: "receivingYards", label: "Jardas recebidas", pos: null },
  { key: "receivingTD", label: "Recepções para TD", pos: null },
  { key: "tackles", label: "Tackles", pos: null },
  { key: "sacks", label: "Sacks", pos: null },
  { key: "qbHits", label: "QB hits", pos: null },
  { key: "qbHurries", label: "Pressões (hurries)", pos: null },
  { key: "interceptions", label: "Interceptações", pos: null },
  { key: "passesDefended", label: "Passes defendidos", pos: null },
  { key: "fgMade", label: "Field goals convertidos", pos: "K" },
  { key: "fgPct", label: "% de field goals", pos: "K" },
  { key: "fgPct40", label: "% de FG 40+ jardas", pos: "K" },
  { key: "fgPct50", label: "% de FG 50+ jardas", pos: "K" },
  { key: "runBlockWinPct", label: "% de duelos de bloqueio vencidos", pos: "OL" },
  { key: "pressuresAllowed", label: "Pressões sofridas", pos: "OL" },
  { key: "sacksAllowed", label: "Sacks sofridos", pos: "OL" },
];

// Percentage/average categories: computed as num/den, but only for players
// with enough volume that the number means something. That minimum RAMPS
// UP through the season instead of being fixed: `start` is the bar after
// the first game, and it grows by `perGame` for every game played (never
// dropping below `start`). Week 1 needs ~20 passes to rank a QB; by week
// 10 it takes ~95, so an early 3-for-3 kicker or a 5-for-5 passer doesn't
// top the board, but a full-season leaderboard is still honest.
const RATIO_STATS = {
  passCompletionPct: { num: "passCompletions", den: "passAttempts", start: 20, perGame: 9.5, unit: "passes", mult: 100, decimals: 1, suffix: "%" },
  rushYPC: { num: "rushYards", den: "rushAttempts", start: 10, perGame: 6, unit: "corridas", mult: 1, decimals: 1, suffix: " ypc" },
  fgPct: { num: "fgMade", den: "fgAttempts", start: 2, perGame: 1, unit: "field goals", mult: 100, decimals: 1, suffix: "%" },
  fgPct40: { num: "fgMade40", den: "fgAttempts40", start: 1, perGame: 0.4, unit: "FGs de 40+ jardas", mult: 100, decimals: 1, suffix: "%" },
  fgPct50: { num: "fgMade50", den: "fgAttempts50", start: 1, perGame: 0.15, unit: "FGs de 50+ jardas", mult: 100, decimals: 1, suffix: "%" },
  runBlockWinPct: { num: "runBlockWins", den: "runBlockSnaps", start: 4, perGame: 2.2, unit: "duelos de bloqueio", mult: 100, decimals: 1, suffix: "%" },
};

// Games each team has played in the regular season so far (the schedule
// has no byes, so it's just completed weeks). Once the regular season is
// over it stays at the full 17.
function gamesPlayedThisSeason(career) {
  if (career.phase === "season") return Math.max(0, Math.min(17, (career.week || 1) - 1));
  return 17;
}

// The minimum denominator volume for `key` after `gamesPlayed` games.
function ratioMinimum(key, gamesPlayed) {
  const r = RATIO_STATS[key];
  if (!r) return 0;
  const g = gamesPlayed ?? 17;
  return Math.max(r.start, Math.round(r.perGame * g));
}

function statRatioValue(p, key, gamesPlayed) {
  const r = RATIO_STATS[key];
  if (!r) return null;
  const den = p.seasonStats?.[r.den] || 0;
  if (den < ratioMinimum(key, gamesPlayed)) return null;
  const num = p.seasonStats?.[r.num] || 0;
  return (num / den) * r.mult;
}
function formatStatValue(key, value) {
  const r = RATIO_STATS[key];
  if (!r || value === null || value === undefined) return value;
  return `${value.toFixed(r.decimals)}${r.suffix}`;
}

function leagueLeaders(teams, statKey, n = 5, gamesPlayed) {
  const ratio = RATIO_STATS[statKey];
  const rows = [];
  Object.values(teams).forEach((t) => {
    t.roster.forEach((p) => {
      if (ratio) {
        const v = statRatioValue(p, statKey, gamesPlayed);
        if (v !== null) rows.push({ player: p, teamAbbr: t.abbr, value: v });
      } else {
        const val = p.seasonStats?.[statKey];
        if (val) rows.push({ player: p, teamAbbr: t.abbr, value: val });
      }
    });
  });
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, n);
}

function resetSeasonStats(teams) {
  Object.values(teams).forEach((t) => { t.roster.forEach((p) => { p.seasonStats = {}; }); });
}


export { STAT_CATEGORIES, RATIO_STATS, gamesPlayedThisSeason, ratioMinimum, statRatioValue, formatStatValue, leagueLeaders, resetSeasonStats };
