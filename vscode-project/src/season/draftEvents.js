import { pick, randInt } from "../lib/rng.js";
import { TEAM_META } from "../data/teams.js";
import { applyEffects, opt } from "./events.js";
import { teamNeeds } from "./freeAgencyAI.js";
import { pickValueRead } from "./scouting.js";
import { consensusScore, revealAttrs, revealTrait, traitInfo, ensureScoutingState } from "./fog.js";

// ============================================================
// DRAFT AO VIVO: comentário a cada escolha, eventos de sala de guerra, reação da torcida.
// Eventos usam o mesmo formato do events.js (opções com efeitos declarativos) e aparecem no EventModal.
// Efeitos próprios: reveal, revealTrait, points, wish. O resto é delegado ao applyEffects.
// ============================================================

const tName = (a) => { const t = TEAM_META.find((x) => x.abbr === a); return t?.city ? `${t.city} ${t.name}` : a; };
const evUid = (c, idx, rng) => `${c.year}-d${idx}-${Math.floor(rng() * 1e6)}`;

function pushFeed(c, entry) {
  c.draftFeed = [entry, ...(c.draftFeed || [])].slice(0, 40);
}

// ---------- comentário das escolhas da IA ----------
function pickCommentary(c, rec, rng) {
  const read = rec.projectedRound ? pickValueRead(rec.projectedRound, rec.round) : null;
  const t = tName(rec.teamAbbr), pk = `${rec.round}.${String(rec.pick).padStart(2, "0")}`;
  const needs = teamNeeds(c.leagueTeams[rec.teamAbbr]).map((n) => n.pos);
  const need = needs.indexOf(rec.pos);
  let text, tone = "info";
  if (read?.label === "ROUBADA!") { text = `💎 ROUBADA! ${t} leva ${rec.name} (${rec.pos}) só na pick ${pk}. A projeção era a rodada ${rec.projectedRound}.`; tone = "good"; }
  else if (read?.label === "Ótimo valor") { text = `👏 Bom valor: ${rec.name} (${rec.pos}) para o ${t} na ${pk}.`; tone = "good"; }
  else if (read?.label === "Reach") { text = `😲 REACH! O ${t} gasta a pick ${pk} em ${rec.name} (${rec.pos}) e a mídia estranha.`; tone = "bad"; }
  else if (read?.label === "Um pouco cedo") { text = `🤔 ${t} antecipa ${rec.name} (${rec.pos}) na ${pk}.`; }
  else text = need >= 0 && need <= 1 ? `✅ ${t} resolve uma necessidade: ${rec.name} (${rec.pos}), pick ${pk}.` : `${t} escolhe ${rec.name} (${rec.pos}), pick ${pk}.`;
  if (rng() < 0.12) text += pick(rng, [" Na sala de guerra, aplausos.", " A torcida no telão reage.", " Os repórteres já correm atrás do técnico.", " O comissário mal esconde a surpresa."]);
  return { text, tone };
}

// ---------- reação à SUA escolha ----------
function afterUserPick(c, prospect, round, pickInRound, rng) {
  const t = c.leagueTeams[c.teamAbbr];
  const read = prospect.draftRound ? pickValueRead(prospect.draftRound, round) : null;
  const lines = [];
  if (read?.label === "Reach") { t.fanSupport = Math.max(0, t.fanSupport - 3); lines.push("🗣️ A torcida vaia no estádio: a escolha foi vista como reach."); }
  else if (read?.label === "Um pouco cedo") { t.fanSupport = Math.max(0, t.fanSupport - 1); lines.push("🤨 A torcida recebe a escolha com ceticismo."); }
  else if (read?.label === "ROUBADA!") { t.fanSupport = Math.min(100, t.fanSupport + 5); t.ownerConfidence = Math.min(100, t.ownerConfidence + 2); lines.push("🎉 O estádio explode: roubada no draft!"); }
  else if (read?.label === "Ótimo valor") { t.fanSupport = Math.min(100, t.fanSupport + 3); lines.push("👏 A torcida aplaude a escolha."); }
  const w = c.draftWish;
  if (w) {
    if (prospect.pos === w.pos) {
      if (w.owner) t.ownerConfidence = Math.min(100, t.ownerConfidence + 4);
      if (w.fan) t.fanSupport = Math.min(100, t.fanSupport + 4);
      lines.push(`✅ Pedido atendido: você levou um ${w.pos}.`);
      c.draftWish = null;
    } else if (round === 1) {
      if (w.owner) t.ownerConfidence = Math.max(0, t.ownerConfidence - 3);
      if (w.fan) t.fanSupport = Math.max(0, t.fanSupport - 3);
      lines.push(`❌ Você ignorou o pedido por um ${w.pos}: ${w.owner ? "o dono" : "a torcida"} não gostou.`);
      c.draftWish = null;
    }
  }
  const tr = prospect.trait && prospect.trait !== "normal" ? traitInfo(prospect) : null;
  if (tr) lines.push(`🧠 Perfil revelado: ${prospect.name} é "${tr.label}". ${tr.desc}`);
  lines.forEach((text) => pushFeed(c, { key: `u-${prospect.id}-${text.length}`, round, pick: pickInRound, teamAbbr: c.teamAbbr, text, tone: "user" }));
  c.news.push(...lines.slice(0, 2));
}

