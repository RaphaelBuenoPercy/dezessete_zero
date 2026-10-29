// ============================================================
// LÍDERES HISTÓRICOS DA CARREIRA (All-Time Leaders)
//
// career.allTimeLeaders = { passYards: [ {playerId,name,pos,value,isRetired,teamAbbr}, ... ], ... }
// Um Top 100 por categoria, mantido de forma incremental UMA vez por temporada
// (updateAllTimeLeaders, depois de applyCareerRollover) em vez de recalculado a cada render.
// Aposentados ficam congelados na lista com isRetired: true (markRetiredLeaders).
// ============================================================

const TOP_N = 100;

const ALL_TIME_CATEGORIES = [
  { key: "passYards", label: "Jardas aéreas", short: "jds" },
  { key: "passTD", label: "Passes para TD", short: "TD" },
  { key: "rushYards", label: "Jardas terrestres", short: "jds" },
  { key: "rushTD", label: "Corridas para TD", short: "TD" },
  { key: "receptions", label: "Recepções", short: "rec" },
  { key: "receivingYards", label: "Jardas recebidas", short: "jds" },
  { key: "receivingTD", label: "Recepções para TD", short: "TD" },
  { key: "tackles", label: "Tackles", short: "tackles" },
  { key: "sacks", label: "Sacks", short: "sacks" },
  { key: "interceptions", label: "Interceptações", short: "INT" },
  { key: "fgMade", label: "Field goals", short: "FG" },
];
const CATEGORY = Object.fromEntries(ALL_TIME_CATEGORIES.map((c) => [c.key, c]));

// Filtros da tela: grupo de posição -> posições e categorias disponíveis.
const POS_GROUPS = {
  QB: { positions: ["QB"], categories: ["passYards", "passTD"] },
  RB: { positions: ["RB"], categories: ["rushYards", "rushTD", "receptions", "receivingYards"] },
  "WR/TE": { positions: ["WR", "TE"], categories: ["receptions", "receivingYards", "receivingTD"] },
  DEF: { positions: ["DL", "LB", "CB", "S"], categories: ["sacks", "interceptions", "tackles"] },
  K: { positions: ["K"], categories: ["fgMade"] },
};

function newAllTimeLeaders() {
  return Object.fromEntries(ALL_TIME_CATEGORIES.map((c) => [c.key, []]));
}

// Todos os jogadores ativos (elencos + free agents), com o time de cada um.
function forEachActive(c, fn) {
  Object.values(c.leagueTeams).forEach((t) => t.roster.forEach((p) => fn(p, t.abbr)));
  (c.freeAgentPool || []).forEach((p) => fn(p, null));
}
function buildActiveIndex(c) {
  const idx = new Map();
  forEachActive(c, (p, abbr) => idx.set(p.id, { p, teamAbbr: abbr }));
  return idx;
}
function buildTeamsIndex(leagueTeams) {
  const idx = new Map();
  Object.values(leagueTeams).forEach((t) => t.roster.forEach((p) => idx.set(p.id, { p, teamAbbr: t.abbr })));
  return idx;
}
const careerValue = (p, key) => p.careerStats?.[key] || 0;
const liveValue = (p, key) => (p.careerStats?.[key] || 0) + (p.seasonStats?.[key] || 0);

function ensureAllTimeLeaders(c) {
  if (!c.allTimeLeaders) {
    c.allTimeLeaders = newAllTimeLeaders();
    seedFromHallOfFame(c);                          // saves antigos: lendários que já se aposentaram
    updateAllTimeLeaders(c);                        // e o que os ativos já acumularam
  }
  ALL_TIME_CATEGORIES.forEach((k) => { c.allTimeLeaders[k.key] ||= []; });
  return c;
}

// Saves antigos: o Hall da Fama guarda careerStats dos aposentados lendários.
function seedFromHallOfFame(c) {
  (c.hallOfFame || []).forEach((r) => {
    if (r?.id == null || !r.careerStats) return;
    ALL_TIME_CATEGORIES.forEach(({ key }) => {
      const v = r.careerStats[key] || 0;
      if (v > 0) c.allTimeLeaders[key].push({ playerId: r.id, name: r.name, pos: r.pos, value: v, isRetired: true, teamAbbr: r.teamAbbr || null });
    });
  });
  ALL_TIME_CATEGORIES.forEach(({ key }) => { c.allTimeLeaders[key].sort((a, b) => b.value - a.value); c.allTimeLeaders[key] = c.allTimeLeaders[key].slice(0, TOP_N); });
}

