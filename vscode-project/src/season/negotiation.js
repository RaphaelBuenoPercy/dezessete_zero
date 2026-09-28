import { randInt, clamp } from "../lib/rng.js";
import { CAP } from "../data/teams.js";
import { capUsed } from "../engine/playerGen.js";
import { findSlotForRookie, insertPlayer } from "./roster.js";
import { teamNeeds, scoreTeamForFreeAgent } from "./freeAgencyAI.js";

// ============================================================
// FREE AGENCY NEGOTIATION ENGINE
//
// Signing a free agent is no longer a single instant click. Every player
// on the market carries a `faMarket[playerId]` negotiation record:
//   { offers: [{teamAbbr, years, salary}], decisionIn, log: [string], interestCount }
//
// Rival teams enter the market over successive "waves" (each call to
// aiOffersWave), placing or raising offers based on how well they fit the
// player and how much cap room they have. The user does the same by
// calling submitUserOffer. resolveMarket periodically checks every
// negotiation in progress and, once a player is ready to decide (their
// patience — decisionIn — runs out, or one offer is clearly dominant),
// picks a winner with a weighted random draw so the best offer usually —
// but not always — wins, same as a real free agent weighing intangibles
// a spreadsheet can't capture.
// ============================================================

function initNegotiation(rng) {
  return { offers: [], decisionIn: randInt(rng, 2, 5), log: [], interestCount: 0 };
}

function ensureNegotiation(faMarket, player, rng) {
  if (!faMarket[player.id]) faMarket[player.id] = initNegotiation(rng);
  return faMarket[player.id];
}

function pushLog(negotiation, line) {
  negotiation.log.push(line);
  if (negotiation.log.length > 8) negotiation.log = negotiation.log.slice(-8);
}

function moneySignalFor(offerSalary, askSalary) {
  const ratio = offerSalary / Math.max(0.5, askSalary);
  return clamp((ratio - 0.65) / (1.35 - 0.65), 0, 1);
}
function yearsSignalFor(offerYears, askYears) {
  return clamp(1 - Math.abs(offerYears - (askYears || 2)) / 3, 0, 1);
}

// How attractive one concrete offer from `team` looks to `player`,
// blending team fit (scheme, winning, market, climate...) with how the
// actual money and term on the table compare to what they were asking for.
function scoreOffer(player, team, offer) {
  if (!team || !offer) return 0;
  const fit = scoreTeamForFreeAgent(player, team);
  const money = moneySignalFor(offer.salary, player.salary);
  const years = yearsSignalFor(offer.years, player.askingYears);
  return fit * 0.4 + money * 0.4 + years * 0.2;
}

// All offers on the table for `player`, scored and sorted best-first.
function rankOffers(player, negotiation, leagueTeams) {
  if (!negotiation) return [];
  return negotiation.offers
    .map((o) => ({ ...o, score: scoreOffer(player, leagueTeams[o.teamAbbr], o) }))
    .sort((a, b) => b.score - a.score);
}

// Human-readable reason a player picked `team`, based on their strongest
// priority weight (with a hometown tie always taking precedence).
const REASON_LABELS = {
  money: "pelo contrato mais robusto",
  winning: "pela chance real de brigar por título",
  playingTime: "pela promessa de minutos em quadra",
  climate: "pelo clima da cidade",
  fanSupport: "pela torcida apaixonada",
  market: "pelos holofotes do mercado grande",
};
function winReason(player, team) {
  if (player.homeTeam === team.abbr) return "pela proximidade de casa";
  const pr = player.priorities;
  if (!pr) return "pela proposta mais atraente";
  const top = Object.entries(pr).sort((a, b) => b[1] - a[1])[0];
  return REASON_LABELS[top?.[0]] || "pela proposta mais atraente";
}

// One AI team either opens a new offer for `player` or, if it's already in
// the mix but has fallen behind the best rival offer, raises it. Returns a
// short descriptor for the activity log, or null if the team does nothing
// this wave (not every team re-engages every time).
function proposeOrRaise(rng, leagueTeams, team, player, negotiation) {
  const capRoom = CAP - capUsed(team.roster);
  const existing = negotiation.offers.find((o) => o.teamAbbr === team.abbr);
  const fit = scoreTeamForFreeAgent(player, team);
  const eagerness = clamp(fit + (rng() - 0.5) * 0.2, 0, 1.3);
  const targetSalary = clamp(player.salary * (0.75 + eagerness * 0.55), player.salary * 0.55, capRoom - 2);
  if (targetSalary < 1) return null;
  const years = clamp(Math.round((player.askingYears || 2) + (eagerness > 0.7 ? 1 : 0) + randInt(rng, -1, 1)), 1, 5);

  if (existing) {
    const scored = negotiation.offers.map((o) => scoreOffer(player, leagueTeams[o.teamAbbr], o));
    const best = Math.max(...scored);
    const mine = scoreOffer(player, team, existing);
    if (mine >= best - 0.02) return null; // already competitive, no need to move
    if (rng() > 0.55) return null;
    existing.salary = Math.max(existing.salary, Math.round(Math.min(targetSalary, capRoom - 2) * 10) / 10);
    existing.years = years;
    return { type: "raise" };
  }

  negotiation.offers.push({ teamAbbr: team.abbr, years, salary: Math.round(targetSalary * 10) / 10 });
  return { type: "offer" };
}

