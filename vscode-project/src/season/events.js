import { clamp, pick, randInt } from "../lib/rng.js";
import { TEAM_META } from "../data/teams.js";
import { rivalryTier } from "./rivalries.js";
import { defenseRating, offenseRating } from "../engine/ratings.js";
import { recalcOvr } from "../engine/playerGen.js";
import { ROLE_LABEL } from "../engine/coachesGen.js";

// ============================================================
// EVENTOS DINÂMICOS & REUNIÕES (entre as semanas da temporada regular)
//
// - EVENTS: banco de eventos. Cada um tem `when(ctx)` (contexto que precisa existir) e
//   `build(...)` que devolve título, narrativa e 2-4 opções. As opções são DADOS
//   (efeitos declarativos), então o evento pendente pode ficar salvo no career.
// - rollWeeklyEvents(career, rng): sorteia 0-2 eventos para a PRÓXIMA semana.
// - resolveEvent: aplica a opção escolhida. checkPromises: cobra promessas depois do jogo.
// Efeitos: owner, fan, teamMorale, morale, tmp (modificador provisório de atributos; who: pid/team/opp/pos),
// dev, injury, heal, healTeam, salary, weekMod (tática só da semana), swap, chance, promise, text.
// ============================================================

const CATEGORY = {
  crisis: { icon: "⚠️", label: "Crise" }, positive: { icon: "🌟", label: "Momento positivo" },
  strategy: { icon: "📋", label: "Reunião tática" }, rivalry: { icon: "🔥", label: "Rivalidade" },
  media: { icon: "📰", label: "Mídia" }, relations: { icon: "🤝", label: "Relações" },
};

const myTeam = (c) => c.leagueTeams[c.teamAbbr];
const abbrName = (a) => { const t = TEAM_META.find((x) => x.abbr === a); return t?.city ? `${t.city} ${t.name}` : a; };
const uid = (c, rng) => `${c.year}-${c.week}-${Math.floor(rng() * 1e6)}`;

function ensureEventsState(c) {
  c.pendingEvents ||= [];
  c.activePromises ||= [];
  c.eventNotices ||= [];
  c.eventCooldowns ||= {};
  // limpeza: versão anterior tinha um evento de patrocínio que mexia em salários (removido)
  if (c.capRelief?.length) {
    const t = c.leagueTeams?.[c.teamAbbr];
    c.capRelief.forEach((r) => { const p = t?.roster.find((x) => x.id === r.pid); if (p) p.salary = Math.round((p.salary + r.amount) * 10) / 10; });
  }
  delete c.capRelief; delete c.pendingCapBonus;
  return c;
}

// ---------- contexto da semana ----------
function buildCtx(c) {
  const my = myTeam(c);
  const game = c.schedule?.[c.week - 1]?.find((g) => g.home === c.teamAbbr || g.away === c.teamAbbr);
  const oppAbbr = game ? (game.home === c.teamAbbr ? game.away : game.home) : null;
  const opp = oppAbbr ? c.leagueTeams[oppAbbr] : null;
  const isDivision = !!opp && opp.conf === my.conf && opp.div === my.div;
  const rival = oppAbbr ? rivalryTier(c.rivalries?.[oppAbbr], isDivision) : null;
  const starters = my.roster.filter((p) => p.slot && !p.slot.startsWith("BEN"));
  const gp = Math.max(0, c.week - 1);
  return { my, game, oppAbbr, opp, isDivision, rival, starters, gp, week: c.week, isHome: game?.home === c.teamAbbr };
}

// ---------- efeitos ----------
function addTmp(p, mod) { (p.tmpMods ||= []).push(mod); }

function applyEffects(c, effects, rng, out = []) {
  const t = myTeam(c);
  const P = (pid) => t.roster.find((p) => p.id === pid);
  (effects || []).forEach((e) => {
    switch (e.t) {
      case "owner": t.ownerConfidence = clamp(t.ownerConfidence + e.v, 0, 100); break;
      case "fan": t.fanSupport = clamp(t.fanSupport + e.v, 0, 100); break;
      case "teamMorale": t.roster.forEach((p) => { p.morale = clamp((p.morale ?? 65) + e.v, 0, 100); }); break;
      case "morale": { const p = P(e.pid); if (p) p.morale = clamp((p.morale ?? 65) + e.v, 0, 100); break; }
      case "tmp": {
        const mod = { all: e.all, attrs: e.attrs, weeks: e.weeks || 1, label: e.label || "Evento" };
        if (e.who === "opp") (c.leagueTeams[e.abbr]?.roster || []).forEach((p) => addTmp(p, mod));
        else if (e.who === "pos") t.roster.filter((p) => p.pos === e.pos).forEach((p) => addTmp(p, mod));
        else if (e.who === "team") t.roster.forEach((p) => addTmp(p, mod));
        else { const p = P(e.pid); if (p) addTmp(p, mod); }
        break;
      }
      case "dev": { const p = P(e.pid); if (p) { Object.keys(p.attrs).forEach((k) => { p.attrs[k] = clamp(p.attrs[k] + e.v, 30, 99); }); recalcOvr(p); } break; }
      case "injury": { const p = P(e.pid); if (p) p.injuredWeeks = Math.max(p.injuredWeeks || 0, e.weeks); break; }
      case "salary": { const p = P(e.pid); if (p) p.salary = Math.round(p.salary * e.mult * 10) / 10; break; }
      case "heal": { const p = P(e.pid); if (p) p.injuredWeeks = Math.max(0, (p.injuredWeeks || 0) - (e.weeks ?? 99)); break; }
      case "healTeam": t.roster.forEach((p) => { if (p.injuredWeeks > 0) p.injuredWeeks = Math.max(0, p.injuredWeeks - (e.weeks || 1)); }); break;
      case "weekMod": {
        const w = c.weekMods || (c.weekMods = {});
        if (e.passRatio) w.passRatio = (w.passRatio || 0) + e.passRatio;
        if (e.aggressive) w.aggressive = (w.aggressive || 0) + e.aggressive;
        break;
      }
      case "swap": { const a = P(e.a), b = P(e.b); if (a && b) { const s = a.slot; a.slot = b.slot; b.slot = s; } break; }
      case "chance": {
        const win = rng() < e.p;
        applyEffects(c, win ? e.win : e.lose, rng, out);
        out.push(win ? e.winText : e.loseText);
        break;
      }
      case "promise": (c.activePromises ||= []).push({ id: uid(c, rng) + "p", createdWeek: c.week, ...e.promise }); break;
      case "text": out.push(e.text); break;
      default: break;
    }
  });
  return out;
}