// ---------- efeitos próprios ----------
function applyDraftEffects(c, effects, rng) {
  const out = [];
  (effects || []).forEach((e) => {
    const P = (pid) => c.draftClass?.find((p) => p.id === pid);
    if (e.t === "reveal") { const p = P(e.pid); if (p) revealAttrs(c, p, e.n, e.mode || "random", rng); }
    else if (e.t === "revealTrait") { const p = P(e.pid); if (p) revealTrait(c, p); }
    else if (e.t === "points") { ensureScoutingState(c); c.scouting.points = Math.max(0, c.scouting.points + e.v); }
    else if (e.t === "wish") c.draftWish = { pos: e.pos, owner: !!e.owner, fan: !!e.fan };
    else out.push(...applyEffects(c, [e], rng));
  });
  return out;
}

// ---------- banco de eventos ----------
function make(c, idx, rng, id, title, body, options) {
  return { uid: evUid(c, idx, rng), eventId: id, category: "draft", tag: "Draft ao vivo", week: null, title, body, options };
}
const topBoard = (c, n) => [...c.draftClass].sort((a, b) => consensusScore(b) - consensusScore(a)).slice(0, n);

const MY_TURN = [
  { id: "faller", p: 0.7,
    when: (c, x) => c.draftClass.find((p) => p.draftRound < x.round || (x.round === 1 && x.pickInRound >= 10 && p.ovr >= 88)),
    build: (c, x, rng, p) => make(c, x.idx, rng, "faller", `${p.name} despencou no board`,
      `${p.name} (${p.pos}) era tratado como escolha mais alta, mas ainda está disponível na pick ${x.round}.${String(x.pickInRound).padStart(2, "0")}. Os agentes cochicham: lesão escondida? Ou o resto da liga errou feio?`,
      [opt("Investigar a fundo (1 ponto)", [{ t: "points", v: -1 }, { t: "reveal", pid: p.id, n: "all" }]),
       opt("Mandar o olheiro-chefe ver ao vivo", [{ t: "reveal", pid: p.id, n: 3, mode: "top" }]),
       opt("Seguir o plano e ignorar o burburinho", [])]) },
  { id: "late_gem", p: 0.5,
    when: (c, x) => (x.round >= 4 ? [...c.draftClass].sort((a, b) => b.ovr - a.ovr)[0] : null),
    build: (c, x, rng, p) => make(c, x.idx, rng, "late_gem", "O olheiro jura que achou um tesouro",
      `Um olheiro veterano puxa você de lado: "${p.name} (${p.pos}) vale muito mais que esta rodada. Confia em mim."`,
      [opt("Pedir o dossiê completo", [{ t: "reveal", pid: p.id, n: "all" }, { t: "revealTrait", pid: p.id }]),
       opt("Só o resumo do que ele faz de melhor", [{ t: "reveal", pid: p.id, n: 2, mode: "top" }]),
       opt("Ignorar", [])]) },
  { id: "war_room", p: 0.4,
    when: (c) => { const t = topBoard(c, 8); const a = t[0], b = t.find((q) => q.pos !== a?.pos); return a && b ? [a, b] : null; },
    build: (c, x, rng, [a, b]) => make(c, x.idx, rng, "war_room", "Sala de guerra dividida",
      `A comissão de olheiros racha: metade jura por ${a.name} (${a.pos}), metade por ${b.name} (${b.pos}). Há tempo para mandar uma equipe atrás de mais informações sobre um deles.`,
      [opt(`Apostar em ${a.name}`, [{ t: "reveal", pid: a.id, n: 3 }]),
       opt(`Apostar em ${b.name}`, [{ t: "reveal", pid: b.id, n: 3 }]),
       opt("Decidir no instinto", [])]) },
  { id: "crowd", p: 0.25,
    when: (c, x) => { const need = teamNeeds(c.leagueTeams[c.teamAbbr])[0]; return need && !c.draftWish ? need.pos : null; },
    build: (c, x, rng, pos) => make(c, x.idx, rng, "crowd", "A torcida no estádio pede um " + pos,
      `Os cânticos nas arquibancadas pedem um ${pos}. As câmeras mostram a multidão em pé. O que você faz?`,
      [opt(`Acenar e prometer um ${pos}`, [{ t: "fan", v: 2 }, { t: "wish", pos, fan: true }]),
       opt("Fingir que não ouviu", [{ t: "fan", v: -1 }])]) },
];

