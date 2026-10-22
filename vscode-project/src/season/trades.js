import { clamp } from "../lib/rng.js";
import { rosterSlotsFor } from "../data/rosterSlots.js";
import { pickTradeValue } from "./picks.js";
import { findSlotForRookie, insertPlayer } from "./roster.js";
import { makePlayer } from "../engine/playerGen.js";
import { makeName } from "../data/names.js";
import { autoSortDepth, refreshGroups } from "./depth.js";

// ============================================================
// TRADE VALUATION
//
// A player's market value is talent (on a steeply convex curve, so a 90
// is worth many times a 75 and replacement-level players are worth
// almost nothing) × positional value (a QB is worth far more than a
// running back of the same rating) × age × trajectory.
//
// The AI team then judges a deal from its own seat: what it RECEIVES is
// scaled by how much that player would actually help its lineup (a team
// with a franchise QB doesn't pay for another one), and what it GIVES UP
// is scaled by how much losing that player hurts (starters cost more
// than backups, and its own franchise QB costs a lot more). Contenders
// discount picks; rebuilding teams prize them.
// ============================================================

const POSITION_VALUE = { QB: 1.7, DL: 1.15, OL: 1.0, WR: 1.0, CB: 1.0, LB: 0.85, S: 0.8, TE: 0.8, RB: 0.75, K: 0.3, P: 0.25 };

// ~0 at 60 ovr and below, ~7 at 70, ~33 at 80, 80 at 90, ~140 at 99.
function talentValue(ovr) { return 80 * Math.pow(Math.max(0, ovr - 60) / 30, 2.2); }

function ageFactor(age) {
  return age <= 24 ? 1.15 : age <= 27 ? 1.05 : age <= 29 ? 0.95 : age <= 31 ? 0.75 : age <= 33 ? 0.5 : 0.3;
}

function marketValue(p) {
  const dev = p.dev === "rising" ? 1.08 : p.dev === "declining" ? 0.9 : 1;
  return talentValue(p.ovr) * (POSITION_VALUE[p.pos] ?? 0.8) * ageFactor(p.age) * dev;
}

function startersAt(pos, scheme) {
  if (pos === "DL") return scheme === "3-4" ? 3 : 4;
  if (pos === "LB") return scheme === "3-4" ? 4 : 3;
  return { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, CB: 3, S: 2, K: 1, P: 1 }[pos] || 1;
}

function samePos(roster, pos, exceptId) {
  return roster.filter((p) => p.pos === pos && p.id !== exceptId).sort((a, b) => b.ovr - a.ovr);
}

// How much an incoming player would help this team's lineup, as a
// multiplier on market value: 0.2 if he'd just be depth, up to 1.5 for a
// big upgrade over the weakest starter at his position.
function incomingUpgrade(player, team) {
  const n = startersAt(player.pos, team.scheme);
  const same = samePos(team.roster, player.pos, player.id);
  const bar = same.length >= n ? same[n - 1].ovr : 0;
  return { upgrade: player.ovr - bar, bar };
}
function needFactor(player, team) {
  const { upgrade, bar } = incomingUpgrade(player, team);
  if (player.pos === "QB" && bar >= 84 && upgrade < 6) return 0.15; // already has a franchise QB
  if (upgrade <= 0) return 0.2;
  return clamp(0.45 + upgrade / 14, 0.45, 1.5);
}

// How much giving this player up hurts the team.
function lossFactor(player, team) {
  const n = startersAt(player.pos, team.scheme);
  const same = samePos(team.roster, player.pos);
  const rank = same.findIndex((x) => x.id === player.id);
  if (rank < 0 || rank >= n) return 0.7; // depth piece
  const replacement = same[n] ? same[n].ovr : player.ovr - 25;
  let f = 1.1 + clamp((player.ovr - replacement) / 40, 0, 0.35);
  if (player.pos === "QB" && rank === 0 && player.ovr >= 80) f *= 1.25; // franchise QB
  return f;
}

function winPctOf(team) {
  if (!team) return 0.5;
  const played = team.wins + team.losses + team.ties;
  return played ? (team.wins + team.ties * 0.5) / played : 0.5;
}
function strategyPickFactor(team) {
  const w = winPctOf(team);
  return w >= 0.6 ? 0.85 : w <= 0.35 ? 1.2 : 1;
}

function valueToTeam(p, team) { return marketValue(p) * needFactor(p, team); }
function valueLostByTeam(p, team) { return marketValue(p) * lossFactor(p, team); }
function pickValueForTeam(pk, team, leagueTeams, currentYear) {
  return pickTradeValue(pk.round, pk.year, currentYear, winPctOf(leagueTeams[pk.originalAbbr])) * strategyPickFactor(team);
}

// Short role labels for the trade sheet.
function incomingRole(player, team) {
  const { upgrade, bar } = incomingUpgrade(player, team);
  if (player.pos === "QB" && bar >= 84 && upgrade < 6) return "já têm QB titular";
  if (upgrade >= 8) return "seria titular";
  if (upgrade > 0) return "reforço";
  return "só reserva";
}
function outgoingRole(player, team) {
  const n = startersAt(player.pos, team.scheme);
  const rank = samePos(team.roster, player.pos).findIndex((x) => x.id === player.id);
  return rank >= 0 && rank < n ? "titular deles" : "reserva deles";
}

