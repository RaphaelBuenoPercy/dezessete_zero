import { randInt, pick, clamp } from "../lib/rng.js";
import { makeName } from "../data/names.js";

// ============================================================
// COMISSÃO TÉCNICA: geração de coordenadores, esquemas, bônus e badges.
// Este módulo NÃO importa playerGen (evita ciclo); quem precisa de OVR
// efetivo usa engine/staffEffects.js.
// ============================================================

const LEVELS = ["D", "C", "B", "A", "S"];
const LEVEL_MULT = { S: 1.5, A: 1, B: 0.75, C: 0.5, D: 0.25 };       // peso dos bônus
const LEVEL_SALARY = { S: 9, A: 6.5, B: 4.5, C: 3, D: 1.8 };          // $M por ano
const LEVEL_COLORS = { S: "#f59e0b", A: "#4ade80", B: "#38bdf8", C: "#94a3b8", D: "#64748b" };

const ROLE_LABEL = { OC: "Coordenador Ofensivo", DC: "Coordenador Defensivo", SC: "Coordenador de Special Teams" };
const OFF_SCHEMES = ["Spread", "West Coast", "Smashmouth", "Air Raid"];
const DEF_SCHEMES = ["4-3", "3-4", "Tampa 2", "Man-Heavy"];
// Front seven do time é amarrado ao esquema do DC.
const FRONT_BY_SCHEME = { "4-3": "4-3", "Tampa 2": "4-3", "3-4": "3-4", "Man-Heavy": "3-4" };

// Bônus-base por esquema (valores no nível A; os outros níveis multiplicam por LEVEL_MULT).
// Valores negativos são o "custo" do esquema.
const SCHEME_BONUS = {
  "West Coast": { QB: { STA: 2 }, WR: { RTE: 1 }, TE: { RTE: 1 } },
  "Spread": { QB: { STA: 1, MTA: 1 }, WR: { ACC: 1, RTE: 1 }, RB: { CTH: 1 }, OL: { RBK: -1 } },
  "Smashmouth": { OL: { RBK: 2, STR: 1 }, RB: { POW: 1, VIS: 1 }, TE: { RBK: 1 }, QB: { DTA: -1 } },
  "Air Raid": { QB: { DTA: 2, MTA: 1, THP: 1 }, WR: { RTE: 1, CIT: 1 }, OL: { RBK: -1 } },
  "4-3": { DL: { BSH: 1, TKL: 1 }, LB: { TKL: 1, PRC: 1 } },
  "3-4": { DL: { STR: 1, BSH: 1 }, LB: { PMV: 1, FMV: 1, BSH: 1 } },
  "Tampa 2": { S: { ZCV: 2, PRC: 1 }, LB: { ZCV: 1 }, CB: { ZCV: 1, MCV: -1 } },
  "Man-Heavy": { CB: { MCV: 2, PRS: 1 }, S: { MCV: 1, ZCV: -1 }, LB: { MCV: 1 } },
  // Special Teams: agressivo = mais potência/risco; passivo = precisão/segurança
  "ST Agressivo": { K: { KPW: 2, CLT: 1, KAC: -1 }, P: { KPW: 1, TRK: 2, KAC: -1 } },
  "ST Passivo": { K: { KAC: 2, CLT: 1, KPW: -1 }, P: { KAC: 2, TRK: 1, KPW: -1 } },
};
// Efeitos de estilo no motor: passBias (OC) soma na % de passes; manBias/blitzBias (DC) mexem na defesa.
const SCHEME_META = {
  "Spread": { passBias: 0.04 }, "West Coast": { passBias: 0.01 }, "Smashmouth": { passBias: -0.08 }, "Air Raid": { passBias: 0.07 },
  "4-3": {}, "3-4": { blitzBias: 0.05 }, "Tampa 2": { manBias: -0.14, blitzBias: -0.05 }, "Man-Heavy": { manBias: 0.22, blitzBias: 0.03 },
  // fgRangeBias: jardas extras (ou a menos) que o time aceita no alcance de FG; goBias: soma na agressividade de 4ª descida
  "ST Agressivo": { fgRangeBias: 5, goBias: 0.15 }, "ST Passivo": { fgRangeBias: -4, goBias: -0.15 },
};
const SCHEME_BLURB = {
  "Spread": "Formações abertas e passes rápidos; abre mão de bloqueio de corrida.",
  "West Coast": "Passes curtos precisos e rotas afiadas.",
  "Smashmouth": "Jogo terrestre físico; corre mais, arrisca menos no ar.",
  "Air Raid": "Lançamentos longos e muito volume de passe.",
  "4-3": "Front de 4 linemen e 3 linebackers. Sólido contra a corrida.",
  "3-4": "Front de 3 linemen e 4 linebackers; blitz de LBs.",
  "Tampa 2": "Zona pesada; protege o fundo do campo, joga menos man.",
  "Man-Heavy": "Cobertura individual agressiva; CBs brilham, safeties ficam expostos.",
  "ST Agressivo": "Chutes longos e 4ª descida arriscada; mais potência, menos precisão.",
  "ST Passivo": "Chutes seguros e punts colocados; mais precisão, menos potência."
};

