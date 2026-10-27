import { pick, randInt, clamp } from "../lib/rng.js";
import {
  attr, slotPlayer, activePlayer, offenseRating, defenseRating, teamOverall,
  manCover, zoneCover, routeSkill, finesseMove, powerMove, runDefRating,
  runBlockRating, passBlockRating,
} from "./ratings.js";
import { SCHEME_META } from "./coachesGen.js";
import { applyStaffBonuses, clearStaffBonuses } from "./staffEffects.js";

// The play-by-play game engine (simGameDetailed) plus the lighter
// statistical approximation used for the 15 games the user isn't
// watching (quickGameStats / simGameQuick). See the README/analysis for
// how these two are calibrated to line up statistically.

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
  const base = attr(p, "TKL") / 70;
  let posMult = p.pos === "LB" ? 2.0 : p.pos === "S" ? 1.5 : p.pos === "CB" ? 0.15 : 0.65; // DL default
  if (p.slot === "LB1" || p.slot === "S1") posMult *= 2.6;
  return base * posMult;
}

// In-game injuries: a small per-play chance for whoever just took the hit
// (ball carrier, receiver after the catch, or a sacked QB) to go down and
// not return. `activePlayer()` already benches anyone with injuredWeeks > 0
// in favor of a healthy backup, so setting it here takes effect on the very
// next snap — no separate substitution logic needed. Severity mirrors the
// weekly injury tiers (mostly minor, rarely long-term), independent of the
// weekly roll so watched games don't get double-counted.
const INJURY_CHANCE = { sack: 0.01, run: 0.004, pass: 0.0035 };
const INJURY_TIERS = [
  { chance: 0.6, weeks: [1, 2] },
  { chance: 0.27, weeks: [3, 5] },
  { chance: 0.1, weeks: [6, 9] },
  { chance: 0.03, weeks: [10, 16] },
];
function maybeInjure(rng, player, playKind) {
  const chance = INJURY_CHANCE[playKind];
  if (!chance || !player || player.injuredWeeks > 0 || rng() >= chance) return null;
  let roll = rng(), tier = INJURY_TIERS[0];
  for (const t of INJURY_TIERS) { if (roll < t.chance) { tier = t; break; } roll -= t.chance; }
  const weeks = randInt(rng, tier.weeks[0], tier.weeks[1]);
  player.injuredWeeks = weeks;
  player.injuryHistory = player.injuryHistory || [];
  player.injuryHistory.push({ weeks, type: "lesão em campo" });
  return { id: player.id, name: player.name, pos: player.pos, weeks };
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

// Run gaps: each one now names the lineman primarily responsible for that
// hole, so his individual run-block rating (vs. the defender who'd fill
// that gap) feeds into the yardage — not just flavor/visual direction.
const RUN_GAPS = [
  { dir: "esquerda", label: "por fora à esquerda", blockerSlot: "LT" },
  { dir: "esquerda", label: "entre guarda e tackle esquerdo", blockerSlot: "LG" },
  { dir: "meio", label: "pelo meio", blockerSlot: "C" },
  { dir: "meio", label: "pelo meio", blockerSlot: "C" },
  { dir: "direita", label: "entre guarda e tackle direito", blockerSlot: "RG" },
  { dir: "direita", label: "por fora à direita", blockerSlot: "RT" },
];

// excludeSlot: slot que fica para bloquear (ex.: "RB1" ou "TE1"); `true` = "RB1" (compat.)
function pickRouteConcept(rng, down, distance, tendO, excludeSlot, personnel) {
  const aggressive = tendO?.aggressive ?? 0.5;
  const info = PERSONNEL_INFO[personnel] || PERSONNEL_INFO["11"];
  let pool = ROUTE_CONCEPTS;
  const exclude = excludeSlot === true ? "RB1" : excludeSlot;
  if (exclude) pool = pool.filter((c) => c.targetSlot !== exclude);
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
// Quanto o RB / TE rende segurando um blitzer (multiplica o PBK dele; a OL não tem penalidade).
const PICKUP_PENALTY = { RB: 0.78, TE: 0.86 };
// QB móvel escapa de parte dos sacks (vira hurry). Máximo de sacks evitados.
const MOB_ESCAPE_MAX = 0.2;

// Cada confronto sorteia o movimento do rusher: finesse (FMV) ou power (PMV),
// com viés para o movimento em que ele é melhor.
function pickMove(rng, rusher) {
  const f = finesseMove(rusher), w = powerMove(rusher);
  return rng() < clamp(0.5 + (f - w) / 50, 0.15, 0.85) ? "FMV" : "PMV";
}

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

  let rbBlocking = false, teBlocking = false, blitzer = null;
  const sam = activePlayer(defRoster, "LB2"), will = activePlayer(defRoster, "LB3");
  const safeties = [activePlayer(defRoster, "S1"), activePlayer(defRoster, "S2")].filter(Boolean);
  const aggressive = tendD?.aggressive ?? 0.5;
  const blitzPickupMult = PERSONNEL_INFO[personnel]?.blitzPickupMult ?? 1;
  const blitzChance = clamp((0.13 + (aggressive - 0.5) * 0.35 + (down >= 3 && distance > 6 ? 0.08 : 0)) * blitzPickupMult, 0.05, 0.46);
  if ((sam || will) && rng() < blitzChance) {
    // ~1 em cada 5 blitz vem de um safety (usa finesse/power derivados de SPD/ACC e TKL/PUR)
    blitzer = safeties.length && rng() < 0.2 ? pick(rng, safeties) : pick(rng, [sam, will].filter(Boolean));
    const label = blitzer.slot === "LB2" ? "SAM" : blitzer.slot === "LB3" ? "WILL" : "safety";
    const rb = slotPlayer(offRoster, "RB1"), te = slotPlayer(offRoster, "TE1");
    if (blitzer && !empty) {
      // Em 12/21 personnel o TE às vezes fica para ajudar na proteção no lugar do RB.
      const teStays = !!(te && PERSONNEL_INFO[personnel]?.hasTE && (personnel === "12" || personnel === "21") && rng() < 0.45);
      const picker = teStays ? te : rb;
      if (picker) {
        if (teStays) teBlocking = true; else rbBlocking = true;
        matchups.push({ blocker: picker, rusher: blitzer, edge: `blitz do ${label}`, blockerPenalty: teStays ? PICKUP_PENALTY.TE : PICKUP_PENALTY.RB });
      }
    }
  }
  const covered = rbBlocking || teBlocking;
  if (!matchups.length) return { tier: "clean", rbBlocking, teBlocking, blitzer };

  let worst = matchups[0], worstDiff = -999, worstMove = "PMV";
  matchups.forEach((m) => {
    const move = pickMove(rng, m.rusher);
    const rushRating = move === "FMV" ? finesseMove(m.rusher) : powerMove(m.rusher);
    const blockRating = passBlockRating(m.blocker, move) * (m.blockerPenalty || 1);
    const diff = rushRating - blockRating + randInt(rng, -14, 14);
    if (diff > worstDiff) { worstDiff = diff; worst = m; worstMove = move; }
  });
  // An unblocked blitz in an empty backfield always gets home — no lineman
  // extra to help, no RB staying in to chip.
  const unblockedBlitz = empty && blitzer && !covered;
  const effDiff = unblockedBlitz ? worstDiff + 16 : worstDiff;
  const pressureChance = clamp((effDiff - 6) / 55, 0.03, 0.42);
  if (rng() > pressureChance) return { tier: "clean", rbBlocking, teBlocking, blitzer };
  const severity = clamp(effDiff / 30, 0, 1);
  const sackChance = 0.05 + severity * 0.15, hitChance = 0.18 + severity * 0.14;
  const roll = rng();
  let tier = roll < sackChance ? "sack" : roll < sackChance + hitChance ? "hit" : "hurry";
  // QB móvel (MOB) escapa de parte dos sacks: vira apenas uma pressão.
  if (tier === "sack") {
    const qb = activePlayer(offRoster, "QB1");
    if (qb && rng() < clamp((attr(qb, "MOB") - 65) / 200, 0, MOB_ESCAPE_MAX)) tier = "hurry";
  }
  return { tier, rusher: unblockedBlitz ? blitzer : worst.rusher, blocker: worst.blocker, edge: unblockedBlitz ? "blitz sem bloqueio" : worst.edge, rbBlocking, teBlocking, blitz: !!blitzer, blitzer, move: worstMove };
}

// Pre-snap motion: sending a receiver across the formation before the snap
// is how real offenses diagnose man vs. zone coverage. Here it gives the QB
// a small, attribute-driven edge on his read (bigger with a sharper QB,
// smaller against a disciplined safety who doesn't bite on it).
function preSnapRead(offRoster, defRoster, rng) {
  const qb = activePlayer(offRoster, "QB1");
  const motionChance = clamp(0.32 + (attr(qb, "AWR") - 75) * 0.002, 0.15, 0.55);
  if (rng() > motionChance) return { motion: false, readBonus: 0 };
  const s1 = activePlayer(defRoster, "S1");
  const disguiseSkill = s1 ? attr(s1, "PRC") : 70;
  const readBonus = clamp((attr(qb, "AWR") - disguiseSkill) / 260, -0.05, 0.06);
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

// Qual atributo de precisão do QB vale para cada profundidade de rota.
const QB_ACC_BY_DEPTH = { short: "STA", medium: "MTA", deep: "DTA" };

// Defesa em man ou zone neste lance? CBs jogam mais man; LBs e safeties mais zone;
// rotas longas pedem mais shell/zone; táticas agressivas aumentam o man.
// (Se um dia existir um slider de tática de cobertura, é só somar aqui.)
function coverageType(rng, defender, concept, tendD) {
  let man = 0.38 + ((tendD?.aggressive ?? 0.5) - 0.5) * 0.4 + (tendD?.manBias || 0); // manBias: esquema do DC
  if (defender.pos === "CB") man += 0.2;
  else if (defender.pos === "LB") man -= 0.08;
  if (concept.depth === "deep") man -= 0.1;
  else if (concept.depth === "short") man += 0.05;
  return rng() < clamp(man, 0.1, 0.85) ? "man" : "zone";
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
        statAdd(prot.rusher, "sacks", 1); statAdd(prot.rusher, "qbHits", 1); statAdd(prot.rusher, "forcedFumbles", 1); statAdd(prot.rusher, "tacklesForLoss", 1);
        if (prot.blocker) { statAdd(prot.blocker, "pressuresAllowed", 1); statAdd(prot.blocker, "sacksAllowed", 1); }
        return { yards: -loss, desc: `${qb.name} sofre um strip-sack de ${prot.rusher.name} (${prot.edge})${personnelTag} — bola solta!`, isPass: true, turnover: "FUM", qb, dir: sackDir, depth: "sack", personnel, elapsed: randInt(rng, 30, 42) };
      }
      const loss = randInt(rng, 4, 11);
      statAdd(qb, "sacksTaken", 1);
      statAdd(prot.rusher, "sacks", 1); statAdd(prot.rusher, "qbHits", 1); statAdd(prot.rusher, "tacklesForLoss", 1);
      if (prot.blocker) { statAdd(prot.blocker, "pressuresAllowed", 1); statAdd(prot.blocker, "sacksAllowed", 1); }
      const sackDesc = prot.blitz ? `sacado no blitz por ${prot.rusher.name}` : `sacado por ${prot.rusher.name} pelo ${prot.edge}`;
      return { yards: -loss, desc: `${qb.name} não tem tempo — ${sackDesc}${personnelTag} (${loss} jds).`, isPass: true, sack: true, qb, dir: sackDir, depth: "sack", personnel, elapsed: randInt(rng, 30, 42) };
    }
    const hurried = prot.tier === "hit" || prot.tier === "hurry";
    if (hurried) {
      statAdd(prot.rusher, prot.tier === "hit" ? "qbHits" : "qbHurries", 1);
      if (prot.blocker) statAdd(prot.blocker, "pressuresAllowed", 1);
    }

    const preSnap = preSnapRead(offRoster, defRoster, rng);
    const concept = pickRouteConcept(rng, down, distance, tendO, prot.rbBlocking ? "RB1" : prot.teBlocking ? "TE1" : false, personnel);
    const target = activePlayer(offRoster, concept.targetSlot);
    let defender = activePlayer(defRoster, concept.defenderSlot) || pick(rng, secondary);
    // quem está blitzando não cobre: outro defensor da secundária assume o recebedor
    if (prot.blitzer && defender.id === prot.blitzer.id) {
      const alt = secondary.filter((p) => p.id !== defender.id);
      if (alt.length) defender = pick(rng, alt);
    }
    const oRate = offenseRating(offRoster, "pass"), dRate = defenseRating(defRoster, "pass");
    // O defensor usa MCV (man) ou ZCV (zone) contra a separação (RTE) do recebedor.
    const coverage = coverageType(rng, defender, concept, tendD);
    let cover = coverage === "man" ? manCover(defender) : zoneCover(defender);
    if (coverage === "man" && defender.pos === "CB" && concept.depth === "short") cover += (attr(defender, "PRS") - 70) * 0.15; // press nas rotas curtas
    const catchSkill = attr(target, coverage === "man" ? "CIT" : "CTH"); // man = pega sob marcação; zone = mãos
    const matchupDiff = (routeSkill(target) - cover) / 10;
    const diff = (oRate - dRate) / 10 + matchupDiff * 0.3;
    // Precisão do QB depende da profundidade da rota; sob pressão vale o TUP.
    const qbAcc = attr(qb, hurried ? "TUP" : QB_ACC_BY_DEPTH[concept.depth] || "MTA");
    let completeChance = clamp(concept.baseComplete + diff * 0.03 + (qbAcc - 75) * 0.003 + (catchSkill - 75) * 0.001 + preSnap.readBonus, 0.28, 0.9);
    if (hurried) completeChance -= prot.tier === "hit" ? 0.22 : 0.12;
    completeChance = clamp(completeChance, 0.15, 0.9);
    const motionTag = preSnap.motion ? " após motion pré-snap" : "";

    if (rng() > completeChance) {
      const brokenUp = rng() < 0.5;
      if (brokenUp) {
        statAdd(defender, "passesDefended", 1);
        statAdd(qb, "passAttempts", 1); statAdd(target, "targets", 1);
        return { yards: 0, desc: `${qb.name} tenta ${concept.name}${motionTag}${personnelTag}, mas ${defender.name} defende bem o passe.`, isPass: true, incomplete: true, target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 24, 34) };
      }
      const intChance = clamp(concept.baseInt - diff * 0.01 - (attr(qb, "AWR") - 75) * 0.0005 + (hurried ? 0.05 : 0), 0.01, 0.22);
      if (rng() < intChance) {
        statAdd(qb, "interceptionsThrown", 1); statAdd(qb, "passAttempts", 1); statAdd(target, "targets", 1);
        statAdd(defender, "interceptions", 1);
        return { yards: 0, desc: `Passe de ${qb.name} (${concept.name}) interceptado por ${defender.name}!`, isPass: true, turnover: "INT", target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 24, 34) };
      }
      statAdd(qb, "passAttempts", 1); statAdd(target, "targets", 1);
      return { yards: 0, desc: `${qb.name} tenta ${concept.name} para ${target.name}${motionTag}${personnelTag}... incompleto.`, isPass: true, incomplete: true, target, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 24, 34) };
    }
    let yards = Math.max(0, Math.round(concept.baseYards + diff * 1 + randInt(rng, concept.varLow, concept.varHigh)));
    // braço forte (THP) rende mais jardas nos lançamentos médios/longos
    if (concept.depth !== "short") yards = Math.max(0, yards + Math.round((attr(qb, "THP") - 75) * (concept.depth === "deep" ? 0.06 : 0.03)));
    if (rng() < concept.bigPlayChance) yards += randInt(rng, 15, 45);
    const tackler = pickW(rng, [...secondary, ...frontSeven.filter((p) => p.pos === "LB")], tackleWeight);
    statAdd(qb, "passYards", yards); statAdd(qb, "passCompletions", 1); statAdd(qb, "passAttempts", 1);
    statAdd(target, "targets", 1); statAdd(target, "receptions", 1); statAdd(target, "receivingYards", yards);
    statAdd(tackler, "tackles", 1);
    return { yards, desc: `${qb.name} completa ${concept.name} para ${target.name}${motionTag}${personnelTag} (${yards} jds), derrubado por ${tackler.name}.`, isPass: true, target, passer: qb, dir: concept.dir, depth: concept.depth, personnel, elapsed: randInt(rng, 28, 40) };
  } else {
    const rb1 = activePlayer(offRoster, "RB1");
    const rb2 = activePlayer(offRoster, "RB2");
    const rb2Share = tendO?.rb2CarryShare ?? 0.2;
    const rb = (rb2 && rb2.id !== rb1.id && rng() < rb2Share) ? rb2 : rb1;
    const oRate = offenseRating(offRoster, "run", rb), dRate = defenseRating(defRoster, "run");
    const gap = pick(rng, RUN_GAPS);
    const blocker = slotPlayer(offRoster, gap.blockerSlot);
    const runDefender = pickW(rng, frontSeven, runDefRating);
    // corridas por fora (e pulls/zona) dependem bem mais da agilidade (AGI) da OL
    const outside = gap.label.startsWith("por fora");
    const blockDiff = blocker ? (runBlockRating(blocker, outside) - runDefRating(runDefender) + randInt(rng, -10, 10)) / 20 : 0;
    const diff = clamp((oRate - dRate) / 10 + pInfo.runBonus + blockDiff, -3, 3);
    if (rng() < clamp(0.02 - diff * 0.005, 0.005, 0.06)) {
      const defender = pickW(rng, frontSeven, runDefRating);
      statAdd(rb, "fumbles", 1);
      statAdd(defender, "fumbleRecoveries", 1);
      return { yards: 0, desc: `${rb.name} perde a bola! Recuperada por ${defender.name}.`, isPass: false, turnover: "FUM", dir: gap.dir, depth: "run", personnel, elapsed: randInt(rng, 28, 38) };
    }
    let yards = Math.max(-3, Math.round(2.0 + diff * 1.3 + randInt(rng, -3, 5)));
    // explosão (ACC/SPD) do RB aumenta a chance de lance longo
    if (rng() < clamp(0.05 + ((attr(rb, "ACC") + attr(rb, "SPD")) / 2 - 75) * 0.0004, 0.02, 0.1)) yards += randInt(rng, 12, 30);
    const tackler = pickW(rng, [...frontSeven, ...secondary.filter((p) => p.pos === "S")], tackleWeight);
    statAdd(rb, "rushYards", yards); statAdd(rb, "rushAttempts", 1);
    statAdd(tackler, "tackles", 1);
    if (blocker) {
      statAdd(blocker, "runBlockSnaps", 1);
      if (yards >= 4) statAdd(blocker, "runBlockWins", 1);
      else if (yards <= 0) { statAdd(blocker, "runStuffsAllowed", 1); statAdd(runDefender, "tacklesForLoss", 1); }
    }
    return { yards, desc: `${rb.name} corre ${gap.label}${personnelTag}, derrubado por ${tackler.name} (${yards} jds).`, isPass: false, rusher: rb, dir: gap.dir, depth: "run", personnel, elapsed: randInt(rng, 28, 40) };
  }
}

