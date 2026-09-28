// Pure rating helpers: given a roster, how good is it on offense/defense,
// overall — used both by the game simulation and by management screens.

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


export { slotPlayer, activePlayer, posAvg, offenseRating, defenseRating, teamOverall };
