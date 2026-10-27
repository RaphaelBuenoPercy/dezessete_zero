import { computeOvr } from "./playerGen.js";
import { staffBonuses } from "./coachesGen.js";

// Bônus dos coordenadores aplicados SÓ durante o jogo: p.fx = { ATTR: delta } e
// p.fxOvr = ganho de OVR efetivo. p.attrs e p.ovr (derivado dos atributos) NUNCA
// são alterados, então o OVR "de verdade" continua consistente. Sempre limpar depois.

function ovrBoost(p, b) {
  const eff = {};
  Object.keys(p.attrs).forEach((k) => { eff[k] = Math.min(99, p.attrs[k] + (b[k] || 0)); });
  return computeOvr(p.pos, eff) - p.ovr;
}

function applyStaffBonuses(roster, coaches) {
  const bonus = staffBonuses(coaches);
  roster.forEach((p) => {
    const b = bonus[p.pos];
    if (!b || !p.attrs) { delete p.fx; delete p.fxOvr; return; }
    p.fx = b;
    p.fxOvr = ovrBoost(p, b);
  });
}
function clearStaffBonuses(roster) {
  roster.forEach((p) => { delete p.fx; delete p.fxOvr; });
}

// Ganho médio de OVR efetivo dos titulares por posição: { QB: 1.2, OL: 0.8, ... }
// Estimativa pela reputação (nível), sem os fatores ocultos — é o que as telas mostram.
function staffImpact(roster, coaches) {
  const bonus = staffBonuses(coaches, true);
  const sums = {}, counts = {};
  roster.forEach((p) => {
    if (!p.slot || p.slot.startsWith("BEN") || !p.attrs) return;
    const d = bonus[p.pos] ? ovrBoost(p, bonus[p.pos]) : 0;
    sums[p.pos] = (sums[p.pos] || 0) + d; counts[p.pos] = (counts[p.pos] || 0) + 1;
  });
  const out = {};
  Object.keys(counts).forEach((pos) => { out[pos] = Math.round((sums[pos] / counts[pos]) * 10) / 10; });
  return out;
}

export { applyStaffBonuses, clearStaffBonuses, staffImpact };
