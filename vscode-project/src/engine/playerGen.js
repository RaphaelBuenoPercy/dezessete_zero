import { mulberry32, seedFromString, randInt, pick, clamp } from "../lib/rng.js";
import { rosterSlotsFor, SUB_ATTRS } from "../data/rosterSlots.js";
import { TEAM_META, CAP } from "../data/teams.js";
import { makeName } from "../data/names.js";
import { CUSTOM_ROSTERS } from "../customRosters.js";
import { generateNickname } from "./nicknames.js";

// Procedural player/roster/league generation, plus the free-agency and
// draft pools drawn from the same generator (see makePlayer).

let PID = Math.floor(Math.random() * 1e9);

function tierRange(tier) {
  if (tier === "star") return [86, 97];
  if (tier === "starter") return [72, 87];
  if (tier === "backup") return [58, 74];
  return [48, 65]; // bench
}

// ============================================================
// OVR BOTTOM-UP: o OVR é a média ponderada dos atributos da posição.
// Pesos em % (cada posição soma 100). Chave ausente no jogador é ignorada
// e os demais pesos são renormalizados.
// ============================================================
const POSITION_WEIGHTS = {
  QB: { THP: 10, STA: 15, MTA: 20, DTA: 15, AWR: 20, MOB: 5, TUP: 15 },
  RB: { SPD: 22, ACC: 18, POW: 20, VIS: 20, CTH: 10, PBK: 10 },
  WR: { SPD: 20, ACC: 15, CTH: 22, RTE: 20, CIT: 15, RBK: 8 },
  TE: { CTH: 18, RBK: 15, STR: 10, RTE: 15, CIT: 14, PBK: 10, ACC: 8, SPD: 10 },
  OL: { PBK: 30, RBK: 30, STR: 15, AWR: 15, AGI: 10 },
  DL: { PMV: 20, FMV: 20, BSH: 20, STR: 15, TKL: 15, AWR: 10 },
  LB: { TKL: 18, PRC: 16, ZCV: 12, BSH: 10, SPD: 10, MCV: 10, FMV: 6, PMV: 6, ACC: 12 },
  CB: { MCV: 22, ZCV: 20, SPD: 18, ACC: 12, PRS: 10, STR: 6, AWR: 12 },
  S: { ZCV: 22, TKL: 14, PRC: 18, SPD: 12, PUR: 12, MCV: 12, ACC: 10 },
  K: { KPW: 40, KAC: 45, CLT: 15 },
  P: { KPW: 45, KAC: 40, TRK: 15 },
};

function computeOvr(pos, attrs) {
  const w = POSITION_WEIGHTS[pos];
  if (!w || !attrs) return 60;
  let sum = 0, tot = 0;
  Object.entries(w).forEach(([k, pct]) => {
    if (attrs[k] != null) { sum += attrs[k] * pct; tot += pct; }
  });
  return tot ? clamp(Math.round(sum / tot), 40, 99) : 60;
}
// Chame depois de qualquer mudança em p.attrs (progressão, lesão grave, etc.).
function recalcOvr(p) { p.ovr = computeOvr(p.pos, p.attrs); return p; }

const ATTR_SPREAD = 8;

// Sorteia os atributos de uma posição. Cada atributo sai de um "talento" do
// tier (faixa de tierRange) ± ATTR_SPREAD — o talento é compartilhado para os
// atributos de um mesmo jogador se correlacionarem (senão a média dos atributos
// colapsaria para o meio da faixa e não existiriam estrelas). Depois 1 atributo
// recebe um bônus e 1 uma penalidade (perfil/arquétipo do jogador).
//   targetOvr: se informado, ajusta os atributos livres até o OVR calculado bater
//   centers:   { ATTR: valor } centro específico por atributo (usado na migração)
//   overrides: { ATTR: valor } atributos fixos (não são alterados)
function rollAttrs(rng, pos, { tier = "starter", targetOvr = null, centers = {}, overrides = {} } = {}) {
  const keys = SUB_ATTRS[pos];
  const [lo, hi] = tierRange(tier);
  const talent = targetOvr ?? randInt(rng, lo, hi);
  const attrs = {};
  keys.forEach((k) => {
    attrs[k] = overrides[k] ?? clamp((centers[k] ?? talent) + randInt(rng, -ATTR_SPREAD, ATTR_SPREAD), 35, 99);
  });
  const free = keys.filter((k) => overrides[k] == null);
  if (free.length >= 3) {
    const strong = pick(rng, free);
    const weak = pick(rng, free.filter((k) => k !== strong));
    attrs[strong] = clamp(attrs[strong] + randInt(rng, 3, 8), 35, 99);
    attrs[weak] = clamp(attrs[weak] - randInt(rng, 3, 8), 35, 99);
  }
  if (targetOvr != null && free.length) {
    for (let i = 0; i < 4; i++) {
      const delta = targetOvr - computeOvr(pos, attrs);
      if (delta === 0) break;
      free.forEach((k) => { attrs[k] = clamp(attrs[k] + delta, 35, 99); });
    }
  }
  return attrs;
}