const BADGES = {
  mentor_linha: { name: "Mentor de Linha", icon: "🧱", desc: "No fim do ano, novatos da OL (OC) ou da DL (DC) ganham XP/OVR extra." },
  mentor_chutador: { name: "Mentor de Especialistas", icon: "🦵", desc: "No fim do ano, kickers e punters novatos ganham XP/OVR extra." },
  fiel: { name: "Fiel", icon: "🤝", desc: "Dificilmente aceita propostas de outros times para virar Head Coach." },
  mercenario: { name: "Mercenário", icon: "💰", desc: "Contrato mais caro e sai na primeira oferta de Head Coach." },
  disciplinador: { name: "Disciplinador", icon: "📏", desc: "Reduz pela metade os efeitos negativos do esquema." },
  visionario: { name: "Visionário", icon: "💡", desc: "+25% em todos os bônus positivos do esquema." },
};

let CID = Math.floor(Math.random() * 1e9);

// ---------- rendimento IMPREVISÍVEL ----------
// O nível (S-D) é só a reputação do coordenador. O rendimento real depende de 3 fatores
// ocultos que o usuário não vê:
//   talent: talento "de verdade" (fixo, pode ser bem diferente da reputação)
//   form:   fase do ano (sorteada a cada temporada)
//   fit:    entrosamento com o elenco/time atual (sorteado quando ele chega a um time)
// Só os bônus POSITIVOS do esquema são multiplicados por isso — o "custo" do esquema não
// some quando o coordenador vai mal. Depois de cada temporada sai um relatório vago.
function gauss(rng) { return (rng() + rng() + rng() + rng() - 2) * 1.732; }          // ~N(0,1)
function rollTalent(rng) { return clamp(1 + gauss(rng) * 0.3, 0.35, 1.7); }
function rollForm(rng) { return clamp(1 + gauss(rng) * 0.28, 0.4, 1.6); }
function rollFit(rng) { return clamp(1 + gauss(rng) * 0.18, 0.65, 1.35); }
function effMult(coach) { return (coach?.talent ?? 1) * (coach?.form ?? 1) * (coach?.fit ?? 1); }
function performanceLabel(eff) {
  return eff >= 1.3 ? { key: "up", text: "Acima do esperado", icon: "🔥" }
    : eff <= 0.7 ? { key: "down", text: "Abaixo do esperado", icon: "🧊" }
    : { key: "ok", text: "Dentro do esperado", icon: "➖" };
}

const SC_SCHEMES = ["ST Agressivo", "ST Passivo"];
function schemesFor(role) { return role === "OC" ? OFF_SCHEMES : role === "DC" ? DEF_SCHEMES : SC_SCHEMES; }
function levelIdx(coach) { return LEVELS.indexOf(coach.level); }
function staffSalary(level, mercenary) { return Math.round(LEVEL_SALARY[level] * (mercenary ? 1.35 : 1) * 10) / 10; }

