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

// Percentage/average categories: computed as num/den (with a minimum sample
// so a 1-for-1 kicker doesn't lead the league), instead of a raw counting stat.
const RATIO_STATS = {
  passCompletionPct: { num: "passCompletions", den: "passAttempts", min: 40, mult: 100, decimals: 1, suffix: "%" },
  rushYPC: { num: "rushYards", den: "rushAttempts", min: 20, mult: 1, decimals: 1, suffix: " ypc" },
  fgPct: { num: "fgMade", den: "fgAttempts", min: 5, mult: 100, decimals: 1, suffix: "%" },
  fgPct40: { num: "fgMade40", den: "fgAttempts40", min: 3, mult: 100, decimals: 1, suffix: "%" },
  fgPct50: { num: "fgMade50", den: "fgAttempts50", min: 2, mult: 100, decimals: 1, suffix: "%" },
  runBlockWinPct: { num: "runBlockWins", den: "runBlockSnaps", min: 15, mult: 100, decimals: 1, suffix: "%" },
};
function statRatioValue(p, key) {
  const r = RATIO_STATS[key];
  if (!r) return null;
  const den = p.seasonStats?.[r.den] || 0;
  if (den < r.min) return null;
  const num = p.seasonStats?.[r.num] || 0;
  return (num / den) * r.mult;
}
function formatStatValue(key, value) {
  const r = RATIO_STATS[key];
  if (!r || value === null || value === undefined) return value;
  return `${value.toFixed(r.decimals)}${r.suffix}`;
}

function leagueLeaders(teams, statKey, n = 5) {
  const ratio = RATIO_STATS[statKey];
  const rows = [];
  Object.values(teams).forEach((t) => {
    t.roster.forEach((p) => {
      if (ratio) {
        const v = statRatioValue(p, statKey);
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


export { STAT_CATEGORIES, RATIO_STATS, statRatioValue, formatStatValue, leagueLeaders, resetSeasonStats };
