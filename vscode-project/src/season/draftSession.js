import { mulberry32, seedFromString } from "../lib/rng.js";
import { resolvePickOwner, consumePick } from "./picks.js";
import { pickForTeamAI } from "./scouting.js";
import { findSlotForRookie, insertPlayer } from "./roster.js";
import { autoSortDepth } from "./depth.js";
import { doScout } from "./fog.js";
import { pickCommentary, afterUserPick, rollMyTurnEvent, rollBetweenEvent, resolveDraftEvent, pushFeed } from "./draftEvents.js";

// ============================================================
// SESSÃO DO DRAFT AO VIVO (estado volátil, fora do `career`)
//
// Durante o draft, as escolhas, o feed, o scouting e os eventos ficam num objeto de sessão
// pequeno e independente. O `career` NÃO é clonado a cada escolha: ele só recebe um merge com
// compartilhamento estrutural (commitDraftSession) em blocos: a cada ~32 escolhas, a cada escolha
// do usuário, ao terminar o draft ou ao sair da tela.
//
// Tudo aqui é puro e determinístico (as sementes vêm de id + índice da escolha + passo da sessão).
// A sessão imita os campos do career que draftEvents.js/fog.js já esperam (draftClass, scouting,
// draftFeed, pendingDraftEvent, draftWish, draftFlags, news, leagueTeams, teamAbbr, year), então
// aqueles módulos funcionam sem mudanças.
// ============================================================

const BLOCK = 32;

const totalPicks = (d) => d.draftOrder.length * 7;
const roundOf = (d, idx) => Math.floor(idx / d.draftOrder.length) + 1;
const pickInRoundOf = (d, idx) => (idx % d.draftOrder.length) + 1;
const ownerOf = (d, idx) => resolvePickOwner(d.futurePicks, d.draftOrder, d.year + 1, roundOf(d, idx), idx);
const isDraftComplete = (d) => d.draftPickIndex >= totalPicks(d);

function createDraftSession(c) {
  const user = c.teamAbbr;
  return {
    id: c.id, year: c.year, teamAbbr: user,
    draftOrder: c.draftOrder, futurePicks: c.futurePicks,                       // somente leitura
    leagueTeams: user && c.leagueTeams[user] ? { ...c.leagueTeams, [user]: { ...c.leagueTeams[user] } } : c.leagueTeams, // cópia rasa só do time do usuário (fan/dono)
    draftClass: c.draftClass, draftPickIndex: c.draftPickIndex,
    newHistory: [], signings: [], consumed: [], drafted: {},
    scouting: c.scouting, draftFeed: c.draftFeed || [], pendingDraftEvent: c.pendingDraftEvent || null,
    draftWish: c.draftWish || null, draftFlags: { ...(c.draftFlags || {}) }, draftEventPick: c.draftEventPick ?? -1,
    news: [], step: 0, picksSinceCommit: 0,
  };
}

// Visão "career + sessão" que as telas leem (sem copiar o resto do career).
function draftOverlay(career, d) {
  return {
    ...career,
    draftClass: d.draftClass, draftPickIndex: d.draftPickIndex,
    draftHistory: d.newHistory.length ? [...(career.draftHistory || []), ...d.newHistory] : career.draftHistory,
    scouting: d.scouting, draftFeed: d.draftFeed, pendingDraftEvent: d.pendingDraftEvent, draftWish: d.draftWish,
  };
}

const withDrafted = (drafted, abbr, prospect) => ({ ...drafted, [abbr]: [...(drafted[abbr] || []), prospect] });

