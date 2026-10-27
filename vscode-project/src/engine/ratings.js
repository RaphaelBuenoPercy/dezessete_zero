// Pure rating helpers: given a roster, how good is it on offense/defense,
// overall — used both by the game simulation and by management screens.
//
// Os jogadores agora têm vários atributos por posição (ver SUB_ATTRS). Os
// helpers abaixo combinam esses atributos em "notas" por situação (cobertura,
// pass rush, defesa de corrida...). `attr()` cai para o OVR quando o atributo
// não existe (ex.: save antigo ainda não migrado), então nada vira NaN.

function attr(p, key, fallback) {
  const v = p?.attrs?.[key];
  return v ?? fallback ?? p?.ovr ?? 60;
}

function slotPlayer(roster, key) { return roster.find((p) => p.slot === key) || roster.find((p) => p.pos === key); }
function activePlayer(roster, key) {
  const p = slotPlayer(roster, key);
  if (p && p.injuredWeeks > 0) {
    const backup = roster.find((q) => q.pos === p.pos && q.id !== p.id && q.injuredWeeks === 0);
    if (backup) return backup;
  }
  return p;
}

// attrKey pode ser: nada (usa OVR), o nome de um atributo, ou uma função p => nota.
function posAvg(roster, pos, attrKey) {
  const players = roster.filter((p) => p.pos === pos);
  if (!players.length) return 60;
  let sum = 0, wsum = 0;
  players.forEach((p) => {
    const w = p.injuredWeeks > 0 ? 0.5 : 1;
    const val = typeof attrKey === "function" ? attrKey(p) : attrKey ? (p.attrs?.[attrKey] ?? p.ovr) : p.ovr;
    sum += val * w; wsum += w;
  });
  return sum / wsum;
}

// ---------- notas derivadas dos atributos ----------

// Cobertura individual (man) e por zona.
function manCover(p) { return attr(p, "MCV") * 0.75 + attr(p, "SPD") * 0.25; }
function zoneCover(p) { return attr(p, "ZCV") * 0.7 + attr(p, "PRC", attr(p, "AWR")) * 0.3; }
function coverRating(p) { return (manCover(p) + zoneCover(p)) / 2; }

// Movimentos de pass rush. Safeties não têm FMV/PMV, então usam uma nota derivada
// (finesse ~ velocidade/aceleração; power ~ tackle/perseguição, um pouco menor).
function finesseMove(p) { return p?.attrs?.FMV ?? (attr(p, "SPD") + attr(p, "ACC")) / 2; }
function powerMove(p) { return p?.attrs?.PMV ?? ((attr(p, "TKL") + attr(p, "PUR")) / 2) * 0.92; }
function rushRating(p) {
  const f = finesseMove(p), w = powerMove(p);
  return Math.max(f, w) * 0.6 + Math.min(f, w) * 0.4;
}

// Defesa de corrida: quão bem o defensor se livra do bloqueio e derruba o RB.
function runDefRating(p) {
  if (p.pos === "DL") return attr(p, "BSH") * 0.55 + attr(p, "STR") * 0.2 + attr(p, "TKL") * 0.25;
  if (p.pos === "LB") return attr(p, "TKL") * 0.35 + attr(p, "BSH") * 0.3 + attr(p, "PRC") * 0.25 + attr(p, "SPD") * 0.1;
  if (p.pos === "S") return attr(p, "TKL") * 0.5 + attr(p, "PUR") * 0.5;
  return p.ovr;
}

// Recebedor: separação. RB/TE sem RTE usam velocidade/aceleração/recepção.
function routeSkill(p) {
  return p?.attrs?.RTE ?? (attr(p, "SPD") + attr(p, "ACC") + attr(p, "CTH")) / 3;
}

// RB em corrida: visão, força, aceleração e velocidade.
function rbRunScore(p) {
  return attr(p, "VIS") * 0.3 + attr(p, "POW") * 0.25 + attr(p, "ACC") * 0.2 + attr(p, "SPD") * 0.25;
}

// Bloqueio de corrida da OL. Corridas "por fora" e de zona (pulls) dependem
// bem mais da agilidade do que as que vão por dentro.
function runBlockRating(p, outside) {
  return outside
    ? attr(p, "RBK") * 0.6 + attr(p, "AGI", attr(p, "RBK")) * 0.4
    : attr(p, "RBK") * 0.85 + attr(p, "AGI", attr(p, "RBK")) * 0.15;
}

// Bloqueio de passe contra um movimento específico: finesse (FMV) é neutralizado
// por agilidade, power (PMV) por força. RB/TE (sem AGI/STR) usam só PBK.
function passBlockRating(p, move) {
  const base = attr(p, "PBK");
  const aux = move === "FMV" ? p?.attrs?.AGI : p?.attrs?.STR;
  return aux != null ? base * 0.75 + aux * 0.25 : base;
}

function offenseRating(roster, type, rusher) {
  const qb = activePlayer(roster, "QB1");
  const rb = rusher || activePlayer(roster, "RB1");
  const wr1 = activePlayer(roster, "WR1"), wr2 = activePlayer(roster, "WR2");
  const te = activePlayer(roster, "TE1");
  if (type === "pass") return (qb.ovr * 1.4 + wr1.ovr + wr2.ovr * 0.7 + te.ovr * 0.5 + posAvg(roster, "OL", "PBK")) / 4.6;
  return (rbRunScore(rb) * 1.3 + posAvg(roster, "OL", "RBK") * 1.2 + attr(te, "RBK") * 0.5) / 3;
}
function defenseRating(roster, type) {
  const s1 = activePlayer(roster, "S1");
  const dlRSH = posAvg(roster, "DL", rushRating), dlRUN = posAvg(roster, "DL", runDefRating);
  const lbCOV = posAvg(roster, "LB", coverRating), lbRUN = posAvg(roster, "LB", runDefRating);
  const cbCOV = posAvg(roster, "CB", coverRating);
  if (type === "pass") return (cbCOV * 2.2 + coverRating(s1) + dlRSH * 0.9 + lbCOV * 0.5) / 4.6;
  return (dlRUN * 1.2 + lbRUN * 2 + attr(s1, "TKL") * 0.5) / 3.7;
}
function teamOverall(roster) {
  const w = { QB: 3, RB: 1.4, WR: 1.2, TE: 0.8, OL: 1.6, DL: 1.6, LB: 1.2, CB: 1.3, S: 1.1, K: 0.4, P: 0.3 };
  let sum = 0, tot = 0;
  roster.forEach((p) => { const wt = w[p.pos] || 0.5; sum += p.ovr * wt; tot += wt; });
  return sum / tot;
}


export { attr, slotPlayer, activePlayer, posAvg, manCover, zoneCover, coverRating,
  finesseMove, powerMove, rushRating, runDefRating, routeSkill, rbRunScore,
  runBlockRating, passBlockRating, offenseRating, defenseRating, teamOverall };
