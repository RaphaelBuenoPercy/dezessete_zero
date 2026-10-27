import { randInt, pick, clamp } from "../lib/rng.js";
import { makePlayer, recalcOvr } from "../engine/playerGen.js";
import { makeName } from "../data/names.js";
import {
  ROLE_LABEL, FRONT_BY_SCHEME, LEVEL_MULT,
  generateCoach, makeExHeadCoach, topUpMarket, levelUp, levelDown, levelIdx,
  rollForm, rollFit, effMult, performanceLabel,
} from "../engine/coachesGen.js";

// ============================================================
// COACHING CAROUSEL + contratação/demissão/renovação de coordenadores.
// Tudo opera direto sobre o `career` (já clonado pelo App) e devolve textos de notícia.
// ============================================================

function pushAlert(c, kind, text, role = null) {
  c.staffAlerts ||= [];
  c.staffAlerts.push({ id: `${c.year}-${c.staffAlerts.length}-${Math.floor(Math.random() * 1e6)}`, kind, role, year: c.year, text });
  if (c.staffAlerts.length > 20) c.staffAlerts.shift();
}

// ---------- troca de front quando o DC muda ----------
function nextBench(roster) {
  const n = roster.map((p) => parseInt((p.slot || "").replace("BEN", ""), 10)).filter((x) => !Number.isNaN(x));
  return "BEN" + (Math.max(5, ...n) + 1);
}
function signFiller(team, pos, rng) {
  const p = makePlayer(rng, pos, "starter", makeName(rng));
  team.roster.push(p);
  return p;
}
// Reorganiza o elenco para o front do DC (4-3 <-> 3-4). Sem jogador disponível na posição,
// o time assina um reforço de "starter" para não deixar a escalação furada.
function convertFront(team, front, rng) {
  if (!front || team.scheme === front) return null;
  const r = team.roster, by = (k) => r.find((p) => p.slot === k);
  const bestBench = (pos) => r.filter((p) => p.pos === pos && (p.slot || "").startsWith("BEN")).sort((a, b) => b.ovr - a.ovr)[0];
  let note = "";
  if (front === "3-4") {
    const dt1 = by("DT1"), dt2 = by("DT2");
    if (dt1) dt1.slot = "NT1";
    let lb = bestBench("LB");
    if (!lb) { lb = signFiller(team, "LB", rng); note = " (assinou um LB de reforço)"; }
    const benchKey = lb.slot && lb.slot.startsWith("BEN") ? lb.slot : nextBench(r);
    lb.slot = "LB4";
    if (dt2) dt2.slot = benchKey;
  } else {
    const nt = by("NT1"), lb4 = by("LB4");
    if (nt) nt.slot = "DT1";
    let dl = bestBench("DL");
    if (!dl) { dl = signFiller(team, "DL", rng); note = " (assinou um DL de reforço)"; }
    const benchKey = dl.slot && dl.slot.startsWith("BEN") ? dl.slot : nextBench(r);
    dl.slot = "DT2";
    if (lb4) lb4.slot = benchKey;
  }
  team.scheme = front;
  return `Front seven reorganizado para ${front}${note}.`;
}