// Uma escolha da IA. Devolve { d, rec } ou null (vez do usuário, ou sem prospects).
function aiPickOnce(d) {
  const idx = d.draftPickIndex;
  if (idx >= totalPicks(d) || !d.draftClass.length) return null;
  const owner = ownerOf(d, idx);
  if (owner === d.teamAbbr) return null;
  const rng = mulberry32(seedFromString(`${d.id}-dpick-${idx}`));
  const team = d.leagueTeams[owner];
  const view = { ...team, roster: team.roster.concat(d.drafted[owner] || []) };   // necessidades já contam quem ele escolheu
  const prospect = pickForTeamAI(rng, view, d.draftClass) || d.draftClass[0];
  const rec = { round: roundOf(d, idx), pick: pickInRoundOf(d, idx), teamAbbr: owner, name: prospect.name, pos: prospect.pos, ovr: prospect.ovr, projectedRound: prospect.draftRound };
  return {
    rec,
    d: {
      ...d,
      draftClass: d.draftClass.filter((p) => p.id !== prospect.id), draftPickIndex: idx + 1,
      newHistory: [...d.newHistory, rec],
      signings: [...d.signings, { teamAbbr: owner, prospect, idx }], consumed: [...d.consumed, idx],
      drafted: withDrafted(d.drafted, owner, prospect), picksSinceCommit: d.picksSinceCommit + 1,
    },
  };
}

// Um "tick" do modo ao vivo: uma escolha da IA + comentário + (às vezes) um evento de sala de guerra.
function liveTick(d) {
  if (d.pendingDraftEvent || isDraftComplete(d)) return d;
  const r = aiPickOnce(d);
  if (!r) return d;
  const rng = mulberry32(seedFromString(`${d.id}-live-${d.draftPickIndex}-${d.step}`));
  const n = { ...r.d, step: d.step + 1, draftFlags: { ...r.d.draftFlags }, news: [...r.d.news] };
  const cm = pickCommentary(n, r.rec, rng);
  pushFeed(n, { key: `p${d.draftPickIndex}`, round: r.rec.round, pick: r.rec.pick, teamAbbr: r.rec.teamAbbr, text: cm.text, tone: cm.tone });
  const nIdx = n.draftPickIndex;
  if (nIdx >= totalPicks(n)) return n;
  let untilMine = 99;
  for (let k = 0; k < 10 && nIdx + k < totalPicks(n); k++) { if (ownerOf(n, nIdx + k) === n.teamAbbr) { untilMine = k; break; } }
  const x = { idx: nIdx, round: roundOf(n, nIdx), pickInRound: pickInRoundOf(n, nIdx), untilMine };
  const ev = untilMine === 0 ? rollMyTurnEvent(n, x, rng) : rollBetweenEvent(n, x, rng);
  if (ev) n.pendingDraftEvent = ev;
  return n;
}

// "Pular até minha vez": roda as escolhas da IA em sequência, sem comentário nem eventos.
function skipToUser(d) {
  let cur = d;
  for (let guard = 0; guard < totalPicks(d); guard++) {
    const r = aiPickOnce(cur);
    if (!r) break;
    cur = r.d;
  }
  return cur;
}

// Escolha do usuário. Ignora se não for a vez dele ou se o prospect não está mais no board.
function userPick(d, prospect) {
  const idx = d.draftPickIndex;
  if (idx >= totalPicks(d) || ownerOf(d, idx) !== d.teamAbbr || !d.draftClass.some((p) => p.id === prospect.id)) return d;
  const round = roundOf(d, idx), pickInRound = pickInRoundOf(d, idx);
  const rec = { round, pick: pickInRound, teamAbbr: d.teamAbbr, name: prospect.name, pos: prospect.pos, ovr: prospect.ovr, projectedRound: prospect.draftRound };
  const n = {
    ...d,
    draftClass: d.draftClass.filter((p) => p.id !== prospect.id), draftPickIndex: idx + 1,
    newHistory: [...d.newHistory, rec],
    signings: [...d.signings, { teamAbbr: d.teamAbbr, prospect, idx }], consumed: [...d.consumed, idx],
    drafted: withDrafted(d.drafted, d.teamAbbr, prospect),
    news: [...d.news, `Draft: ${d.teamAbbr} seleciona ${prospect.name} (${prospect.pos}).`],
    draftFlags: { ...d.draftFlags }, step: d.step + 1, picksSinceCommit: d.picksSinceCommit + 1,
  };
  afterUserPick(n, prospect, round, pickInRound, mulberry32(seedFromString(`${d.id}-afterpick-${idx}`)));
  return n;
}

