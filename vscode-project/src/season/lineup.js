import { SUB_ATTRS } from "../data/rosterSlots.js";

// Helpers puros das telas de Elenco e Escalação: grupos de posição, força dos setores (com ranking
// na liga), candidatos para cada slot e alertas de escalação. Nada aqui altera o career.

const RESERVE_SLOTS = new Set(["QB2", "RB2", "BEN1", "BEN2", "BEN3", "BEN4", "BEN5"]);
const OFFENSE_SLOTS = new Set(["QB1", "QB2", "RB1", "RB2", "WR1", "WR2", "WR3", "TE1", "LT", "LG", "C", "RG", "RT"]);
const GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];
const GROUP_LABEL = {
  QB: "Quarterbacks", RB: "Running backs", WR: "Wide receivers", TE: "Tight ends", OL: "Linha ofensiva",
  DL: "Linha defensiva", LB: "Linebackers", CB: "Cornerbacks", S: "Safeties", K: "Kicker", P: "Punter",
};
const OFFENSE_GROUPS = ["QB", "RB", "WR", "TE", "OL"];
const DEFENSE_GROUPS = ["DL", "LB", "CB", "S"];

const isStarterSlot = (slot) => !!slot && !RESERVE_SLOTS.has(slot) && !slot.startsWith("BEN");
const sideOfSlot = (slot) => (OFFENSE_SLOTS.has(slot) ? "offense" : "defense");

function starterSlots(scheme, group) {
  switch (group) {
    case "QB": return ["QB1"];
    case "RB": return ["RB1"];
    case "WR": return ["WR1", "WR2", "WR3"];
    case "TE": return ["TE1"];
    case "OL": return ["LT", "LG", "C", "RG", "RT"];
    case "DL": return scheme === "3-4" ? ["DE1", "DE2", "NT1"] : ["DE1", "DE2", "DT1", "DT2"];
    case "LB": return scheme === "3-4" ? ["LB1", "LB2", "LB3", "LB4"] : ["LB1", "LB2", "LB3"];
    case "CB": return ["CB1", "CB2", "CB3"];
    case "S": return ["S1", "S2"];
    case "K": return ["K1"];
    default: return ["P1"];
  }
}

// Depth chart agrupado, na ordem em que aparece na tela.
function depthGroups(scheme) {
  return [
    ["Quarterbacks", ["QB1", "QB2"]], ["Corredores", ["RB1", "RB2"]], ["Recebedores", ["WR1", "WR2", "WR3", "TE1"]],
    ["Linha ofensiva", ["LT", "LG", "C", "RG", "RT"]], [`Linha defensiva (${scheme})`, starterSlots(scheme, "DL")],
    ["Linebackers", starterSlots(scheme, "LB")], ["Secundária", ["CB1", "CB2", "CB3", "S1", "S2"]],
    ["Special teams", ["K1", "P1"]], ["Banco", ["BEN1", "BEN2", "BEN3", "BEN4", "BEN5"]],
  ];
}

function startersOf(team, group) {
  const slots = starterSlots(team.scheme, group);
  return slots.map((s) => team.roster.find((p) => p.slot === s)).filter(Boolean);
}
function groupAvg(team, group) {
  const st = startersOf(team, group);
  return st.length ? st.reduce((s, p) => s + p.ovr, 0) / st.length : 0;
}

// Ranking de cada setor entre todos os times: { QB: { avg: 81.2, rank: 5, total: 32 }, ... } para o time.
function groupStrength(leagueTeams, team) {
  const teams = Object.values(leagueTeams || {});
  const out = {};
  GROUPS.forEach((g) => {
    const mine = groupAvg(team, g);
    const better = teams.filter((t) => t.abbr !== team.abbr && groupAvg(t, g) > mine).length;
    out[g] = { avg: mine, rank: teams.length ? better + 1 : null, total: teams.length || null };
  });
  return out;
}

// Quem pode ocupar o slot: mesma posição, melhor OVR primeiro.
function candidatesFor(team, slot) {
  const cur = team.roster.find((p) => p.slot === slot);
  if (!cur) return [];
  return team.roster.filter((p) => p.pos === cur.pos && p.id !== cur.id).sort((a, b) => b.ovr - a.ovr);
}

function topAttrs(p, n = 2) {
  return (SUB_ATTRS[p.pos] || []).filter((k) => p.attrs?.[k] != null).map((k) => ({ k, v: p.attrs[k] })).sort((a, b) => b.v - a.v).slice(0, n);
}

// Alertas acionáveis: titular lesionado, reserva melhor que o titular, titular com moral baixa.
function lineupAlerts(team) {
  const out = [];
  const starters = team.roster.filter((p) => isStarterSlot(p.slot));
  starters.forEach((p) => {
    if (p.injuredWeeks > 0) {
      const sub = candidatesFor(team, p.slot).find((c) => !isStarterSlot(c.slot) && !(c.injuredWeeks > 0));
      out.push({ tone: "bad", slot: p.slot, text: `${p.name} (${p.slot}) está lesionado por ${p.injuredWeeks} sem.${sub ? ` Melhor reserva: ${sub.name}, OVR ${sub.ovr}.` : ""}` });
    }
  });
  starters.forEach((p) => {
    if (p.injuredWeeks > 0) return;
    const better = candidatesFor(team, p.slot).find((c) => !isStarterSlot(c.slot) && !(c.injuredWeeks > 0) && c.ovr > p.ovr);
    if (better) out.push({ tone: "warn", slot: p.slot, text: `${better.name} (OVR ${better.ovr}) é melhor que ${p.name} (OVR ${p.ovr}) em ${p.slot}.` });
  });
  starters.forEach((p) => {
    if ((p.morale ?? 65) < 35) out.push({ tone: "warn", slot: p.slot, text: `${p.name} (${p.slot}) está com moral baixa: ${p.morale}/100.` });
  });
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "bad" ? -1 : 1));
}

const ovrColor = (ovr) => (ovr >= 85 ? "#4ade80" : ovr >= 75 ? "#38bdf8" : ovr >= 65 ? "#fbbf24" : "#f87171");
const ageColor = (age) => (age <= 25 ? "#4ade80" : age <= 29 ? "#38bdf8" : age <= 32 ? "#fbbf24" : "#f87171");

export {
  RESERVE_SLOTS, GROUPS, GROUP_LABEL, OFFENSE_GROUPS, DEFENSE_GROUPS, isStarterSlot, sideOfSlot, starterSlots, depthGroups,
  startersOf, groupAvg, groupStrength, candidatesFor, topAttrs, lineupAlerts, ovrColor, ageColor,
};