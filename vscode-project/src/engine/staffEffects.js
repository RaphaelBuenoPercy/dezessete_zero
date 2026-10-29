import { computeOvr } from "./playerGen.js";
import { staffBonuses } from "./coachesGen.js";

// Bônus dos coordenadores aplicados SÓ durante o jogo: p.fx = { ATTR: delta } e
// p.fxOvr = ganho de OVR efetivo. p.attrs e p.ovr (derivado dos atributos) NUNCA
// são alterados, então o OVR "de verdade" continua consistente. Sempre limpar depois.

const clamp99 = (v) => Math.max(20, Math.min(99, v));
function ovrBoost(p, b) {
  const eff = {};
  Object.keys(p.attrs).forEach((k) => { eff[k] = clamp99(p.attrs[k] + (b[k] || 0)); });
  return computeOvr(p.pos, eff) - p.ovr;
}

// Modificadores provisórios persistidos no jogador (eventos): p.tmpMods = [{ all, attrs, weeks }].
function tmpOf(p) {
  const out = {};
  (p.tmpMods || []).forEach((m) => {
    if (m.all) Object.keys(p.attrs).forEach((k) => { out[k] = (out[k] || 0) + m.all; });
    if (m.attrs) Object.entries(m.attrs).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  });
  return out;
}

function applyStaffBonuses(roster, coaches) {
  const bonus = staffBonuses(coaches);
  roster.forEach((p) => {
    if (!p.attrs) return;
    const b = { ...(bonus[p.pos] || {}) };
    if (p.tmpMods?.length) Object.entries(tmpOf(p)).forEach(([k, v]) => { b[k] = (b[k] || 0) + v; });
    if (!Object.keys(b).length) { delete p.fx; delete p.fxOvr; return; }
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