function scoutPure(d, prospectId, actionId) {
  const p = d.draftClass.find((x) => x.id === prospectId);
  if (!p) return { d, result: { ok: false, msg: "Prospect indisponível." } };
  const n = { ...d, scouting: structuredClone(d.scouting), step: d.step + 1 };
  const result = doScout(n, p, actionId, mulberry32(seedFromString(`${d.id}-scout-${prospectId}-${actionId}-${d.step}`)));
  return result.ok ? { d: n, result } : { d, result };
}

function chooseEventPure(d, eventUid, optionIdx) {
  const n = { ...d, scouting: structuredClone(d.scouting), news: [...d.news], draftFlags: { ...d.draftFlags }, step: d.step + 1 };
  resolveDraftEvent(n, eventUid, optionIdx, mulberry32(seedFromString(`${d.id}-devchoice-${eventUid}`)));
  return n;
}

// Merge da sessão no career com compartilhamento estrutural: só os times que assinaram ganham novos
// arrays de elenco; o resto do career (arquivo histórico, Top 100, outros times) é reaproveitado.
// `final` (draft completo): reordena a escalação das IAs e dispara a coletiva de nota do draft.
function commitDraftSession(prev, d, { final = false, onFinalize } = {}) {
  const leagueTeams = { ...prev.leagueTeams };
  const byTeam = {};
  d.signings.forEach((s) => { (byTeam[s.teamAbbr] ||= []).push(s); });
  Object.entries(byTeam).forEach(([abbr, list]) => {
    const team = prev.leagueTeams[abbr];
    const roster = [...team.roster];
    list.forEach((s) => { const slot = findSlotForRookie(roster, s.prospect.pos); insertPlayer(roster, slot, { ...s.prospect, slot }); });
    leagueTeams[abbr] = { ...team, roster };
  });
  const user = prev.teamAbbr;
  if (user && leagueTeams[user] && d.leagueTeams[user]) {
    leagueTeams[user] = { ...leagueTeams[user], fanSupport: d.leagueTeams[user].fanSupport, ownerConfidence: d.leagueTeams[user].ownerConfidence };
  }
  const futurePicks = [...prev.futurePicks];
  d.consumed.forEach((idx) => consumePick(futurePicks, d.draftOrder, d.year + 1, roundOf(d, idx), idx));

  const merged = {
    ...prev, leagueTeams, futurePicks,
    draftClass: d.draftClass, draftPickIndex: d.draftPickIndex,
    draftHistory: [...(prev.draftHistory || []), ...d.newHistory],
    scouting: d.scouting, draftFeed: d.draftFeed, pendingDraftEvent: d.pendingDraftEvent,
    draftWish: d.draftWish, draftFlags: d.draftFlags, draftEventPick: d.draftEventPick,
    news: d.news.length ? [...prev.news, ...d.news] : prev.news,
  };
  if (final) {
    Object.keys(leagueTeams).forEach((abbr) => {
      if (abbr === user) return;
      const t = leagueTeams[abbr];
      const copy = { ...t, roster: t.roster.map((p) => ({ ...p })) };    // autoSortDepth altera p.slot: copia rasa antes
      autoSortDepth(copy);
      leagueTeams[abbr] = copy;
    });
    if (onFinalize) onFinalize(merged, mulberry32(seedFromString(merged.id + "-draftgrade")));
  }
  return merged;
}

export { BLOCK, createDraftSession, draftOverlay, isDraftComplete, liveTick, skipToUser, userPick, scoutPure, chooseEventPure, commitDraftSession };
