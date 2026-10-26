// Arquivo de temporadas.
// Ao fim de cada ano guardamos, em career.seasonArchive[ano], os MESMOS formatos
// que a temporada atual usa (schedule com homeScore/awayScore/boxScore e
// playoffs com rounds/score/boxScore), só que "enxutos" para caber no localStorage.

import { STAT_CATEGORIES, leagueLeaders } from "./stats.js";

// Temporadas mais recentes que mantêm box score; as mais antigas ficam só com
// placares, classificação, líderes e prêmios.
const KEEP_BOX_SEASONS = 5;

// O TeamBoxScore só exibe o melhor de cada categoria, então só guardamos esses.
const BOX_KEYS = ["passYards", "rushYards", "receivingYards", "tackles", "sacks", "qbHurries", "interceptions"];

function slimTeamBox(list) {
  if (!list?.length) return list || [];
  const keep = new Map();
  BOX_KEYS.forEach((key) => {
    const n = key === "rushYards" ? 2 : 1;
    [...list].filter((p) => p.stats?.[key]).sort((a, b) => b.stats[key] - a.stats[key]).slice(0, n)
      .forEach((p) => keep.set(p.id, p));
  });
  return [...keep.values()];
}
function slimBox(box) {
  return box ? { home: slimTeamBox(box.home), away: slimTeamBox(box.away) } : undefined;
}

function slimSchedule(schedule) {
  return (schedule || []).map((week) => week.map((g) => ({
    home: g.home, away: g.away, homeScore: g.homeScore, awayScore: g.awayScore, boxScore: slimBox(g.boxScore),
  })));
}

function slimMatch(m) {
  return m && { a: m.a, b: m.b, score: m.score, winner: m.winner, boxScore: slimBox(m.boxScore) };
}
function slimPlayoffs(po) {
  if (!po) return null;
  return {
    roundLabel: po.roundLabel, champion: po.champion,
    afcSeeds: po.afcSeeds, nfcSeeds: po.nfcSeeds,
    rounds: (po.rounds || []).map((r) => (r.superBowl
      ? { label: r.label, superBowl: slimMatch(r.superBowl) }
      : { label: r.label, afc: (r.afc || []).map(slimMatch), nfc: (r.nfc || []).map(slimMatch) })),
  };
}

// Líderes de cada categoria. Chamar ANTES de resetSeasonStats/aposentadorias.
function snapshotLeaders(teams, n = 10) {
  const out = {};
  STAT_CATEGORIES.forEach(({ key }) => {
    out[key] = leagueLeaders(teams, key, n, 17).map((r) => ({
      id: r.player.id, name: r.player.name, pos: r.player.pos, teamAbbr: r.teamAbbr, value: r.value,
    }));
  });
  return out;
}

function stripBox(entry) {
  entry.schedule.forEach((wk) => wk.forEach((g) => { delete g.boxScore; }));
  (entry.playoffs?.rounds || []).forEach((r) => {
    [r.superBowl, ...(r.afc || []), ...(r.nfc || [])].forEach((m) => { if (m) delete m.boxScore; });
  });
  entry.boxPruned = true;
}

function pruneArchive(c) {
  const years = Object.keys(c.seasonArchive).map(Number).sort((a, b) => b - a);
  years.slice(KEEP_BOX_SEASONS).forEach((y) => {
    const e = c.seasonArchive[y];
    if (!e.boxPruned) stripBox(e);
  });
}

// Chamar em advanceToNextSeason, depois de c.lastSeasonAwards estar pronto e
// antes de aposentar jogadores / zerar tabela / gerar novo calendário.
function archiveSeason(c, leaders) {
  const t = c.leagueTeams[c.teamAbbr];
  c.seasonArchive = c.seasonArchive || {};
  c.seasonArchive[c.year] = {
    year: c.year,
    myAbbr: c.teamAbbr,
    myRecord: { wins: t.wins, losses: t.losses, ties: t.ties },
    champion: c.playoffs?.champion || null,
    teams: Object.fromEntries(Object.values(c.leagueTeams).map((x) => [x.abbr, {
      abbr: x.abbr, conf: x.conf, div: x.div, wins: x.wins, losses: x.losses, ties: x.ties, pf: x.pf, pa: x.pa,
    }])),
    schedule: slimSchedule(c.schedule),
    playoffs: slimPlayoffs(c.playoffs),
    leaders,
    awards: c.lastSeasonAwards || null,
  };
  pruneArchive(c);
}

export { snapshotLeaders, archiveSeason };