// Núcleo: atualiza as listas a partir dos elencos. É o que applyCareerRollover (legacy.js) chama,
// logo depois de somar seasonStats em careerStats. Custo: ~1 passada pelos jogadores por categoria
// + ordenar no máximo ~100 itens.
function updateLeadersFromTeams(leaders, leagueTeams) {
  const idx = buildTeamsIndex(leagueTeams);
  ALL_TIME_CATEGORIES.forEach(({ key }) => {
    const list = leaders[key] || (leaders[key] = []);
    const inList = new Set();
    // 1) quem já está na lista: atualiza o total dos ativos (aposentados ficam congelados)
    list.forEach((e) => {
      const hit = idx.get(e.playerId);
      if (hit) { e.value = Math.max(e.value, careerValue(hit.p, key)); e.name = hit.p.name; e.pos = hit.p.pos; e.teamAbbr = hit.teamAbbr; e.isRetired = false; }
      inList.add(e.playerId);
    });
    list.sort((a, b) => b.value - a.value);
    const cutoff = list.length >= TOP_N ? list[list.length - 1].value : 0;
    // 2) candidatos novos: só entra quem passa do corte
    idx.forEach(({ p, teamAbbr }, id) => {
      if (inList.has(id)) return;
      const v = careerValue(p, key);
      if (v > 0 && v > cutoff) list.push({ playerId: id, name: p.name, pos: p.pos, value: v, isRetired: false, teamAbbr });
    });
    list.sort((a, b) => b.value - a.value);
    leaders[key] = list.slice(0, TOP_N);
  });
}
// Versão para o career inteiro (inclui free agents que ainda têm careerStats).
function updateAllTimeLeaders(c) {
  c.allTimeLeaders ||= newAllTimeLeaders();
  updateLeadersFromTeams(c.allTimeLeaders, c.leagueTeams);
}

// Chamar em retireAndRefreshLeague (offseason.js) com os ids de quem saiu do elenco
// (aposentados ou fim de contrato): viram isRetired: true, mesmo sem Hall da Fama.
function markLeadersRetired(leaders, playerIds) {
  const gone = new Set(playerIds);
  if (!gone.size) return;
  ALL_TIME_CATEGORIES.forEach(({ key }) => {
    (leaders[key] || []).forEach((e) => { if (gone.has(e.playerId)) e.isRetired = true; });
  });
}

// Varredura de segurança (App.jsx, depois da aposentadoria): quem não está mais em nenhum
// elenco/mercado/draft vira isRetired (ex.: free agent que ninguém contratou).
function markRetiredLeaders(c) {
  const active = new Set();
  forEachActive(c, (p) => active.add(p.id));
  (c.draftClass || []).forEach((p) => active.add(p.id));
  ALL_TIME_CATEGORIES.forEach(({ key }) => {
    (c.allTimeLeaders?.[key] || []).forEach((e) => { e.isRetired = !active.has(e.playerId); });
  });
}

// Lista exibida na tela.
//  activeOnly: varre os jogadores ativos (exato, com a temporada em andamento).
//  senão: Top 100 guardado + total ao vivo (careerStats + seasonStats) dos ativos que estão nele.
function getAllTimeList(c, key, { group = null, activeOnly = false, limit = 25, index = null } = {}) {
  const positions = group ? new Set(POS_GROUPS[group].positions) : null;
  const idx = index || buildActiveIndex(c);
  let rows;
  if (activeOnly) {
    rows = [];
    idx.forEach(({ p, teamAbbr }, id) => {
      if (positions && !positions.has(p.pos)) return;
      const v = liveValue(p, key);
      if (v > 0) rows.push({ playerId: id, name: p.name, pos: p.pos, value: v, isRetired: false, teamAbbr });
    });
  } else {
    rows = (c.allTimeLeaders?.[key] || []).filter((e) => !positions || positions.has(e.pos)).map((e) => {
      const hit = e.isRetired ? null : idx.get(e.playerId);
      return hit ? { ...e, value: Math.max(e.value, liveValue(hit.p, key)), teamAbbr: hit.teamAbbr } : e;
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, limit);
}

// Posições do jogador no Top N histórico: [{ key, label, rank, value }]
function allTimeRanksFor(c, player, topN = 10, index = null) {
  const out = [];
  if (!c.allTimeLeaders) return out;
  const idx = index || buildActiveIndex(c);
  ALL_TIME_CATEGORIES.forEach(({ key, label }) => {
    const mine = liveValue(player, key);
    if (mine <= 0) return;
    let ahead = 0;
    (c.allTimeLeaders[key] || []).forEach((e) => {
      if (e.playerId === player.id) return;
      const hit = e.isRetired ? null : idx.get(e.playerId);
      const v = hit ? Math.max(e.value, liveValue(hit.p, key)) : e.value;
      if (v > mine) ahead++;
    });
    if (ahead < topN) out.push({ key, label, rank: ahead + 1, value: mine });
  });
  return out.sort((a, b) => a.rank - b.rank);
}

export { TOP_N, ALL_TIME_CATEGORIES, CATEGORY, POS_GROUPS, newAllTimeLeaders, ensureAllTimeLeaders, updateAllTimeLeaders,
  updateLeadersFromTeams, markLeadersRetired, markRetiredLeaders, buildActiveIndex, getAllTimeList, allTimeRanksFor };
