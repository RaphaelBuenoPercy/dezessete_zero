import { randInt, clamp } from "../lib/rng.js";
import { rosterSlotsFor } from "../data/rosterSlots.js";
import { makeName } from "../data/names.js";
import { makePlayer, convertToFreeAgent } from "../engine/playerGen.js";
import { expectedSalary } from "./morale.js";

// ============================================================
// CONTRACT LIFECYCLE
//
// `years` on a player is the number of seasons left *including the one
// whose rollover is still pending*, so a player at years <= 1 is in the
// final season of their deal. At the end of a season, those players are
// expiring: your own can be extended (or let go to the market), and every
// AI team decides whether to keep or release theirs — with the released
// ones showing up in the free-agent pool as real, named players instead of
// quietly vanishing.
// ============================================================

const MARKET_MIN_OVR = 68; // below this, a departure is just quietly replaced

// Old enough to retire, or washed enough to retire, is not a contract
// question — the retirement pass in offseason.js handles those.
function isExpiring(p) { return p.years <= 1 && p.age < 34 && p.ovr >= 44; }

// What this player would ask to stay. Morale is the lever: a happy player
// gives a discount, a sour one costs extra, and one who's fed up refuses.
function extensionAsk(p) {
  const morale = p.morale ?? 65;
  if (morale < 30) return { willing: false, reason: "Está infeliz e não quer renovar." };
  const ageFactor = p.age <= 26 ? 1.08 : p.age >= 31 ? 0.93 : 1.0;
  const moraleFactor = morale >= 75 ? 0.92 : morale >= 55 ? 1.0 : 1.12;
  const salary = Math.max(0.8, Math.round(expectedSalary(p.ovr) * ageFactor * moraleFactor * 10) / 10);
  const years = p.age >= 33 ? 1 : p.age >= 30 ? 2 : p.age <= 25 ? 4 : 3;
  const note = morale >= 75 ? "Feliz no clube — aceita um desconto." : morale < 55 ? "Insatisfeito — cobra mais pra ficar." : null;
  return { willing: true, salary, years, note };
}

// A fresh player to fill the slot someone just left, so the roster's fixed
// slot structure never has a hole. Never a star: replacements are depth.
function replacementFor(rng, team, oldPlayer) {
  const def = rosterSlotsFor(team.scheme || "4-3").find((s) => s.key === oldPlayer.slot) || { pos: oldPlayer.pos, tier: "backup" };
  const repl = makePlayer(rng, def.pos, def.tier === "star" ? "starter" : def.tier, makeName(rng));
  repl.slot = oldPlayer.slot;
  repl.years = randInt(rng, 2, 4); // don't hand out a contract that ends before the first snap
  return repl;
}

// Every AI team re-signs or releases its expiring players. Re-sign odds
// climb with talent and morale. Releases above the market threshold enter
// the free-agent pool (mutated in place) as named players; the rest are
// quietly replaced. Returns news lines for the most notable departures.
function processAIContracts(leagueTeams, freeAgentPool, rng, excludeAbbr) {
  const departures = [];
  Object.values(leagueTeams).forEach((t) => {
    if (t.abbr === excludeAbbr) return;
    t.roster.forEach((p, i) => {
      if (!isExpiring(p)) return;
      const eligible = p.ovr >= MARKET_MIN_OVR;
      const resignChance = eligible ? clamp(0.5 + (p.ovr - 70) / 60 + ((p.morale ?? 65) - 50) / 200, 0.25, 0.9) : 0.85;
      if (rng() < resignChance) {
        p.salary = Math.max(0.8, Math.round(expectedSalary(p.ovr) * (0.92 + rng() * 0.2) * 10) / 10);
        p.years = randInt(rng, 2, 4) + 1;
        return;
      }
      if (eligible) {
        const fa = convertToFreeAgent(rng, p, t.abbr);
        fa.salary = Math.max(0.8, Math.round(expectedSalary(p.ovr) * (0.95 + rng() * 0.15) * 10) / 10);
        freeAgentPool.push(fa);
        departures.push({ name: p.name, teamAbbr: t.abbr, ovr: p.ovr, pos: p.pos });
      }
      t.roster[i] = replacementFor(rng, t, p);
    });
  });
  return departures.sort((a, b) => b.ovr - a.ovr).slice(0, 4)
    .map((d) => `📋 ${d.name} (${d.pos}, ${d.ovr} OVR) não renovou com o ${d.teamAbbr} e chega ao mercado.`);
}

// The user lets an expiring player walk: they hit the free-agent pool with
// a hometown pull back toward your club, and a depth player takes the slot.
function releaseToMarket(team, playerId, freeAgentPool, rng) {
  const idx = team.roster.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  const p = team.roster[idx];
  const fa = convertToFreeAgent(rng, p, team.abbr);
  fa.homeTeam = team.abbr;
  fa.salary = Math.max(0.8, expectedSalary(p.ovr));
  freeAgentPool.push(fa);
  team.roster[idx] = replacementFor(rng, team, p);
  return fa;
}

export { isExpiring, extensionAsk, processAIContracts, releaseToMarket, replacementFor, MARKET_MIN_OVR };