// Chips de prévia do que a opção mexe (direção, sem números exatos).
const CHIP_LABEL = { owner: "Dono", fan: "Torcida", teamMorale: "Moral do time", morale: "Moral do jogador", dev: "Evolução", injury: "Disponibilidade",
  salary: "Salário", heal: "Lesões", healTeam: "Lesões", weekMod: "Tática da semana", swap: "Escalação", promise: "Promessa ⚠️", tmp: "Atributos temporários" };
function chipsFor(effects, uncertain = false, acc = {}) {
  (effects || []).forEach((e) => {
    if (e.t === "chance") { chipsFor(e.win, true, acc); chipsFor(e.lose, true, acc); return; }
    if (e.t === "text") return;
    let label = CHIP_LABEL[e.t], dir = 0, big = false;
    if (["owner", "fan", "teamMorale", "morale", "dev"].includes(e.t)) { dir = Math.sign(e.v); big = Math.abs(e.v) >= 6; }
    else if (e.t === "heal" || e.t === "healTeam") dir = 1;
    else if (e.t === "injury") dir = -1;
    else if (e.t === "salary") dir = e.mult > 1 ? -1 : 1;
    else if (e.t === "tmp") {
      const v = e.all ?? Object.values(e.attrs || {}).reduce((a, b) => a + b, 0);
      if (e.who === "opp") { label = "Rival motivado"; dir = v > 0 ? -1 : 1; } else dir = Math.sign(v);
      big = Math.abs(v) >= 4;
    }
    const key = label + (uncertain ? "?" : "");
    const cur = acc[key] || { label, dir: 0, big: false, uncertain };
    cur.dir = Math.sign(cur.dir + dir) || (uncertain ? 0 : dir); cur.big = cur.big || big;
    acc[key] = cur;
  });
  return acc;
}
const previewOf = (effects) => Object.values(chipsFor(effects));

const opt = (label, effects) => ({ label, effects, chips: previewOf(effects) });
const sign = (n) => (n > 0 ? "+" : "");

// ---------- banco de eventos ----------
const GROUPS = ["WR", "RB", "CB", "LB", "DL", "OL", "S", "TE"];
const first = (arr) => arr[0] || null;

