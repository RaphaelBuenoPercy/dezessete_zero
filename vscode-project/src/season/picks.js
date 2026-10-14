import { clamp } from "../lib/rng.js";

// ============================================================
// DRAFT PICK OWNERSHIP
//
// Every pick is its own asset: { id, year, round, originalAbbr, currentOwner }.
// `originalAbbr` never changes — it's what the standings-based draft order
// is built from. `currentOwner` is who actually gets to make the pick,
// which trades can move around independently, round by round, year by
// year. This is what makes "trade my 2028 3rd for your 2027 2nd" possible
// without one trade accidentally reassigning every future round a team
// would have picked in.
// ============================================================

function generatePicksForYear(teamAbbrs, year) {
  const picks = [];
  teamAbbrs.forEach((abbr) => {
    for (let round = 1; round <= 7; round++) {
      picks.push({ id: `${abbr}-${year}-${round}`, year, round, originalAbbr: abbr, currentOwner: abbr });
    }
  });
  return picks;
}

// Keeps exactly the window [fromYear, fromYear+1, fromYear+2] (3 draft
// classes) tradeable at any time — called whenever a new draft year comes
// into view (offseason start), dropping the year that just wrapped up and
// adding the newly-visible far year.
function rollFuturePicks(futurePicks, teamAbbrs, fromYear) {
  const years = [fromYear, fromYear + 1, fromYear + 2];
  let picks = (futurePicks || []).filter((p) => years.includes(p.year));
  years.forEach((y) => {
    if (!picks.some((p) => p.year === y)) picks = picks.concat(generatePicksForYear(teamAbbrs, y));
  });
  return picks;
}

// Who actually owns the pick at (draftYear, round, slot), following the
// standings-based `order` array for the original slot sequence. Falls back
// to the original slot's team if the asset isn't tracked (shouldn't happen
// once futurePicks covers the draft year, but keeps the draft unbreakable).
function resolvePickOwner(futurePicks, order, draftYear, round, slotIndex) {
  const originalAbbr = order[slotIndex % order.length];
  const asset = futurePicks.find((p) => p.year === draftYear && p.round === round && p.originalAbbr === originalAbbr);
  return asset ? asset.currentOwner : originalAbbr;
}

// Removes the specific pick asset used to make a selection, so it can't
// linger around as a tradeable "future" pick after it's already been spent.
function consumePick(futurePicks, order, draftYear, round, slotIndex) {
  const originalAbbr = order[slotIndex % order.length];
  const idx = futurePicks.findIndex((p) => p.year === draftYear && p.round === round && p.originalAbbr === originalAbbr);
  if (idx >= 0) futurePicks.splice(idx, 1);
}

function teamPicks(futurePicks, abbr) {
  return futurePicks.filter((p) => p.currentOwner === abbr).sort((a, b) => a.year - b.year || a.round - b.round);
}

// Draft equity for a pick — and, critically, WHERE in the round it's
// likely to land. A bad team's 1st-rounder (probably picking near the
// top) is worth far more than a contender's 1st-rounder (probably
// picking near the bottom), the same way a real draft-value chart works.
// Each round has a floor (worst likely slot) and a spread added on top
// for how early the projected slot is; value also fades a bit the
// further out the pick is, since nothing that far away is a sure thing.
const ROUND_CURVE = {
  1: { base: 45, spread: 65 }, 2: { base: 20, spread: 20 }, 3: { base: 12, spread: 10 },
  4: { base: 7, spread: 6 }, 5: { base: 4, spread: 3 }, 6: { base: 2.5, spread: 1.5 }, 7: { base: 1.5, spread: 1 },
};

// 0 (worst likely slot, bottom of the round) .. 1 (best likely slot, top
// of the round) from the owning team's current win percentage — a team
// struggling now projects to pick early; a team near the top projects late.
function projectedSlotFactor(winPct) {
  return clamp(1 - winPct, 0.05, 0.95);
}

function pickTradeValue(round, year, currentYear, originalWinPct = 0.5) {
  const curve = ROUND_CURVE[round] || ROUND_CURVE[7];
  const slot = projectedSlotFactor(originalWinPct);
  const value = curve.base + curve.spread * slot;
  const yearsOut = Math.max(0, year - currentYear);
  return value * Math.pow(0.92, yearsOut);
}

// A short read on draft slot, for display next to a pick ("topo da
// rodada" etc.) so the projection isn't just a hidden number.
function pickProjectionLabel(winPct) {
  const slot = projectedSlotFactor(winPct);
  if (slot >= 0.7) return { label: "topo da rodada", color: "#4ade80" };
  if (slot >= 0.4) return { label: "meio da rodada", color: "#94a3b8" };
  return { label: "final da rodada", color: "#f87171" };
}

function pickLabel(pick) {
  const ord = { 1: "1ª", 2: "2ª", 3: "3ª", 4: "4ª", 5: "5ª", 6: "6ª", 7: "7ª" }[pick.round] || `${pick.round}ª`;
  return `${pick.year} · ${ord} rodada`;
}

export { generatePicksForYear, rollFuturePicks, resolvePickOwner, consumePick, teamPicks, pickTradeValue, pickProjectionLabel, pickLabel };