// Nomes antigos (2 atributos por posição) -> novos atributos que eles "alimentam".
// Usado para migrar saves antigos e para ler customRosters.js escritos no formato velho.
const LEGACY_ATTR_MAP = {
  QB: { ARM: ["THP"], ACC: ["STA", "MTA", "DTA", "TUP"] },
  RB: { SPD: ["SPD", "ACC"], POW: ["POW"] },
  WR: { SPD: ["SPD", "ACC"], HND: ["CTH", "CIT"] },
  TE: { HND: ["CTH", "CIT"], BLK: ["RBK", "PBK", "STR"] },
  OL: { RBK: ["RBK", "STR"], PBK: ["PBK"] },
  DL: { RSH: ["PMV", "FMV"], RUN: ["BSH", "TKL", "STR"] },
  LB: { COV: ["ZCV", "MCV"], RUN: ["TKL", "BSH"] },
  CB: { COV: ["MCV", "ZCV"], SPD: ["SPD", "ACC"] },
  S: { COV: ["ZCV", "MCV"], TKL: ["TKL", "PUR"] },
  K: { POW: ["KPW"], ACC: ["KAC"] },
  P: { POW: ["KPW"], ACC: ["KAC"] },
};
// Separa um objeto attrs em: chaves válidas hoje (overrides) e chaves antigas (centers).
function splitAttrs(pos, given = {}) {
  const valid = new Set(SUB_ATTRS[pos] || []);
  const overrides = {}, centers = {};
  Object.entries(given).forEach(([k, v]) => {
    if (valid.has(k)) overrides[k] = v;
    else (LEGACY_ATTR_MAP[pos]?.[k] || []).forEach((nk) => { centers[nk] = v; });
  });
  return { overrides, centers };
}

function makePlayer(rng, pos, tier, name) {
  const attrs = rollAttrs(rng, pos, { tier });
  const ovr = computeOvr(pos, attrs);
  const age = tier === "star" ? randInt(rng, 24, 31) : tier === "bench" ? randInt(rng, 21, 26) : randInt(rng, 22, 32);
  const years = randInt(rng, 1, 4);
  const salary = Math.round((ovr - 45) * (ovr - 45) / 90 * 10) / 10 + (tier === "star" ? randInt(rng,2,8) : 0);
  return {
    id: PID++, name, pos, ovr, attrs, age, years, salary: Math.max(0.8, salary),
    dev: tier === "star" || tier === "bench" ? (age < 26 ? "rising" : age > 30 ? "declining" : "steady") : "steady",
    injuredWeeks: 0, seasonStats: {}, careerStats: {},
    morale: 65, accolades: [], seasonsPlayed: 0, injuryHistory: [], rookieYear: null,
    nickname: generateNickname(rng, pos, attrs, SUB_ATTRS[pos]),
  };
}