// ---------- ações do usuário ----------
function hireCoach(c, role, coachId, rng) {
  const t = c.leagueTeams[c.teamAbbr];
  const i = (c.coachesMarket || []).findIndex((x) => x.id === coachId);
  const co = c.coachesMarket[i];
  if (!co || co.role !== role) return { ok: false, msg: "Esse técnico não está mais disponível." };
  if (t.coaches?.[role]) return { ok: false, msg: "Dispense o coordenador atual primeiro (só na offseason)." };
  c.coachesMarket.splice(i, 1);
  co.teamAbbr = t.abbr; co.years = Math.max(2, co.years || 0); co.yearsOnTeam = 0;
  co.fit = rollFit(rng);                                  // entrosamento com este time: sorteado e oculto
  t.coaches = { ...(t.coaches || {}), [role]: co };
  let extra = "";
  if (role === "DC") extra = " " + (convertFront(t, FRONT_BY_SCHEME[co.scheme], rng) || "");
  c.staffAlerts = (c.staffAlerts || []).filter((a) => a.kind === "poached" ? a.role !== role : !(a.kind === "vacancy"));
  const msg = `🧢 ${co.name} (${co.level}, ${co.scheme}) é o novo ${ROLE_LABEL[role]}.${extra}`;
  c.news.push(msg);
  return { ok: true, msg };
}
function fireCoach(c, role) {
  const t = c.leagueTeams[c.teamAbbr], co = t.coaches?.[role];
  if (!co) return { ok: false, msg: "Sem coordenador nessa função." };
  if (c.phase !== "offseason") return { ok: false, msg: "Só dá para dispensar um coordenador na offseason." };
  t.coaches[role] = null; co.teamAbbr = null; co.years = 0;
  c.coachesMarket.push(co);
  c.news.push(`🧢 ${co.name} deixou o cargo de ${ROLE_LABEL[role]}.`);
  return { ok: true, msg: "Coordenador dispensado." };
}
function renewCoach(c, role) {
  const t = c.leagueTeams[c.teamAbbr], co = t.coaches?.[role];
  if (!co) return { ok: false, msg: "Sem coordenador nessa função." };
  const newSalary = Math.round(co.salary * 1.1 * 10) / 10;
  co.salary = newSalary; co.years += 2;
  return { ok: true, msg: `${co.name} renovado por mais 2 anos ($${newSalary}M).` };
}

// ---------- IA contrata do mercado ----------
function aiHire(c, t, role, rng) {
  const opts = c.coachesMarket.filter((x) => x.role === role)
    .map((x) => ({ x, s: levelIdx(x) * 2 + (x.eliteYears || 0) * 0.5 + rng() * 2 }))
    .sort((a, b) => b.s - a.s).slice(0, 3);
  let co;
  if (opts.length) { co = pick(rng, opts).x; c.coachesMarket.splice(c.coachesMarket.indexOf(co), 1); }
  else co = generateCoach(rng, role, { level: pick(rng, ["C", "D"]) });
  co.teamAbbr = t.abbr; co.years = randInt(rng, 2, 4); co.yearsOnTeam = 0; co.fit = rollFit(rng);
  t.coaches[role] = co;
  if (role === "DC") convertFront(t, FRONT_BY_SCHEME[co.scheme], rng);
}

// ---------- o carrossel (chamar uma vez, quando a offseason começa) ----------
function seasonContext(c) {
  const teams = Object.values(c.leagueTeams);
  const offRank = {}, defRank = {}, success = {};
  [...teams].sort((a, b) => b.pf - a.pf).forEach((t, i) => { offRank[t.abbr] = i + 1; });
  [...teams].sort((a, b) => a.pa - b.pa).forEach((t, i) => { defRank[t.abbr] = i + 1; });
  teams.forEach((t) => { success[t.abbr] = 0; });
  const rounds = c.playoffs?.rounds || [];
  const abbrs = (r) => [...(r?.afc || []), ...(r?.nfc || [])].flatMap((m) => [m?.a?.abbr, m?.b?.abbr]).filter(Boolean);
  abbrs(rounds[2]).forEach((a) => { success[a] = Math.max(success[a], 1.5); });          // final de conferência
  const sb = rounds.find((r) => r.superBowl)?.superBowl;
  if (sb) [sb.a?.abbr, sb.b?.abbr].filter(Boolean).forEach((a) => { success[a] = Math.max(success[a], 2); });
  if (c.playoffs?.champion) success[c.playoffs.champion] = 3;
  return { offRank, defRank, success };
}

