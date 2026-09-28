import { pickValue as baseRoundValue } from "../engine/playerGen.js";

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

// Draft equity for a pick: the same round-value curve free agency/trades
// already use, discounted a bit the further out it is (a pick two years
// away is worth less certainty than this year's).
function pickTradeValue(round, year, currentYear) {
  const yearsOut = Math.max(0, year - currentYear);
  return baseRoundValue(round) * Math.pow(0.88, yearsOut);
}

function pickLabel(pick) {
  const ord = { 1: "1ª", 2: "2ª", 3: "3ª", 4: "4ª", 5: "5ª", 6: "6ª", 7: "7ª" }[pick.round] || `${pick.round}ª`;
  return `${pick.year} · ${ord} rodada`;
}

export { generatePicksForYear, rollFuturePicks, resolvePickOwner, consumePick, teamPicks, pickTradeValue, pickLabel };