const EVENTS = [
  // ===== CRISES =====
  { id: "locker_fight", category: "crisis", weight: 1.0, cd: 8,
    when: (ctx, c, rng) => {
      const pos = pick(rng, GROUPS);
      const s = first(ctx.starters.filter((p) => p.pos === pos).sort((a, b) => a.ovr - b.ovr));
      const b = first(ctx.my.roster.filter((p) => p.pos === pos && p.id !== s?.id && (!p.slot || p.slot.startsWith("BEN") || p.slot !== s?.slot)).sort((a, b) => b.ovr - a.ovr));
      return s && b && b.ovr >= s.ovr - 6 && b.id !== s.id ? { s, b } : null;
    },
    build: (ctx, { s, b }) => ({
      title: "Briga no vestiário",
      body: `${b.name} e ${s.name} (${s.pos}) trocaram empurrões no treino. O reserva acha que merece a vaga; o titular não vai abrir mão dela sem lutar. O vestiário inteiro está olhando para você.`,
      options: [
        opt("Chamar os dois e mediar", [{ t: "chance", p: 0.6, win: [{ t: "morale", pid: s.id, v: 5 }, { t: "morale", pid: b.id, v: 5 }], winText: "A conversa funcionou: os dois se entenderam.",
          lose: [{ t: "morale", pid: s.id, v: -4 }, { t: "morale", pid: b.id, v: -6 }], loseText: "A conversa só azedou o clima." }]),
        opt(`Dar a vaga a ${b.name}`, [{ t: "swap", a: s.id, b: b.id }, { t: "morale", pid: b.id, v: 10 }, { t: "morale", pid: s.id, v: -10 }]),
        opt(`Bancar ${s.name}`, [{ t: "morale", pid: s.id, v: 6 }, { t: "morale", pid: b.id, v: -10 }, { t: "teamMorale", v: -1 }]),
      ],
    }) },
  { id: "holdout", category: "crisis", weight: 0.9, cd: 10,
    when: (ctx) => { const p = first(ctx.starters.filter((p) => p.ovr >= 78 && (p.years <= 1 || p.salary < ((p.ovr - 45) ** 2 / 90) * 0.7)).sort((a, b) => b.ovr - a.ovr)); return p ? { p } : null; },
    build: (ctx, { p }) => ({
      title: `${p.name} ameaça greve`,
      body: `${p.name} (OVR ${p.ovr}) mandou um recado pelo agente: não vai treinar enquanto o contrato não for revisto. A imprensa já está na porta do CT.`,
      options: [
        opt("Pagar: aumentar o salário em 20%", [{ t: "salary", pid: p.id, mult: 1.2 }, { t: "morale", pid: p.id, v: 12 }]),
        opt("Linha dura: treina ou senta", [{ t: "teamMorale", v: 1 }, { t: "chance", p: 0.5, win: [{ t: "morale", pid: p.id, v: -4 }], winText: "Ele cedeu e voltou aos treinos.",
          lose: [{ t: "morale", pid: p.id, v: -15 }, { t: "tmp", pid: p.id, all: -6, weeks: 2, label: "Greve" }], loseText: "Ele manteve a greve: está destreinado por duas semanas." }]),
        opt("Prometer conversar na offseason", [{ t: "morale", pid: p.id, v: 5 }, { t: "chance", p: 0.3, win: [], winText: "", lose: [{ t: "tmp", pid: p.id, all: -3, weeks: 1, label: "Insatisfação" }], loseText: "" }]),
      ],
    }) },
  { id: "offfield", category: "crisis", weight: 0.8, cd: 9,
    when: (ctx, c, rng) => { const p = ctx.starters.length ? pick(rng, ctx.starters) : null; return p ? { p } : null; },
    build: (ctx, { p }) => ({
      title: "Incidente fora de campo",
      body: `${p.name} foi flagrado saindo de uma festa na véspera do treino, e o vídeo já circula nas redes. A torcida cobra uma posição.`,
      options: [
        opt("Suspender por um jogo", [{ t: "injury", pid: p.id, weeks: 1 }, { t: "fan", v: 2 }, { t: "owner", v: 2 }, { t: "morale", pid: p.id, v: -6 }]),
        opt("Defendê-lo publicamente", [{ t: "morale", pid: p.id, v: 8 }, { t: "fan", v: -4 }, { t: "owner", v: -3 }, { t: "teamMorale", v: -1 }]),
        opt("Esperar a poeira baixar", [{ t: "chance", p: 0.5, win: [], winText: "A história esfriou sozinha.", lose: [{ t: "fan", v: -6 }, { t: "owner", v: -4 }], loseText: "Virou polêmica nacional." }]),
      ],
    }) },
  // ===== POSITIVOS =====
  { id: "vet_mentor", category: "positive", weight: 1.0, cd: 8,
    when: (ctx) => {
      const v = first(ctx.starters.filter((p) => p.age >= 29 && p.ovr >= 76).sort((a, b) => b.ovr - a.ovr));
      const r = v && first(ctx.my.roster.filter((p) => p.age <= 23 && p.ovr <= 74 && p.id !== v.id).sort((a, b) => (b.pos === v.pos) - (a.pos === v.pos) || b.ovr - a.ovr));
      return v && r ? { v, r } : null;
    },
    build: (ctx, { v, r }) => ({
      title: "Veterano adota um novato",
      body: `${v.name}, veterano de ${v.age} anos, começou a ficar depois do treino com o jovem ${r.name} (${r.pos}), revendo vídeo e corrigindo detalhes. Vale incentivar?`,
      options: [
        opt("Incentivar a mentoria", [{ t: "tmp", pid: r.id, all: 3, weeks: 4, label: "Mentoria" }, { t: "dev", pid: r.id, v: 1 }, { t: "morale", pid: v.id, v: 5 }]),
        opt(`Pedir que ${v.name} foque no próprio jogo`, [{ t: "tmp", pid: v.id, all: 1, weeks: 3, label: "Foco" }, { t: "morale", pid: r.id, v: -3 }]),
        opt("Deixar acontecer", [{ t: "chance", p: 0.5, win: [{ t: "tmp", pid: r.id, all: 2, weeks: 3, label: "Mentoria" }], winText: "Rolou naturalmente: o novato evoluiu.", lose: [], loseText: "Nada de mais aconteceu." }]),
      ],
    }) },
  { id: "team_dinner", category: "positive", weight: 0.9, cd: 6,
    when: (ctx) => (ctx.gp >= 2 ? {} : null),
    build: () => ({
      title: "Jantar da equipe",
      body: "Os capitães sugeriram um jantar de integração antes do próximo jogo. Pode ajudar o ambiente, mas também tem gente que prefere ficar vendo vídeo.",
      options: [
        opt("Jantar por minha conta", [{ t: "teamMorale", v: 4 }]),
        opt("Jantar com patrocinador e discurso", [{ t: "teamMorale", v: 3 }, { t: "owner", v: 2 }, { t: "fan", v: -1 }]),
        opt("Sessão de vídeo em vez do jantar", [{ t: "tmp", who: "team", all: 1, weeks: 1, label: "Preparo extra" }, { t: "teamMorale", v: -1 }]),
      ],
    }) },
  // ===== ESTRATÉGICOS =====
  { id: "coordinator_meeting", category: "strategy", weight: 1.3, cd: 3,
    when: (ctx) => {
      if (!ctx.opp) return null;
      const oc = ctx.my.coaches?.OC, dc = ctx.my.coaches?.DC;
      const passD = defenseRating(ctx.opp.roster, "pass"), runD = defenseRating(ctx.opp.roster, "run");
      const oPass = offenseRating(ctx.opp.roster, "pass"), oRun = offenseRating(ctx.opp.roster, "run");
      if (oc && passD < runD - 2) return { plan: "pass", coach: oc };
      if (dc && oRun > oPass + 2) return { plan: "box", coach: dc };
      if (oc && runD < passD - 2) return { plan: "run", coach: oc };
      return null;
    },
    build: (ctx, { plan, coach }) => {
      const opp = abbrName(ctx.oppAbbr);
      const txt = plan === "pass" ? `${coach.name} (${ROLE_LABEL.OC}) analisou o ${opp}: "A secundária deles é fraca. Vamos focar no passe esta semana."`
        : plan === "run" ? `${coach.name} (${ROLE_LABEL.OC}) acha que o ${opp} sofre contra a corrida: "Vamos martelar o jogo terrestre."`
        : `${coach.name} (${ROLE_LABEL.DC}) avisa que o ${opp} vive do jogo corrido: "Vamos colocar oito homens na caixa e apertar."`;
      const full = plan === "pass" ? { t: "weekMod", passRatio: 0.1 } : plan === "run" ? { t: "weekMod", passRatio: -0.1 } : { t: "weekMod", aggressive: 0.2 };
      const half = plan === "pass" ? { t: "weekMod", passRatio: 0.05 } : plan === "run" ? { t: "weekMod", passRatio: -0.05 } : { t: "weekMod", aggressive: 0.1 };
      const prom = (win, lose, w, l, text) => ({ t: "promise", promise: { kind: "result", dueWeek: ctx.week, text, onSuccess: win, onFail: lose, successText: w, failText: l } });
      return {
        title: "Reunião com o coordenador", body: txt,
        options: [
          opt(`Seguir o plano de ${coach.name}`, [full, prom([{ t: "owner", v: 2 }], [{ t: "owner", v: -3 }], "O plano da semana deu certo e a diretoria notou.", "O plano da semana não funcionou, e a diretoria cobrou.", "Plano tático da semana: se perder, o dono perde confiança.")]),
          opt("Aplicar só parte do plano", [half, prom([], [{ t: "owner", v: -1 }], "", "O meio-termo não convenceu a diretoria.", "Plano parcial da semana.")]),
          opt("Manter meu plano de jogo", []),
        ],
      };
    } },
  // ===== RIVALIDADE =====
  { id: "rivalry_trash", category: "rivalry", weight: 2.2, cd: 2,
    when: (ctx) => (ctx.rival && ctx.oppAbbr ? {} : null),
    build: (ctx) => {
      const opp = abbrName(ctx.oppAbbr);
      return {
        title: `Clima de ${ctx.rival.label}`,
        body: `O jogo contra o ${opp} ferve na mídia. Um jogador deles provocou seu time numa entrevista e os repórteres querem saber como você responde.`,
        options: [
          opt("Colocar lenha na fogueira", [{ t: "fan", v: 8 }, { t: "teamMorale", v: 3 }, { t: "tmp", who: "opp", abbr: ctx.oppAbbr, all: 2, weeks: 1, label: "Provocado" }, { t: "owner", v: -1 }]),
          opt("Respeitar o rival", [{ t: "fan", v: 1 }, { t: "teamMorale", v: 1 }]),
          opt("Acalmar os ânimos", [{ t: "owner", v: 2 }, { t: "fan", v: -2 }]),
        ],
      };
    } },
  // ===== MÍDIA =====
  { id: "playbook_leak", category: "media", weight: 0.7, cd: 10,
    when: (ctx) => (ctx.opp ? {} : null),
    build: (ctx) => {
      const qb = ctx.my.roster.find((p) => p.slot === "QB1");
      return {
        title: "Vazamento do playbook",
        body: `Um site publicou páginas do seu playbook às vésperas do jogo contra o ${abbrName(ctx.oppAbbr)}. Alguém de dentro está falando.`,
        options: [
          opt("Investigar e punir o culpado", [{ t: "chance", p: 0.5, win: [{ t: "owner", v: 2 }, { t: "teamMorale", v: -2 }], winText: "O vazador foi encontrado.", lose: [{ t: "teamMorale", v: -4 }, { t: "owner", v: -1 }], loseText: "Clima de caça às bruxas." }]),
          opt("Trocar o plano de jogo", qb ? [{ t: "tmp", pid: qb.id, attrs: { AWR: -3 }, weeks: 1, label: "Adaptação" }] : []),
          opt("Ignorar", [{ t: "tmp", who: "opp", abbr: ctx.oppAbbr, all: 1.5, weeks: 1, label: "Preparado" }]),
        ],
      };
    } },
  { id: "firing_rumors", category: "media", weight: 1.0, cd: 8,
    when: (ctx) => (ctx.my.ownerConfidence < 55 || ctx.my.losses > ctx.my.wins ? {} : null),
    build: () => ({
      title: "Rumores de demissão",
      body: "Um colunista famoso garante que o dono já procura seu substituto. O assunto domina o rádio esportivo.",
      options: [
        opt("Responder com firmeza em público", [{ t: "chance", p: 0.5, win: [{ t: "fan", v: 3 }, { t: "owner", v: 3 }], winText: "A resposta firme foi bem recebida.", lose: [{ t: "owner", v: -4 }], loseText: "O tom irritou o dono." }]),
        opt("Procurar o dono em particular", [{ t: "chance", p: 0.55, win: [{ t: "owner", v: 5 }], winText: "O dono gostou da transparência.", lose: [{ t: "owner", v: -2 }], loseText: "A conversa foi fria." }]),
        opt("Ignorar o barulho", [{ t: "owner", v: -1 }, { t: "teamMorale", v: -1 }]),
      ],
    }) },
  { id: "qb_gossip", category: "media", weight: 0.8, cd: 10,
    when: (ctx) => { const qb = ctx.my.roster.find((p) => p.slot === "QB1"); return qb ? { qb } : null; },
    build: (ctx, { qb }) => ({
      title: "Fofoca sobre o quarterback",
      body: `Um blog de celebridades publicou fotos de ${qb.name} em plena madrugada com uma pessoa não identificada. O vestiário comenta, a imprensa pergunta.`,
      options: [
        opt("Proteger o jogador", [{ t: "morale", pid: qb.id, v: 6 }, { t: "fan", v: -1 }]),
        opt("Cobrar foco no jogo", [{ t: "morale", pid: qb.id, v: -5 }, { t: "tmp", pid: qb.id, all: 1.5, weeks: 2, label: "Raiva produtiva" }, { t: "teamMorale", v: 1 }]),
        opt("Fazer uma coletiva dura", [{ t: "morale", pid: qb.id, v: -8 }, { t: "fan", v: -3 }, { t: "owner", v: 1 }]),
      ],
    }) },
  // ===== RELAÇÕES E PROMESSAS =====
  { id: "owner_streak", category: "relations", weight: 1.0, cd: 10,
    when: (ctx, c) => {
      if (ctx.week < 3 || ctx.my.ownerConfidence >= 75 || (c.activePromises || []).some((p) => p.kind === "streak")) return null;
      return { n: ctx.week < 8 ? 2 : 3 };
    },
    build: (ctx, { n }) => {
      const prom = (k, ok, bad) => ({ t: "promise", promise: { kind: "streak", remaining: k, text: `Prometeu ${k} vitórias seguidas ao dono.`,
        onSuccess: ok, onFail: bad, successText: `Você cumpriu a promessa das ${k} vitórias seguidas. O dono está radiante.`, failText: "Você falhou na promessa ao dono e a confiança despencou." } });
      return {
        title: "O dono exige resultados",
        body: `O dono pediu uma reunião a portas fechadas: está impaciente e quer ${n} vitórias seguidas. Quem não cumpre promessa, diz ele, não fica no cargo.`,
        options: [
          opt(`Aceitar o desafio (${n} vitórias)`, [prom(n, [{ t: "owner", v: 10 }, { t: "fan", v: 4 }, { t: "teamMorale", v: 3 }], [{ t: "owner", v: -12 }, { t: "fan", v: -3 }])]),
          opt(`Pedir mais prazo (${n + 1} vitórias)`, [{ t: "owner", v: -2 }, prom(n + 1, [{ t: "owner", v: 14 }, { t: "fan", v: 5 }, { t: "teamMorale", v: 4 }], [{ t: "owner", v: -9 }])]),
          opt("Recusar a cobrança", [{ t: "owner", v: -4 }]),
        ],
      };
    } },
  { id: "wr_demand", category: "relations", weight: 1.2, cd: 6,
    when: (ctx, c) => {
      if (ctx.gp < 2 || (c.activePromises || []).some((p) => p.kind === "targets")) return null;
      const wr = first(ctx.starters.filter((p) => p.pos === "WR" && p.ovr >= 80 && (p.seasonStats?.targets ?? p.seasonStats?.receptions ?? 0) / ctx.gp < 6.5).sort((a, b) => b.ovr - a.ovr));
      return wr ? { wr } : null;
    },
    build: (ctx, { wr }) => {
      const prom = (n, ok, bad, text) => ({ t: "promise", promise: { kind: "targets", pid: wr.id, target: n, dueWeek: ctx.week, text,
        onSuccess: ok, onFail: bad, successText: `${wr.name} recebeu a bola que queria e está nas nuvens.`, failText: `${wr.name} não teve os ${n} alvos prometidos e ficou furioso.` } });
      return {
        title: `${wr.name} invade a sua sala`,
        body: `${wr.name} (OVR ${wr.ovr}) entrou sem bater: "Sou o melhor recebedor do time e mal vejo a bola. Quero mais passes no próximo jogo, ou vamos ter problema."`,
        options: [
          opt("Prometer 8+ alvos no próximo jogo", [{ t: "weekMod", passRatio: 0.05 }, prom(8, [{ t: "morale", pid: wr.id, v: 12 }, { t: "tmp", pid: wr.id, all: 2, weeks: 2, label: "Confiança" }], [{ t: "morale", pid: wr.id, v: -20 }, { t: "tmp", pid: wr.id, all: -3, weeks: 3, label: "Revolta" }, { t: "teamMorale", v: -3 }], `Prometeu 8+ alvos a ${wr.name} no próximo jogo.`)]),
          opt("Prometer 'mais bola', sem número", [{ t: "weekMod", passRatio: 0.03 }, prom(6, [{ t: "morale", pid: wr.id, v: 6 }], [{ t: "morale", pid: wr.id, v: -10 }], `Prometeu mais bola a ${wr.name} (6+ alvos).`)]),
          opt("Dizer que o time vem primeiro", [{ t: "morale", pid: wr.id, v: -10 }, { t: "teamMorale", v: 2 }]),
        ],
      };
    } },

  // ===== MAIS EVENTOS DA NFL =====
  { id: "injury_decision", category: "crisis", weight: 1.2, cd: 4,
    when: (ctx) => { const p = first(ctx.starters.filter((p) => p.injuredWeeks >= 1 && p.injuredWeeks <= 2 && p.ovr >= 75).sort((a, b) => b.ovr - a.ovr)); return p ? { p } : null; },
    build: (ctx, { p }) => ({
      title: `${p.name} é dúvida para o jogo`,
      body: `${p.name} (${p.pos}, OVR ${p.ovr}) ainda sente a lesão, mas jura que consegue jogar. O departamento médico pede cautela. A decisão final é sua.`,
      options: [
        opt("Liberar para jogar", [{ t: "chance", p: 0.45, win: [{ t: "heal", pid: p.id }, { t: "morale", pid: p.id, v: 6 }], winText: "O médico liberou e ele joga.", lose: [{ t: "injury", pid: p.id, weeks: 4 }, { t: "morale", pid: p.id, v: -4 }], loseText: "Forçou demais e a lesão piorou." }]),
        opt("Seguir o protocolo e poupá-lo", [{ t: "morale", pid: p.id, v: 3 }]),
        opt("Pedir uma segunda opinião médica", [{ t: "chance", p: 0.6, win: [{ t: "heal", pid: p.id, weeks: 1 }], winText: "A segunda avaliação adiantou a volta em uma semana.", lose: [], loseText: "A segunda opinião confirmou o prazo." }]),
      ],
    }) },
  { id: "short_week", category: "strategy", weight: 0.8, cd: 7,
    when: (ctx) => (ctx.week >= 2 && ctx.opp ? {} : null),
    build: (ctx) => ({
      title: "Semana curta",
      body: `O jogo contra o ${abbrName(ctx.oppAbbr)} caiu na quinta à noite: só três dias de preparação. O preparador físico quer saber como dividir o tempo.`,
      options: [
        opt("Treino leve e recuperação", [{ t: "healTeam", weeks: 1 }, { t: "tmp", who: "team", all: -1, weeks: 1, label: "Pouco treino" }]),
        opt("Só vídeo e estratégia", [{ t: "tmp", who: "team", all: 1, weeks: 1, label: "Bem preparado" }, { t: "teamMorale", v: -1 }]),
        opt("Treino normal, sem mudar a rotina", []),
      ],
    }) },
  { id: "kicker_slump", category: "crisis", weight: 0.9, cd: 8,
    when: (ctx) => {
      const k = ctx.my.roster.find((p) => p.slot === "K1"); const s = k?.seasonStats || {};
      return k && (s.fgAttempts || 0) >= 4 && (s.fgMade || 0) / s.fgAttempts < 0.68 ? { k, pct: Math.round(((s.fgMade || 0) / s.fgAttempts) * 100) } : null;
    },
    build: (ctx, { k, pct }) => ({
      title: "Kicker perdeu a confiança",
      body: `${k.name} converteu só ${pct}% dos field goals e já ouve vaias no estádio. Os companheiros comentam que ele chuta com medo.`,
      options: [
        opt("Conversa individual e apoio", [{ t: "morale", pid: k.id, v: 8 }, { t: "tmp", pid: k.id, attrs: { KAC: 2, CLT: 3 }, weeks: 2, label: "Confiança" }]),
        opt("Cobrança dura", [{ t: "morale", pid: k.id, v: -8 }, { t: "chance", p: 0.4, win: [{ t: "tmp", pid: k.id, attrs: { KAC: 3 }, weeks: 2, label: "Reação" }], winText: "A cobrança deu resultado.", lose: [{ t: "tmp", pid: k.id, attrs: { KAC: -3 }, weeks: 2, label: "Pressão" }], loseText: "A pressão piorou o chute." }]),
        opt("Treino extra com o especialista", [{ t: "tmp", pid: k.id, attrs: { KAC: 2 }, weeks: 3, label: "Treino extra" }, { t: "morale", pid: k.id, v: 3 }]),
      ],
    }) },
  { id: "qb_controversy", category: "crisis", weight: 1.0, cd: 9,
    when: (ctx) => {
      const q1 = ctx.my.roster.find((p) => p.slot === "QB1");
      const q2 = first(ctx.my.roster.filter((p) => p.pos === "QB" && p.id !== q1?.id).sort((a, b) => b.ovr - a.ovr));
      if (!q1 || !q2) return null;
      const ints = (q1.seasonStats?.interceptionsThrown || 0) / Math.max(1, ctx.gp);
      return q2.ovr >= q1.ovr - 3 || (ctx.gp >= 3 && ints >= 1.2) ? { q1, q2 } : null;
    },
    build: (ctx, { q1, q2 }) => ({
      title: "Polêmica no quarterback",
      body: `A torcida pede ${q2.name} no lugar de ${q1.name} nas rádios e nas redes. O vestiário está dividido e a imprensa quer saber quem é o seu QB.`,
      options: [
        opt(`Manter ${q1.name}`, [{ t: "morale", pid: q1.id, v: 5 }, { t: "morale", pid: q2.id, v: -8 }, { t: "fan", v: -2 }]),
        opt(`Promover ${q2.name}`, [{ t: "swap", a: q1.id, b: q2.id }, { t: "morale", pid: q2.id, v: 10 }, { t: "morale", pid: q1.id, v: -12 }, { t: "fan", v: 3 }]),
        opt(`Dar a ${q1.name} só mais um jogo`, [{ t: "promise", promise: { kind: "result", dueWeek: ctx.week, text: `${q1.name} precisa vencer o próximo jogo para manter a vaga.`,
          onSuccess: [{ t: "morale", pid: q1.id, v: 8 }, { t: "fan", v: 2 }], onFail: [{ t: "morale", pid: q1.id, v: -8 }, { t: "fan", v: -3 }],
          successText: `${q1.name} calou os críticos.`, failText: `${q1.name} não aguentou a pressão e a torcida exige mudança.` } }]),
      ],
    }) },
  { id: "weather_game", category: "strategy", weight: 0.8, cd: 7,
    when: (ctx, c, rng) => (ctx.week >= 5 && ctx.opp ? { kind: pick(rng, ["vento forte", "neve", "chuva forte"]) } : null),
    build: (ctx, { kind }) => {
      const qb = ctx.my.roster.find((p) => p.slot === "QB1"), k = ctx.my.roster.find((p) => p.slot === "K1");
      const kick = k ? [{ t: "tmp", pid: k.id, attrs: { KAC: -3 }, weeks: 1, label: "Clima" }] : [];
      return {
        title: `Previsão de ${kind}`,
        body: `O jogo contra o ${abbrName(ctx.oppAbbr)} deve ser sob ${kind}. O coordenador quer saber se o plano de jogo continua o mesmo, e o kicker já olha para as bandeiras no estádio.`,
        options: [
          opt("Adaptar: mais corrida", [{ t: "weekMod", passRatio: -0.12 }, ...kick]),
          opt("Manter o ataque aéreo", [...(qb ? [{ t: "tmp", pid: qb.id, attrs: { DTA: -3, MTA: -2 }, weeks: 1, label: "Clima" }] : []), ...kick]),
          opt("Cuidado total com a bola", [{ t: "weekMod", passRatio: -0.06 }, ...(qb ? [{ t: "tmp", pid: qb.id, attrs: { AWR: 2 }, weeks: 1, label: "Foco" }] : []), ...kick]),
        ],
      };
    } },
  { id: "ol_struggles", category: "strategy", weight: 1.0, cd: 6,
    when: (ctx) => {
      const sacks = ctx.my.roster.filter((p) => p.pos === "OL").reduce((s, p) => s + (p.seasonStats?.sacksAllowed || 0), 0);
      return ctx.gp >= 3 && sacks / ctx.gp >= 2.5 ? { sacks } : null;
    },
    build: (ctx, { sacks }) => ({
      title: "Linha ofensiva em apuros",
      body: `Seu QB já foi sacado ${sacks} vezes em ${ctx.gp} jogos. O treinador de OL diz que o problema é de comunicação, enquanto o QB reclama que segura a bola demais.`,
      options: [
        opt("Reunião com a linha ofensiva", [{ t: "tmp", who: "pos", pos: "OL", attrs: { PBK: 3, AWR: 2 }, weeks: 2, label: "Entrosamento" }]),
        opt("Mais proteção: RB e TE ajudam", [{ t: "weekMod", passRatio: -0.06 }, { t: "tmp", who: "pos", pos: "OL", attrs: { PBK: 1 }, weeks: 1, label: "Ajuda extra" }]),
        opt("Cobrar o QB por segurar a bola", [{ t: "teamMorale", v: 1 }, { t: "chance", p: 0.5, win: [{ t: "tmp", who: "pos", pos: "OL", attrs: { PBK: 2 }, weeks: 1, label: "Bola saindo rápido" }], winText: "A bola passou a sair mais rápido.", lose: [], loseText: "" }]),
      ],
    }) },
  { id: "community_day", category: "positive", weight: 0.8, cd: 12,
    when: () => ({}),
    build: () => ({
      title: "Dia de ação social",
      body: "A fundação do clube organizou uma visita ao hospital infantil da cidade no dia de folga. A torcida adora esse tipo de gesto, mas o elenco queria descansar.",
      options: [
        opt("Todo o elenco participa", [{ t: "fan", v: 5 }, { t: "teamMorale", v: 3 }]),
        opt("Só os capitães vão", [{ t: "fan", v: 3 }]),
        opt("Sem ação: foco no descanso", [{ t: "teamMorale", v: 1 }, { t: "fan", v: -1 }]),
      ],
    }) },
  { id: "facility_upgrade", category: "positive", weight: 0.7, cd: 18,
    when: (ctx) => (ctx.my.ownerConfidence >= 55 ? {} : null),
    build: () => ({
      title: "O dono quer investir no CT",
      body: "Satisfeito com seu trabalho, o dono ofereceu uma verba para melhorar o centro de treinamento. Você escolhe em que ela vai ser gasta.",
      options: [
        opt("Tecnologia de recuperação", [{ t: "healTeam", weeks: 1 }, { t: "teamMorale", v: 1 }]),
        opt("Reformar vestiário e refeitório", [{ t: "teamMorale", v: 5 }, { t: "owner", v: 1 }]),
        opt("Devolver a verba ao dono", [{ t: "owner", v: 4 }]),
      ],
    }) },
  { id: "trade_rumor", category: "media", weight: 0.8, cd: 9,
    when: (ctx) => { const p = first(ctx.starters.filter((p) => p.ovr >= 85).sort((a, b) => b.ovr - a.ovr)); return p ? { p } : null; },
    build: (ctx, { p }) => ({
      title: `Rumor de troca: ${p.name}`,
      body: `Um repórter de peso garantiu que ${p.name} (OVR ${p.ovr}) está na mira de um rival e que o time estaria disposto a negociá-lo. O jogador leu tudo.`,
      options: [
        opt("Desmentir publicamente", [{ t: "morale", pid: p.id, v: 6 }, { t: "fan", v: 1 }]),
        opt("Não comentar", [{ t: "chance", p: 0.5, win: [], winText: "O barulho passou.", lose: [{ t: "morale", pid: p.id, v: -8 }, { t: "tmp", pid: p.id, all: -2, weeks: 1, label: "Distração" }], loseText: "O rumor desestabilizou o jogador." }]),
        opt("Conversar a sós com ele", [{ t: "morale", pid: p.id, v: 4 }]),
      ],
    }) },
  { id: "playoff_push", category: "strategy", weight: 1.4, cd: 4,
    when: (ctx) => (ctx.week >= 13 && ctx.week <= 17 && ctx.my.wins >= ctx.my.losses - 1 ? {} : null),
    build: (ctx, b, rng) => {
      const risk = ctx.starters.length ? pick(rng, ctx.starters) : null;
      return {
        title: "Briga por vaga nos playoffs",
        body: "Faltam poucas rodadas e cada jogo vale a temporada. O elenco está desgastado, mas a pressão por vaga nos playoffs só aumenta.",
        options: [
          opt("Titulares até o fim, sem rotação", [{ t: "tmp", who: "team", all: 1, weeks: 1, label: "Força máxima" }, ...(risk ? [{ t: "chance", p: 0.2, win: [{ t: "injury", pid: risk.id, weeks: 3 }], winText: `${risk.name} se machucou no desgaste.`, lose: [], loseText: "" }] : [])]),
          opt("Poupar os machucados e descansar", [{ t: "healTeam", weeks: 1 }, { t: "teamMorale", v: 1 }]),
          opt("Discurso de 'tudo ou nada'", [{ t: "teamMorale", v: 4 }, { t: "owner", v: 1 }, { t: "promise", promise: { kind: "result", dueWeek: ctx.week, text: "Você prometeu entrega total no próximo jogo.",
            onSuccess: [{ t: "teamMorale", v: 2 }], onFail: [{ t: "teamMorale", v: -3 }, { t: "owner", v: -3 }], successText: "O time respondeu ao seu discurso.", failText: "O discurso foi grande, mas o resultado não veio." } }]),
        ],
      };
    } },
  { id: "captain_speech", category: "positive", weight: 0.9, cd: 7,
    when: (ctx) => (ctx.gp >= 3 && ctx.my.losses >= ctx.my.wins ? { vet: first(ctx.starters.filter((p) => p.age >= 29).sort((a, b) => b.ovr - a.ovr)) } : null),
    build: (ctx, { vet }) => ({
      title: "Os capitães pedem a palavra",
      body: "Depois de mais uma semana difícil, os capitães querem reunir o elenco sem a comissão técnica. Pode unir o grupo, ou escancarar as divisões.",
      options: [
        opt("Deixar os capitães falarem", [{ t: "chance", p: 0.6, win: [{ t: "teamMorale", v: 6 }], winText: "Foi catártico: o vestiário saiu unido.", lose: [{ t: "teamMorale", v: -2 }], loseText: "Virou bate-boca e as divisões apareceram." }]),
        opt("Falar você mesmo", [{ t: "teamMorale", v: 3 }, { t: "owner", v: 1 }]),
        ...(vet ? [opt(`Chamar ${vet.name}, o mais respeitado`, [{ t: "teamMorale", v: 4 }, { t: "morale", pid: vet.id, v: 4 }])] : []),
      ],
    }) },
];