function rollLevel(rng) {
  const r = rng();
  return r < 0.04 ? "S" : r < 0.18 ? "A" : r < 0.46 ? "B" : r < 0.78 ? "C" : "D";
}
function rollBadges(rng, level, role) {
  const n = level === "S" ? 2 : level === "A" ? randInt(rng, 1, 2) : level === "B" ? 1 : randInt(rng, 0, 1);
  const pool = Object.keys(BADGES).filter((b) => b === "mentor_chutador" ? role === "SC" : b === "mentor_linha" ? role !== "SC" : true);
  const out = [];
  while (out.length < n && pool.length) {
    const b = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (b === "fiel" && out.includes("mercenario")) continue;
    if (b === "mercenario" && out.includes("fiel")) continue;
    out.push(b);
  }
  return out;
}

// opts: { level, scheme, formerHC }
function generateCoach(rng, role, opts = {}) {
  const level = opts.level || rollLevel(rng);
  const badges = rollBadges(rng, level, role);
  return {
    id: "CO" + (CID++), name: makeName(rng), role, level,
    scheme: opts.scheme || pick(rng, schemesFor(role)),
    badges, age: randInt(rng, 38, 64), years: randInt(rng, 2, 4),
    salary: staffSalary(level, badges.includes("mercenario")),
    eliteYears: 0, yearsOnTeam: 0, formerHC: !!opts.formerHC, teamAbbr: null,
    talent: rollTalent(rng), form: rollForm(rng), fit: 1, history: [],
  };
}

// Ex-Head Coach demitido: entra no mercado como coordenador (geralmente bom).
function makeExHeadCoach(rng, fromAbbr) {
  const role = rng() < 0.5 ? "OC" : "DC";
  const level = pick(rng, ["A", "A", "B", "B", "C"]);
  const c = generateCoach(rng, role, { level, formerHC: true });
  c.age = randInt(rng, 48, 66); c.exHcOf = fromAbbr; c.years = 0;
  return c;
}

function levelDown(coach) {
  const i = levelIdx(coach);
  if (i > 0) coach.level = LEVELS[i - 1];
  return coach;
}
function levelUp(coach) {
  const i = levelIdx(coach);
  if (i < LEVELS.length - 1) coach.level = LEVELS[i + 1];
  return coach;
}

// Staff inicial de um time de IA. forcedFront ("4-3"/"3-4") amarra o DC ao front do elenco.
function generateStartingStaff(rng, forcedFront) {
  const front = forcedFront || (rng() < 0.5 ? "4-3" : "3-4");
  const dcSchemes = DEF_SCHEMES.filter((s) => FRONT_BY_SCHEME[s] === front);
  const OC = generateCoach(rng, "OC");
  const DC = generateCoach(rng, "DC", { scheme: pick(rng, dcSchemes) });
  const SC = generateCoach(rng, "SC");
  [OC, DC, SC].forEach((co) => { co.fit = rollFit(rng); });
  return { OC, DC, SC, front };
}

// Reposição do mercado: pelo menos `perRole` por função e 2+ coordenadores nível B ou melhor.
function topUpMarket(market, rng, perRole = 8) {
  ["OC", "DC", "SC"].forEach((role) => {
    const list = market.filter((c) => c.role === role);
    let n = list.length;
    const good = () => market.filter((c) => c.role === role && levelIdx(c) >= 2).length;
    while (good() < 2) { market.push(generateCoach(rng, role, { level: pick(rng, ["B", "B", "A"]) })); n++; }
    while (n < perRole) { market.push(generateCoach(rng, role)); n++; }
  });
  return market;
}

