// ============================================================
// SEASON AWARDS & CAREER LEGACY
//
// Runs once a year, right before the roster ages/retires and season
// stats reset — while final records and this year's seasonStats are
// still intact. Produces award winners for the front page, and rolls
// every player's seasonStats into their careerStats + accolades so a
// long coaching career actually accumulates a legacy.
// ============================================================

const OFFENSE_POS = ["QB", "RB", "WR", "TE"];
const DEFENSE_POS = ["DL", "LB", "CB", "S"];

// A rough, position-aware "how good was this season" score. Not meant to
// be a perfect advanced stat — just something that reliably rewards a
// clearly outstanding year over a merely decent one, weighted a little by
// team success so awards feel connected to the standings.
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

function hasStats(player) { return player.seasonStats && Object.values(player.seasonStats).some((v) => v); }

function computeSeasonAwards(leagueTeams, year) {
  const entries = [];
  Object.values(leagueTeams).forEach((t) => t.roster.forEach((p) => { if (hasStats(p)) entries.push({ p, t, score: seasonValueScore(p, t) }); }));
  entries.sort((a, b) => b.score - a.score);

  const offense = entries.filter((e) => OFFENSE_POS.includes(e.p.pos));
  const defense = entries.filter((e) => DEFENSE_POS.includes(e.p.pos));
  const rookies = entries.filter((e) => e.p.rookieYear === year);
  const rookiesOff = rookies.filter((e) => OFFENSE_POS.includes(e.p.pos));
  const rookiesDef = rookies.filter((e) => DEFENSE_POS.includes(e.p.pos));

  const allPro = {};
  ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"].forEach((pos) => {
    const pool = entries.filter((e) => e.p.pos === pos);
    if (pool.length) allPro[pos] = pool[0];
  });

  const coachRanking = Object.values(leagueTeams)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa));

  return {
    year,
    mvp: entries[0] || null,
    opoy: offense[0] || null,
    dpoy: defense[0] || null,
    oroy: rookiesOff[0] || null,
    droy: rookiesDef[0] || null,
    allPro,
    coachOfYear: coachRanking[0] || null,
  };
}

function accoladeLabel(key, year) {
  const labels = {
    mvp: `MVP ${year}`, opoy: `Melhor Atacante ${year}`, dpoy: `Melhor Defensor ${year}`,
    oroy: `Novato Ofensivo do Ano ${year}`, droy: `Novato Defensivo do Ano ${year}`, allPro: `All-Pro ${year}`,
  };
  return labels[key] || `Prêmio ${year}`;
}

// Accumulates every player's seasonStats into careerStats, bumps seasons
// played, and stamps any awards they won onto their accolades list. Must
// run BEFORE resetSeasonStats() wipes the season, and before retirement
// swaps a player out of the league.
function applyCareerRollover(leagueTeams, awards) {
  const news = [];
  function grant(entry, key) {
    if (!entry) return;
    entry.p.accolades = entry.p.accolades || [];
    entry.p.accolades.push(accoladeLabel(key, awards.year));
  }
  grant(awards.mvp, "mvp");
  grant(awards.opoy, "opoy");
  grant(awards.dpoy, "dpoy");
  grant(awards.oroy, "oroy");
  grant(awards.droy, "droy");
  Object.values(awards.allPro).forEach((entry) => grant(entry, "allPro"));

  if (awards.mvp) news.push(`🏆 MVP da temporada: ${awards.mvp.p.name} (${awards.mvp.t.abbr}).`);
  if (awards.opoy) news.push(`⭐ Melhor jogador ofensivo: ${awards.opoy.p.name} (${awards.opoy.t.abbr}).`);
  if (awards.dpoy) news.push(`🛡️ Melhor jogador defensivo: ${awards.dpoy.p.name} (${awards.dpoy.t.abbr}).`);
  if (awards.oroy) news.push(`🌟 Novato ofensivo do ano: ${awards.oroy.p.name} (${awards.oroy.t.abbr}).`);
  if (awards.droy) news.push(`🌟 Novato defensivo do ano: ${awards.droy.p.name} (${awards.droy.t.abbr}).`);
  if (awards.coachOfYear) news.push(`📋 Melhor campanha da temporada: ${awards.coachOfYear.city} ${awards.coachOfYear.name} (${awards.coachOfYear.wins}-${awards.coachOfYear.losses}).`);

  Object.values(leagueTeams).forEach((t) => {
    t.roster.forEach((p) => {
      p.careerStats = p.careerStats || {};
      Object.entries(p.seasonStats || {}).forEach(([k, v]) => {
        if (typeof v === "number") p.careerStats[k] = (p.careerStats[k] || 0) + v;
      });
      p.seasonsPlayed = (p.seasonsPlayed || 0) + 1;
    });
  });

  return news;
}

export { computeSeasonAwards, applyCareerRollover, accoladeLabel, seasonValueScore };