// ---------- sorteio semanal ----------
function rollWeeklyEvents(c, rng) {
  ensureEventsState(c);
  const ctx = buildCtx(c);
  const abs = c.year * 100 + c.week;
  const pool = EVENTS.map((ev) => {
    const last = c.eventCooldowns[ev.id];
    if (last != null && abs - last < ev.cd) return null;
    const b = ev.when(ctx, c, rng);
    return b ? { ev, b } : null;
  }).filter(Boolean);
  if (!pool.length) return [];
  const r = rng();
  let count = r < 0.3 ? 0 : r < 0.85 ? 1 : 2;
  if (ctx.rival && rng() < 0.75) count = Math.max(count, 1);
  const out = [], cats = new Set();
  while (out.length < count && pool.length) {
    const total = pool.reduce((s, x) => s + x.ev.weight * (x.ev.id === "rivalry_trash" && ctx.rival ? 1.5 : 1), 0);
    let roll = rng() * total, idx = 0;
    for (; idx < pool.length - 1; idx++) { roll -= pool[idx].ev.weight; if (roll <= 0) break; }
    const [{ ev, b }] = pool.splice(idx, 1);
    if (cats.has(ev.category)) continue;
    cats.add(ev.category);
    const built = ev.build(ctx, b, rng);
    c.eventCooldowns[ev.id] = abs;
    out.push({ uid: uid(c, rng), eventId: ev.id, category: ev.category, week: c.week, ...built });
  }
  return out;
}

