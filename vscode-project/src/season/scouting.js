import { clamp } from "../lib/rng.js";
import { SUB_ATTRS } from "../data/rosterSlots.js";
import { teamNeeds } from "./freeAgencyAI.js";

// ============================================================
// DRAFT SCOUTING & WAR-ROOM HELPERS
//
// Everything here is pure/derived — no new persisted state — so the big
// board, the prospect page, and the "on the clock" war room can all read
// the same grades and reports without the two ever disagreeing.
// ============================================================

function ovrGrade(ovr) {
  if (ovr >= 90) return "A+";
  if (ovr >= 86) return "A";
  if (ovr >= 82) return "A-";
  if (ovr >= 78) return "B+";
  if (ovr >= 74) return "B";
  if (ovr >= 70) return "B-";
  if (ovr >= 65) return "C+";
  if (ovr >= 60) return "C";
  return "C-";
}
function gradeColor(grade) {
  if (grade.startsWith("A")) return "#4ade80";
  if (grade.startsWith("B")) return "#38bdf8";
  return "#fbbf24";
}

// Scouting language for each tracked sub-attribute — the flattering read
// (when it's a player's standout trait) and the worried read (when it's
// their soft spot).
const TRAIT_LABELS = {
  ARM: "braço forte", ACC: "precisão fina",
  SPD: "velocidade de nível elite", POW: "poder físico",
  HND: "mãos confiáveis", BLK: "capacidade de bloqueio",
  RBK: "bloqueio de corrida", PBK: "proteção de passe",
  RSH: "pressão constante no QB", RUN: "instinto contra a corrida",
  COV: "cobertura fechada", TKL: "tackle seguro",
};
const CONCERN_LABELS = {
  ARM: "braço abaixo da média", ACC: "precisão inconsistente",
  SPD: "velocidade limitada para a posição", POW: "falta de poder físico",
  HND: "mãos inconsistentes", BLK: "bloqueio ainda cru",
  RBK: "bloqueio de corrida a desenvolver", PBK: "proteção de passe a desenvolver",
  RSH: "pouca pressão gerada", RUN: "instinto contra a corrida a desenvolver",
  COV: "cobertura a desenvolver", TKL: "tackle inconsistente",
};

// A one-line scouting report: the standout trait, and — if the weaker of
// the two attributes is genuinely shaky — the concern to go with it.
function scoutingReport(player) {
  const keys = SUB_ATTRS[player.pos] || [];
  if (keys.length !== 2) return { strength: null, concern: null };
  const [k1, k2] = keys;
  const v1 = player.attrs[k1], v2 = player.attrs[k2];
  const [hiKey, hiVal] = v1 >= v2 ? [k1, v1] : [k2, v2];
  const [loKey, loVal] = v1 >= v2 ? [k2, v2] : [k1, v1];
  return {
    strength: TRAIT_LABELS[hiKey] || null,
    strengthKey: hiKey, strengthValue: hiVal,
    concern: loVal < 68 ? (CONCERN_LABELS[loKey] || null) : null,
    concernKey: loKey, concernValue: loVal,
  };
}

// How well this prospect answers one of the team's current weak spots,
// reusing the exact need-ranking free agency relies on so the board reads
// consistently across the front office.
function fitForTeam(player, team) {
  const needs = teamNeeds(team);
  const idx = needs.findIndex((n) => n.pos === player.pos);
  if (idx === -1) return { label: "Fora de necessidade", color: "#94a3b8", rank: null };
  if (idx === 0) return { label: "Maior necessidade do time", color: "#4ade80", rank: idx + 1 };
  if (idx <= 2) return { label: "Preenche necessidade", color: "#38bdf8", rank: idx + 1 };
  return { label: "Já tem profundidade aqui", color: "#94a3b8", rank: idx + 1 };
}

// Was this prospect's talent tier "worth" the slot they were actually
// taken at? Every prospect already carries a projected draftRound from
// generation, so comparing it to the round they actually went in gives a
// simple, spoiler-free steal/reach read.
function pickValueRead(projectedRound, actualRound) {
  const diff = projectedRound - actualRound; // positive = went earlier than projected
  if (diff >= 2) return { label: "ROUBADA!", color: "#4ade80" };
  if (diff === 1) return { label: "Ótimo valor", color: "#4ade80" };
  if (diff === 0) return { label: "Como esperado", color: "#94a3b8" };
  if (diff === -1) return { label: "Um pouco cedo", color: "#fbbf24" };
  return { label: "Reach", color: "#f87171" };
}

// Need-aware AI draft pick: teams don't just take the best player left on
// the board, they weigh it against how badly they need the position —
// pulled from a shallow "still plausible" window near the top of the
// board, same as a real team wouldn't reach 40 spots for a need.
function pickForTeamAI(rng, team, draftClassSortedByRank) {
  const poolSize = Math.min(8, draftClassSortedByRank.length);
  const candidates = draftClassSortedByRank.slice(0, poolSize);
  if (!candidates.length) return null;
  const needs = teamNeeds(team).map((n) => n.pos);
  let best = null, bestScore = -Infinity;
  candidates.forEach((p, i) => {
    const needIdx = needs.indexOf(p.pos);
    const needFit = needIdx === -1 ? 0.3 : clamp(1 - needIdx / needs.length, 0, 1);
    const valueScore = 1 - i / poolSize;
    const combined = valueScore * 0.55 + needFit * 0.45 + (rng() - 0.5) * 0.12;
    if (combined > bestScore) { bestScore = combined; best = p; }
  });
  return best || candidates[0];
}

export { ovrGrade, gradeColor, scoutingReport, fitForTeam, pickValueRead, pickForTeamAI };
