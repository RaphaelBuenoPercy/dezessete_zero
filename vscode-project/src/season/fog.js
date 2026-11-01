import { clamp } from "../lib/rng.js";
import { SUB_ATTRS, ATTR_LABELS } from "../data/rosterSlots.js";
import { ovrGrade } from "./scouting.js";
import { TRAIT_LABELS, CONCERN_LABELS } from "./attrLabels.js";

// ============================================================
// FOG OF WAR NO DRAFT
//
// Os prospects têm atributos reais (p.attrs, p.ovr), mas o usuário só vê o que o scouting revelou.
// - c.scouting = { points, total, reveals: { [prospectId]: { keys: [attrs revelados], trait: bool } }, log }
// - Sem informação: OVR aparece como faixa (ex.: "68–84") que estreita a cada atributo revelado.
// - Perfil pessoal oculto (p.trait): trabalhador, líder, problemático, frágil — só aparece na entrevista.
// Os pontos são renovados a cada novo draft (resetScouting).
// ============================================================

const SCOUT_POINTS = 12;

const SCOUT_ACTIONS = [
  { id: "campus", label: "Olheiro no campus", cost: 1, desc: "Revela 1 atributo aleatório." },
  { id: "video", label: "Análise de vídeo", cost: 2, desc: "Revela os 2 maiores atributos (o que ele faz de melhor)." },
  { id: "workout", label: "Workout individual", cost: 3, desc: "Revela 3 atributos aleatórios." },
  { id: "interview", label: "Entrevista pessoal", cost: 2, desc: "Revela o perfil pessoal: disciplina, liderança, histórico médico." },
  { id: "full", label: "Avaliação completa", cost: 5, desc: "Revela todos os atributos e o perfil pessoal." },
];

const TRAITS = {
  normal: { label: "Sem alertas", color: "#94a3b8", desc: "Perfil comum, sem nada que chame atenção." },
  trabalhador: { label: "Trabalhador", color: "#4ade80", desc: "Vive no CT: tende a evoluir mais rápido." },
  lider: { label: "Líder nato", color: "#38bdf8", desc: "Chega com moral alto e puxa o vestiário." },
  problematico: { label: "Problemático", color: "#f87171", desc: "Histórico de indisciplina: chega com moral baixo." },
  fragil: { label: "Histórico de lesões", color: "#fbbf24", desc: "Corpo frágil: mais propenso a se machucar." },
};

function ensureScoutingState(c) {
  if (!c.scouting) c.scouting = { points: SCOUT_POINTS, total: SCOUT_POINTS, reveals: {}, log: [] };
  return c;
}
function resetScouting(c) {
  c.scouting = { points: SCOUT_POINTS, total: SCOUT_POINTS, reveals: {}, log: [] };
  c.draftFeed = []; c.pendingDraftEvent = null; c.draftWish = null; c.draftEventPick = -1; c.draftFlags = {};
}

const revealOf = (c, pid) => c.scouting?.reveals?.[pid] || { keys: [], trait: false };
function noiseOf(p) {                                   // ruído do "consenso da mídia"; estável por prospect
  if (p.scoutNoise != null) return p.scoutNoise;
  return Math.round((((p.id * 9301 + 49297) % 233280) / 233280 - 0.5) * 12);
}
const consensusScore = (p) => p.ovr + noiseOf(p);       // ordem do "mock draft" público

function mergeReveal(c, pid, keys, trait) {
  ensureScoutingState(c);
  const r = c.scouting.reveals[pid] || (c.scouting.reveals[pid] = { keys: [], trait: false });
  keys.forEach((k) => { if (!r.keys.includes(k)) r.keys.push(k); });
  if (trait) r.trait = true;
}

// Revela atributos (n = número, ou "all"). mode: "random" | "top".
function revealAttrs(c, p, n, mode = "random", rng = Math.random) {
  const all = SUB_ATTRS[p.pos] || [];
  const have = new Set(revealOf(c, p.id).keys);
  let pool = all.filter((k) => !have.has(k));
  if (mode === "top") pool = pool.sort((a, b) => p.attrs[b] - p.attrs[a]);
  else pool = [...pool].sort(() => rng() - 0.5);
  const picked = n === "all" ? pool : pool.slice(0, n);
  mergeReveal(c, p.id, picked, false);
  return picked;
}
function revealTrait(c, p) { mergeReveal(c, p.id, [], true); }