// ---------- bônus ----------
// nominal=true: o que a reputação (nível) promete — usado nas telas. Real (padrão): inclui talento,
// fase e entrosamento ocultos — usado no jogo.
function coachBonusMap(coach, nominal = false) {
  const table = coach && SCHEME_BONUS[coach.scheme];
  if (!table) return {};
  const mult = LEVEL_MULT[coach.level] ?? 0;
  const vis = coach.badges?.includes("visionario") ? 1.25 : 1;
  const dis = coach.badges?.includes("disciplinador") ? 0.5 : 1;
  const eff = nominal ? 1 : effMult(coach);
  const out = {};
  Object.entries(table).forEach(([pos, attrs]) => {
    Object.entries(attrs).forEach(([k, base]) => {
      const raw = base > 0 ? base * mult * vis * eff : base * mult * dis;
      const v = nominal ? Math.round(raw * 2) / 2 : Math.round(raw * 10) / 10;
      if (v !== 0) (out[pos] ||= {})[k] = v;
    });
  });
  return out;
}
// Soma os bônus de todos os coordenadores: { POS: { ATTR: delta } }
function staffBonuses(coaches, nominal = false) {
  const out = {};
  ["OC", "DC", "SC"].forEach((role) => {
    const m = coachBonusMap(coaches?.[role], nominal);
    Object.entries(m).forEach(([pos, attrs]) => Object.entries(attrs).forEach(([k, v]) => {
      ((out[pos] ||= {})[k] = (out[pos][k] || 0) + v);
    }));
  });
  return out;
}
// Cria coaches/mercado/alertas em saves novos e antigos (idempotente).
// Time do usuário começa SEM coordenadores (precisa contratar no mercado).
function ensureCoachingState(c, rng) {
  Object.values(c.leagueTeams).forEach((t) => {
    if (!t.coaches) {
      const s = generateStartingStaff(rng, t.scheme);
      t.coaches = { OC: s.OC, DC: s.DC, SC: s.SC };
    }
    if (t.abbr !== c.teamAbbr && !t.coaches.SC) { t.coaches.SC = generateCoach(rng, "SC"); t.coaches.SC.fit = rollFit(rng); }
    delete t.staffBudget;                                   // sem orçamento de staff: contratação livre
    ["OC", "DC", "SC"].forEach((r) => { if (t.coaches[r]) t.coaches[r].teamAbbr = t.abbr; });
  });
  c.staffAlerts ||= [];
  c.hcHires ||= [];
  if (!c.spectator) {   // no modo espectador não existe 'time do usuário'
    const mine = c.leagueTeams[c.teamAbbr];
    if (!c.staffInit) {
      mine.coaches = { OC: null, DC: null, SC: null };
      c.staffAlerts.push({ id: "init", kind: "vacancy", role: null, year: c.year,
        text: "🧢 Você é o Head Coach: contrate seus coordenadores (ofensivo, defensivo e de special teams) no mercado de técnicos." });
      c.staffInit = true;
    } else if (!("SC" in mine.coaches)) {
      mine.coaches.SC = null;
      c.staffAlerts.push({ id: "sc-init", kind: "vacancy", role: "SC", year: c.year,
        text: "🦵 Novidade: agora existe o Coordenador de Special Teams (chutadores e punters). Contrate um no mercado." });
    }
  }
  c.coachesMarket ||= [];
  // saves da versão anterior: coordenadores sem os fatores ocultos
  const allCoaches = [...c.coachesMarket, ...Object.values(c.leagueTeams).flatMap((t) => Object.values(t.coaches).filter(Boolean))];
  allCoaches.forEach((co) => {
    if (co.talent == null) { co.talent = rollTalent(rng); co.form = rollForm(rng); co.fit = 1; co.history = []; }
  });
  topUpMarket(c.coachesMarket, rng, 8);
  return c;
}

export {
  LEVELS, LEVEL_MULT, LEVEL_COLORS, LEVEL_SALARY, ROLE_LABEL, SC_SCHEMES, OFF_SCHEMES, DEF_SCHEMES,
  FRONT_BY_SCHEME, SCHEME_BONUS, SCHEME_META, SCHEME_BLURB, BADGES,
  generateCoach, makeExHeadCoach, generateStartingStaff, topUpMarket, levelUp, levelDown, levelIdx, staffSalary,
  coachBonusMap, staffBonuses, ensureCoachingState,
  rollForm, rollFit, effMult, performanceLabel,
};
