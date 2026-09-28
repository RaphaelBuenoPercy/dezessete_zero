import { mulberry32, seedFromString, randInt, pick, clamp } from "../lib/rng.js";
import { rosterSlotsFor, SUB_ATTRS } from "../data/rosterSlots.js";
import { TEAM_META, CAP } from "../data/teams.js";
import { makeName } from "../data/names.js";
import { CUSTOM_ROSTERS } from "../customRosters.js";

// Procedural player/roster/league generation, plus the free-agency and
// draft pools drawn from the same generator (see makePlayer).

let PID = Math.floor(Math.random() * 1e9);

function tierRange(tier) {
  if (tier === "star") return [86, 97];
  if (tier === "starter") return [72, 87];
  if (tier === "backup") return [58, 74];
  return [48, 65]; // bench
}

function makePlayer(rng, pos, tier, name) {
  const [lo, hi] = tierRange(tier);
  const ovr = randInt(rng, lo, hi);
  const [a1, a2] = SUB_ATTRS[pos];
  const spread = 8;
  const attrs = {
    [a1]: clamp(ovr + randInt(rng, -spread, spread), 35, 99),
    [a2]: clamp(ovr + randInt(rng, -spread, spread), 35, 99),
  };
  const age = tier === "star" ? randInt(rng, 24, 31) : tier === "bench" ? randInt(rng, 21, 26) : randInt(rng, 22, 32);
  const years = randInt(rng, 1, 4);
  const salary = Math.round((ovr - 45) * (ovr - 45) / 90 * 10) / 10 + (tier === "star" ? randInt(rng,2,8) : 0);
  return {
    id: PID++, name, pos, ovr, attrs, age, years, salary: Math.max(0.8, salary),
    dev: tier === "star" || tier === "bench" ? (age < 26 ? "rising" : age > 30 ? "declining" : "steady") : "steady",
    injuredWeeks: 0, seasonStats: {}, careerStats: {},
    morale: 65, accolades: [], seasonsPlayed: 0, injuryHistory: [], rookieYear: null,
  };
}

// Builds a player from a CUSTOM_ROSTERS entry, filling in anything the
// user didn't specify (overall, attrs, age, name...) so partial overrides
// (e.g. just naming the starting QB) work fine alongside the rest of the
// auto-generated roster.
function makeCustomPlayer(rng, slot, cp) {
  const pos = cp.pos || slot.pos;
  const tier = cp.tier || slot.tier;
  const ovr = cp.ovr ?? randInt(rng, ...tierRange(tier));
  const subAttrs = SUB_ATTRS[pos] || SUB_ATTRS[slot.pos] || ["ARM", "ACC"];
  const [a1, a2] = subAttrs;
  const attrs = {
    [a1]: cp.attrs?.[a1] ?? clamp(ovr + randInt(rng, -8, 8), 35, 99),
    [a2]: cp.attrs?.[a2] ?? clamp(ovr + randInt(rng, -8, 8), 35, 99),
  };
  const age = cp.age ?? randInt(rng, 22, 32);
  const years = cp.years ?? randInt(rng, 1, 4);
  const salary = cp.salary ?? Math.max(0.8, Math.round((ovr - 45) * (ovr - 45) / 90 * 10) / 10);
  return {
    id: PID++, name: cp.name || makeName(rng), pos, ovr, attrs, age, years, salary,
    dev: cp.dev || "steady",
    injuredWeeks: 0, seasonStats: {}, careerStats: {}, slot: slot.key,
    morale: 65, accolades: [], seasonsPlayed: 0, injuryHistory: [], rookieYear: null,
  };
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

function agePlayer(p, rng) {
  const decline = p.age > 30 ? -randInt(rng, 1, 3) : p.age > 27 ? randInt(rng, -1, 1) : randInt(rng, 0, 3);
  p.ovr = clamp(p.ovr + decline, 40, 99);
  Object.keys(p.attrs).forEach((k) => { p.attrs[k] = clamp(p.attrs[k] + decline, 30, 99); });
  p.age += 1;
  p.years = Math.max(0, p.years - 1);
  return p;
}


export { tierRange, makePlayer, makeCustomPlayer, buildRoster, normalizeSalaries,
  buildLeague, circleSchedule, buildSchedule, generateFreeAgents, convertToFreeAgent, generateDraftClass,
  capUsed, playerValue, pickValue, agePlayer };
