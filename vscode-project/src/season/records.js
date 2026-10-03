// ============================================================
// LEAGUE RECORD BOOK
//
// Single-game records update after every game in the league (watched or
// quick-simmed — both already produce a full box score). Single-season
// records update once a year, at the same point season awards are
// computed, before stats reset. Both persist for the whole career, so a
// record set in year one can stand — or fall — years later.
// ============================================================

const GAME_RECORD_CATS = [
  { key: "passYards", label: "Mais jardas de passe num jogo" },
  { key: "rushYards", label: "Mais jardas de corrida num jogo" },
  { key: "receivingYards", label: "Mais jardas recebidas num jogo" },
  { key: "passTD", label: "Mais passes para touchdown num jogo" },
  { key: "sacks", label: "Mais sacks num jogo" },
  { key: "interceptions", label: "Mais interceptações num jogo" },
  { key: "tackles", label: "Mais tackles num jogo" },
];

const SEASON_RECORD_CATS = [
  { key: "passYards", label: "Mais jardas de passe numa temporada" },
  { key: "rushYards", label: "Mais jardas de corrida numa temporada" },
  { key: "receivingYards", label: "Mais jardas recebidas numa temporada" },
  { key: "passTD", label: "Mais passes para touchdown numa temporada" },
  { key: "sacks", label: "Mais sacks numa temporada" },
  { key: "interceptions", label: "Mais interceptações numa temporada" },
];

function ensureRecords(records) {
  if (!records.single_game) records.single_game = {};
  if (!records.single_season) records.single_season = {};
  return records;
}

// Scans one game's box score (both sides) for broken single-game records.
// `records` is mutated in place; returns the list of breaks for news/UI.
function checkGameRecords(records, boxScore, homeAbbr, awayAbbr, year, week) {
  ensureRecords(records);
  const broken = [];
  [[boxScore?.home, homeAbbr], [boxScore?.away, awayAbbr]].forEach(([list, abbr]) => {
    (list || []).forEach((p) => {
      GAME_RECORD_CATS.forEach(({ key, label }) => {
        const val = p.stats?.[key];
        if (!val) return;
        const cur = records.single_game[key];
        if (!cur || val > cur.value) {
          records.single_game[key] = { value: val, playerId: p.id, playerName: p.name, pos: p.pos, teamAbbr: abbr, year, week };
          broken.push({ key, label, value: val, playerName: p.name, teamAbbr: abbr, scope: "game" });
        }
      });
    });
  });
  return broken;
}

// Scans every player's final seasonStats (called right before rollover
// resets them) for broken single-season records.
function checkSeasonRecords(records, leagueTeams, year) {
  ensureRecords(records);
  const broken = [];
  Object.values(leagueTeams).forEach((t) => {
    t.roster.forEach((p) => {
      SEASON_RECORD_CATS.forEach(({ key, label }) => {
        const val = p.seasonStats?.[key];
        if (!val) return;
        const cur = records.single_season[key];
        if (!cur || val > cur.value) {
          records.single_season[key] = { value: val, playerId: p.id, playerName: p.name, pos: p.pos, teamAbbr: t.abbr, year };
          broken.push({ key, label, value: val, playerName: p.name, teamAbbr: t.abbr, scope: "season" });
        }
      });
    });
  });
  return broken;
}

export { GAME_RECORD_CATS, SEASON_RECORD_CATS, checkGameRecords, checkSeasonRecords };
