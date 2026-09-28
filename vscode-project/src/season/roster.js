// Small roster-editing helpers used by the draft and by depth-chart swaps.

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

export { findSlotForRookie, insertPlayer };
