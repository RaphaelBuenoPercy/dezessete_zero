// Roster slot layout (offense/special teams are fixed; the defensive
// front depends on the team's scheme) and the pair of secondary
// attributes tracked per position.

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



export { FIXED_SLOTS, schemeSlots, rosterSlotsFor, ROSTER_SLOTS, SUB_ATTRS };
