// ============================================================
// DEPTH CHART HELPERS
//
// Slots are what the game engine actually reads (QB1 starts, QB2 backs
// up), so whenever players move between teams the right man has to end
// up in the right slot. promoteBench pulls a better bench player into
// the worst starter's slot; autoSortDepth additionally orders each group
// best-to-worst. The O-line is only ever promoted from the bench, never
// reshuffled, since LT/LG/C/RG/RT are distinct jobs.
// ============================================================

function groupsFor(scheme) {
  const dl = scheme === "3-4" ? ["DE1", "DE2", "NT1"] : ["DE1", "DE2", "DT1", "DT2"];
  const lb = scheme === "3-4" ? ["LB1", "LB2", "LB3", "LB4"] : ["LB1", "LB2", "LB3"];
  return {
    sortable: [["QB1", "QB2"], ["RB1", "RB2"], ["WR1", "WR2", "WR3"], dl, lb, ["CB1", "CB2", "CB3"], ["S1", "S2"]],
    promoteOnly: [["TE1"], ["K1"], ["P1"], ["LT", "LG", "C", "RG", "RT"]],
  };
}

function holders(team, slots) {
  return slots.map((s) => team.roster.find((p) => p.slot === s)).filter(Boolean);
}

// Swaps a better bench player of the same position into the worst
// starter's slot, repeating until no bench player beats a starter.
function promoteGroup(team, slots) {
  const starters = holders(team, slots);
  if (starters.length !== slots.length || !starters.length) return; // a slot is missing — leave it alone
  const pos = starters[0].pos;
  if (!starters.every((p) => p.pos === pos)) return; // unexpected mix — safer to skip than guess
  for (let i = 0; i < 12; i++) {
    const worst = holders(team, slots).sort((a, b) => a.ovr - b.ovr)[0];
    const bench = team.roster.filter((p) => p.pos === pos && !slots.includes(p.slot)).sort((a, b) => b.ovr - a.ovr)[0];
    if (!bench || bench.ovr <= worst.ovr) return;
    const tmp = worst.slot; worst.slot = bench.slot; bench.slot = tmp;
  }
}

function promoteBench(team) {
  const g = groupsFor(team.scheme);
  [...g.sortable, ...g.promoteOnly].forEach((slots) => promoteGroup(team, slots));
}

function sortGroup(team, slots) {
  const players = holders(team, slots);
  if (players.length !== slots.length) return;
  if (!players.every((p) => p.pos === players[0].pos)) return;
  const sorted = [...players].sort((a, b) => b.ovr - a.ovr);
  slots.forEach((s, i) => { sorted[i].slot = s; });
}

// promoteBench, then order each multi-man group best-to-worst.
function autoSortDepth(team) {
  promoteBench(team);
  groupsFor(team.scheme).sortable.forEach((slots) => sortGroup(team, slots));
}

// Re-sorts only the groups that contain one of `slotKeys` — used after a
// trade so a user's hand-built depth chart isn't reshuffled everywhere,
// just fixed where a slot actually changed hands.
function refreshGroups(team, slotKeys) {
  const g = groupsFor(team.scheme);
  const touches = (slots) => slots.some((s) => slotKeys.includes(s));
  g.sortable.filter(touches).forEach((slots) => { promoteGroup(team, slots); sortGroup(team, slots); });
  g.promoteOnly.filter(touches).forEach((slots) => promoteGroup(team, slots));
}

export { promoteBench, autoSortDepth, refreshGroups };