// ctx (opcional): { quarter, scoreDiff } — no 4º quarto/prorrogação com placar
// a até 3 pontos, o CLT do kicker pesa (acima de 70 ajuda, abaixo atrapalha;
// para só dar bônus, troque o piso -0.04 por 0).
function attemptFG(kicker, distanceToGoal, rng, ctx) {
  const kickDist = distanceToGoal + 17;
  const longBoost = (attr(kicker, "KPW") - 75) * 0.0015 * clamp((kickDist - 35) / 20, 0, 1.2); // potência importa nos chutes longos
  let chance = 0.98 - (kickDist - 20) * 0.013 + (attr(kicker, "KAC") - 75) * 0.002 + longBoost;
  if (ctx && ctx.quarter >= 4 && Math.abs(ctx.scoreDiff) <= 3) chance += clamp((attr(kicker, "CLT") - 70) * 0.0025, -0.04, 0.05);
  chance = clamp(chance, 0.15, 0.98);
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

// Estilo dos coordenadores nas táticas do jogo: o esquema do OC muda a % de passes e o
// do DC muda blitz/man (os sliders do usuário continuam valendo, isto só soma por cima).
// Special teams coordinator: alcance de FG, agressividade na 4ª descida e punts (TRK/KAC colocam a bola).
function stMeta(team) { return SCHEME_META[team?.coaches?.SC?.scheme] || {}; }
function puntDistance(punter, ballOn, rng) {
  let yds = randInt(rng, 35, 50) + Math.round((attr(punter, "KPW") - 75) * 0.12);
  if (ballOn + yds >= 100) {                                  // iria para o fundo da endzone: chance de colocar a bola
    const place = ((attr(punter, "TRK") * 0.6 + attr(punter, "KAC") * 0.4) - 50) / 120;
    if (rng() < clamp(place, 0, 0.6)) yds = 100 - ballOn - randInt(rng, 5, 12);
  }
  return Math.max(20, yds);
}
function schemePassBias(team) { return SCHEME_META[team?.coaches?.OC?.scheme]?.passBias || 0; }
function withDefScheme(tend, team) {
  const m = SCHEME_META[team?.coaches?.DC?.scheme] || {};
  return { ...tend, aggressive: clamp((tend?.aggressive ?? 0.5) + (m.blitzBias || 0), 0, 1), manBias: m.manBias || 0 };
}

// Entrada pública: aplica os bônus dos coordenadores dos dois times durante o jogo e
// limpa no fim (os atributos/OVR guardados nunca são alterados).
function simGameDetailed(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
  const h = leagueTeams[homeAbbr], a = leagueTeams[awayAbbr];
  applyStaffBonuses(h.roster, h.coaches); applyStaffBonuses(a.roster, a.coaches);
  try { return simGameDetailedCore(homeAbbr, awayAbbr, leagueTeams, tendencies, rng); }
  finally { clearStaffBonuses(h.roster); clearStaffBonuses(a.roster); }
}
function simGameDetailedCore(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
  const home = leagueTeams[homeAbbr], away = leagueTeams[awayAbbr];
  const log = [], scoreTimeline = [], plays = [], injuries = [];
  const score = { [homeAbbr]: 0, [awayAbbr]: 0 };
  function checkInjury(result, playKind, offAbbr, defAbbr, down, distance, ballOn, lbl) {
    const candidate = playKind === "sack" ? result.qb : playKind === "run" ? result.rusher : playKind === "pass" ? result.target : null;
    const hurt = candidate && maybeInjure(rng, candidate, playKind);
    if (!hurt) return;
    injuries.push({ ...hurt, teamAbbr: offAbbr });
    push(`🏥 ${hurt.name} fica no chão e não retorna a este jogo.`, lbl, { offAbbr, defAbbr, down, distance, ballOn, yards: 0, isPass: null, dir: "meio", kind: "injury" });
  }

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
      quarter, clock: fmtClock(secs),
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
    const tendO = { ...baseTend, passRatio: situationalPassRatio((baseTend?.passRatio ?? 0.55) + schemePassBias(offTeam), score[offAbbr] - score[defAbbr], quarter, secs) };
    const tendD = withDefScheme(defAbbr === homeAbbr ? tendencies.home : tendencies.away, defTeam);
    const yardsToGoal = 100 - ballOn;
    let elapsed = 0;

    const st = stMeta(offTeam);
    if (down === 4 && !((tendO.aggressive ?? 0.5) + (st.goBias || 0) > 0.6 && distance <= 3)) {
      if (yardsToGoal <= 38 + (st.fgRangeBias || 0)) {
        const kicker = activePlayer(offTeam.roster, "K1");
        const { good, kickDist } = attemptFG(kicker, yardsToGoal, rng, { quarter, scoreDiff: score[offAbbr] - score[defAbbr] });
        statAdd(kicker, "fgAttempts", 1); if (good) statAdd(kicker, "fgMade", 1);
        if (kickDist >= 40) { statAdd(kicker, "fgAttempts40", 1); if (good) statAdd(kicker, "fgMade40", 1); }
        if (kickDist >= 50) { statAdd(kicker, "fgAttempts50", 1); if (good) statAdd(kicker, "fgMade50", 1); }
        push(`Tentativa de FG de ${kickDist} jds por ${kicker.name}: ${good ? "É BOA! 🏈" : "NÃO PASSA."}`, label(), { offAbbr, defAbbr, down, distance, ballOn, yards: good ? yardsToGoal : 0, isPass: null, dir: "meio", kind: good ? "fieldgoal-good" : "fieldgoal-miss" });
        elapsed = randInt(rng, 6, 10);
        if (good) { score[offAbbr] += 3; kickoffReset(offAbbr); } else { possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - yardsToGoal, 2, 98); }
      } else {
        const punter = activePlayer(offTeam.roster, "P1");
        const puntYds = puntDistance(punter, ballOn, rng);
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
      checkInjury(result, playKind, offAbbr, defAbbr, down, distance, ballOn, label());
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
            const puntYds = puntDistance(punter, ballOn, rng);
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
      const tendO = { ...(offAbbr === homeAbbr ? tendencies.home : tendencies.away) };
      tendO.passRatio = clamp((tendO.passRatio ?? 0.55) + schemePassBias(offTeam), 0.05, 0.95);
      const tendD = withDefScheme(defAbbr === homeAbbr ? tendencies.home : tendencies.away, defTeam);
      if (down > 4) { possession = defAbbr; down = 1; distance = 10; ballOn = clamp(100 - ballOn, 2, 98); continue; }
      const result = simPlay(offAbbr, defAbbr, offTeam.roster, defTeam.roster, down, distance, ballOn, tendO, tendD, rng);
      const downLabel = `${down}ª e ${distance > 0 ? distance : "gol"} na ${fieldSpot(offAbbr, ballOn)}`;
      const playKind = result.penalty ? "penalty" : result.isPass ? (result.turnover === "INT" ? "interception" : result.incomplete ? "incomplete" : result.sack ? "sack" : "pass") : (result.turnover === "FUM" ? "fumble" : "run");
      push(`${downLabel} — ${result.desc}`, "OT", { offAbbr, defAbbr, down, distance, ballOn, yards: result.yards, isPass: result.isPass, dir: result.dir, kind: playKind, personnel: result.personnel });
      checkInjury(result, playKind, offAbbr, defAbbr, down, distance, ballOn, "OT");
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
  return { score, log, scoreTimeline, plays, injuries };
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
  let sacksLeft = sacks;
  while (sacksLeft-- > 0 && linemen.length) statAdd(pick(rng, linemen), "sacksAllowed", 1);
  // Approximate run-block win/loss splits per lineman, roughly consistent
  // with the ~55-65% win rate the play-by-play engine produces.
  let runSnapsLeft = rushAttemptsTotal;
  while (runSnapsLeft-- > 0 && linemen.length) {
    const l = pick(rng, linemen);
    statAdd(l, "runBlockSnaps", 1);
    if (rng() < 0.58) statAdd(l, "runBlockWins", 1);
    else if (rng() < 0.4) statAdd(l, "runStuffsAllowed", 1);
  }
  const secondary = defRoster.filter((p) => p.pos === "CB" || p.pos === "S");
  if (rng() < 0.35 && secondary.length) statAdd(pick(rng, secondary), "interceptions", 1);
  let pdLeft = randInt(rng, 3, 8);
  while (pdLeft-- > 0 && secondary.length) statAdd(pick(rng, secondary), "passesDefended", 1);

  const kicker = activePlayer(offRoster, "K1");
  const fgAttempts = randInt(rng, 1, 4);
  for (let i = 0; i < fgAttempts; i++) {
    const yardsToGoal = randInt(rng, 3, 40);
    const { good, kickDist } = attemptFG(kicker, yardsToGoal, rng);
    statAdd(kicker, "fgAttempts", 1); if (good) statAdd(kicker, "fgMade", 1);
    if (kickDist >= 40) { statAdd(kicker, "fgAttempts40", 1); if (good) statAdd(kicker, "fgMade40", 1); }
    if (kickDist >= 50) { statAdd(kicker, "fgAttempts50", 1); if (good) statAdd(kicker, "fgMade50", 1); }
  }
  const xpAttempts = Math.max(0, tds - Math.round(tds * 0.15));
  statAdd(kicker, "xpAttempts", xpAttempts);
  statAdd(kicker, "xpMade", Math.round(xpAttempts * 0.96));
  const punter = activePlayer(offRoster, "P1");
  const punts = randInt(rng, 2, 6);
  statAdd(punter, "punts", punts);
  statAdd(punter, "puntYards", punts * randInt(rng, 38, 48));
}

function simGameQuick(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
  const h = leagueTeams[homeAbbr], a = leagueTeams[awayAbbr];
  applyStaffBonuses(h.roster, h.coaches); applyStaffBonuses(a.roster, a.coaches);
  try { return simGameQuickCore(homeAbbr, awayAbbr, leagueTeams, tendencies, rng); }
  finally { clearStaffBonuses(h.roster); clearStaffBonuses(a.roster); }
}
function simGameQuickCore(homeAbbr, awayAbbr, leagueTeams, tendencies, rng) {
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


export { fmtClock, statAdd, tackleWeight, snapshotRosterStats, diffRosterStats,
  pickW, ROUTE_CONCEPTS, RUN_GAPS, pickRouteConcept, passProtection, preSnapRead,
  PERSONNEL_INFO, DEFAULT_PERSONNEL, pickPersonnel, fieldSpot, simPlay, attemptFG,
  situationalPassRatio, simGameDetailed, quickGameStats, simGameQuick };