// Builds a player from a CUSTOM_ROSTERS entry, filling in anything the
// user didn't specify (attrs, age, name...) so partial overrides
// (e.g. just naming the starting QB) work fine alongside the rest of the
// auto-generated roster. `cp.attrs` aceita os atributos novos E os antigos
// (ARM, HND...). `cp.ovr`, se vier, é a meta: os atributos não fixados são
// ajustados até o OVR calculado bater; se você fixar atributos demais, o OVR
// final é o calculado a partir deles.
function makeCustomPlayer(rng, slot, cp) {
  const pos = cp.pos || slot.pos;
  const tier = cp.tier || slot.tier;
  const safePos = SUB_ATTRS[pos] ? pos : slot.pos;
  const { overrides, centers } = splitAttrs(safePos, cp.attrs);
  const attrs = rollAttrs(rng, safePos, { tier, targetOvr: cp.ovr ?? null, centers, overrides });
  const ovr = computeOvr(safePos, attrs);
  const age = cp.age ?? randInt(rng, 22, 32);
  const years = cp.years ?? randInt(rng, 1, 4);
  const salary = cp.salary ?? Math.max(0.8, Math.round((ovr - 45) * (ovr - 45) / 90 * 10) / 10);
  return {
    id: PID++, name: cp.name || makeName(rng), pos: safePos, ovr, attrs, age, years, salary,
    dev: cp.dev || "steady",
    injuredWeeks: 0, seasonStats: {}, careerStats: {}, slot: slot.key,
    morale: 65, accolades: [], seasonsPlayed: 0, injuryHistory: [], rookieYear: null,
    nickname: cp.nickname ?? generateNickname(rng, safePos, attrs, SUB_ATTRS[safePos]),
  };
}

// ---------- migração de saves antigos ----------
// Converte um jogador do formato antigo (2 atributos) para o novo, preservando o OVR.
function upgradePlayerAttrs(p) {
  const keys = SUB_ATTRS[p.pos];
  if (!keys || !p.attrs || keys.every((k) => p.attrs[k] != null)) return false;
  const rng = mulberry32(seedFromString("upgrade-" + p.id));
  const { overrides, centers } = splitAttrs(p.pos, p.attrs);
  p.attrs = rollAttrs(rng, p.pos, { targetOvr: p.ovr, centers, overrides });
  return true;
}
// Percorre o career inteiro (elencos, free agents, draft...) e migra todo jogador antigo.
function upgradeCareerPlayers(career) {
  let n = 0;
  const seen = new Set();
  const skip = new Set(["seasonArchive", "news", "schedule"]);
  const walk = (o, d) => {
    if (!o || typeof o !== "object" || d > 6 || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
    if (o.attrs && o.pos && typeof o.ovr === "number") { if (upgradePlayerAttrs(o)) n++; return; }
    Object.keys(o).forEach((k) => { if (!skip.has(k)) walk(o[k], d + 1); });
  };
  walk(career, 0);
  return n;
}

function buildRoster(team) {
  const rng = mulberry32(seedFromString(team.abbr + "-roster"));
  const custom = CUSTOM_ROSTERS[team.abbr];
  const scheme = custom?.scheme || (rng() < 0.5 ? "4-3" : "3-4");
  const slots = rosterSlotsFor(scheme);
  const customBySlot = {};
  (custom?.players || []).forEach((cp) => { if (cp.slot) customBySlot[cp.slot] = cp; });
  const roster = slots.map((slot) => {
    const cp = customBySlot[slot.key];
    if (cp) return makeCustomPlayer(rng, slot, cp);
    let name = null;
    if (slot.key === "QB1" && team.stars.QB) name = team.stars.QB;
    if (slot.key === "RB1" && team.stars.RB) name = team.stars.RB;
    if (slot.key === "WR1" && team.stars.WR) name = team.stars.WR;
    if (slot.key === "DE1" && team.stars.DEF) name = team.stars.DEF;
    if (!name) name = makeName(rng);
    const p = makePlayer(rng, slot.pos, slot.tier, name);
    p.slot = slot.key;
    return p;
  });
  normalizeSalaries(roster, rng);
  return { roster, scheme };
}

// Scale every contract on the roster so the team's total payroll lands under the cap,
// with a bit of team-to-team variance instead of everyone spending to the exact dollar.
function normalizeSalaries(roster, rng) {
  const total = roster.reduce((s, p) => s + p.salary, 0);
  const target = CAP * (0.82 + rng() * 0.14);
  const scale = total > 0 ? target / total : 1;
  roster.forEach((p) => { p.salary = Math.max(0.5, Math.round(p.salary * scale * 10) / 10); });
}

function buildLeague() {
  const teams = {};
  TEAM_META.forEach((meta) => {
    const { roster, scheme } = buildRoster(meta);
    teams[meta.abbr] = {
      ...meta,
      roster, scheme,
      wins: 0, losses: 0, ties: 0, pf: 0, pa: 0,
      ownerConfidence: 65, fanSupport: 60,
      picks: [1, 2, 3, 4, 5, 6, 7].map((r) => ({ round: r, id: `${meta.abbr}-${r}-init` })),
    };
  });
  return teams;
}

function circleSchedule(abbrs) {
  // Standard circle-method round robin. n teams -> n-1 rounds, each with n/2 games.
  const arr = [...abbrs];
  const n = arr.length;
  const rounds = [];
  const fixed = arr[0];
  let rest = arr.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const left = [fixed, ...rest.slice(0, n / 2 - 1)];
    const right = rest.slice(n / 2 - 1).reverse();
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      const home = r % 2 === 0 ? left[i] : right[i];
      const away = r % 2 === 0 ? right[i] : left[i];
      games.push({ home, away });
    }
    rounds.push(games);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}