// Ação de scouting do usuário. Retorna { ok, msg }.
function doScout(c, p, actionId, rng) {
  ensureScoutingState(c);
  const act = SCOUT_ACTIONS.find((a) => a.id === actionId);
  if (!act) return { ok: false, msg: "Ação inválida." };
  if (c.scouting.points < act.cost) return { ok: false, msg: "Pontos de scouting insuficientes." };
  const rev = revealOf(c, p.id);
  const total = (SUB_ATTRS[p.pos] || []).length;
  if (act.id !== "interview" && rev.keys.length >= total) return { ok: false, msg: "Esse prospect já foi totalmente avaliado." };
  if (act.id === "interview" && rev.trait) return { ok: false, msg: "Você já entrevistou esse prospect." };
  c.scouting.points -= act.cost;
  let msg = "";
  if (act.id === "campus") { const k = revealAttrs(c, p, 1, "random", rng); msg = `${act.label}: ${k.map((x) => ATTR_LABELS[x]).join(", ")} de ${p.name}.`; }
  else if (act.id === "video") { const k = revealAttrs(c, p, 2, "top", rng); msg = `${act.label}: pontos fortes de ${p.name} (${k.map((x) => ATTR_LABELS[x]).join(", ")}).`; }
  else if (act.id === "workout") { const k = revealAttrs(c, p, 3, "random", rng); msg = `${act.label} com ${p.name}: ${k.length} atributo(s) revelados.`; }
  else if (act.id === "interview") { revealTrait(c, p); msg = `Entrevista com ${p.name}: ${TRAITS[p.trait || "normal"].label}.`; }
  else { revealAttrs(c, p, "all", "random", rng); revealTrait(c, p); msg = `Avaliação completa de ${p.name}.`; }
  c.scouting.log = [msg, ...(c.scouting.log || [])].slice(0, 12);
  return { ok: true, msg };
}

// Leitura embaçada do prospect: faixa de OVR que estreita conforme os atributos são revelados.
function fogRead(c, p) {
  const total = (SUB_ATTRS[p.pos] || []).length || 1;
  const rev = revealOf(c, p.id);
  const frac = clamp(rev.keys.length / total, 0, 1);
  const noise = noiseOf(p);
  const exact = frac >= 1;
  const mid = exact ? p.ovr : clamp(Math.round(p.ovr + noise * (1 - frac)), 40, 99);
  const half = exact ? 0 : Math.max(Math.ceil(Math.abs(noise) * (1 - frac)) + 1, Math.round(9 * (1 - frac)) + 1);
  const lo = clamp(mid - half, 40, 99), hi = clamp(mid + half, 40, 99);
  return { frac, exact, mid, lo, hi, text: exact ? String(p.ovr) : `${lo}–${hi}`, grade: ovrGrade(mid), known: rev.keys.length };
}

// Relatório de olheiro usando só o que foi revelado.
function fogReport(c, p) {
  const rev = revealOf(c, p.id);
  if (!rev.keys.length) return { strength: null, concern: null, empty: true };
  const keys = rev.keys;
  const sorted = [...keys].sort((a, b) => p.attrs[b] - p.attrs[a]);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  return {
    strength: TRAIT_LABELS[best] || null, strengthKey: best, strengthValue: p.attrs[best],
    concern: keys.length > 1 && p.attrs[worst] < 68 ? CONCERN_LABELS[worst] : null,
    concernKey: worst, concernValue: p.attrs[worst],
  };
}

const traitKnown = (c, p) => !!revealOf(c, p.id).trait;
const traitInfo = (p) => TRAITS[p.trait || "normal"] || TRAITS.normal;

export {
  SCOUT_POINTS, SCOUT_ACTIONS, TRAITS, ensureScoutingState, resetScouting, revealOf, consensusScore, noiseOf,
  revealAttrs, revealTrait, doScout, fogRead, fogReport, traitKnown, traitInfo,
};
