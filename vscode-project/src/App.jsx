import React, { useState, useEffect, useMemo, useCallback } from "react";
import { CUSTOM_ROSTERS } from "./customRosters.js";

/* ============================================================
   CONSTANTS & DATA
   ============================================================ */

const CAP = 260; // team salary cap, $M (simplified, roughly current-era scale)

const TEAM_META = [
  { abbr:"BUF", city:"Buffalo", name:"Bills", conf:"AFC", div:"East", c1:"#00338D", c2:"#C60C30", stars:{QB:"Josh Allen",RB:"James Cook",WR:"Khalil Shakir",DEF:"Matt Milano"} },
  { abbr:"MIA", city:"Miami", name:"Dolphins", conf:"AFC", div:"East", c1:"#008E97", c2:"#F58220", stars:{QB:"Tua Tagovailoa",RB:"De'Von Achane",WR:"Tyreek Hill",DEF:"Jalen Ramsey"} },
  { abbr:"NE", city:"New England", name:"Patriots", conf:"AFC", div:"East", c1:"#002244", c2:"#C60C30", stars:{QB:"Drake Maye",RB:"Rhamondre Stevenson",WR:"Stefon Diggs",DEF:"Christian Gonzalez"} },
  { abbr:"NYJ", city:"New York", name:"Jets", conf:"AFC", div:"East", c1:"#125740", c2:"#000000", stars:{QB:"Justin Fields",RB:"Breece Hall",WR:"Garrett Wilson",DEF:"Sauce Gardner"} },
  { abbr:"BAL", city:"Baltimore", name:"Ravens", conf:"AFC", div:"North", c1:"#241773", c2:"#9E7C0C", stars:{QB:"Lamar Jackson",RB:"Derrick Henry",WR:"Zay Flowers",DEF:"Roquan Smith"} },
  { abbr:"CIN", city:"Cincinnati", name:"Bengals", conf:"AFC", div:"North", c1:"#FB4F14", c2:"#000000", stars:{QB:"Joe Burrow",RB:"Chase Brown",WR:"Ja'Marr Chase",DEF:"Trey Hendrickson"} },
  { abbr:"CLE", city:"Cleveland", name:"Browns", conf:"AFC", div:"North", c1:"#311D00", c2:"#FF3C00", stars:{QB:"Dillon Gabriel",RB:"Quinshon Judkins",WR:"Jerry Jeudy",DEF:"Myles Garrett"} },
  { abbr:"PIT", city:"Pittsburgh", name:"Steelers", conf:"AFC", div:"North", c1:"#000000", c2:"#FFB612", stars:{QB:"Aaron Rodgers",RB:"Jaylen Warren",WR:"DK Metcalf",DEF:"T.J. Watt"} },
  { abbr:"HOU", city:"Houston", name:"Texans", conf:"AFC", div:"South", c1:"#03202F", c2:"#A71930", stars:{QB:"C.J. Stroud",RB:"Joe Mixon",WR:"Nico Collins",DEF:"Will Anderson Jr."} },
  { abbr:"IND", city:"Indianapolis", name:"Colts", conf:"AFC", div:"South", c1:"#002C5F", c2:"#A2AAAD", stars:{QB:"Daniel Jones",RB:"Jonathan Taylor",WR:"Michael Pittman Jr.",DEF:"Kwity Paye"} },
  { abbr:"JAX", city:"Jacksonville", name:"Jaguars", conf:"AFC", div:"South", c1:"#006778", c2:"#D7A22A", stars:{QB:"Trevor Lawrence",RB:"Travis Etienne",WR:"Brian Thomas Jr.",DEF:"Josh Hines-Allen"} },
  { abbr:"TEN", city:"Tennessee", name:"Titans", conf:"AFC", div:"South", c1:"#4B92DB", c2:"#0C2340", stars:{QB:"Cam Ward",RB:"Tony Pollard",WR:"Calvin Ridley",DEF:"Jeffery Simmons"} },
  { abbr:"KC", city:"Kansas City", name:"Chiefs", conf:"AFC", div:"West", c1:"#E31837", c2:"#FFB81C", stars:{QB:"Patrick Mahomes",RB:"Isiah Pacheco",WR:"Xavier Worthy",DEF:"Chris Jones"} },
  { abbr:"LAC", city:"Los Angeles", name:"Chargers", conf:"AFC", div:"West", c1:"#0080C6", c2:"#FFC20E", stars:{QB:"Justin Herbert",RB:"Omarion Hampton",WR:"Ladd McConkey",DEF:"Khalil Mack"} },
  { abbr:"DEN", city:"Denver", name:"Broncos", conf:"AFC", div:"West", c1:"#FB4F14", c2:"#002244", stars:{QB:"Bo Nix",RB:"J.K. Dobbins",WR:"Courtland Sutton",DEF:"Patrick Surtain II"} },
  { abbr:"LV", city:"Las Vegas", name:"Raiders", conf:"AFC", div:"West", c1:"#000000", c2:"#A5ACAF", stars:{QB:"Geno Smith",RB:"Ashton Jeanty",WR:"Jakobi Meyers",DEF:"Maxx Crosby"} },
  { abbr:"DAL", city:"Dallas", name:"Cowboys", conf:"NFC", div:"East", c1:"#041E42", c2:"#869397", stars:{QB:"Dak Prescott",RB:"Javonte Williams",WR:"CeeDee Lamb",DEF:"DaRon Bland"} },
  { abbr:"PHI", city:"Philadelphia", name:"Eagles", conf:"NFC", div:"East", c1:"#004C54", c2:"#A5ACAF", stars:{QB:"Jalen Hurts",RB:"Saquon Barkley",WR:"A.J. Brown",DEF:"Zack Baun"} },
  { abbr:"NYG", city:"New York", name:"Giants", conf:"NFC", div:"East", c1:"#0B2265", c2:"#A71930", stars:{QB:"Jaxson Dart",RB:"Tyrone Tracy Jr.",WR:"Malik Nabers",DEF:"Brian Burns"} },
  { abbr:"WAS", city:"Washington", name:"Commanders", conf:"NFC", div:"East", c1:"#5A1414", c2:"#FFB612", stars:{QB:"Jayden Daniels",RB:"Austin Ekeler",WR:"Terry McLaurin",DEF:"Frankie Luvu"} },
  { abbr:"DET", city:"Detroit", name:"Lions", conf:"NFC", div:"North", c1:"#0076B6", c2:"#B0B7BC", stars:{QB:"Jared Goff",RB:"Jahmyr Gibbs",WR:"Amon-Ra St. Brown",DEF:"Aidan Hutchinson"} },
  { abbr:"GB", city:"Green Bay", name:"Packers", conf:"NFC", div:"North", c1:"#203731", c2:"#FFB612", stars:{QB:"Jordan Love",RB:"Josh Jacobs",WR:"Jayden Reed",DEF:"Micah Parsons"} },
  { abbr:"MIN", city:"Minnesota", name:"Vikings", conf:"NFC", div:"North", c1:"#4F2683", c2:"#FFC62F", stars:{QB:"J.J. McCarthy",RB:"Aaron Jones",WR:"Justin Jefferson",DEF:"Andrew Van Ginkel"} },
  { abbr:"CHI", city:"Chicago", name:"Bears", conf:"NFC", div:"North", c1:"#0B162A", c2:"#C83803", stars:{QB:"Caleb Williams",RB:"D'Andre Swift",WR:"DJ Moore",DEF:"Montez Sweat"} },
  { abbr:"TB", city:"Tampa Bay", name:"Buccaneers", conf:"NFC", div:"South", c1:"#D50A0A", c2:"#34302B", stars:{QB:"Baker Mayfield",RB:"Bucky Irving",WR:"Mike Evans",DEF:"Vita Vea"} },
  { abbr:"ATL", city:"Atlanta", name:"Falcons", conf:"NFC", div:"South", c1:"#A71930", c2:"#000000", stars:{QB:"Michael Penix Jr.",RB:"Bijan Robinson",WR:"Drake London",DEF:"Jessie Bates III"} },
  { abbr:"CAR", city:"Carolina", name:"Panthers", conf:"NFC", div:"South", c1:"#0085CA", c2:"#101820", stars:{QB:"Bryce Young",RB:"Chuba Hubbard",WR:"Xavier Legette",DEF:"Derrick Brown"} },
  { abbr:"NO", city:"New Orleans", name:"Saints", conf:"NFC", div:"South", c1:"#D3BC8D", c2:"#101820", stars:{QB:"Tyler Shough",RB:"Alvin Kamara",WR:"Chris Olave",DEF:"Cameron Jordan"} },
  { abbr:"SF", city:"San Francisco", name:"49ers", conf:"NFC", div:"West", c1:"#AA0000", c2:"#B3995D", stars:{QB:"Brock Purdy",RB:"Christian McCaffrey",WR:"Ricky Pearsall",DEF:"Fred Warner"} },
  { abbr:"SEA", city:"Seattle", name:"Seahawks", conf:"NFC", div:"West", c1:"#002244", c2:"#69BE28", stars:{QB:"Sam Darnold",RB:"Kenneth Walker III",WR:"Jaxon Smith-Njigba",DEF:"Leonard Williams"} },
  { abbr:"LAR", city:"Los Angeles", name:"Rams", conf:"NFC", div:"West", c1:"#003594", c2:"#FFA300", stars:{QB:"Matthew Stafford",RB:"Kyren Williams",WR:"Puka Nacua",DEF:"Jared Verse"} },
  { abbr:"ARI", city:"Arizona", name:"Cardinals", conf:"NFC", div:"West", c1:"#97233F", c2:"#000000", stars:{QB:"Kyler Murray",RB:"James Conner",WR:"Marvin Harrison Jr.",DEF:"Budda Baker"} },
];

const FIXED_SLOTS = [
  { key:"QB1", pos:"QB", tier:"star" }, { key:"QB2", pos:"QB", tier:"backup" },
  { key:"RB1", pos:"RB", tier:"star" }, { key:"RB2", pos:"RB", tier:"backup" },
  { key:"WR1", pos:"WR", tier:"star" }, { key:"WR2", pos:"WR", tier:"starter" }, { key:"WR3", pos:"WR", tier:"backup" },
  { key:"TE1", pos:"TE", tier:"starter" },
  { key:"LT", pos:"OL", tier:"starter" }, { key:"LG", pos:"OL", tier:"starter" }, { key:"C", pos:"OL", tier:"starter" },
  { key:"RG", pos:"OL", tier:"starter" }, { key:"RT", pos:"OL", tier:"starter" },
  { key:"CB1", pos:"CB", tier:"starter" }, { key:"CB2", pos:"CB", tier:"starter" }, { key:"CB3", pos:"CB", tier:"starter" },
  { key:"S1", pos:"S", tier:"starter" }, { key:"S2", pos:"S", tier:"starter" },
  { key:"K1", pos:"K", tier:"starter" }, { key:"P1", pos:"P", tier:"starter" },
  { key:"BEN1", pos:"WR", tier:"bench" }, { key:"BEN2", pos:"RB", tier:"bench" },
  { key:"BEN3", pos:"OL", tier:"bench" }, { key:"BEN4", pos:"CB", tier:"bench" }, { key:"BEN5", pos:"LB", tier:"bench" },
];

// Front seven depends on the team's scheme: 4-3 runs 4 down linemen + 3 linebackers,
// 3-4 runs 3 down linemen (2 DE + a nose tackle) + 4 linebackers (two of them edge rushers).
function schemeSlots(scheme) {
  if (scheme === "3-4") {
    return [
      { key:"DE1", pos:"DL", tier:"star" }, { key:"DE2", pos:"DL", tier:"starter" }, { key:"NT1", pos:"DL", tier:"starter" },
      { key:"LB1", pos:"LB", tier:"starter" }, { key:"LB2", pos:"LB", tier:"starter" },
      { key:"LB3", pos:"LB", tier:"starter" }, { key:"LB4", pos:"LB", tier:"starter" },
    ];
  }
  return [
    { key:"DE1", pos:"DL", tier:"star" }, { key:"DE2", pos:"DL", tier:"starter" },
    { key:"DT1", pos:"DL", tier:"starter" }, { key:"DT2", pos:"DL", tier:"starter" },
    { key:"LB1", pos:"LB", tier:"starter" }, { key:"LB2", pos:"LB", tier:"starter" }, { key:"LB3", pos:"LB", tier:"starter" },
  ];
}
function rosterSlotsFor(scheme) { return [...FIXED_SLOTS, ...schemeSlots(scheme)]; }
const ROSTER_SLOTS = rosterSlotsFor("4-3"); // default shape, used by generic helpers (retirement, etc.)

const SUB_ATTRS = {
  QB:["ARM","ACC"], RB:["SPD","POW"], WR:["SPD","HND"], TE:["HND","BLK"],
  OL:["RBK","PBK"], DL:["RSH","RUN"], LB:["COV","RUN"], CB:["COV","SPD"],
  S:["COV","TKL"], K:["POW","ACC"], P:["POW","ACC"],
};


const FIRST_NAMES = ["Marcus","Deshaun","Cole","Trent","Jalen","Xavier","Bryce","Elijah","Dante","Malik",
  "Tyler","Isaiah","Cameron","Jordan","Devin","Antoine","Reggie","Sean","Kaden","Miles",
  "Andre","Damon","Julian","Corey","Nate","Grant","Wesley","Omari","Leo","Vince",
  "Darius","Colton","Emmett","Gabe","Rashad","Tre","Kobe","Zion","Blake","Hunter"];
const LAST_NAMES = ["Whitfield","Sanders","Brooks","Marsh","Coleman","Reyes","Osei","Booker","Lindqvist","Patterson",
  "Coburn","Vance","Delgado","Harmon","Ashford","Kowalski","Odom","Fuller","Marek","Sinclair",
  "Dunlap","Chavez","Prentiss","Boykin","Larkin","McAdams","Renner","Talbot","Osborne","Kellerman",
  "Hargrove","Blevins","Castillo","Nix","Winslow","Abara","Dietrich","Solano","Kirkland","Vasquez"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return h;
}
function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
let PID = Math.floor(Math.random() * 1e9);