function buildSchedule(teams) {
  const abbrs = Object.keys(teams);
  const rng = mulberry32(seedFromString("schedule-" + abbrs.length));
  const shuffled = [...abbrs].sort(() => rng() - 0.5);
  const rounds = circleSchedule(shuffled);
  return rounds.slice(0, 17); // 17-week regular season
}


/* ============================================================
   FREE AGENCY / DRAFT / TRADES / OFFSEASON
   ============================================================ */

function generateFreeAgents(year) {
  const rng = mulberry32(seedFromString("fa-" + year));
  const pool = [];
  // Guarantee every position group has at least a little depth on the
  // market — a fully random draw can (and did) leave whole positions like
  // TE or K completely absent some years, which made the AI's free-agency
  // logic starve for candidates. Then top up to a healthy pool size.
  const baseline = { QB: 1, RB: 2, WR: 3, TE: 2, OL: 3, DL: 3, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
  Object.entries(baseline).forEach(([pos, n]) => {
    for (let i = 0; i < n; i++) pool.push(makeFreeAgent(rng, pos));
  });
  const positions = ["QB","RB","WR","WR","TE","OL","OL","DL","DL","LB","CB","CB","S","K"];
  while (pool.length < 34) pool.push(makeFreeAgent(rng, pick(rng, positions)));
  return pool;
}

function makeFreeAgent(rng, pos) {
  const tier = rng() < 0.1 ? "star" : rng() < 0.5 ? "starter" : "backup";
  const p = makePlayer(rng, pos, tier, makeName(rng));
  p.slot = null;
  p.askingYears = randInt(rng, 1, 3);
  p.climatePref = pickClimatePref(rng);
  p.homeTeam = rng() < 0.25 ? pick(rng, TEAM_META).abbr : null;
  p.priorities = generateFreeAgentPriorities(rng, p);
  return p;
}

// What a free agent cares about when weighing offers, as normalized weights
// (they add up to 1). Archetypes nudge the mix: stars chase money/spotlight,
// veterans chase rings, young players chase snaps.
function generateFreeAgentPriorities(rng, player) {
  const w = {
    money: 0.6 + rng() * 0.8,
    winning: 0.3 + rng() * 0.8,
    playingTime: 0.3 + rng() * 0.8,
    climate: rng() * 0.6,
    fanSupport: rng() * 0.6,
    market: rng() * 0.6,
  };
  if (player.ovr >= 85) { w.money *= 1.3; w.market *= 1.4; }
  if (player.age >= 30) { w.winning *= 1.4; w.playingTime *= 0.6; }
  if (player.age <= 24) { w.playingTime *= 1.5; w.money *= 0.85; }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach((k) => { w[k] = w[k] / total; });
  return w;
}

// Most players don't have a strong climate preference — "any" is deliberately
// the most common draw.
function pickClimatePref(rng) { return pick(rng, ["warm", "cold", "mild", "any", "any", "any"]); }


// Turns a player who just left a roster (contract expired, released) into
// a proper free agent: same person, but with the market-facing fields the
// free-agency engine needs (asking term, climate taste, priorities). Their
// former club is remembered, and there's a decent chance they feel a
// hometown pull back toward it.
function convertToFreeAgent(rng, player, formerTeam) {
  const fa = { ...player, slot: null };
  fa.askingYears = randInt(rng, 1, 3);
  fa.climatePref = pickClimatePref(rng);
  fa.formerTeam = formerTeam;
  fa.homeTeam = rng() < 0.5 ? formerTeam : (rng() < 0.2 ? pick(rng, TEAM_META).abbr : null);
  fa.priorities = generateFreeAgentPriorities(rng, fa);
  return fa;
}

function generateDraftClass(year) {
  const rng = mulberry32(seedFromString("draft-" + year));
  // Weighted so K/P are rare late-round prospects, matching real draft frequency.
  const positions = ["QB","QB","RB","RB","RB","WR","WR","WR","WR","TE","TE",
    "OL","OL","OL","OL","DL","DL","DL","DL","LB","LB","LB","CB","CB","CB","S","S"];
  const kickerSlots = new Set([210, 217]); // only 2 specialists in the whole class, both very late
  const prospects = [];
  for (let i = 0; i < 224; i++) {
    const round = Math.min(7, Math.floor(i / 32) + 1);
    let pos = kickerSlots.has(i) ? pick(rng, ["K", "P"]) : pick(rng, positions);
    let tier = round === 1 ? "star" : round <= 3 ? "starter" : round <= 5 ? "backup" : "bench";
    if (pos === "K" || pos === "P") tier = "backup"; // specialists never grade out as "star" prospects
    const p = makePlayer(rng, pos, tier, makeName(rng));
    p.age = randInt(rng, 21, 23);
    p.years = 4;
    p.salary = Math.max(0.8, Math.round((5 - round) * 1.4 * 10) / 10);
    p.slot = null;
    p.draftRound = round;
    p.rookieYear = year;
    prospects.push(p);
  }
  // sort roughly by quality with noise so draft order isn't perfectly ovr-sorted
  return prospects.sort((a, b) => (b.ovr + randInt(rng,-4,4)) - (a.ovr + randInt(rng,-4,4)));
}

function capUsed(roster) { return roster.reduce((s, p) => s + p.salary, 0); }

function playerValue(p) {
  const ageFactor = p.age < 27 ? 1.15 : p.age < 30 ? 1 : p.age < 33 ? 0.8 : 0.55;
  return p.ovr * ageFactor;
}
function pickValue(round) { return [0, 30, 18, 11, 7, 4.5, 3, 2][round] || 1; }

// Atributos físicos caem mais rápido depois dos 30; os mentais seguram (ou até sobem).
const PHYSICAL_ATTRS = new Set(["SPD", "ACC", "AGI", "STR", "MOB", "THP", "POW", "PMV", "FMV", "PUR", "KPW"]);
function agePlayer(p, rng) {
  upgradePlayerAttrs(p); // segurança: save antigo que ainda não foi migrado
  const decline = p.age > 30 ? -randInt(rng, 1, 3) : p.age > 27 ? randInt(rng, -1, 1) : randInt(rng, 0, 3);
  Object.keys(p.attrs).forEach((k) => {
    let d = decline;
    if (p.age > 29) d += PHYSICAL_ATTRS.has(k) ? -randInt(rng, 0, 1) : randInt(rng, 0, 1);
    else d += randInt(rng, -1, 1);
    p.attrs[k] = clamp(p.attrs[k] + d, 30, 99);
  });
  recalcOvr(p);
  p.age += 1;
  p.years = Math.max(0, p.years - 1);
  return p;
}


export { POSITION_WEIGHTS, computeOvr, recalcOvr, rollAttrs, upgradePlayerAttrs, upgradeCareerPlayers,
  tierRange, makePlayer, makeCustomPlayer, buildRoster, normalizeSalaries,
  buildLeague, circleSchedule, buildSchedule, generateFreeAgents, convertToFreeAgent, generateDraftClass,
  capUsed, playerValue, pickValue, agePlayer };