function runCoachingCarousel(c, rng) {
  const news = [];
  c.coachesMarket ||= []; c.hcHires ||= [];
  const ctx = seasonContext(c), my = c.teamAbbr;
  const teams = Object.values(c.leagueTeams);

  // 1) fim de temporada para cada coordenador: idade, contrato, tempo em alto nível, promoção
  teams.forEach((t) => {
    t.coaches ||= { OC: null, DC: null };
    ["OC", "DC", "SC"].forEach((role) => {
      const co = t.coaches[role];
      if (!co) return;
      // Relatório (vago) do rendimento real da temporada que acabou; depois sorteia a fase do próximo ano.
      const lab = performanceLabel(effMult(co));
      co.lastReport = { year: c.year, key: lab.key, text: lab.text, icon: lab.icon };
      co.history = [...(co.history || []), lab.key].slice(-4);
      co.form = rollForm(rng);
      if (co.history.slice(-2).join() === "down,down" && co.level !== "D") {
        levelDown(co); co.history = [];
        if (t.abbr === my) news.push(`📉 ${co.name} (${role}) caiu para o nível ${co.level} após duas temporadas ruins.`);
      }
      co.age += 1; co.years = Math.max(0, co.years - 1); co.yearsOnTeam = (co.yearsOnTeam || 0) + 1;
      const rank = role === "OC" ? ctx.offRank[t.abbr] : role === "DC" ? ctx.defRank[t.abbr] : 99;
      co.eliteYears = rank <= 8 ? (co.eliteYears || 0) + 1 : Math.max(0, (co.eliteYears || 0) - 1);
      if (co.eliteYears >= 3 && co.level !== "S") {
        levelUp(co); co.eliteYears = 0;
        if (t.abbr === my) news.push(`⭐ ${co.name} (${role}) foi promovido ao nível ${co.level} após anos em alto nível!`);
      }
      if (co.age >= 66 && rng() < 0.4) {
        t.coaches[role] = null;
        if (t.abbr === my) pushAlert(c, "vacancy", `🧢 ${co.name} se aposentou. Contrate um novo ${ROLE_LABEL[role]}.`, role);
        return;
      }
      if (co.years === 0) {
        if (t.abbr === my) {
          t.coaches[role] = null; co.teamAbbr = null; c.coachesMarket.push(co);
          pushAlert(c, "vacancy", `🧢 O contrato de ${co.name} (${role}) venceu e ele foi ao mercado. Você pode recontratá-lo lá.`, role);
        } else co.years = randInt(rng, 2, 3);                        // IA renova sozinha
      }
    });
  });

  // 2) times ruins demitem o Head Coach (ex-HCs viram coordenadores no mercado)
  const ai = teams.filter((t) => t.abbr !== my);
  const byRecord = [...ai].sort((a, b) => (a.wins - a.losses) - (b.wins - b.losses));
  const vacancies = [];
  byRecord.forEach((t, i) => {
    const p = (i < 4 ? 0.55 : i < 8 ? 0.3 : 0.04) + (t.ownerConfidence < 35 ? 0.2 : 0);
    if (rng() < p) vacancies.push(t);
  });
  if (!vacancies.length) vacancies.push(byRecord[0]);
  vacancies.splice(6);
  vacancies.forEach((t) => {
    const fired = t.hc ? { ...t.hc, formerHC: true, teamAbbr: null, years: 0, exHcOf: t.abbr } : makeExHeadCoach(rng, t.abbr);
    c.coachesMarket.push(fired);
    news.push(`🔥 ${t.abbr} demitiu o Head Coach ${fired.name}, que agora procura vaga como ${ROLE_LABEL[fired.role]}.`);
    t.hc = null;
  });

  // 3) vagas de HC "roubam" coordenadores de times de sucesso
  const poachedFrom = new Set();
  vacancies.sort(() => rng() - 0.5).forEach((v) => {
    const pool = [];
    teams.forEach((t) => {
      if (t.abbr === v.abbr || poachedFrom.has(t.abbr)) return;
      ["OC", "DC"].forEach((role) => {
        const co = t.coaches?.[role];
        if (!co) return;
        const top = role === "OC" ? ctx.offRank[t.abbr] <= 3 : ctx.defRank[t.abbr] <= 3;
        let attract = levelIdx(co) + (co.eliteYears || 0) * 0.6 + ctx.success[t.abbr] + (top ? 1 : 0);
        let p = clamp(0.05 + attract * 0.07, 0.03, 0.6);
        if (co.badges?.includes("fiel")) p *= 0.25;
        if (co.badges?.includes("mercenario")) { p = 1; attract += 2.5; }   // sai na primeira oferta
        pool.push({ t, role, co, attract, p });
      });
    });
    pool.sort((a, b) => b.attract - a.attract);
    const hit = pool.find((x) => rng() < x.p);
    if (!hit) { news.push(`📋 ${v.abbr} contratou um novo Head Coach de fora da liga.`); return; }
    poachedFrom.add(hit.t.abbr);
    hit.t.coaches[hit.role] = null;
    v.hc = { ...hit.co, hcSince: c.year + 1, hcFrom: hit.t.abbr };
    c.hcHires.push({ year: c.year, teamAbbr: v.abbr, name: hit.co.name, fromTeam: hit.t.abbr, role: hit.role });
    const txt = `${ROLE_LABEL[hit.role]} ${hit.co.name} foi contratado como Head Coach pelo time ${v.abbr}`;
    if (hit.t.abbr === my) {
      pushAlert(c, "poached", `🚨 O seu ${ROLE_LABEL[hit.role]} ${hit.co.name} foi contratado como Head Coach pelo time ${v.abbr}. Reponha a peça no mercado — e talvez readapte seu estilo de jogo.`, hit.role);
      news.push(`🚨 ${txt}. (era o seu coordenador!)`);
    } else news.push(`🎩 ${txt} (vindo do ${hit.t.abbr}).`);
  });

  // 4) times de IA repõem as vagas; mercado ganha caras novas
  ai.forEach((t) => ["OC", "DC", "SC"].forEach((role) => { if (!t.coaches[role]) aiHire(c, t, role, rng); }));
  c.coachesMarket.forEach((co) => { co.form = rollForm(rng); });
  c.coachesMarket.forEach((co) => { co.marketYears = (co.marketYears || 0) + 1; });
  c.coachesMarket = c.coachesMarket.filter((co) => (co.marketYears || 0) <= 3);
  topUpMarket(c.coachesMarket, rng, 8);

  // vagas na comissão do usuário (lembrete)
  const mine = c.leagueTeams[my];
  ["OC", "DC"].forEach((role) => {
    if (!mine.coaches[role] && !(c.staffAlerts || []).some((a) => a.role === role)) pushAlert(c, "vacancy", `🧢 Você está sem ${ROLE_LABEL[role]}.`, role);
  });
  return news;
}