function makeName(rng) { return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`; }

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

export { TEAM_META, ROSTER_SLOTS, SUB_ATTRS, mulberry32, seedFromString, randInt, pick, clamp,
  makeName, makePlayer, buildRoster, buildLeague, buildSchedule, CAP };

/* ============================================================
   RATINGS HELPERS
   ============================================================ */

function slotPlayer(roster, key) { return roster.find((p) => p.slot === key) || roster.find((p) => p.pos === key); }
function activePlayer(roster, key) {
  const p = slotPlayer(roster, key);
  if (p && p.injuredWeeks > 0) {
    const backup = roster.find((q) => q.pos === p.pos && q.id !== p.id && q.injuredWeeks === 0);
    if (backup) return backup;
  }
  return p;
}

function posAvg(roster, pos, attrKey) {
  const players = roster.filter((p) => p.pos === pos);
  if (!players.length) return 60;
  let sum = 0, wsum = 0;
  players.forEach((p) => {
    const w = p.injuredWeeks > 0 ? 0.5 : 1;
    const val = attrKey ? (p.attrs[attrKey] ?? p.ovr) : p.ovr;
    sum += val * w; wsum += w;
  });
  return sum / wsum;
}

function offenseRating(roster, type, rusher) {
  const qb = activePlayer(roster, "QB1");
  const rb = rusher || activePlayer(roster, "RB1");
  const wr1 = activePlayer(roster, "WR1"), wr2 = activePlayer(roster, "WR2");
  const te = activePlayer(roster, "TE1");
  if (type === "pass") return (qb.ovr * 1.4 + wr1.ovr + wr2.ovr * 0.7 + te.ovr * 0.5 + posAvg(roster, "OL", "PBK")) / 4.6;
  return (rb.ovr * 1.3 + posAvg(roster, "OL", "RBK") * 1.2 + te.attrs.BLK * 0.5) / 3;
}
function defenseRating(roster, type) {
  const s1 = activePlayer(roster, "S1");
  const dlRSH = posAvg(roster, "DL", "RSH"), dlRUN = posAvg(roster, "DL", "RUN");
  const lbCOV = posAvg(roster, "LB", "COV"), lbRUN = posAvg(roster, "LB", "RUN");
  const cbCOV = posAvg(roster, "CB", "COV");
  if (type === "pass") return (cbCOV * 2.2 + s1.attrs.COV + dlRSH * 0.9 + lbCOV * 0.5) / 4.6;
  return (dlRUN * 1.2 + lbRUN * 2 + s1.attrs.TKL * 0.5) / 3.7;
}
function teamOverall(roster) {
  const w = { QB: 3, RB: 1.4, WR: 1.2, TE: 0.8, OL: 1.6, DL: 1.6, LB: 1.2, CB: 1.3, S: 1.1, K: 0.4, P: 0.3 };
  let sum = 0, tot = 0;
  roster.forEach((p) => { const wt = w[p.pos] || 0.5; sum += p.ovr * wt; tot += wt; });
  return sum / tot;
}

/* ============================================================
   PLAY-BY-PLAY GAME SIMULATION
   ============================================================ */

function fmtClock(sec) { const s = Math.max(0, Math.round(sec)); const m = Math.floor(s / 60), r = s % 60; return `${m}:${r.toString().padStart(2, "0")}`; }

function statAdd(player, key, val) {
  if (!player) return;
  if (!player.seasonStats) player.seasonStats = {};
  player.seasonStats[key] = (player.seasonStats[key] || 0) + val;
}

// Realistic tackle distribution: LBs and the starting strong safety see the
// most run-support snaps, corners see the fewest. The "anchor" starters
// (LB1/S1) get an extra bump so a single defender usually emerges as the
// game's tackle leader (~12-14), instead of tackles spreading flat across
// the whole defense.
function tackleWeight(p) {
  const base = (p.attrs?.TKL || p.attrs?.RUN || p.attrs?.COV || p.ovr || 60) / 70;
  let posMult = p.pos === "LB" ? 2.0 : p.pos === "S" ? 1.5 : p.pos === "CB" ? 0.15 : 0.65; // DL default
  if (p.slot === "LB1" || p.slot === "S1") posMult *= 2.6;
  return base * posMult;
}

// Snapshot a roster's cumulative season stats before simming a game, then
// diff afterward, so we can store a self-contained per-game box score
// without touching how statAdd accumulates season totals.
function snapshotRosterStats(roster) {
  const snap = {};
  roster.forEach((p) => { snap[p.id] = { ...(p.seasonStats || {}) }; });
  return snap;
}
function diffRosterStats(roster, before) {
  const out = [];
  roster.forEach((p) => {
    const b = before[p.id] || {};
    const a = p.seasonStats || {};
    const stats = {};
    let any = false;
    Object.keys(a).forEach((k) => {
      const d = (a[k] || 0) - (b[k] || 0);
      if (d) { stats[k] = d; any = true; }
    });
    if (any) out.push({ id: p.id, name: p.name, pos: p.pos, slot: p.slot, stats });
  });
  return out;
}

function pickW(rng, arr, weightFn) {
  const pool = arr.filter(Boolean);
  if (!pool.length) return null;
  const total = pool.reduce((s, p) => s + Math.max(1, weightFn(p)), 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= Math.max(1, weightFn(p));
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

// ============================================================
// PLAYBOOK: route concepts + O-line/D-line pass-protection matchups
// ============================================================
// Route concepts assign a specific receiver alignment (X = WR1, Z = WR2,
// slot = WR3, Y = TE1, checkdown = RB1) against a specific defender
// (CB1/CB2/CB3 on the outside/slot corners, S1/S2 at safety, LB2 "SAM" and
// LB3 "WILL" underneath), instead of picking a random receiver vs a random
// defensive back. Depth tiers (short/medium/deep) trade completion% for
// upside, and play-calling leans on the tier that fits the down & distance.
const ROUTE_CONCEPTS = [
  { name: "slant pro X", targetSlot: "WR1", defenderSlot: "CB1", depth: "short", dir: "esquerda", baseYards: 6, baseComplete: 0.72, baseInt: 0.02, varLow: -3, varHigh: 7, bigPlayChance: 0.03 },
  { name: "bola curta pro Z", targetSlot: "WR2", defenderSlot: "CB2", depth: "short", dir: "direita", baseYards: 5, baseComplete: 0.73, baseInt: 0.018, varLow: -3, varHigh: 6, bigPlayChance: 0.02 },
  { name: "drag pro slot", targetSlot: "WR3", defenderSlot: "CB3", depth: "short", dir: "meio", baseYards: 5, baseComplete: 0.75, baseInt: 0.015, varLow: -2, varHigh: 6, bigPlayChance: 0.02 },
  { name: "flat pro Y", targetSlot: "TE1", defenderSlot: "LB2", depth: "short", dir: "direita", baseYards: 5, baseComplete: 0.76, baseInt: 0.01, varLow: -2, varHigh: 5, bigPlayChance: 0.015 },
  { name: "checkdown pro RB", targetSlot: "RB1", defenderSlot: "LB3", depth: "short", dir: "meio", baseYards: 4, baseComplete: 0.8, baseInt: 0.008, varLow: -3, varHigh: 5, bigPlayChance: 0.015 },
  { name: "comeback pro Z", targetSlot: "WR2", defenderSlot: "CB2", depth: "medium", dir: "direita", baseYards: 10, baseComplete: 0.6, baseInt: 0.04, varLow: -4, varHigh: 8, bigPlayChance: 0.04 },
  { name: "out pro X", targetSlot: "WR1", defenderSlot: "CB1", depth: "medium", dir: "esquerda", baseYards: 9, baseComplete: 0.62, baseInt: 0.035, varLow: -4, varHigh: 8, bigPlayChance: 0.035 },
  { name: "seam pro Y", targetSlot: "TE1", defenderSlot: "S2", depth: "medium", dir: "direita", baseYards: 12, baseComplete: 0.56, baseInt: 0.045, varLow: -4, varHigh: 10, bigPlayChance: 0.05 },
  { name: "post pro X", targetSlot: "WR1", defenderSlot: "S1", depth: "deep", dir: "meio", baseYards: 18, baseComplete: 0.46, baseInt: 0.07, varLow: -6, varHigh: 14, bigPlayChance: 0.08 },
  { name: "bomba (go) pro Z", targetSlot: "WR2", defenderSlot: "CB2", depth: "deep", dir: "direita", baseYards: 22, baseComplete: 0.4, baseInt: 0.08, varLow: -8, varHigh: 18, bigPlayChance: 0.1 },
];

// Run gaps: purely a flavor/visual layer (which side of the line the back
// hits) laid on top of the already-tuned yardage formula below, so the
// mini-field has a direction to draw without re-touching the calibrated ypc.
const RUN_GAPS = [
  { dir: "esquerda", label: "por fora à esquerda" },
  { dir: "esquerda", label: "entre guarda e tackle esquerdo" },
  { dir: "meio", label: "pelo meio" },
  { dir: "meio", label: "pelo meio" },
  { dir: "direita", label: "entre guarda e tackle direito" },
  { dir: "direita", label: "por fora à direita" },
];

function pickRouteConcept(rng, down, distance, tendO, excludeRB, personnel) {
  const aggressive = tendO?.aggressive ?? 0.5;
  const info = PERSONNEL_INFO[personnel] || PERSONNEL_INFO["11"];
  let pool = ROUTE_CONCEPTS;
  if (excludeRB) pool = pool.filter((c) => c.targetSlot !== "RB1");
  if (!info.hasTE) pool = pool.filter((c) => c.targetSlot !== "TE1");
  if (!info.hasSlot) pool = pool.filter((c) => c.targetSlot !== "WR3");
  if (!pool.length) pool = ROUTE_CONCEPTS.filter((c) => c.targetSlot === "WR1" || c.targetSlot === "WR2");
  return pickW(rng, pool, (c) => {
    let w = 1;
    if (down >= 3 && distance > 7) w *= c.depth === "deep" ? 2.2 : c.depth === "medium" ? 1.6 : 0.5;
    else if (distance <= 3) w *= c.depth === "short" ? 1.8 : 0.6;
    if (c.depth === "deep") w *= 0.55 + aggressive * 0.9;
    return w;
  });
}

// Individual O-line vs D-line matchups (both tackles on the edge, plus one
// interior lineman vs the best interior rusher) decide whether the QB gets a
// clean pocket, a hurry, a QB hit, or gets sacked — and who gets credit.
// A SAM/WILL blitz (more likely from an aggressive defensive tendency, and
// on passing downs) adds a 4th rush lane picked up by the RB instead of a
// lineman — backs are much weaker blockers, so blitzes are a real source of
// pressure rather than just a coin flip.
function passProtection(offRoster, defRoster, tendD, down, distance, personnel, empty, rng) {
  const rt = slotPlayer(offRoster, "RT"), lt = slotPlayer(offRoster, "LT");
  const interiorOL = [slotPlayer(offRoster, "LG"), slotPlayer(offRoster, "C"), slotPlayer(offRoster, "RG")].filter(Boolean);
  const de1 = activePlayer(defRoster, "DE1"), de2 = activePlayer(defRoster, "DE2");
  const interiorDL = defRoster.filter((p) => p.pos === "DL" && p.slot !== "DE1" && p.slot !== "DE2" && !p.slot?.startsWith("BEN"));
  const matchups = [
    { blocker: rt, rusher: de1, edge: "lado direito" },
    { blocker: lt, rusher: de2, edge: "lado esquerdo" },
    { blocker: pick(rng, interiorOL.length ? interiorOL : [rt]), rusher: interiorDL.length ? pick(rng, interiorDL) : de1, edge: "por dentro" },
  ].filter((m) => m.blocker && m.rusher);

  let rbBlocking = false, blitzer = null;
  const sam = activePlayer(defRoster, "LB2"), will = activePlayer(defRoster, "LB3");
  const aggressive = tendD?.aggressive ?? 0.5;
  const blitzPickupMult = PERSONNEL_INFO[personnel]?.blitzPickupMult ?? 1;
  const blitzChance = clamp((0.13 + (aggressive - 0.5) * 0.35 + (down >= 3 && distance > 6 ? 0.08 : 0)) * blitzPickupMult, 0.05, 0.46);
  if ((sam || will) && rng() < blitzChance) {
    blitzer = pick(rng, [sam, will].filter(Boolean));
    const rb = slotPlayer(offRoster, "RB1");
    if (rb && blitzer && !empty) {
      rbBlocking = true;
      matchups.push({ blocker: rb, rusher: blitzer, edge: `blitz do ${blitzer.slot === "LB2" ? "SAM" : "WILL"}`, blockerAttr: "POW", blockerPenalty: 0.72 });
    }
  }
  if (!matchups.length) return { tier: "clean", rbBlocking };

  let worst = matchups[0], worstDiff = -999;
  matchups.forEach((m) => {
    const blockRating = (m.blockerAttr ? (m.blocker.attrs[m.blockerAttr] || m.blocker.ovr) : (m.blocker.attrs.PBK || m.blocker.ovr)) * (m.blockerPenalty || 1);
    const diff = (m.rusher.attrs.RSH || m.rusher.ovr) - blockRating + randInt(rng, -14, 14);
    if (diff > worstDiff) { worstDiff = diff; worst = m; }
  });
  // An unblocked blitz in an empty backfield always gets home — no lineman
  // extra to help, no RB staying in to chip.
  const unblockedBlitz = empty && blitzer && !rbBlocking;
  const effDiff = unblockedBlitz ? worstDiff + 16 : worstDiff;
  const pressureChance = clamp((effDiff - 2) / 40, 0.04, 0.68);
  if (rng() > pressureChance) return { tier: "clean", rbBlocking };
  const severity = clamp(effDiff / 30, 0, 1);
  const sackChance = 0.07 + severity * 0.24, hitChance = 0.22 + severity * 0.16;
  const roll = rng();
  const tier = roll < sackChance ? "sack" : roll < sackChance + hitChance ? "hit" : "hurry";
  return { tier, rusher: unblockedBlitz ? blitzer : worst.rusher, blocker: worst.blocker, edge: unblockedBlitz ? "blitz sem bloqueio" : worst.edge, rbBlocking, blitz: !!blitzer };
}

// Pre-snap motion: sending a receiver across the formation before the snap
// is how real offenses diagnose man vs. zone coverage. Here it gives the QB
// a small, attribute-driven edge on his read (bigger with a sharper QB,
// smaller against a disciplined safety who doesn't bite on it).
function preSnapRead(offRoster, defRoster, rng) {
  const qb = activePlayer(offRoster, "QB1");
  const motionChance = clamp(0.32 + (qb.attrs.ACC - 75) * 0.002, 0.15, 0.55);
  if (rng() > motionChance) return { motion: false, readBonus: 0 };
  const s1 = activePlayer(defRoster, "S1");
  const disguiseSkill = s1?.attrs.COV || s1?.ovr || 70;
  const readBonus = clamp((qb.attrs.ACC - disguiseSkill) / 260, -0.05, 0.06);
  return { motion: true, readBonus };
}

// Personnel packages: which extra players are on the field shapes both the
// run-blocking math and which route concepts even make sense (no slot WR to
// throw a "drag pro slot" to in 12/21 personnel; no TE for a "seam" in 10
// personnel). "Formação ligeira" (empty backfield) is a further wrinkle on
// top of 11/10 personnel: the RB never stays in to help block, so any blitz
// comes free, but he's live as a 5th route option.
const PERSONNEL_INFO = {
  "11": { runBonus: 0, hasTE: true, hasSlot: true, blitzPickupMult: 1, canEmpty: true, label: "11 personnel" },
  "12": { runBonus: 0.6, hasTE: true, hasSlot: false, blitzPickupMult: 0.7, canEmpty: false, label: "12 personnel" },
  "21": { runBonus: 1.0, hasTE: true, hasSlot: false, blitzPickupMult: 0.55, canEmpty: false, label: "21 personnel" },
  "10": { runBonus: -0.6, hasTE: false, hasSlot: true, blitzPickupMult: 1.25, canEmpty: true, label: "10 personnel" },
};
const DEFAULT_PERSONNEL = { p11: 55, p12: 20, p21: 15, p10: 10 };

function pickPersonnel(rng, tendO) {
  const p = tendO?.personnel || DEFAULT_PERSONNEL;
  const roll = rng() * 100;
  let acc = p.p11 ?? DEFAULT_PERSONNEL.p11;
  if (roll < acc) return "11";
  acc += p.p12 ?? DEFAULT_PERSONNEL.p12; if (roll < acc) return "12";
  acc += p.p21 ?? DEFAULT_PERSONNEL.p21; if (roll < acc) return "21";
  return "10";
}

function fieldSpot(offAbbr, ballOn) {
  return ballOn <= 50 ? `${offAbbr} ${ballOn}` : `adv ${100 - ballOn}`;
}

function simPlay(offAbbr, defAbbr, offRoster, defRoster, down, distance, ballOn, tendO, tendD, rng) {
  const passRatio = tendO?.passRatio ?? 0.55;
  let isPass = rng() < (down === 3 && distance > 6 ? Math.min(0.85, passRatio + 0.25) : passRatio);
  if (rng() < 0.06) {
    const onOff = rng() < 0.5;
    const yds = pick(rng, [5, 5, 10, 15]);
    return { yards: onOff ? -yds : yds, desc: onOff ? `Penalidade contra ${offAbbr} (${yds} jds).` : `Penalidade contra ${defAbbr}, avanço de ${yds} jds.`, isPass, penalty: true, dir: "meio", depth: "penalty", elapsed: randInt(rng, 3, 6) };
  }
  const qb = activePlayer(offRoster, "QB1");
  const secondary = defRoster.filter((p) => (p.pos === "CB" || p.pos === "S") && !p.slot?.startsWith("BEN"));
  const frontSeven = defRoster.filter((p) => (p.pos === "DL" || p.pos === "LB") && !p.slot?.startsWith("BEN"));
  const personnel = pickPersonnel(rng, tendO);
  const pInfo = PERSONNEL_INFO[personnel];
  const empty = isPass && pInfo.canEmpty && rng() < (tendO?.lightFormationShare ?? 20) / 100;
  const personnelTag = personnel !== "11" ? ` (${pInfo.label}${empty ? ", formação vazia" : ""})` : (empty ? " (formação vazia)" : "");

  if (isPass) {
    const prot = passProtection(offRoster, defRoster, tendD, down, distance, personnel, empty, rng);
    if (prot.tier === "sack") {
      const sackDir = prot.blitz ? "meio" : prot.edge?.includes("esquerdo") ? "esquerda" : prot.edge?.includes("direito") ? "direita" : "meio";
      if (rng() < 0.12) {
        const loss = randInt(rng, 2, 8);
        statAdd(qb, "fumbles", 1); statAdd(qb, "sacksTaken", 1);
        statAdd(prot.rusher, "sacks", 1); statAdd(prot.rusher, "qbHits", 1); statAdd(prot.rusher, "forcedFumbles", 1);
        if (prot.blocker) statAdd(prot.blocker, "pressuresAllowed", 1);
        return { yards: -loss, desc: `${qb.name} sofre um strip-sack de ${prot.rusher.name} (${prot.edge})${personnelTag} — bola solta!`, isPass: true, turnover: "FUM", dir: sackDir, depth: "sack", personnel, elapsed: randInt(rng, 30, 42) };
      }
      const loss = randInt(rng, 4, 11);
      statAdd(qb, "sacksTaken", 1);
      statAdd(prot.rusher, "sacks", 1); statAdd(prot.rusher, "qbHits", 1);
      if (prot.blocker) statAdd(prot.blocker, "pressuresAllowed", 1);
      const sackDesc = prot.blitz ? `sacado no blitz por ${prot.rusher.name}` : `sacado por ${prot.rusher.name} pelo ${prot.edge}`;
      return { yards: -loss, desc: `${qb.name} não tem tempo — ${sackDesc}${personnelTag} (${loss} jds).`, isPass: true, sack: true, dir: sackDir, depth: "sack", personnel, elapsed: randInt(rng, 30, 42) };
    }
    const hurried = prot.tier === "hit" || prot.tier === "hurry";
    if (hurried) {
      statAdd(prot.rusher, prot.tier === "hit" ? "qbHits" : "qbHurries", 1);
      if (prot.blocker) statAdd(prot.blocker, "pressuresAllowed", 1);
    }

    const preSnap = preSnapRead(offRoster, defRoster, rng);
    const concept = pickRouteConcept(rng, down, distance, tendO, prot.rbBlocking, personnel);
    const target = activePlayer(offRoster, concept.targetSlot);
    const defender = activePlayer(defRoster, concept.defenderSlot) || pick(rng, secondary);
    const oRate = offenseRating(offRoster, "pass"), dRate = defenseRating(defRoster, "pass");
    const matchupDiff = ((target.attrs.HND || target.attrs.SPD || target.ovr) - (defender.attrs.COV || defender.ovr)) / 10;
    const diff = (oRate - dRate) / 10 + matchupDiff * 0.5;
    let completeChance = clamp(concept.baseComplete + diff * 0.03 + (qb.attrs.ACC - 75) * 0.003 + preSnap.readBonus, 0.28, 0.9);
    if (hurried) completeChance -= prot.tier === "hit" ? 0.22 : 0.12;
    completeChance = clamp(completeChance, 0.15, 0.9);
    const motionTag = preSnap.motion ? " após motion pré-snap" : "";

    if (rng() > completeChance) {
      const brokenUp = rng() < 0.5;
      if (brokenUp) {
        statAdd(defender, "passesDefended", 1);
        statAdd(qb, "passAttempts", 1);
        return { yards: 0, desc: `${qb.name} tenta ${concept.name}${motionTag}${personnelTag}, mas ${defender.name} defende bem o passe.`, isPass: true, incomplete: true, target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 4, 8) };
      }
      const intChance = clamp(concept.baseInt - diff * 0.01 + (hurried ? 0.05 : 0), 0.01, 0.22);
      if (rng() < intChance) {
        statAdd(qb, "interceptionsThrown", 1); statAdd(qb, "passAttempts", 1);
        statAdd(defender, "interceptions", 1);
        return { yards: 0, desc: `Passe de ${qb.name} (${concept.name}) interceptado por ${defender.name}!`, isPass: true, turnover: "INT", target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 4, 8) };
      }
      statAdd(qb, "passAttempts", 1);
      return { yards: 0, desc: `${qb.name} tenta ${concept.name} para ${target.name}${motionTag}${personnelTag}... incompleto.`, isPass: true, incomplete: true, target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 4, 8) };
    }
    let yards = Math.max(0, Math.round(concept.baseYards + diff * 3 + randInt(rng, concept.varLow, concept.varHigh)));
    if (rng() < concept.bigPlayChance) yards += randInt(rng, 15, 45);
    const tackler = pickW(rng, [...secondary, ...frontSeven.filter((p) => p.pos === "LB")], tackleWeight);
    statAdd(qb, "passYards", yards); statAdd(qb, "passCompletions", 1); statAdd(qb, "passAttempts", 1);
    statAdd(target, "receptions", 1); statAdd(target, "receivingYards", yards);
    statAdd(tackler, "tackles", 1);
    return { yards, desc: `${qb.name} completa ${concept.name} para ${target.name}${motionTag}${personnelTag} (${yards} jds), derrubado por ${tackler.name}.`, isPass: true, target, passer: qb, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 28, 40) };
  } else {
    const rb1 = activePlayer(offRoster, "RB1");
    const rb2 = activePlayer(offRoster, "RB2");
    const rb2Share = tendO?.rb2CarryShare ?? 0.2;
    const rb = (rb2 && rb2.id !== rb1.id && rng() < rb2Share) ? rb2 : rb1;
    const oRate = offenseRating(offRoster, "run", rb), dRate = defenseRating(defRoster, "run");
    const diff = (oRate - dRate) / 10 + pInfo.runBonus;
    const gap = pick(rng, RUN_GAPS);
    if (rng() < clamp(0.02 - diff * 0.005, 0.005, 0.06)) {
      const defender = pickW(rng, frontSeven, (p) => p.attrs.RUN || p.ovr);
      statAdd(rb, "fumbles", 1);
      statAdd(defender, "fumbleRecoveries", 1);
      return { yards: 0, desc: `${rb.name} perde a bola! Recuperada por ${defender.name}.`, isPass: false, turnover: "FUM", dir: gap.dir, depth: "run", personnel, elapsed: randInt(rng, 28, 38) };
    }
    let yards = Math.max(-3, Math.round(2.6 + diff * 2.2 + randInt(rng, -3, 5)));
    if (rng() < 0.05) yards += randInt(rng, 12, 30);
    const tackler = pickW(rng, [...frontSeven, ...secondary.filter((p) => p.pos === "S")], tackleWeight);
    statAdd(rb, "rushYards", yards); statAdd(rb, "rushAttempts", 1);
    statAdd(tackler, "tackles", 1);
    return { yards, desc: `${rb.name} corre ${gap.label}${personnelTag}, derrubado por ${tackler.name} (${yards} jds).`, isPass: false, rusher: rb, dir: gap.dir, depth: "run", personnel, elapsed: randInt(rng, 28, 40) };
  }
}

function attemptFG(kicker, distanceToGoal, rng) {
  const kickDist = distanceToGoal + 17;
  const chance = clamp(0.98 - (kickDist - 20) * 0.013 + (kicker.attrs.ACC - 75) * 0.002, 0.15, 0.98);
  return { good: rng() < chance, kickDist };
}

// Flat, clock-driven game loop: one play at a time, real game clock, quarters,
// simplified sudden-death overtime, and full per-player stat crediting.
// Adjusts a team's called pass ratio based on the live game situation:
// trailing teams (especially late) throw a lot more to catch up, while
// leading teams lean on the run to bleed clock. Magnitude scales with how
// far into the game we are (urgency), not just the raw score gap.
function situationalPassRatio(baseRatio, scoreDiff, quarter, secsLeft) {
  const secsIntoGame = (quarter - 1) * 900 + (900 - secsLeft);
  const urgency = clamp(secsIntoGame / 3600, 0.05, 1); // 0 at kickoff -> 1 at the final whistle
  const possessionsBehind = -scoreDiff / 8; // positive = offense is trailing
  const adj = clamp(possessionsBehind * 0.16, -0.4, 0.4) * urgency;
  return clamp(baseRatio + adj, 0.12, 0.92);
}

function simGameDetailed(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
  const home = leagueTeams[homeAbbr], away = leagueTeams[awayAbbr];
  const log = [], scoreTimeline = [], plays = [];
  const score = { [homeAbbr]: 0, [awayAbbr]: 0 };
  function pushPlay(meta) {
    plays.push({
      offAbbr: meta?.offAbbr ?? possession,
      defAbbr: meta?.defAbbr ?? (possession === homeAbbr ? awayAbbr : homeAbbr),
      down: meta?.down ?? down,
      distance: meta?.distance ?? distance,
      ballOn: meta?.ballOn ?? ballOn,
      yards: meta?.yards ?? 0,
      isPass: meta?.isPass ?? null,
      dir: meta?.dir ?? "meio",
      kind: meta?.kind ?? "info",
      personnel: meta?.personnel ?? "11",
    });
  }
  function push(text, label, meta) {
    log.push(`${label} — ${text}`);
    scoreTimeline.push({ [homeAbbr]: score[homeAbbr], [awayAbbr]: score[awayAbbr] });
    pushPlay(meta);
  }

  let possession = rng() < 0.5 ? homeAbbr : awayAbbr;
  let down = 1, distance = 10, ballOn = 25;
  let quarter = 1, secs = 900, halftimeAnnounced = false;
  let timeouts = { [homeAbbr]: 3, [awayAbbr]: 3 };
  let twoMinWarnQ2 = false, twoMinWarnQ4 = false;
  const label = () => `Q${quarter} ${fmtClock(secs)}`;

  log.push(`🏈 Pontapé inicial: ${away.city} ${away.name} @ ${home.city} ${home.name}`);
  scoreTimeline.push({ [homeAbbr]: 0, [awayAbbr]: 0 });
  pushPlay({ ballOn: 25, down: 1, distance: 10, kind: "kickoff" });

  function creditTouchdown(result, offRoster) {
    if (result.isPass && result.target) { statAdd(result.target, "receivingTD", 1); if (result.passer) statAdd(result.passer, "passTD", 1); }
    else if (result.rusher) { statAdd(result.rusher, "rushTD", 1); }
    const kicker = activePlayer(offRoster, "K1");
    statAdd(kicker, "xpAttempts", 1);
    const xpGood = rng() < 0.95;
    if (xpGood) statAdd(kicker, "xpMade", 1);
    return xpGood ? 7 : 6;
  }

  function kickoffReset(scoringTeam) {
    possession = scoringTeam === homeAbbr ? awayAbbr : homeAbbr;
    down = 1; distance = 10; ballOn = 25;
  }

  let safety = 0;
  while (quarter <= 4 && safety < 400) {
    safety++;
    const offAbbr = possession, defAbbr = possession === homeAbbr ? awayAbbr : homeAbbr;
    const offTeam = leagueTeams[offAbbr], defTeam = leagueTeams[defAbbr];
    const baseTend = offAbbr === homeAbbr ? tendencies.home : tendencies.away;
    const tendO = { ...baseTend, passRatio: situationalPassRatio(baseTend?.passRatio ?? 0.55, score[offAbbr] - score[defAbbr], quarter, secs) };
    const tendD = defAbbr === homeAbbr ? tendencies.home : tendencies.away;
    const yardsToGoal = 100 - ballOn;
    let elapsed = 0;

    if (down === 4 && !(tendO.aggressive > 0.6 && distance <= 3)) {
      if (yardsToGoal <= 38) {
        const kicker = activePlayer(offTeam.roster, "K1");
        const { good, kickDist } = attemptFG(kicker, yardsToGoal, rng);
        statAdd(kicker, "fgAttempts", 1); if (good) statAdd(kicker, "fgMade", 1);
        push(`Tentativa de FG de ${kickDist} jds por ${kicker.name}: ${good ? "É BOA! 🏈" : "NÃO PASSA."}`, label(), { offAbbr, defAbbr, down, distance, ballOn, yards: good ? yardsToGoal : 0, isPass: null, dir: "meio", kind: good ? "fieldgoal-good" : "fieldgoal-miss" });
        elapsed = randInt(rng, 6, 10);
        if (good) { score[offAbbr] += 3; kickoffReset(offAbbr); } else { possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - yardsToGoal, 2, 98); }
      } else {
        const punter = activePlayer(offTeam.roster, "P1");
        const puntYds = randInt(rng, 35, 50);
        statAdd(punter, "punts", 1); statAdd(punter, "puntYards", puntYds);
        push(`Punt de ${punter.name} saindo da ${fieldSpot(offAbbr, ballOn)}.`, label(), { offAbbr, defAbbr, down, distance, ballOn, yards: puntYds, isPass: null, dir: "meio", kind: "punt" });
        elapsed = randInt(rng, 6, 10);
        possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - (ballOn + puntYds), 2, 98);
      }
    } else {
      const result = simPlay(offAbbr, defAbbr, offTeam.roster, defTeam.roster, down, distance, ballOn, tendO, tendD, rng);
      const downLabel = `${down}ª e ${distance > 0 ? distance : "gol"} na ${fieldSpot(offAbbr, ballOn)}`;
      const playKind = result.penalty ? "penalty" : result.isPass ? (result.turnover === "INT" ? "interception" : result.incomplete ? "incomplete" : result.sack ? "sack" : "pass") : (result.turnover === "FUM" ? "fumble" : "run");
      push(`${downLabel} — ${result.desc}`, label(), { offAbbr, defAbbr, down, distance, ballOn, yards: result.yards, isPass: result.isPass, dir: result.dir, kind: playKind, personnel: result.personnel });
      elapsed = result.elapsed ?? 30;
      if (result.turnover) {
        possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - (ballOn + (result.yards || 0)), 2, 98);
      } else {
        ballOn = clamp(ballOn + result.yards, 0, 100);
        if (ballOn >= 100) {
          const extra = creditTouchdown(result, offTeam.roster);
          score[offAbbr] += extra;
          push(`TOUCHDOWN ${offAbbr}! 🎉`, label(), { offAbbr, defAbbr, down, distance: 0, ballOn: 100, yards: 0, isPass: result.isPass, dir: result.dir, kind: "touchdown" });
          kickoffReset(offAbbr);
        } else if (!result.penalty) {
          distance -= result.yards;
          if (distance <= 0) { down = 1; distance = 10; }
          else down += 1;
          if (down > 4) {
            const punter = activePlayer(offTeam.roster, "P1");
            const puntYds = randInt(rng, 35, 50);
            statAdd(punter, "punts", 1); statAdd(punter, "puntYards", puntYds);
            possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - (ballOn + puntYds), 2, 98);
          }
        }
      }
    }

    // Two-minute warning: the clock always stops here once per half.
    if ((quarter === 2 || quarter === 4) && secs > 120 && secs - elapsed <= 120 && !(quarter === 2 ? twoMinWarnQ2 : twoMinWarnQ4)) {
      push("⏱️ Aviso de dois minutos.", label());
      elapsed = secs - 120;
      if (quarter === 2) twoMinWarnQ2 = true; else twoMinWarnQ4 = true;
    }
    // The trailing team burns a timeout late in the 4th to stop the clock and
    // save time for a final drive, instead of just watching it run.
    const trailingAbbr = score[homeAbbr] === score[awayAbbr] ? null : (score[homeAbbr] < score[awayAbbr] ? homeAbbr : awayAbbr);
    if (quarter === 4 && secs <= 300 && trailingAbbr && trailingAbbr === defAbbr && timeouts[trailingAbbr] > 0 && elapsed >= 20) {
      timeouts[trailingAbbr] -= 1;
      push(`⏱️ ${trailingAbbr} pede tempo (${timeouts[trailingAbbr]} restante${timeouts[trailingAbbr] === 1 ? "" : "s"}).`, label());
      elapsed = Math.min(elapsed, 6);
    }

    secs -= elapsed;
    if (secs <= 0) {
      secs = 0;
      quarter += 1;
      if (quarter === 3 && !halftimeAnnounced) { push("Intervalo. Fim do primeiro tempo.", "HT"); halftimeAnnounced = true; timeouts = { [homeAbbr]: 3, [awayAbbr]: 3 }; }
      if (quarter <= 4) secs = 900;
    }
  }

  if (score[homeAbbr] === score[awayAbbr]) {
    push("⏱️ Prorrogação! Próximo time a pontuar vence a partida.", "OT");
    let otPlays = 0;
    while (score[homeAbbr] === score[awayAbbr] && otPlays < 25) {
      otPlays++;
      const offAbbr = possession, defAbbr = possession === homeAbbr ? awayAbbr : homeAbbr;
      const offTeam = leagueTeams[offAbbr], defTeam = leagueTeams[defAbbr];
      const tendO = offAbbr === homeAbbr ? tendencies.home : tendencies.away;
      const tendD = defAbbr === homeAbbr ? tendencies.home : tendencies.away;
      if (down > 4) { possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - ballOn, 2, 98); continue; }
      const result = simPlay(offAbbr, defAbbr, offTeam.roster, defTeam.roster, down, distance, ballOn, tendO, tendD, rng);
      const downLabel = `${down}ª e ${distance > 0 ? distance : "gol"} na ${fieldSpot(offAbbr, ballOn)}`;
      const playKind = result.penalty ? "penalty" : result.isPass ? (result.turnover === "INT" ? "interception" : result.incomplete ? "incomplete" : result.sack ? "sack" : "pass") : (result.turnover === "FUM" ? "fumble" : "run");
      push(`${downLabel} — ${result.desc}`, "OT", { offAbbr, defAbbr, down, distance, ballOn, yards: result.yards, isPass: result.isPass, dir: result.dir, kind: playKind, personnel: result.personnel });
      if (result.turnover) { possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - (ballOn + (result.yards || 0)), 2, 98); continue; }
      ballOn = clamp(ballOn + result.yards, 0, 100);
      if (ballOn >= 100) {
        const extra = creditTouchdown(result, offTeam.roster);
        score[offAbbr] += extra;
        push(`TOUCHDOWN ${offAbbr}! Fim de jogo! 🎉`, "OT", { offAbbr, defAbbr, down, distance: 0, ballOn: 100, yards: 0, isPass: result.isPass, dir: result.dir, kind: "touchdown" });
        break;
      }
      if (!result.penalty) { distance -= result.yards; if (distance <= 0) { down = 1; distance = 10; } else down += 1; }
    }
  }

  log.push(`🏁 FIM DE JOGO: ${away.abbr} ${score[awayAbbr]} — ${score[homeAbbr]} ${home.abbr}`);
  scoreTimeline.push({ [homeAbbr]: score[homeAbbr], [awayAbbr]: score[awayAbbr] });
  pushPlay({ kind: "final" });
  return { score, log, scoreTimeline, plays };
}

// Approximate individual stat lines for games that are quick-simmed (every game
// except the user's), so league leaderboards stay populated across all 32 teams.
function quickGameStats(offRoster, defRoster, teamScore, rng, tendO) {
  const qb = activePlayer(offRoster, "QB1");
  const rb1 = activePlayer(offRoster, "RB1");
  const rb2 = activePlayer(offRoster, "RB2");
  const wrs = ["WR1", "WR2", "WR3", "TE1"].map((k) => activePlayer(offRoster, k));
  const passYards = Math.max(60, Math.round(teamScore * randInt(rng, 8, 13) + randInt(rng, -20, 40)));
  // Team rushing total is only loosely tied to score and capped, so even the
  // leading rusher (after the RB1/RB2 split below) only clears ~170 in truly
  // exceptional games, matching real NFL rarity for a 170+ rushing day.
  const rushYards = clamp(Math.round(85 + (teamScore - 21) * 1.9 + randInt(rng, -25, 55)), 35, 220);
  const attempts = randInt(rng, 22, 36);
  statAdd(qb, "passYards", passYards);
  statAdd(qb, "passAttempts", attempts);
  statAdd(qb, "passCompletions", Math.round(attempts * (0.55 + rng() * 0.15)));

  // Split carries between RB1 and RB2 per the offense's tactics slider, so a
  // heavier RB2 workload both looks realistic and keeps RB1 fresher.
  const rb2Share = rb2 && rb2.id !== rb1.id ? clamp((tendO?.rb2CarryShare ?? 0.2) + (rng() - 0.5) * 0.12, 0, 0.6) : 0;
  const rushAttemptsTotal = randInt(rng, 20, 30);
  const rb2Yards = Math.round(rushYards * rb2Share);
  const rb2Attempts = Math.round(rushAttemptsTotal * rb2Share);
  statAdd(rb1, "rushYards", rushYards - rb2Yards);
  statAdd(rb1, "rushAttempts", Math.max(1, rushAttemptsTotal - rb2Attempts));
  if (rb2Attempts > 0) { statAdd(rb2, "rushYards", rb2Yards); statAdd(rb2, "rushAttempts", rb2Attempts); }

  let remaining = passYards;
  wrs.forEach((w, i) => {
    const isLast = i === wrs.length - 1;
    const share = isLast ? remaining : Math.round(passYards * (0.34 - i * 0.07) * (0.6 + rng() * 0.7));
    const y = Math.max(0, Math.min(remaining, share));
    statAdd(w, "receivingYards", y);
    statAdd(w, "receptions", randInt(rng, 1, Math.max(1, Math.round(y / 11) + 1)));
    remaining -= y;
  });

  const tds = Math.max(0, Math.round(teamScore / 7 - (rng() < 0.3 ? 1 : 0)));
  for (let i = 0; i < tds; i++) {
    if (rng() < 0.42) { statAdd(rng() < rb2Share ? rb2 : rb1, "rushTD", 1); }
    else { statAdd(pick(rng, wrs), "receivingTD", 1); statAdd(qb, "passTD", 1); }
  }
  if (rng() < 0.4) statAdd(qb, "interceptionsThrown", 1);

  // Restrict tackle credit to the actual defensive starters (no bench) and
  // weight it toward LBs/the starting strong safety, so one defender usually
  // emerges as the game's tackle leader in the ~12-14 range instead of a
  // flat spread across the whole depth chart.
  const defenders = defRoster.filter((p) => (p.pos === "DL" || p.pos === "LB" || p.pos === "CB" || p.pos === "S") && !p.slot?.startsWith("BEN"));
  let tacklesLeft = randInt(rng, 42, 50);
  while (tacklesLeft-- > 0 && defenders.length) statAdd(pickW(rng, defenders, tackleWeight), "tackles", 1);
  const rushers = defRoster.filter((p) => p.pos === "DL" || p.pos === "LB");
  const sacks = randInt(rng, 0, 4);
  for (let i = 0; i < sacks; i++) statAdd(pick(rng, rushers), "sacks", 1);
  const hits = randInt(rng, sacks, sacks + 4);
  for (let i = 0; i < hits; i++) statAdd(pick(rng, rushers), "qbHits", 1);
  const hurries = randInt(rng, 3, 9);
  for (let i = 0; i < hurries; i++) statAdd(pick(rng, rushers), "qbHurries", 1);
  const linemen = offRoster.filter((p) => p.pos === "OL");
  let pressuresLeft = hits + hurries + sacks;
  while (pressuresLeft-- > 0 && linemen.length) statAdd(pick(rng, linemen), "pressuresAllowed", 1);
  const secondary = defRoster.filter((p) => p.pos === "CB" || p.pos === "S");
  if (rng() < 0.35 && secondary.length) statAdd(pick(rng, secondary), "interceptions", 1);
  let pdLeft = randInt(rng, 3, 8);
  while (pdLeft-- > 0 && secondary.length) statAdd(pick(rng, secondary), "passesDefended", 1);

  const kicker = activePlayer(offRoster, "K1");
  const fgAttempts = randInt(rng, 1, 4);
  const fgMade = Math.round(fgAttempts * (0.72 + rng() * 0.2));
  statAdd(kicker, "fgAttempts", fgAttempts);
  statAdd(kicker, "fgMade", fgMade);
  const xpAttempts = Math.max(0, tds - Math.round(tds * 0.15));
  statAdd(kicker, "xpAttempts", xpAttempts);
  statAdd(kicker, "xpMade", Math.round(xpAttempts * 0.96));
  const punter = activePlayer(offRoster, "P1");
  const punts = randInt(rng, 2, 6);
  statAdd(punter, "punts", punts);
  statAdd(punter, "puntYards", punts * randInt(rng, 38, 48));
}

function simGameQuick(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
  const home = leagueTeams[homeAbbr], away = leagueTeams[awayAbbr];
  const hOvr = teamOverall(home.roster) + 1.5; // home field
  const aOvr = teamOverall(away.roster);
  const diff = (hOvr - aOvr) / 4;
  const hScore = clamp(Math.round(21 + diff + randInt(rng, -10, 10)), 0, 55);
  const aScore = clamp(Math.round(21 - diff + randInt(rng, -10, 10)), 0, 55);
  quickGameStats(home.roster, away.roster, hScore, rng, tendencies?.home);
  quickGameStats(away.roster, home.roster, aScore, rng, tendencies?.away);
  return { [homeAbbr]: hScore, [awayAbbr]: aScore };
}

/* ============================================================
   FREE AGENCY / DRAFT / TRADES / OFFSEASON
   ============================================================ */

function generateFreeAgents(year) {
  const rng = mulberry32(seedFromString("fa-" + year));
  const pool = [];
  const positions = ["QB","RB","WR","WR","TE","OL","OL","DL","DL","LB","CB","CB","S","K"];
  for (let i = 0; i < 26; i++) {
    const pos = pick(rng, positions);
    const tier = rng() < 0.1 ? "star" : rng() < 0.5 ? "starter" : "backup";
    const p = makePlayer(rng, pos, tier, makeName(rng));
    p.slot = null;
    p.askingYears = randInt(rng, 1, 3);
    pool.push(p);
  }
  return pool;
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

const PRESS_EVENTS = {
  win_big: {
    prompt: "Vitória tranquila. Repórteres querem sua reação.",
    options: [
      { label: "Elogiar o elenco publicamente", owner: 3, fan: 6 },
      { label: "Focar no próximo adversário, sem festejar", owner: 5, fan: 2 },
      { label: "Cutucar o rival da divisão", owner: -2, fan: 8 },
    ],
  },
  win_close: {
    prompt: "Vitória apertada. A diretoria quer saber se o time está pronto pros playoffs.",
    options: [
      { label: "Defender o grupo, dizer que estão evoluindo", owner: 4, fan: 4 },
      { label: "Ser crítico, cobrar mais da equipe", owner: 2, fan: -3 },
      { label: "Elogiar a torcida pelo apoio", owner: 1, fan: 7 },
    ],
  },
  loss_close: {
    prompt: "Derrota de virada nos minutos finais. A pressão aumenta.",
    options: [
      { label: "Assumir a responsabilidade pelas escolhas táticas", owner: -1, fan: 5 },
      { label: "Culpar erros de arbitragem", owner: -4, fan: 4 },
      { label: "Prometer ajustes já na próxima semana", owner: 3, fan: 1 },
    ],
  },
  loss_big: {
    prompt: "Derrota feia em casa. A torcida está impaciente e o dono quer respostas.",
    options: [
      { label: "Pedir paciência ao projeto", owner: -3, fan: -2 },
      { label: "Anunciar mudanças na escalação titular", owner: 4, fan: 3 },
      { label: "Ficar na defensiva com a imprensa", owner: -6, fan: -6 },
    ],
  },
};

function pickPressEvent(myScore, oppScore) {
  const diff = myScore - oppScore;
  if (diff > 0 && diff >= 14) return "win_big";
  if (diff > 0) return "win_close";
  if (diff < 0 && diff <= -14) return "loss_big";
  return "loss_close";
}

export { slotPlayer, offenseRating, defenseRating, teamOverall, simGameDetailed, simGameQuick,
  generateFreeAgents, generateDraftClass, capUsed, playerValue, pickValue, agePlayer,
  PRESS_EVENTS, pickPressEvent };

/* ============================================================
   OFFSEASON / PLAYOFF HELPERS
   ============================================================ */

function standingsSorted(teams) {
  return Object.values(teams).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa));
}
function conferenceSeeds(teams, conf) {
  return Object.values(teams)
    .filter((t) => t.conf === conf)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa))
    .slice(0, 7)
    .map((t, i) => ({ seed: i + 1, abbr: t.abbr }));
}
function draftOrderFromStandings(teams) {
  return Object.values(teams)
    .sort((a, b) => (a.wins - a.losses) - (b.wins - b.losses) || (a.pf - a.pa) - (b.pf - b.pa))
    .map((t) => t.abbr);
}
function applyResult(teams, home, away, hs, as) {
  teams[home].pf += hs; teams[home].pa += as;
  teams[away].pf += as; teams[away].pa += hs;
  if (hs > as) { teams[home].wins++; teams[away].losses++; }
  else if (as > hs) { teams[away].wins++; teams[home].losses++; }
  else { teams[home].ties++; teams[away].ties++; }
}
function findSlotForRookie(roster, pos) {
  const benchSame = roster.find((p) => p.slot?.startsWith("BEN") && p.pos === pos);
  if (benchSame) return benchSame.slot;
  const anyBench = roster.filter((p) => p.slot?.startsWith("BEN")).sort((a, b) => a.ovr - b.ovr)[0];
  if (anyBench) return anyBench.slot;
  const weakestSame = roster.filter((p) => p.pos === pos).sort((a, b) => a.ovr - b.ovr)[0];
  return weakestSame ? weakestSame.slot : roster[roster.length - 1].slot;
}
function insertPlayer(roster, slotKey, newPlayer) {
  const idx = roster.findIndex((p) => p.slot === slotKey);
  newPlayer.slot = slotKey;
  if (idx >= 0) roster[idx] = newPlayer; else roster.push(newPlayer);
}
const STAT_CATEGORIES = [
  { key: "passYards", label: "Jardas aéreas", pos: "QB" },
  { key: "passTD", label: "Passes para TD", pos: "QB" },
  { key: "rushYards", label: "Jardas terrestres", pos: "RB" },
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
];

function leagueLeaders(teams, statKey, n = 5) {
  const rows = [];
  Object.values(teams).forEach((t) => {
    t.roster.forEach((p) => {
      const val = p.seasonStats?.[statKey];
      if (val) rows.push({ player: p, teamAbbr: t.abbr, value: val });
    });
  });
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, n);
}

function resetSeasonStats(teams) {
  Object.values(teams).forEach((t) => { t.roster.forEach((p) => { p.seasonStats = {}; }); });
}

function retireAndRefreshLeague(teams, year) {
  const rng = mulberry32(seedFromString("retire-" + year));
  const news = [];
  Object.values(teams).forEach((t) => {
    const teamSlots = rosterSlotsFor(t.scheme || "4-3");
    t.roster.forEach((p, i) => {
      agePlayer(p, rng);
      if (p.years <= 0 || p.age > 34 || p.ovr < 44) {
        const slotDef = teamSlots.find((s) => s.key === p.slot) || { pos: p.pos, tier: "backup" };
        const repl = makePlayer(rng, slotDef.pos, slotDef.tier === "star" ? "starter" : slotDef.tier, makeName(rng));
        repl.slot = p.slot;
        news.push(`${p.name} (${t.abbr}) se aposentou.`);
        t.roster[i] = repl;
      }
    });
    normalizeSalaries(t.roster, rng);
  });
  return news;
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function Bar({ value, max = 99, color = "#22c55e" }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${clamp((value / max) * 100, 3, 100)}%`, background: color }} />
    </div>
  );
}
function Card({ children, className = "" }) {
  return <div className={`rounded-lg border border-white/10 bg-[#121a2c] p-4 ${className}`}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", disabled, className = "", color }) {
  const base = "px-4 py-2 rounded-md font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "text-white hover:brightness-110",
    ghost: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
    danger: "bg-red-600/80 text-white hover:bg-red-600",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} onClick={onClick} disabled={disabled}
      style={variant === "primary" ? { background: color || "#2563eb" } : undefined}>
      {children}
    </button>
  );
}
function PosPill({ pos }) {
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">{pos}</span>;
}
function primaryStatLine(p) {
  const s = p.seasonStats || {};
  if (p.pos === "QB" && s.passYards) return `${s.passYards} jds, ${s.passTD || 0} TD, ${s.interceptionsThrown || 0} INT`;
  if (p.pos === "RB" && s.rushYards) return `${s.rushYards} jds, ${s.rushTD || 0} TD`;
  if ((p.pos === "WR" || p.pos === "TE") && s.receivingYards) return `${s.receptions || 0} rec, ${s.receivingYards} jds, ${s.receivingTD || 0} TD`;
  if ((p.pos === "DL" || p.pos === "LB") && (s.tackles || s.sacks || s.qbHits || s.qbHurries)) return `${s.tackles || 0} tackles, ${s.sacks || 0} sacks, ${s.qbHits || 0} QB hits`;
  if ((p.pos === "CB" || p.pos === "S") && (s.tackles || s.interceptions || s.passesDefended)) return `${s.tackles || 0} tackles, ${s.interceptions || 0} INT, ${s.passesDefended || 0} PD`;
  if (p.pos === "OL" && s.pressuresAllowed) return `${s.pressuresAllowed} pressões sofridas`;
  if (p.pos === "K" && s.fgAttempts) return `${s.fgMade || 0}/${s.fgAttempts} FG`;
  if (p.pos === "P" && s.punts) return `${s.punts} punts, ${Math.round((s.puntYards || 0) / s.punts)} jds/punt`;
  return null;
}