// ---------- resolver a escolha do usuário ----------
function resolveEvent(c, eventUid, optionIdx, rng) {
  ensureEventsState(c);
  const i = c.pendingEvents.findIndex((e) => e.uid === eventUid);
  if (i < 0) return;
  const ev = c.pendingEvents[i], o = ev.options[optionIdx];
  c.pendingEvents.splice(i, 1);
  if (!o) return;
  const notes = applyEffects(c, o.effects, rng).filter(Boolean);
  const text = `${CATEGORY[ev.category]?.icon || "📌"} ${ev.title}: ${o.label}.${notes.length ? " " + notes.join(" ") : ""}`;
  c.news.push(text);
  c.eventNotices.push({ id: ev.uid + "n", tone: "info", text });
  if (c.eventNotices.length > 12) c.eventNotices.shift();
}

// ---------- promessas: chamar logo depois do jogo do usuário (antes de c.week += 1) ----------
function checkPromises(c, game, rng) {
  ensureEventsState(c);
  if (!game || game.homeScore === undefined) return;
  const isHome = game.home === c.teamAbbr;
  const mine = isHome ? game.homeScore : game.awayScore, theirs = isHome ? game.awayScore : game.homeScore;
  const won = mine > theirs;
  const box = game.boxScore?.[isHome ? "home" : "away"] || [];
  const keep = [];
  const settle = (p, ok) => {
    const notes = applyEffects(c, ok ? p.onSuccess : p.onFail, rng).filter(Boolean);
    const msg = (ok ? p.successText : p.failText) || (ok ? "Promessa cumprida." : "Promessa quebrada.");
    if (msg) {
      c.news.push(`${ok ? "✅" : "❌"} ${msg}`);
      c.eventNotices.push({ id: p.id + "r", tone: ok ? "good" : "bad", text: `${ok ? "✅" : "❌"} ${msg}` });
    }
    return notes;
  };
  (c.activePromises || []).forEach((p) => {
    if (p.dueWeek && p.dueWeek !== c.week) { keep.push(p); return; }
    if (p.kind === "targets") {
      const s = box.find((x) => x.id === p.pid)?.stats || {};
      settle(p, (s.targets ?? s.receptions ?? 0) >= p.target);
    } else if (p.kind === "result") settle(p, won);
    else if (p.kind === "streak") {
      if (!won) settle(p, false);
      else if (p.remaining - 1 <= 0) settle(p, true);
      else keep.push({ ...p, remaining: p.remaining - 1 });
    } else keep.push(p);
  });
  c.activePromises = keep;
  if (c.eventNotices.length > 12) c.eventNotices = c.eventNotices.slice(-12);
}

// ---------- modificadores temporários ----------
function tickTempMods(c) {
  Object.values(c.leagueTeams).forEach((t) => t.roster.forEach((p) => {
    if (!p.tmpMods?.length) return;
    p.tmpMods = p.tmpMods.map((m) => ({ ...m, weeks: m.weeks - 1 })).filter((m) => m.weeks > 0);
    if (!p.tmpMods.length) delete p.tmpMods;
  }));
  c.weekMods = null;
}
// Tática da semana (eventos) somada aos sliders do usuário só para este jogo.
function withWeekMods(tend, mods) {
  if (!mods) return tend;
  return { ...tend, passRatio: clamp((tend.passRatio ?? 0.55) + (mods.passRatio || 0), 0.05, 0.95), aggressive: clamp((tend.aggressive ?? 0.5) + (mods.aggressive || 0), 0, 1) };
}

export { CATEGORY, EVENTS, ensureEventsState, rollWeeklyEvents, resolveEvent, checkPromises, tickTempMods, withWeekMods };