// ---------- Mentor de Linha: novatos da OL (OC) / DL (DC) ganham XP extra no fim do ano ----------
const MENTOR_GROUPS = { OC: ["OL"], DC: ["DL"], SC: ["K", "P"] };
function applyCoachDevelopment(c, rng) {
  const news = [];
  Object.values(c.leagueTeams).forEach((t) => {
    ["OC", "DC", "SC"].forEach((role) => {
      const co = t.coaches?.[role];
      if (!co?.badges?.some((b) => b === "mentor_linha" || b === "mentor_chutador")) return;
      const groups = MENTOR_GROUPS[role];
      const boost = LEVEL_MULT[co.level] >= 1 ? randInt(rng, 1, 2) : 1;
      let n = 0;
      t.roster.forEach((p) => {
        if (!groups.includes(p.pos) || !p.attrs) return;
        if (!((p.seasonsPlayed ?? 9) <= 2 || (p.rookieYear && p.rookieYear >= c.year - 1))) return;
        Object.keys(p.attrs).forEach((k) => { p.attrs[k] = Math.min(99, p.attrs[k] + boost); });
        recalcOvr(p); n++;
      });
      if (n && t.abbr === c.teamAbbr) news.push(`🧱 ${co.name} (Mentor) desenvolveu ${n} jovem(ns) (${groups.join("/")}): +${boost} nos atributos.`);
    });
  });
  return news;
}

export { runCoachingCarousel, applyCoachDevelopment, hireCoach, fireCoach, renewCoach, convertFront, pushAlert };