function PlayerRow({ p, right, showStats }) {
  const statLine = showStats ? primaryStatLine(p) : null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <PosPill pos={p.pos} />
          <span className="truncate text-sm text-slate-100">{p.name}</span>
          {p.injuredWeeks > 0 && <span className="text-[10px] text-red-400 font-semibold">LESIONADO ({p.injuredWeeks}sem)</span>}
          <span className="text-[11px] text-slate-500">idade {p.age}</span>
        </div>
        {statLine && <div className="text-[11px] text-slate-500 mt-0.5">{statLine}</div>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-slate-400 tabular-nums">${p.salary.toFixed(1)}M</span>
        <span className="font-bold tabular-nums text-sm w-7 text-right" style={{ color: p.ovr >= 85 ? "#4ade80" : p.ovr >= 70 ? "#fbbf24" : "#94a3b8" }}>{p.ovr}</span>
        {right}
      </div>
    </div>
  );
}
function TopBar({ team, career, go, screen }) {
  const tm = TEAM_META.find((t) => t.abbr === team.abbr);
  return (
    <div className="sticky top-0 z-10">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tm.c1}, ${tm.c2})` }} />
      <div className="bg-[#0B1220]/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">Técnico {career.coachName} · {career.year}</div>
          <div className="font-black text-lg tracking-tight truncate">{tm.city} {tm.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-400">Temporada</div>
          <div className="font-bold tabular-nums">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
const NAV = [
  { key: "hub", label: "Painel", icon: "🛡️" },
  { key: "game", label: "Jogo", icon: "🏈" },
  { key: "roster", label: "Elenco", icon: "👥" },
  { key: "depth", label: "Escalação", icon: "📋" },
  { key: "tactics", label: "Táticas", icon: "🎯" },
  { key: "schedule", label: "Classificação", icon: "📅" },
  { key: "results", label: "Resultados", icon: "🏟️" },
  { key: "trade", label: "Trocas", icon: "🔄" },
  { key: "stats", label: "Stats", icon: "📊" },
];
function BottomNav({ screen, go, disabled, hasUnwatchedGame }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#0B1220]/97 backdrop-blur border-t border-white/10 flex justify-around py-1.5 z-20 overflow-x-auto">
      {NAV.map((n) => {
        const active = screen === n.key;
        return (
          <button key={n.key} disabled={disabled} onClick={() => go(n.key)}
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px] shrink-0 ${active ? "text-white" : "text-slate-500"} disabled:opacity-30`}>
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
            {n.key === "game" && hasUnwatchedGame && <span className="absolute top-0 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   SCREENS — MENU / NEW CAREER
   ============================================================ */

function MenuScreen({ saves, onNew, onLoad, onDelete }) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8">
        <div className="text-xs tracking-wide text-slate-500 mb-1">simulador de carreira</div>
        <h1 className="text-4xl font-black tracking-tight">GRIDIRON GM</h1>
        <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">
          Assuma o comando de um time da NFL. Escale o elenco, defina táticas, negocie na free agency, faça trocas, comande o draft e viva cada jogo na marra.
        </p>
      </div>
      <div className="w-full max-w-md space-y-3">
        <Btn className="w-full py-3" onClick={onNew}>Começar nova carreira</Btn>
        {saves.length > 0 && (
          <Card>
            <div className="text-xs text-slate-400 mb-2">Carreiras salvas</div>
            <div className="space-y-2">
              {saves.map((s) => {
                const tm = TEAM_META.find((t) => t.abbr === s.teamAbbr);
                return (
                  <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                    <button className="text-left" onClick={() => onLoad(s.id)}>
                      <div className="text-sm font-semibold">{s.coachName} — {tm?.city} {tm?.name}</div>
                      <div className="text-xs text-slate-500">{s.year} · Semana {s.week}</div>
                    </button>
                    <button className="text-slate-500 hover:text-red-400" onClick={() => onDelete(s.id)}>✕</button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
      <p className="text-[11px] text-slate-600 mt-8 max-w-sm text-center">
        Times e nomes de jogadores usados de forma ilustrativa para fins de simulação; elencos são aproximados e não refletem transações recentes. Projeto independente, sem afiliação com a NFL.
      </p>
    </div>
  );
}

function NewCareerScreen({ onCreate, onBack }) {
  const [name, setName] = useState("");
  const [teamAbbr, setTeamAbbr] = useState(null);
  const grouped = useMemo(() => {
    const byDiv = {};
    TEAM_META.forEach((t) => { const k = `${t.conf} ${t.div}`; byDiv[k] = byDiv[k] || []; byDiv[k].push(t); });
    return byDiv;
  }, []);
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 px-4 py-8 pb-24">
      <button onClick={onBack} className="text-slate-400 text-sm flex items-center gap-1 mb-4">← Voltar</button>
      <h2 className="text-2xl font-black mb-1">Nova carreira</h2>
      <p className="text-slate-400 text-sm mb-6">Escolha seu nome de técnico e o time que vai comandar.</p>
      <label className="text-xs text-slate-400">Nome do técnico</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ricardo Alves"
        className="w-full mt-1 mb-6 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-white/30" />
      <div className="space-y-5">
        {Object.entries(grouped).map(([div, teams]) => (
          <div key={div}>
            <div className="text-xs text-slate-500 mb-2">{div}</div>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button key={t.abbr} onClick={() => setTeamAbbr(t.abbr)}
                  className={`text-left rounded-md px-3 py-2 border ${teamAbbr === t.abbr ? "border-white" : "border-white/10"}`}
                  style={{ background: teamAbbr === t.abbr ? `linear-gradient(135deg, ${t.c1}cc, ${t.c2}66)` : "rgba(255,255,255,0.03)" }}>
                  <div className="text-sm font-bold">{t.city}</div>
                  <div className="text-xs text-slate-300">{t.name}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-[#0B1220] border-t border-white/10 p-4">
        <Btn className="w-full py-3" disabled={!name.trim() || !teamAbbr} onClick={() => onCreate(teamAbbr, name.trim())}>
          Assinar contrato
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   HUB
   ============================================================ */

function HubScreen({ career, myTeam, go, onPlayWeek, onSimPlayoffRound }) {
  const tm = TEAM_META.find((t) => t.abbr === myTeam.abbr);
  const round = career.schedule[career.week - 1];
  const nextGame = round?.find((g) => g.home === myTeam.abbr || g.away === myTeam.abbr);
  const oppAbbr = nextGame ? (nextGame.home === myTeam.abbr ? nextGame.away : nextGame.home) : null;
  const oppTeam = oppAbbr ? TEAM_META.find((t) => t.abbr === oppAbbr) : null;
  const isHome = nextGame ? nextGame.home === myTeam.abbr : true;
  const gamePending = !!(career.lastGame && (career.gameRevealCount ?? 0) < career.lastGame.log.length);

  return (
    <div className="pb-24">
      {gamePending && (
        <Card className="mb-4 border-amber-400/40">
          <div className="text-sm font-semibold mb-1">🏈 Você tem um jogo em andamento</div>
          <div className="text-xs text-slate-400 mb-3">Termine de assistir as jogadas antes de seguir em frente.</div>
          <Btn className="w-full" onClick={() => go("game")}>Voltar ao jogo</Btn>
        </Card>
      )}
      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-1">Confiança do dono</div>
        <Bar value={myTeam.ownerConfidence} max={100} color="#f59e0b" />
        <div className="flex justify-between text-xs text-slate-500 mt-1 mb-3">
          <span>{myTeam.ownerConfidence}/100</span>
          {myTeam.ownerConfidence < 25 && <span className="text-red-400 font-semibold">Seu emprego está em risco!</span>}
        </div>
        <div className="text-xs text-slate-400 mb-1">Apoio da torcida</div>
        <Bar value={myTeam.fanSupport} max={100} color="#38bdf8" />
      </Card>

      {career.phase === "season" && (
        <Card className="mb-4">
          {nextGame ? (
            <>
              <div className="text-xs text-slate-400 mb-2">Semana {career.week} de 17</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">{isHome ? "Em casa vs" : "Fora contra"}</div>
                  <div className="font-black text-xl">{oppTeam.city} {oppTeam.name}</div>
                </div>
                <div className="text-3xl">🏈</div>
              </div>
              <Btn className="w-full mt-4 py-3" color={tm.c1} disabled={gamePending} onClick={onPlayWeek}>Jogar semana {career.week}</Btn>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="font-bold mb-2">Temporada regular encerrada!</div>
              <Btn disabled={gamePending} onClick={onPlayWeek}>Ver classificação final e playoffs</Btn>
            </div>
          )}
        </Card>
      )}

      {career.phase === "playoffs" && (
        <Card className="mb-4">
          <div className="font-bold mb-2">🏆 Playoffs — {career.playoffs.roundLabel}</div>
          <div className="text-sm text-slate-300 mb-3">{career.playoffs.champion ? `Campeão: ${TEAM_META.find(t=>t.abbr===career.playoffs.champion)?.name}!` : "Confira o chaveamento em Classificação."}</div>
          {!career.playoffs.champion && <Btn disabled={gamePending} onClick={onSimPlayoffRound}>Simular rodada</Btn>}
          {career.playoffs.champion && <Btn disabled={gamePending} onClick={onSimPlayoffRound}>Avançar para a offseason</Btn>}
        </Card>
      )}

      {career.phase === "offseason" && (
        <Card className="mb-4">
          <div className="font-bold mb-2">🛠️ Offseason {career.year}</div>
          <p className="text-sm text-slate-400 mb-3">Cuide da free agency, do draft e das trocas antes de avançar para a próxima temporada.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Btn variant="ghost" onClick={() => go("freeagency")}>Free Agency</Btn>
            <Btn variant="ghost" onClick={() => go("draft")}>Draft</Btn>
          </div>
          <Btn className="w-full" color={tm.c1} onClick={onPlayWeek}>Avançar para {career.year + 1}</Btn>
        </Card>
      )}

      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-2">Cap space</div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black tabular-nums">${(CAP - capUsed(myTeam.roster)).toFixed(1)}M</span>
          <span className="text-xs text-slate-500">de ${CAP}M usados</span>
        </div>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 mb-2">Últimas notícias</div>
        <div className="space-y-1 text-sm text-slate-300">
          {[...career.news].slice(-6).reverse().map((n, i) => <div key={i} className="border-b border-white/5 pb-1 last:border-0">{n}</div>)}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   ROSTER
   ============================================================ */

function RosterScreen({ myTeam }) {
  const groups = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Elenco</h2>
      <p className="text-xs text-slate-500 mb-4">{myTeam.roster.length} jogadores · cap usado ${capUsed(myTeam.roster).toFixed(1)}M / ${CAP}M</p>
      {groups.map((pos) => {
        const players = myTeam.roster.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
        if (!players.length) return null;
        return (
          <Card key={pos} className="mb-3">
            <div className="text-xs text-slate-400 mb-1">{pos}</div>
            {players.map((p) => <PlayerRow key={p.id} p={p} showStats />)}
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   DEPTH CHART
   ============================================================ */

const RESERVE_SLOTS = new Set(["QB2", "RB2", "BEN1", "BEN2", "BEN3", "BEN4", "BEN5"]);

function DepthChartScreen({ myTeam, onSwap }) {
  const dlSlots = myTeam.scheme === "3-4" ? ["DE1", "DE2", "NT1"] : ["DE1", "DE2", "DT1", "DT2"];
  const lbSlots = myTeam.scheme === "3-4" ? ["LB1", "LB2", "LB3", "LB4"] : ["LB1", "LB2", "LB3"];
  const groupSlots = {
    "Quarterbacks": ["QB1", "QB2"],
    "Corredores": ["RB1", "RB2"],
    "Recebedores": ["WR1", "WR2", "WR3", "TE1"],
    "Linha ofensiva": ["LT", "LG", "C", "RG", "RT"],
    [`Linha defensiva (${myTeam.scheme})`]: dlSlots,
    "Linebackers": lbSlots,
    "Defesa secundária": ["CB1", "CB2", "CB3 (nickel)", "S1", "S2"],
    "Special teams": ["K1", "P1"],
    "Banco": ["BEN1", "BEN2", "BEN3", "BEN4", "BEN5"],
  };
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Escalação</h2>
      <p className="text-xs text-slate-500 mb-1">Esquema defensivo: <span className="text-slate-200 font-semibold">{myTeam.scheme}</span></p>
      <p className="text-xs text-slate-500 mb-4">Toque em um jogador e depois em outro da mesma posição para trocar de ordem.</p>
      {Object.entries(groupSlots).map(([label, slots]) => (
        <Card key={label} className="mb-3">
          <div className="text-xs text-slate-400 mb-1">{label}</div>
          {slots.map((rawKey) => {
            const slotKey = rawKey.replace(" (nickel)", "");
            const p = myTeam.roster.find((pl) => pl.slot === slotKey);
            if (!p) return null;
            const isReserve = RESERVE_SLOTS.has(slotKey);
            return <PlayerRow key={slotKey} p={p} right={
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isReserve ? "bg-white/5 text-slate-400" : "bg-green-500/15 text-green-400"}`}>
                  {isReserve ? "reserva" : "titular"}
                </span>
                <button onClick={() => onSwap(slotKey)} className="text-[11px] text-blue-400 font-semibold px-1">trocar</button>
              </div>
            } />;
          })}
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   TACTICS
   ============================================================ */

function TacticsScreen({ tendencies, onChange }) {
  const personnel = tendencies.personnel ?? DEFAULT_PERSONNEL;
  const setPersonnel = (key, v) => {
    const others = ["p11", "p12", "p21"].filter((k) => k !== key).reduce((s, k) => s + (personnel[k] ?? 0), 0);
    const capped = clamp(v, 0, 100 - others);
    const p10 = clamp(100 - capped - others, 0, 100);
    onChange({ ...tendencies, personnel: { ...personnel, [key]: capped, p10 } });
  };
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Táticas</h2>
      <p className="text-xs text-slate-500 mb-4">Defina como seu time vai jogar nas próximas partidas.</p>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Estilo ofensivo</span><span className="text-slate-400">{Math.round(tendencies.passRatio*100)}% passe</span></div>
        <input type="range" min="20" max="85" value={Math.round(tendencies.passRatio*100)}
          onChange={(e) => onChange({ ...tendencies, passRatio: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Corrida pesada</span><span>Passe pesado</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Agressividade no 4º down / decisões</span><span className="text-slate-400">{Math.round(tendencies.aggressive*100)}%</span></div>
        <input type="range" min="0" max="100" value={Math.round(tendencies.aggressive*100)}
          onChange={(e) => onChange({ ...tendencies, aggressive: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Conservador (chuta sempre)</span><span>Agressivo (vai pro tudo ou nada)</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Rotação de corredores</span><span className="text-slate-400">{Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}% das corridas p/ RB2</span></div>
        <input type="range" min="0" max="50" value={Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}
          onChange={(e) => onChange({ ...tendencies, rb2CarryShare: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB1 carrega tudo</span><span>Divide bem com o RB2</span></div>
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Personnel (agrupamentos em campo)</div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>11 (1 RB, 1 TE, 3 WR) — padrão</span><span className="text-slate-400">{personnel.p11}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p11} onChange={(e) => setPersonnel("p11", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>12 (1 RB, 2 TE, 2 WR) — reforça bloqueio</span><span className="text-slate-400">{personnel.p12}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p12} onChange={(e) => setPersonnel("p12", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>21 (2 RB, 1 TE, 2 WR) — pesado, corrida</span><span className="text-slate-400">{personnel.p21}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p21} onChange={(e) => setPersonnel("p21", Number(e.target.value))} className="w-full" />
        </div>
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-white/10">
          <span>10 (1 RB, 0 TE, 4 WR) — formação leve/spread</span><span>{personnel.p10}% (resto automático)</span>
        </div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Formação ligeira (vazia) em 11 / 10 personnel</span><span className="text-slate-400">{tendencies.lightFormationShare ?? 20}%</span></div>
        <input type="range" min="0" max="60" value={tendencies.lightFormationShare ?? 20}
          onChange={(e) => onChange({ ...tendencies, lightFormationShare: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB sempre fica pra bloquear</span><span>RB solto como recebedor extra</span></div>
      </Card>
      <Card>
        <div className="text-sm text-slate-300 mb-2">Um perfil mais agressivo tenta mais 4ª descidas e FGs mais longos; um perfil conservador prioriza punt e field goals seguros.</div>
        <div className="text-sm text-slate-300 mb-2">Dar mais corridas ao RB2 poupa o RB1 (menos desgaste ao longo da temporada), mas o RB2 costuma render um pouco menos por jarda.</div>
        <div className="text-sm text-slate-300 mb-2">Personnel 12/21 traz um bloqueador extra (corrida mais forte, menos blitz sofrido), mas reduz as opções de rota — sem WR3 em campo. 10 personnel é o oposto: mais recebedores, porém corrida mais fraca.</div>
        <div className="text-sm text-slate-300">Formação vazia (só disponível em 11/10) manda o RB pra rota em vez de bloquear — mais um recebedor, mas qualquer blitz chega sem ninguém pra segurar.</div>
      </Card>
    </div>
  );
}

/* ============================================================
   SCHEDULE / STANDINGS / PLAYOFFS
   ============================================================ */

function ScheduleScreen({ career, myTeam }) {
  const divTeams = (conf, div) => Object.values(career.leagueTeams).filter((t) => t.conf === conf && t.div === div)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  const divs = [["AFC","East"],["AFC","North"],["AFC","South"],["AFC","West"],["NFC","East"],["NFC","North"],["NFC","South"],["NFC","West"]];
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-3">Classificação</h2>
      {career.phase === "playoffs" && career.playoffs && (
        <Card className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Playoffs — {career.playoffs.roundLabel}</div>
          {["afc","nfc"].map((c) => (
            <div key={c} className="mb-2">
              <div className="text-[11px] text-slate-500 uppercase mb-1">{c.toUpperCase()}</div>
              {(career.playoffs[c + "Bracket"] || []).map((m, i) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span className={m.winner === m.a?.abbr ? "text-green-400" : ""}>{m.a ? `${m.a.abbr} (${m.a.seed})` : "BYE"}</span>
                  <span className="tabular-nums">{m.score ? `${m.score[m.a?.abbr]}-${m.score[m.b?.abbr]}` : "vs"}</span>
                  <span className={m.winner === m.b?.abbr ? "text-green-400" : ""}>{m.b ? `${m.b.abbr} (${m.b.seed})` : "BYE"}</span>
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-3">
        {divs.map(([conf, div]) => (
          <Card key={conf + div}>
            <div className="text-xs text-slate-400 mb-1">{conf} {div}</div>
            {divTeams(conf, div).map((t) => (
              <div key={t.abbr} className={`flex justify-between text-sm py-1 ${t.abbr === myTeam.abbr ? "font-bold text-white" : "text-slate-300"}`}>
                <span>{t.abbr}</span>
                <span className="tabular-nums">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} <span className="text-slate-500">({t.pf}-{t.pa})</span></span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ROUND-BY-ROUND RESULTS / BOX SCORES
   ============================================================ */

function bestBy(list, key) {
  return [...(list || [])].filter((p) => p.stats?.[key]).sort((a, b) => b.stats[key] - a.stats[key])[0];
}

function BoxScoreLine({ p }) {
  if (!p) return null;
  const line = primaryStatLine({ pos: p.pos, seasonStats: p.stats });
  if (!line) return null;
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-slate-300">{p.name} <span className="text-slate-500">({p.pos})</span></span>
      <span className="text-slate-400 tabular-nums">{line}</span>
    </div>
  );
}

function TeamBoxScore({ abbr, list }) {
  const passer = bestBy(list, "passYards");
  const rushers = [...(list || [])].filter((p) => p.stats?.rushYards).sort((a, b) => b.stats.rushYards - a.stats.rushYards).slice(0, 2);
  const receiver = bestBy(list, "receivingYards");
  const tackler = bestBy(list, "tackles");
  const sacker = bestBy(list, "sacks");
  const presser = bestBy(list, "qbHurries");
  const picker = bestBy(list, "interceptions");
  return (
    <div>
      <div className="text-xs font-bold text-slate-400 mb-1">{abbr}</div>
      <BoxScoreLine p={passer} />
      {rushers.map((r) => <BoxScoreLine key={r.id} p={r} />)}
      <BoxScoreLine p={receiver} />
      <BoxScoreLine p={tackler} />
      <BoxScoreLine p={sacker} />
      {presser && presser.id !== sacker?.id && <BoxScoreLine p={presser} />}
      <BoxScoreLine p={picker} />
    </div>
  );
}

function ResultsScreen({ career }) {
  const maxWeek = Math.min(17, Math.max(1, career.phase === "season" ? career.week - 1 : 17));
  const [week, setWeek] = useState(Math.max(1, maxWeek));
  const [openIdx, setOpenIdx] = useState(null);
  const games = (career.schedule[week - 1] || []).filter((g) => g.homeScore !== undefined || g.awayScore !== undefined);

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-black">Resultados</h2>
        <div className="flex items-center gap-2 text-sm">
          <button disabled={week <= 1} onClick={() => { setWeek((w) => w - 1); setOpenIdx(null); }} className="px-2 py-1 rounded-md bg-white/5 disabled:opacity-30">◀</button>
          <span className="tabular-nums">Semana {week}</span>
          <button disabled={week >= maxWeek} onClick={() => { setWeek((w) => w + 1); setOpenIdx(null); }} className="px-2 py-1 rounded-md bg-white/5 disabled:opacity-30">▶</button>
        </div>
      </div>
      {!games.length && <Card><div className="text-sm text-slate-400">Nenhum jogo simulado ainda nesta semana.</div></Card>}
      <div className="space-y-2">
        {games.map((g, i) => {
          const open = openIdx === i;
          const homeWon = g.homeScore > g.awayScore;
          return (
            <Card key={i}>
              <button className="w-full flex items-center justify-between" onClick={() => setOpenIdx(open ? null : i)}>
                <span className={`text-sm ${!homeWon ? "font-bold text-white" : "text-slate-300"}`}>{g.away}</span>
                <span className="text-sm font-black tabular-nums">{g.awayScore} — {g.homeScore}</span>
                <span className={`text-sm ${homeWon ? "font-bold text-white" : "text-slate-300"}`}>{g.home}</span>
              </button>
              {open && g.boxScore && (
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
                  <TeamBoxScore abbr={g.away} list={g.boxScore.away} />
                  <TeamBoxScore abbr={g.home} list={g.boxScore.home} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   GAME SCREEN (play-by-play)
   ============================================================ */

const MINIFIELD_KIND_META = {
  run: { color: "#4ade80", label: "Corrida" },
  pass: { color: "#38bdf8", label: "Passe completo" },
  incomplete: { color: "#94a3b8", label: "Passe incompleto" },
  interception: { color: "#f87171", label: "Interceptação!" },
  sack: { color: "#f87171", label: "Sack" },
  fumble: { color: "#f87171", label: "Fumble!" },
  touchdown: { color: "#facc15", label: "TOUCHDOWN!" },
  "fieldgoal-good": { color: "#c084fc", label: "Field goal bom" },
  "fieldgoal-miss": { color: "#94a3b8", label: "Field goal errado" },
  punt: { color: "#94a3b8", label: "Punt" },
  kickoff: { color: "#94a3b8", label: "Pontapé inicial" },
  penalty: { color: "#fb923c", label: "Penalidade" },
  final: { color: "#64748b", label: "Fim de jogo" },
  info: { color: "#64748b", label: "" },
};

// Compact 2D field: draws the line of scrimmage, the first-down marker, and
// an arrow showing the direction (esquerda/meio/direita) and length of the
// play that's currently revealed in the log, color-coded by outcome.
function MiniField({ play, offTeam, defTeam }) {
  if (!play) return null;
  const W = 320, H = 96, padX = 18;
  const fieldW = W - padX * 2;
  const toX = (yd) => padX + clamp(yd, 0, 100) / 100 * fieldW;
  const losX = toX(play.ballOn);
  const afterYd = clamp(play.ballOn + (play.yards || 0), 0, 100);
  const afterX = toX(afterYd);
  const fdX = play.distance > 0 ? toX(play.ballOn + play.distance) : null;
  const laneY = play.dir === "esquerda" ? 26 : play.dir === "direita" ? 70 : 48;
  const meta = MINIFIELD_KIND_META[play.kind] || MINIFIELD_KIND_META.info;
  const drawArrow = ["run", "pass", "sack", "fumble", "penalty"].includes(play.kind);
  const ballX = play.kind === "touchdown" ? toX(100) : afterX;
  return (
    <Card className="mb-3 !p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 rounded-md" style={{ background: "#0d2818" }}>
        <rect x={0} y={0} width={padX} height={H} fill={defTeam?.c1 || "#1e293b"} opacity="0.55" />
        <rect x={W - padX} y={0} width={padX} height={H} fill={offTeam?.c1 || "#1e293b"} opacity="0.55" />
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={toX(i * 10)} y1={6} x2={toX(i * 10)} y2={H - 6} stroke="rgba(255,255,255,0.18)" strokeWidth={i === 5 ? 1.5 : 1} />
        ))}
        {fdX !== null && <line x1={fdX} y1={2} x2={fdX} y2={H - 2} stroke="#facc15" strokeWidth="2" />}
        <line x1={losX} y1={2} x2={losX} y2={H - 2} stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
        {drawArrow && (
          <line x1={losX} y1={laneY} x2={afterX} y2={laneY} stroke={meta.color} strokeWidth="4" strokeLinecap="round" markerEnd="url(#mf-arrow)" />
        )}
        <circle cx={ballX} cy={laneY} r="5" fill={meta.color} stroke="#0d2818" strokeWidth="1.5" />
        <defs>
          <marker id="mf-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={meta.color} />
          </marker>
        </defs>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
        <span>{play.offAbbr}{play.down ? ` · ${play.down}ª e ${play.distance > 0 ? play.distance : "gol"}` : ""}{play.personnel && play.personnel !== "11" ? ` · ${play.personnel} personnel` : ""}</span>
        <span className="font-semibold" style={{ color: meta.color }}>
          {meta.label}{typeof play.yards === "number" && drawArrow ? ` (${play.yards > 0 ? "+" : ""}${play.yards} jds)` : ""}
        </span>
      </div>
    </Card>
  );
}

function GameScreen({ career, myTeam, go, onAdvance }) {
  const g = career.lastGame;
  if (!g) return <div className="pb-24"><Card>Nenhum jogo simulado ainda.</Card></div>;
  const homeT = TEAM_META.find((t) => t.abbr === g.home), awayT = TEAM_META.find((t) => t.abbr === g.away);
  const shown = Math.min(g.log.length, career.gameRevealCount ?? g.log.length);
  const finished = shown >= g.log.length;
  const liveScore = shown > 0 && g.scoreTimeline ? g.scoreTimeline[shown - 1] : { [g.home]: 0, [g.away]: 0 };
  const curPlay = g.plays && shown > 0 ? g.plays[shown - 1] : null;
  const curOffTeam = curPlay && TEAM_META.find((t) => t.abbr === curPlay.offAbbr);
  const curDefTeam = curPlay && TEAM_META.find((t) => t.abbr === curPlay.defAbbr);
  return (
    <div className="pb-24">
      <Card className="mb-3 text-center">
        <div className="text-xs text-slate-400 mb-1">{finished ? "Final" : "Ao vivo"}</div>
        <div className="flex items-center justify-center gap-6">
          <div><div className="text-xs text-slate-400">{awayT.abbr}</div><div className="text-3xl font-black tabular-nums">{liveScore[g.away] ?? 0}</div></div>
          <div className="text-slate-600">—</div>
          <div><div className="text-xs text-slate-400">{homeT.abbr}</div><div className="text-3xl font-black tabular-nums">{liveScore[g.home] ?? 0}</div></div>
        </div>
      </Card>
      <MiniField play={curPlay} offTeam={curOffTeam} defTeam={curDefTeam} />
      <Card className="mb-3 max-h-96 overflow-y-auto text-sm space-y-1.5">
        {g.log.slice(0, shown).map((l, i) => <div key={i} className="text-slate-300 border-b border-white/5 pb-1 last:border-0">{l}</div>)}
      </Card>
      {!finished ? (
        <Btn className="w-full" onClick={onAdvance}>Avançar jogadas</Btn>
      ) : (
        <Btn className="w-full" onClick={() => go("hub")}>Voltar ao painel</Btn>
      )}
    </div>
  );
}

function PressModal({ eventKey, onChoose }) {
  const ev = PRESS_EVENTS[eventKey];
  if (!ev) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-30 p-4">
      <div className="bg-[#131B2E] border border-white/10 rounded-lg p-5 w-full max-w-md">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs">🎙️ Coletiva de imprensa</div>
        <p className="mb-4 text-slate-100">{ev.prompt}</p>
        <div className="space-y-2">
          {ev.options.map((o, i) => (
            <button key={i} onClick={() => onChoose(o)} className="w-full text-left px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FREE AGENCY
   ============================================================ */

function FreeAgencyScreen({ career, myTeam, onSign }) {
  const cap = CAP - capUsed(myTeam.roster);
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Free Agency</h2>
      <p className="text-xs text-slate-500 mb-4">Cap disponível: <span className="text-slate-200 font-semibold">${cap.toFixed(1)}M</span></p>
      <Card>
        {career.freeAgentPool.length === 0 && <div className="text-sm text-slate-400">Nenhum agente livre restante.</div>}
        {career.freeAgentPool.map((p) => {
          const targetSlot = myTeam.roster.filter((r) => r.pos === p.pos).sort((a, b) => a.ovr - b.ovr)[0];
          const affordable = cap >= p.salary;
          return (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><PosPill pos={p.pos}/><span className="text-sm font-medium">{p.name}</span></div>
                <div className="text-[11px] text-slate-500">OVR {p.ovr} · idade {p.age} · ${p.salary.toFixed(1)}M/ano · substituiria {targetSlot?.name} ({targetSlot?.ovr})</div>
              </div>
              <Btn variant="ghost" className="!px-2 !py-1 !text-xs" disabled={!affordable} onClick={() => onSign(p, targetSlot?.slot)}>Assinar</Btn>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ============================================================
   DRAFT
   ============================================================ */

function DraftScreen({ career, myTeam, onDraftPick, onSimToMyPick }) {
  const order = career.draftOrder;
  const idx = career.draftPickIndex;
  const totalPicks = order.length * 7;
  const round = Math.floor(idx / order.length) + 1;
  const pickInRound = (idx % order.length) + 1;
  const onClock = order[idx % order.length];
  const isMe = onClock === myTeam.abbr;
  const top = career.draftClass.slice(0, 12);
  if (idx >= totalPicks) {
    return <div className="pb-24"><Card><div className="font-bold mb-1">Draft encerrado!</div><div className="text-sm text-slate-400">Confira os novatos no seu elenco.</div></Card></div>;
  }
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Draft {career.year}</h2>
      <p className="text-xs text-slate-500 mb-4">Rodada {round}, pick {pickInRound} — na vez: <span className="font-semibold text-slate-200">{onClock}</span></p>
      {!isMe && <Btn className="w-full mb-3" onClick={onSimToMyPick}>Simular até minha próxima escolha</Btn>}
      <Card>
        <div className="text-xs text-slate-400 mb-2">Melhores disponíveis</div>
        {top.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
              <div className="flex items-center gap-2"><PosPill pos={p.pos}/><span className="text-sm font-medium">{p.name}</span></div>
              <div className="text-[11px] text-slate-500">projeção OVR {p.ovr} · idade {p.age}</div>
            </div>
            {isMe && <Btn variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => onDraftPick(p)}>Draftar</Btn>}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   TRADE CENTER
   ============================================================ */

/* ============================================================
   STATS
   ============================================================ */

function StatsScreen({ career, myTeam }) {
  const [cat, setCat] = useState("passYards");
  const catDef = STAT_CATEGORIES.find((c) => c.key === cat);
  const leaders = leagueLeaders(career.leagueTeams, cat, 8);
  const myLeaders = STAT_CATEGORIES.map((c) => {
    const top = [...myTeam.roster].filter((p) => p.seasonStats?.[c.key]).sort((a, b) => (b.seasonStats[c.key] || 0) - (a.seasonStats[c.key] || 0))[0];
    return { c, top };
  }).filter((r) => r.top);

  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Estatísticas</h2>
      <p className="text-xs text-slate-500 mb-4">Acumulado da temporada {career.year}.</p>

      <Card className="mb-4">
        <div className="text-xs text-slate-400 mb-2">Líderes do seu time</div>
        {myLeaders.length === 0 && <div className="text-sm text-slate-500">Ainda sem estatísticas — jogue uma semana.</div>}
        <div className="space-y-1.5">
          {myLeaders.map(({ c, top }) => (
            <div key={c.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{c.label}</span>
              <span className="font-semibold">{top.name} <span className="text-slate-500 tabular-nums">({top.seasonStats[c.key]})</span></span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-3">
        <div className="text-xs text-slate-400 mb-2">Categoria</div>
        <div className="flex flex-wrap gap-1.5">
          {STAT_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`text-[11px] px-2 py-1 rounded-md border ${cat === c.key ? "bg-white text-black border-white" : "border-white/15 text-slate-300"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 mb-2">Líderes da liga — {catDef.label}</div>
        {leaders.length === 0 && <div className="text-sm text-slate-500">Sem dados ainda.</div>}
        {leaders.map((row, i) => (
          <div key={row.player.id} className={`flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 ${row.teamAbbr === myTeam.abbr ? "text-white font-semibold" : "text-slate-300"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 w-4">{i + 1}</span>
              <PosPill pos={row.player.pos} />
              <span className="truncate text-sm">{row.player.name}</span>
              <span className="text-[11px] text-slate-500">{row.teamAbbr}</span>
            </div>
            <span className="tabular-nums text-sm">{row.value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function TradeScreen({ myTeam, career, onTrade }) {
  const [targetAbbr, setTargetAbbr] = useState(Object.keys(career.leagueTeams).find((a) => a !== myTeam.abbr));
  const [mine, setMine] = useState(null);
  const [theirs, setTheirs] = useState(null);
  const target = career.leagueTeams[targetAbbr];
  const myVal = mine ? playerValue(mine) : 0;
  const theirVal = theirs ? playerValue(theirs) : 0;
  const fair = theirs && mine ? theirVal <= myVal * 1.15 : false;
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Central de trocas</h2>
      <p className="text-xs text-slate-500 mb-4">Só são permitidas trocas entre jogadores da mesma posição.</p>
      <Card className="mb-3">
        <label className="text-xs text-slate-400">Time alvo</label>
        <select value={targetAbbr} onChange={(e) => { setTargetAbbr(e.target.value); setMine(null); setTheirs(null); }}
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm">
          {Object.keys(career.leagueTeams).filter((a) => a !== myTeam.abbr).map((a) => <option key={a} value={a}>{career.leagueTeams[a].city} {career.leagueTeams[a].name}</option>)}
        </select>
      </Card>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card>
          <div className="text-xs text-slate-400 mb-1">Você oferece</div>
          <select value={mine?.id || ""} onChange={(e) => setMine(myTeam.roster.find((p) => p.id === Number(e.target.value)))}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-2 text-xs">
            <option value="">Selecione</option>
            {myTeam.roster.map((p) => <option key={p.id} value={p.id}>{p.pos} {p.name} ({p.ovr})</option>)}
          </select>
        </Card>
        <Card>
          <div className="text-xs text-slate-400 mb-1">Você recebe</div>
          <select value={theirs?.id || ""} onChange={(e) => setTheirs(target.roster.find((p) => p.id === Number(e.target.value)))}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-2 text-xs">
            <option value="">Selecione</option>
            {target.roster.filter((p) => !mine || p.pos === mine.pos).map((p) => <option key={p.id} value={p.id}>{p.pos} {p.name} ({p.ovr})</option>)}
          </select>
        </Card>
      </div>
      <Card className="mb-3 text-sm flex justify-between">
        <span>Valor enviado: <b>{myVal.toFixed(0)}</b></span>
        <span>Valor recebido: <b>{theirVal.toFixed(0)}</b></span>
      </Card>
      <Btn className="w-full" disabled={!mine || !theirs || mine.pos !== theirs.pos} onClick={() => onTrade(mine, theirs, targetAbbr, fair)}>
        Propor troca
      </Btn>
    </div>
  );
}

function FiredScreen({ career, onRestart }) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">📦</div>
      <h1 className="text-2xl font-black mb-2">Você foi demitido</h1>
      <p className="text-slate-400 mb-1 max-w-sm">A diretoria perdeu a confiança em {career.coachName} depois de {career.seasonsCoached} temporada(s) no comando do {career.teamAbbr}.</p>
      <Btn className="mt-6" onClick={onRestart}>Começar nova carreira</Btn>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

function newCareerState(teamAbbr, coachName) {
  const leagueTeams = buildLeague();
  const schedule = buildSchedule(leagueTeams);
  const meta = TEAM_META.find((t) => t.abbr === teamAbbr);
  return {
    id: `${teamAbbr}-${Date.now()}`,
    coachName, teamAbbr, year: 2026, week: 1, phase: "season", seasonsCoached: 0,
    leagueTeams, schedule,
    tendencies: { passRatio: 0.55, aggressive: 0.5, rb2CarryShare: 0.2, personnel: { ...DEFAULT_PERSONNEL }, lightFormationShare: 20 },
    lastGame: null, pressPending: null,
    freeAgentPool: generateFreeAgents(2026),
    draftClass: null, draftPickIndex: 0, draftOrder: null,
    news: [`Bem-vindo, técnico ${coachName}! Você assume o comando do ${meta.city} ${meta.name} para a temporada 2026.`],
    playoffs: null,
  };
}

const AI_TEND = { passRatio: 0.55, aggressive: 0.45, rb2CarryShare: 0.22, personnel: { ...DEFAULT_PERSONNEL }, lightFormationShare: 18 };
export { newCareerState, applyResult, conferenceSeeds, draftOrderFromStandings, findSlotForRookie,
  insertPlayer, retireAndRefreshLeague, AI_TEND, standingsSorted, leagueLeaders, resetSeasonStats, STAT_CATEGORIES };

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [saves, setSaves] = useState([]);
  const [career, setCareer] = useState(null);
  const [pressChoice, setPressChoice] = useState(null);
  const [swapFrom, setSwapFrom] = useState(null);

  const refreshSaves = useCallback(() => {
    try {
      const list = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("nflcareer:")) continue;
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const c = JSON.parse(raw);
            list.push({ id: c.id, coachName: c.coachName, teamAbbr: c.teamAbbr, year: c.year, week: c.week });
          }
        } catch (e) {}
      }
      setSaves(list);
    } catch (e) { setSaves([]); }
  }, []);

  useEffect(() => { refreshSaves(); }, [refreshSaves]);

  const persist = useCallback((c) => {
    try { localStorage.setItem("nflcareer:" + c.id, JSON.stringify(c)); } catch (e) {}
  }, []);

  useEffect(() => { if (career) persist(career); }, [career, persist]);

  function go(s) { setScreen(s); }

  function onNewCareer() { setScreen("newcareer"); }
  function onCreateCareer(teamAbbr, coachName) {
    const c = newCareerState(teamAbbr, coachName);
    setCareer(c);
    setScreen("hub");
  }
  function onLoadCareer(id) {
    try {
      const raw = localStorage.getItem("nflcareer:" + id);
      if (raw) { setCareer(JSON.parse(raw)); setScreen("hub"); }
    } catch (e) {}
  }
  function onDeleteCareer(id) {
    try { localStorage.removeItem("nflcareer:" + id); refreshSaves(); } catch (e) {}
  }
  function onRestart() { setCareer(null); setScreen("menu"); refreshSaves(); }

  const myTeam = career ? career.leagueTeams[career.teamAbbr] : null;

  function playWeek() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const round = c.schedule[c.week - 1];
      const rng = mulberry32(seedFromString(c.id + "-w" + c.week));

      if (!round) {
        // regular season over -> seed playoffs
        const afc = conferenceSeeds(c.leagueTeams, "AFC");
        const nfc = conferenceSeeds(c.leagueTeams, "NFC");
        c.phase = "playoffs";
        c.playoffs = {
          roundLabel: "Wild Card",
          afcSeeds: afc, nfcSeeds: nfc,
          afcBracket: [{ a: afc[1], b: afc[6] }, { a: afc[2], b: afc[5] }, { a: afc[3], b: afc[4] }],
          nfcBracket: [{ a: nfc[1], b: nfc[6] }, { a: nfc[2], b: nfc[5] }, { a: nfc[3], b: nfc[4] }],
          afcBye: afc[0], nfcBye: nfc[0],
          champion: null,
        };
        c.news.push(`Temporada regular encerrada! Playoffs definidos.`);
        return c;
      }

      let myGame = null;
      round.forEach((g) => {
        if (g.home === c.teamAbbr || g.away === c.teamAbbr) { myGame = g; return; }
        const beforeH = snapshotRosterStats(c.leagueTeams[g.home].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[g.away].roster);
        const scores = simGameQuick(g.home, g.away, c.leagueTeams, { home: AI_TEND, away: AI_TEND }, rng);
        applyResult(c.leagueTeams, g.home, g.away, scores[g.home], scores[g.away]);
        g.homeScore = scores[g.home]; g.awayScore = scores[g.away];
        g.boxScore = {
          home: diffRosterStats(c.leagueTeams[g.home].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[g.away].roster, beforeA),
        };
      });

      if (myGame) {
        const tendencies = {
          home: myGame.home === c.teamAbbr ? c.tendencies : AI_TEND,
          away: myGame.away === c.teamAbbr ? c.tendencies : AI_TEND,
        };
        const beforeH = snapshotRosterStats(c.leagueTeams[myGame.home].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[myGame.away].roster);
        const { score, log, scoreTimeline, plays } = simGameDetailed(myGame.home, myGame.away, c.leagueTeams, tendencies, rng);
        applyResult(c.leagueTeams, myGame.home, myGame.away, score[myGame.home], score[myGame.away]);
        myGame.homeScore = score[myGame.home]; myGame.awayScore = score[myGame.away];
        myGame.boxScore = {
          home: diffRosterStats(c.leagueTeams[myGame.home].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[myGame.away].roster, beforeA),
        };
        const oppAbbr = myGame.home === c.teamAbbr ? myGame.away : myGame.home;
        const won = score[c.teamAbbr] > score[oppAbbr];
        c.lastGame = {
          home: myGame.home, away: myGame.away, score, log, scoreTimeline, plays, resolved: false,
          pressKey: pickPressEvent(score[c.teamAbbr], score[oppAbbr]),
          newsLine: `Semana ${c.week}: ${won ? "Vitória" : "Derrota"} ${score[c.teamAbbr]}-${score[oppAbbr]} vs ${oppAbbr}.`,
        };
        c.gameRevealCount = Math.min(6, log.length);
      }

      Object.values(c.leagueTeams).forEach((t) => {
        t.roster.forEach((p) => { if (p.injuredWeeks > 0) p.injuredWeeks -= 1; });
        if (rng() < 0.12) {
          const cand = t.roster.filter((p) => p.pos !== "K" && p.pos !== "P" && p.injuredWeeks === 0);
          if (cand.length) {
            const victim = pick(rng, cand);
            victim.injuredWeeks = randInt(rng, 1, 3);
            if (t.abbr === c.teamAbbr) c.news.push(`${victim.name} sofreu uma lesão e ficará fora por ${victim.injuredWeeks} semana(s).`);
          }
        }
      });

      c.week += 1;
      return c;
    });
    setScreen("game");
  }

  function simPlayoffRound() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const rng = mulberry32(seedFromString(c.id + "-po" + c.playoffs.roundLabel));
      const po = c.playoffs;

      function resolveMatch(m) {
        if (!m.a) return { winnerObj: m.b, m };
        if (!m.b) return { winnerObj: m.a, m };
        const homeAbbr = m.a.abbr, awayAbbr = m.b.abbr;
        let score;
        const beforeH = snapshotRosterStats(c.leagueTeams[homeAbbr].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[awayAbbr].roster);
        if (homeAbbr === c.teamAbbr || awayAbbr === c.teamAbbr) {
          const tendencies = { home: homeAbbr === c.teamAbbr ? c.tendencies : AI_TEND, away: awayAbbr === c.teamAbbr ? c.tendencies : AI_TEND };
          const res = simGameDetailed(homeAbbr, awayAbbr, c.leagueTeams, tendencies, rng);
          score = res.score;
          c.lastGame = { home: homeAbbr, away: awayAbbr, score, log: res.log, scoreTimeline: res.scoreTimeline, plays: res.plays, resolved: true };
          c.gameRevealCount = Math.min(6, res.log.length);
        } else {
          score = simGameQuick(homeAbbr, awayAbbr, c.leagueTeams, { home: AI_TEND, away: AI_TEND }, rng);
        }
        m.score = score;
        m.boxScore = {
          home: diffRosterStats(c.leagueTeams[homeAbbr].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[awayAbbr].roster, beforeA),
        };
        const winnerAbbr = score[homeAbbr] >= score[awayAbbr] ? homeAbbr : awayAbbr;
        m.winner = winnerAbbr;
        return { winnerObj: winnerAbbr === m.a.abbr ? m.a : m.b, m };
      }

      if (po.roundLabel === "Wild Card") {
        const afcResults = po.afcBracket.map(resolveMatch).map((r) => r.winnerObj);
        const nfcResults = po.nfcBracket.map(resolveMatch).map((r) => r.winnerObj);
        const afcSorted = [...afcResults].sort((x, y) => x.seed - y.seed);
        const nfcSorted = [...nfcResults].sort((x, y) => x.seed - y.seed);
        po.afcBracket = [{ a: po.afcBye, b: afcSorted[2] }, { a: afcSorted[0], b: afcSorted[1] }];
        po.nfcBracket = [{ a: po.nfcBye, b: nfcSorted[2] }, { a: nfcSorted[0], b: nfcSorted[1] }];
        po.roundLabel = "Divisional";
        c.news.push("Wild Card concluído! Divisional definida.");
      } else if (po.roundLabel === "Divisional") {
        const afcW = po.afcBracket.map(resolveMatch).map((r) => r.winnerObj);
        const nfcW = po.nfcBracket.map(resolveMatch).map((r) => r.winnerObj);
        po.afcBracket = [{ a: afcW[0], b: afcW[1] }];
        po.nfcBracket = [{ a: nfcW[0], b: nfcW[1] }];
        po.roundLabel = "Final de Conferência";
        c.news.push("Jogos divisionais concluídos! Finais de conferência definidas.");
      } else if (po.roundLabel === "Final de Conferência") {
        const afcChamp = resolveMatch(po.afcBracket[0]).winnerObj;
        const nfcChamp = resolveMatch(po.nfcBracket[0]).winnerObj;
        po.superBowl = { a: afcChamp, b: nfcChamp };
        po.roundLabel = "Super Bowl";
        c.news.push(`Final de conferência concluída! Super Bowl: ${afcChamp.abbr} x ${nfcChamp.abbr}.`);
      } else if (po.roundLabel === "Super Bowl") {
        const { winnerObj } = resolveMatch(po.superBowl);
        po.champion = winnerObj.abbr;
        po.roundLabel = "Concluído";
        c.news.push(`🏆 ${winnerObj.abbr} venceu o Super Bowl ${c.year}!`);
      } else if (po.champion) {
        // move to offseason
        c.phase = "offseason";
        c.draftClass = generateDraftClass(c.year + 1);
        c.draftOrder = draftOrderFromStandings(c.leagueTeams);
        c.draftPickIndex = 0;
        c.freeAgentPool = generateFreeAgents(c.year + 1);
        c.seasonsCoached += 1;
      }
      return c;
    });
    setScreen("game");
  }

  function advanceToNextSeason() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const retirementNews = retireAndRefreshLeague(c.leagueTeams, c.year + 1);
      c.news.push(...retirementNews.slice(0, 5));
      Object.values(c.leagueTeams).forEach((t) => { t.wins = 0; t.losses = 0; t.ties = 0; t.pf = 0; t.pa = 0; });
      resetSeasonStats(c.leagueTeams);
      c.schedule = buildSchedule(c.leagueTeams);
      c.year += 1;
      c.week = 1;
      c.phase = "season";
      c.lastGame = null;
      c.playoffs = null;
      c.draftClass = null;
      c.draftPickIndex = 0;
      c.news.push(`Temporada ${c.year} começando!`);
      return c;
    });
    setScreen("hub");
  }

  function onHubAction() {
    if (career.phase === "season") playWeek();
    else if (career.phase === "playoffs") simPlayoffRound();
    else if (career.phase === "offseason") advanceToNextSeason();
  }

  function advanceGameReveal() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const g = c.lastGame;
      if (!g) return c;
      const newCount = Math.min(g.log.length, (c.gameRevealCount || 6) + 6);
      c.gameRevealCount = newCount;
      if (newCount >= g.log.length && !g.resolved) {
        g.resolved = true;
        if (g.newsLine) c.news.push(g.newsLine);
        if (g.pressKey) c.pressPending = g.pressKey;
      }
      return c;
    });
  }

  function choosePress(opt) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      t.ownerConfidence = clamp(t.ownerConfidence + opt.owner, 0, 100);
      t.fanSupport = clamp(t.fanSupport + opt.fan, 0, 100);
      c.pressPending = null;
      return c;
    });
  }

  function swapSlot(fromSlot) {
    if (!swapFrom) { setSwapFrom(fromSlot); return; }
    if (swapFrom === fromSlot) { setSwapFrom(null); return; }
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      const pA = t.roster.find((p) => p.slot === swapFrom);
      const pB = t.roster.find((p) => p.slot === fromSlot);
      if (pA && pB && pA.pos === pB.pos) { pA.slot = fromSlot; pB.slot = swapFrom; }
      return c;
    });
    setSwapFrom(null);
  }

  function signFreeAgent(fa, targetSlot) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      if (CAP - capUsed(t.roster) < fa.salary) return c;
      insertPlayer(t.roster, targetSlot, { ...fa, slot: targetSlot });
      c.freeAgentPool = c.freeAgentPool.filter((p) => p.id !== fa.id);
      c.news.push(`Contratado: ${fa.name} (${fa.pos}, OVR ${fa.ovr}).`);
      return c;
    });
  }

  function draftPick(prospect) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const teamAbbr = c.draftOrder[c.draftPickIndex % c.draftOrder.length];
      const t = c.leagueTeams[teamAbbr];
      const slot = findSlotForRookie(t.roster, prospect.pos);
      insertPlayer(t.roster, slot, { ...prospect, slot });
      c.draftClass = c.draftClass.filter((p) => p.id !== prospect.id);
      if (teamAbbr === c.teamAbbr) c.news.push(`Draft: ${teamAbbr} seleciona ${prospect.name} (${prospect.pos}).`);
      c.draftPickIndex += 1;
      return c;
    });
  }

  function simToMyPick() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const rng = mulberry32(seedFromString(c.id + "-draftauto" + c.draftPickIndex));
      const total = c.draftOrder.length * 7;
      while (c.draftPickIndex < total) {
        const teamAbbr = c.draftOrder[c.draftPickIndex % c.draftOrder.length];
        if (teamAbbr === c.teamAbbr) break;
        const prospect = c.draftClass[0];
        if (!prospect) break;
        const t = c.leagueTeams[teamAbbr];
        const slot = findSlotForRookie(t.roster, prospect.pos);
        insertPlayer(t.roster, slot, { ...prospect, slot });
        c.draftClass = c.draftClass.slice(1);
        c.draftPickIndex += 1;
      }
      return c;
    });
  }

  function proposeTrade(mine, theirs, targetAbbr, fair) {
    if (!fair) { alert("O outro time recusou: a proposta não é justa o suficiente."); return; }
    setCareer((prev) => {
      const c = structuredClone(prev);
      const my = c.leagueTeams[c.teamAbbr], their = c.leagueTeams[targetAbbr];
      const myIdx = my.roster.findIndex((p) => p.id === mine.id);
      const theirIdx = their.roster.findIndex((p) => p.id === theirs.id);
      const mySlot = my.roster[myIdx].slot, theirSlot = their.roster[theirIdx].slot;
      my.roster[myIdx] = { ...theirs, slot: mySlot };
      their.roster[theirIdx] = { ...mine, slot: theirSlot };
      c.news.push(`Troca concluída: ${mine.name} vai para ${targetAbbr} por ${theirs.name}.`);
      return c;
    });
  }

  // fired check
  useEffect(() => {
    if (career && myTeam && myTeam.ownerConfidence <= 0 && screen !== "fired") setScreen("fired");
  }, [career, myTeam, screen]);

  if (screen === "menu" || !career) {
    return screen === "newcareer"
      ? <NewCareerScreen onCreate={onCreateCareer} onBack={() => setScreen("menu")} />
      : <MenuScreen saves={saves} onNew={onNewCareer} onLoad={onLoadCareer} onDelete={onDeleteCareer} />;
  }

  if (screen === "fired") return <FiredScreen career={career} onRestart={onRestart} />;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 font-sans">
      <TopBar team={myTeam} career={career} />
      <div className="px-4 pt-4 max-w-lg mx-auto">
        {screen === "hub" && <HubScreen career={career} myTeam={myTeam} go={go} onPlayWeek={onHubAction} onSimPlayoffRound={onHubAction} />}
        {screen === "roster" && <RosterScreen myTeam={myTeam} />}
        {screen === "depth" && <DepthChartScreen myTeam={myTeam} onSwap={swapSlot} />}
        {screen === "tactics" && <TacticsScreen tendencies={career.tendencies} onChange={(t) => setCareer((p) => ({ ...p, tendencies: t }))} />}
        {screen === "schedule" && <ScheduleScreen career={career} myTeam={myTeam} />}
        {screen === "results" && <ResultsScreen career={career} />}
        {screen === "game" && <GameScreen career={career} myTeam={myTeam} go={go} onAdvance={advanceGameReveal} />}
        {screen === "freeagency" && <FreeAgencyScreen career={career} myTeam={myTeam} onSign={signFreeAgent} />}
        {screen === "draft" && career.draftClass && <DraftScreen career={career} myTeam={myTeam} onDraftPick={draftPick} onSimToMyPick={simToMyPick} />}
        {screen === "trade" && <TradeScreen myTeam={myTeam} career={career} onTrade={proposeTrade} />}
        {screen === "stats" && <StatsScreen career={career} myTeam={myTeam} />}
      </div>
      <BottomNav screen={screen} go={go} hasUnwatchedGame={!!(career.lastGame && (career.gameRevealCount ?? 0) < career.lastGame.log.length)} />
      {career.pressPending && <PressModal eventKey={career.pressPending} onChoose={choosePress} />}
    </div>
  );
}
