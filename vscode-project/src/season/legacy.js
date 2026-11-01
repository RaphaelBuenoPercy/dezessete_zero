import { updateLeadersFromTeams } from "./allTime.js";

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

// All-Pro: quantos jogadores por posição em cada time (1º e 2º time têm a mesma formação).
const ALL_PRO_SLOTS = { QB: 1, RB: 1, WR: 2, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1, P: 1 };

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

  // 1º e 2º time All-Pro: os melhores de cada posição pela nota da temporada, sem repetir jogador.
  // Na OL, quem jogou pouco fica de fora (a nota da linha só pune erros, então reservas pareceriam ótimos).
  const allProTeams = { first: {}, second: {} };
  const allPro = {};   // compat.: o melhor de cada posição (= 1º time)
  Object.entries(ALL_PRO_SLOTS).forEach(([pos, n]) => {
    let pool = entries.filter((e) => e.p.pos === pos);
    if (pos === "OL" && pool.length) {
      const maxSnaps = Math.max(...pool.map((e) => e.p.seasonStats?.runBlockSnaps || 0));
      pool = pool.filter((e) => (e.p.seasonStats?.runBlockSnaps || 0) >= maxSnaps * 0.6);
    }
    if (pool.length) {
      allProTeams.first[pos] = pool.slice(0, n);
      allProTeams.second[pos] = pool.slice(n, n * 2);
      allPro[pos] = pool[0];
    }
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
    allProTeams,
    coachOfYear: coachRanking[0] || null,
  };
}

function accoladeLabel(key, year) {
  const labels = {
    mvp: `MVP ${year}`, opoy: `Melhor Atacante ${year}`, dpoy: `Melhor Defensor ${year}`,
    oroy: `Novato Ofensivo do Ano ${year}`, droy: `Novato Defensivo do Ano ${year}`, allPro: `All-Pro ${year}`,
    allPro1: `All-Pro 1º Time ${year}`, allPro2: `All-Pro 2º Time ${year}`,
  };
  return labels[key] || `Prêmio ${year}`;
}

// Accumulates every player's seasonStats into careerStats, bumps seasons
// played, and stamps any awards they won onto their accolades list. Must
// run BEFORE resetSeasonStats() wipes the season, and before retirement
// swaps a player out of the league.
// allTimeLeaders (opcional): depois de somar seasonStats em careerStats, atualiza o Top 100 histórico.
function applyCareerRollover(leagueTeams, awards, allTimeLeaders) {
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
  if (awards.allProTeams) {
    Object.values(awards.allProTeams.first).flat().forEach((entry) => grant(entry, "allPro1"));
    Object.values(awards.allProTeams.second).flat().forEach((entry) => grant(entry, "allPro2"));
  } else Object.values(awards.allPro).forEach((entry) => grant(entry, "allPro"));

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

  // Líderes históricos: careerStats já inclui a temporada que acabou (e ainda ninguém se aposentou).
  if (allTimeLeaders) updateLeadersFromTeams(allTimeLeaders, leagueTeams);

  return news;
}

export { ALL_PRO_SLOTS, computeSeasonAwards, applyCareerRollover, accoladeLabel, seasonValueScore };