// Judges a deal from the AI team's seat. Players are evaluated one at a
// time against a working copy of the roster, so sending three QBs doesn't
// count the same need three times, and taking both of a team's QBs costs
// more than taking one.
function evaluateTrade(leagueTeams, targetAbbr, mine, theirs, currentYear) {
  const target = leagueTeams[targetAbbr];
  let gain = 0, loss = 0;

  const incoming = [...mine.players].sort((a, b) => b.ovr - a.ovr);
  const incomingRoster = [...target.roster];
  incoming.forEach((p) => {
    gain += marketValue(p) * needFactor(p, { ...target, roster: incomingRoster });
    incomingRoster.push(p);
  });
  mine.picks.forEach((pk) => { gain += pickValueForTeam(pk, target, leagueTeams, currentYear); });

  const outgoing = [...theirs.players].sort((a, b) => b.ovr - a.ovr);
  let outgoingRoster = [...target.roster];
  outgoing.forEach((p) => {
    loss += marketValue(p) * lossFactor(p, { ...target, roster: outgoingRoster });
    outgoingRoster = outgoingRoster.filter((x) => x.id !== p.id);
  });
  theirs.picks.forEach((pk) => { loss += pickValueForTeam(pk, target, leagueTeams, currentYear); });

  const hasAssets = mine.players.length + mine.picks.length > 0 && theirs.players.length + theirs.picks.length > 0;
  return { gain, loss, hasAssets, fair: hasAssets && gain >= loss * 1.05 };
}

// ------------------------------------------------------------
// EXECUTION
// ------------------------------------------------------------
function slotPos(team, slotKey) {
  return rosterSlotsFor(team.scheme || "4-3").find((s) => s.key === slotKey)?.pos;
}

// Puts incoming players into the slots their departed counterparts left
// (same position first, then a vacated bench spot), so a swapped starter
// is replaced by the newcomer instead of a hole. Anyone left over goes to
// the usual bench placement.
function placeIncoming(team, players, vacated) {
  [...players].sort((a, b) => b.ovr - a.ovr).forEach((p) => {
    const free = (v) => v.slot && !team.roster.some((x) => x.slot === v.slot);
    let vi = vacated.findIndex((v) => free(v) && !String(v.slot).startsWith("BEN") && slotPos(team, v.slot) === p.pos);
    if (vi < 0) vi = vacated.findIndex((v) => free(v) && String(v.slot).startsWith("BEN"));
    if (vi >= 0) {
      const slot = vacated[vi].slot;
      vacated.splice(vi, 1);
      insertPlayer(team.roster, slot, { ...p, slot });
    } else {
      const slot = findSlotForRookie(team.roster, p.pos);
      insertPlayer(team.roster, slot, { ...p, slot });
    }
  });
}

// Any slot still empty after the swap (traded away a starter and got
// nothing at the position back) gets a depth-level body — the engine reads
// slots directly, so a hole would break the next game. Deliberately a
// backup (58-74), never a free starter: selling a star for picks has to
// actually cost you at that position.
function fillVacated(team, vacated, rng) {
  vacated.forEach((v) => {
    if (!v.slot || team.roster.some((x) => x.slot === v.slot)) return;
    const pos = slotPos(team, v.slot) || v.old.pos;
    const repl = makePlayer(rng, pos, "backup", makeName(rng));
    repl.slot = v.slot;
    repl.years = 2 + Math.floor(rng() * 3);
    team.roster.push(repl);
  });
}

// Mutates the (cloned) career: moves players and picks between the user's
// team and `targetAbbr`, keeps both lineups whole, and re-sorts the AI
// team's depth chart so a better newcomer actually starts.
function executeTrade(c, mine, theirs, targetAbbr, rng) {
  const my = c.leagueTeams[c.teamAbbr], their = c.leagueTeams[targetAbbr];
  const vacated = { [my.abbr]: [], [their.abbr]: [] };

  function take(from, ids) {
    return ids.map((id) => {
      const idx = from.roster.findIndex((p) => p.id === id);
      if (idx < 0) return null;
      const [p] = from.roster.splice(idx, 1);
      vacated[from.abbr].push({ slot: p.slot, old: p });
      return p;
    }).filter(Boolean);
  }
  const fromMine = take(my, mine.players.map((p) => p.id));
  const fromTheirs = take(their, theirs.players.map((p) => p.id));
  const myVacatedKeys = vacated[my.abbr].map((v) => v.slot);

  placeIncoming(my, fromTheirs, vacated[my.abbr]);
  placeIncoming(their, fromMine, vacated[their.abbr]);
  fillVacated(my, vacated[my.abbr], rng);
  fillVacated(their, vacated[their.abbr], rng);
  // Your depth chart is yours: only the groups where a slot changed hands
  // get re-checked. The AI team just gets a full re-sort so newcomers start.
  refreshGroups(my, myVacatedKeys);
  autoSortDepth(their);

  mine.picks.forEach((pk) => { const a = c.futurePicks.find((x) => x.id === pk.id); if (a) a.currentOwner = targetAbbr; });
  theirs.picks.forEach((pk) => { const a = c.futurePicks.find((x) => x.id === pk.id); if (a) a.currentOwner = c.teamAbbr; });
}

export {
  POSITION_VALUE, marketValue, valueToTeam, valueLostByTeam, pickValueForTeam,
  incomingRole, outgoingRole, evaluateTrade, executeTrade,
};