// One wave of rival shopping across the league (skipping `excludeAbbr`,
// normally the user's team). Every team checks its weakest `needsPerTeam`
// positions and, for the free agent that fits best there, either opens or
// raises an offer. Mutates `faMarket` in place; returns activity events.
function aiOffersWave(leagueTeams, freeAgentPool, faMarket, rng, opts = {}) {
  const { excludeAbbr = null, needsPerTeam = 3, minCapReserve = 2 } = opts;
  const events = [];
  const abbrs = Object.keys(leagueTeams).filter((a) => a !== excludeAbbr);

  abbrs.forEach((abbr) => {
    const team = leagueTeams[abbr];
    const capRoom = CAP - capUsed(team.roster);
    if (capRoom < minCapReserve + 1) return;
    const needs = teamNeeds(team).slice(0, needsPerTeam).map((n) => n.pos);
    needs.forEach((pos) => {
      const candidates = freeAgentPool.filter((p) => p.pos === pos);
      if (!candidates.length) return;
      let best = null, bestScore = -Infinity;
      candidates.forEach((p) => {
        const s = scoreTeamForFreeAgent(p, team) * 0.7 + (p.ovr / 99) * 0.3;
        if (s > bestScore) { bestScore = s; best = p; }
      });
      if (!best) return;
      const negotiation = ensureNegotiation(faMarket, best, rng);
      const result = proposeOrRaise(rng, leagueTeams, team, best, negotiation);
      if (result) {
        negotiation.interestCount += 1;
        const label = result.type === "offer" ? "entrou na disputa por" : "melhorou a proposta para";
        pushLog(negotiation, `${team.city} ${team.name} ${label} ${best.name}.`);
        events.push({ playerId: best.id, teamAbbr: abbr, type: result.type });
      }
    });
  });
  return events;
}

// Walks every negotiation with at least one offer on the table. Once a
// player's patience runs out, or one offer is clearly the best on the
// table by a wide margin, they decide — via a score-weighted random draw,
// so a great offer usually wins but a mediocre one can still sneak it if
// nothing better ever showed up. Returns signing records.
function resolveMarket(leagueTeams, freeAgentPool, faMarket, rng) {
  const signings = [];
  [...freeAgentPool].forEach((player) => {
    const neg = faMarket[player.id];
    if (!neg || neg.offers.length === 0) return;
    neg.decisionIn -= 1;

    const scored = rankOffers(player, neg, leagueTeams);
    const top = scored[0];
    const second = scored[1];
    const clearWinner = second ? top.score - second.score > 0.18 : true;
    const forceDecide = neg.decisionIn <= 0;
    if (!clearWinner && !forceDecide) return; // still shopping around

    const weights = scored.map((s) => Math.max(0.001, s.score) ** 3);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total, winnerIdx = 0;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { winnerIdx = i; break; } }
    const winner = scored[winnerIdx];
    const team = leagueTeams[winner.teamAbbr];

    const { askingYears, priorities, climatePref, homeTeam, ...base } = player;
    const slot = findSlotForRookie(team.roster, player.pos);
    // +1: the season whose rollover is still pending counts as a year, so a
    // 1-year deal isn't wiped out before the player takes a single snap.
    insertPlayer(team.roster, slot, { ...base, slot, salary: winner.salary, years: winner.years + 1 });

    const idx = freeAgentPool.findIndex((p) => p.id === player.id);
    if (idx >= 0) freeAgentPool.splice(idx, 1);

    signings.push({
      playerId: player.id, name: player.name, pos: player.pos, ovr: player.ovr,
      teamAbbr: winner.teamAbbr, salary: winner.salary, years: winner.years,
      reason: winReason(player, team),
      beatenTeams: scored.filter((s) => s.teamAbbr !== winner.teamAbbr).map((s) => s.teamAbbr),
    });
    delete faMarket[player.id];
  });
  return signings;
}

// Registers or revises the user's own offer for `player`.
function submitUserOffer(faMarket, player, teamAbbr, offer, rng) {
  const neg = ensureNegotiation(faMarket, player, rng);
  const existing = neg.offers.find((o) => o.teamAbbr === teamAbbr);
  if (existing) {
    existing.salary = offer.salary;
    existing.years = offer.years;
    pushLog(neg, `Você revisou sua proposta: ${offer.years} ano(s), $${offer.salary.toFixed(1)}M/ano.`);
  } else {
    neg.offers.push({ teamAbbr, salary: offer.salary, years: offer.years });
    pushLog(neg, `Você propôs: ${offer.years} ano(s), $${offer.salary.toFixed(1)}M/ano.`);
  }
  return neg;
}

function withdrawUserOffer(faMarket, playerId, teamAbbr) {
  const neg = faMarket[playerId];
  if (!neg) return;
  neg.offers = neg.offers.filter((o) => o.teamAbbr !== teamAbbr);
  pushLog(neg, "Você retirou sua proposta.");
}

export {
  initNegotiation, ensureNegotiation, scoreOffer, rankOffers, winReason,
  aiOffersWave, resolveMarket, submitUserOffer, withdrawUserOffer,
};
