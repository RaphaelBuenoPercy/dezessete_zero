// ============================================================
// WEEKLY RECAP — "around the league" this week
//
// Every game, watched or not, already has a full box score (see App.jsx's
// quick-sim loop). This just reads that data and picks out what's worth
// knowing: the best individual performance, a handful of standout stat
// lines, and which results defied the standings.
// ============================================================

// A short, neutral stat-line description — same statistical bar as the
// nemesis detector in rivalries.js, but framed for anyone's box score
// instead of "contra você", since this covers the whole league.
function standoutLine(s) {
  const tds = (s.receivingTD || 0) + (s.rushTD || 0);
  if (tds >= 2) return `${tds} TDs`;
  if ((s.passYards || 0) >= 300) return `${s.passYards} jds aéreas${s.passTD ? `, ${s.passTD} TD` : ""}`;
  if ((s.rushYards || 0) >= 100) return `${s.rushYards} jds de corrida`;
  if ((s.receivingYards || 0) >= 110) return `${s.receivingYards} jds recebidas`;
  if ((s.sacks || 0) >= 2) return `${s.sacks} sacks`;
  if ((s.interceptions || 0) >= 2) return `${s.interceptions} interceptações`;
  return null;
}

// Rough single-game value score — same shape as the season-long one in
// legacy.js, just without the team-success weighting (a week is too short
// a sample to weigh that in).
function gameValueScore(s) {
  return (s.passYards || 0) * 0.04 + (s.passTD || 0) * 4 - (s.interceptionsThrown || 0) * 2
    + (s.rushYards || 0) * 0.1 + (s.rushTD || 0) * 6
    + (s.receivingYards || 0) * 0.08 + (s.receptions || 0) * 0.3 + (s.receivingTD || 0) * 6
    + (s.sacks || 0) * 4 + (s.tackles || 0) * 0.3 + (s.interceptions || 0) * 6 + (s.passesDefended || 0) * 1;
}

function winPct(t) {
  const played = t.wins + t.losses + t.ties;
  return played ? (t.wins + t.ties * 0.5) / played : 0.5;
}

// Builds the recap for one week of `schedule` (already-played games only).
// Returns null if nothing in that week has been played yet.
function buildWeeklyRecap(leagueTeams, weekGames) {
  const games = (weekGames || []).filter((g) => g.homeScore !== undefined && g.boxScore);
  if (!games.length) return null;

  let potw = null, potwScore = -Infinity;
  const standouts = [];
  games.forEach((g) => {
    ["home", "away"].forEach((side) => {
      const abbr = g[side];
      (g.boxScore?.[side] || []).forEach((p) => {
        const s = p.stats || {};
        const score = gameValueScore(s);
        if (score > potwScore) { potwScore = score; potw = { id: p.id, name: p.name, pos: p.pos, teamAbbr: abbr, line: standoutLine(s) || "atuação de destaque" }; }
        const line = standoutLine(s);
        if (line) standouts.push({ id: p.id, name: p.name, pos: p.pos, teamAbbr: abbr, line });
      });
    });
  });

  const upsets = games
    .map((g) => {
      const h = leagueTeams[g.home], a = leagueTeams[g.away];
      if (!h || !a) return null;
      const homeWon = g.homeScore > g.awayScore;
      const favoredHome = winPct(h) >= winPct(a);
      const gap = Math.abs(winPct(h) - winPct(a));
      return { g, upset: (homeWon && !favoredHome) || (!homeWon && favoredHome), gap };
    })
    .filter((x) => x && x.upset && x.gap >= 0.15)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((x) => x.g);

  const blowouts = games.filter((g) => Math.abs(g.homeScore - g.awayScore) >= 24);
  const shutouts = games.filter((g) => g.homeScore === 0 || g.awayScore === 0);

  return {
    totalGames: games.length,
    potw,
    standouts: standouts.filter((s) => !potw || s.id !== potw.id).slice(0, 8),
    upsets, blowouts, shutouts,
  };
}

export { buildWeeklyRecap };