const BETWEEN = [
  { id: "medical", p: 0.12,
    when: (c) => { const t = topBoard(c, 14); const frag = t.find((p) => p.trait === "fragil"); const clean = t.find((p) => p.trait !== "fragil"); const p = frag && Math.random() < 0.65 ? frag : clean; return p || null; },
    build: (c, x, rng, p) => make(c, x.idx, rng, "medical", `Boato médico: ${p.name}`,
      `Circula nos bastidores que ${p.name} (${p.pos}) tem um problema físico escondido. Pode ser verdade, pode ser jogo de bastidor de outro time para derrubá-lo no board.`,
      [opt("Checar com um médico de confiança (1 ponto)", [{ t: "points", v: -1 }, { t: "revealTrait", pid: p.id }]),
       opt("Ignorar o boato", [])]) },
  { id: "owner_wish", p: 0.35,
    when: (c) => (!c.draftWish && !c.draftFlags?.wish ? teamNeeds(c.leagueTeams[c.teamAbbr])[0]?.pos : null),
    build: (c, x, rng, pos) => make(c, x.idx, rng, "owner_wish", `O dono quer um ${pos}`,
      `O dono liga em pleno draft: está de olho em um ${pos} e quer ver o nome dele no seu cartão. A conversa é curta, mas a mensagem é clara.`,
      [opt(`Atender: prometer um ${pos}`, [{ t: "owner", v: 3 }, { t: "wish", pos, owner: true }]),
       opt("Defender o melhor disponível", [{ t: "owner", v: -1 }]),
       opt("Enrolar o dono", [{ t: "owner", v: -2 }])]) },
];

// Evento na SUA vez (no máximo um por escolha).
function rollMyTurnEvent(c, x, rng) {
  if (c.draftEventPick === x.idx) return null;
  c.draftEventPick = x.idx;
  for (const ev of [...MY_TURN].sort(() => rng() - 0.5)) {
    const b = ev.when(c, x);
    if (b && rng() < ev.p) { c.draftFlags ||= {}; return ev.build(c, x, rng, b); }
  }
  return null;
}
// Evento entre escolhas da IA (quando sua vez está chegando).
function rollBetweenEvent(c, x, rng) {
  if (x.untilMine > 8 || x.untilMine < 1) return null;
  for (const ev of [...BETWEEN].sort(() => rng() - 0.5)) {
    if (ev.id === "owner_wish" && c.draftFlags?.wish) continue;
    if (ev.id === "medical" && c.draftFlags?.[`m${Math.floor(x.idx / 6)}`]) continue;
    const b = ev.when(c, x);
    if (b && rng() < ev.p) {
      c.draftFlags ||= {};
      if (ev.id === "owner_wish") c.draftFlags.wish = true; else c.draftFlags[`m${Math.floor(x.idx / 6)}`] = true;
      return ev.build(c, x, rng, b);
    }
  }
  return null;
}

function resolveDraftEvent(c, uid, optionIdx, rng) {
  const ev = c.pendingDraftEvent;
  if (!ev || ev.uid !== uid) return;
  const o = ev.options[optionIdx];
  c.pendingDraftEvent = null;
  if (!o) return;
  applyDraftEffects(c, o.effects, rng);
  const text = `🎓 ${ev.title}: ${o.label}.`;
  pushFeed(c, { key: ev.uid, round: null, pick: null, teamAbbr: c.teamAbbr, text, tone: "user" });
  c.news.push(text);
}

export { pushFeed, pickCommentary, afterUserPick, rollMyTurnEvent, rollBetweenEvent, resolveDraftEvent, applyDraftEffects };
