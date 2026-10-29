import { mulberry32, seedFromString } from "../lib/rng.js";
import { rosterSlotsFor } from "../data/rosterSlots.js";
import { makeName } from "../data/names.js";
import { agePlayer, makePlayer, normalizeSalaries } from "../engine/playerGen.js";
import { markLeadersRetired } from "./allTime.js";

// Offseason aging/retirement pass, run on every team once a year.

// A retiring player earns a Hall of Fame nod for a genuinely decorated
// career: multiple major awards, or a long, productive run. Kept simple
// and generous on purpose — this is a celebration screen, not a strict
// statistical model.
function isLegendary(p) {
  const accolades = p.accolades || [];
  const seasons = p.seasonsPlayed || 0;
  const wasMVP = accolades.some((a) => a.startsWith("MVP"));
  if (wasMVP && seasons >= 3) return true;
  if (accolades.length >= 3) return true;
  if (accolades.length >= 1 && seasons >= 6) return true;
  if (seasons >= 9 && p.ovr >= 82) return true;
  return false;
}

// allTimeLeaders (opcional): quem sai do elenco (aposentadoria ou fim de contrato) vira isRetired: true
// nas listas históricas, mesmo sem entrar no Hall da Fama.
function retireAndRefreshLeague(teams, year, allTimeLeaders) {
  const rng = mulberry32(seedFromString("retire-" + year));
  const news = [];
  const retirees = [];
  const leftLeague = [];
  Object.values(teams).forEach((t) => {
    const teamSlots = rosterSlotsFor(t.scheme || "4-3");
    t.roster.forEach((p, i) => {
      agePlayer(p, rng);
      const retiring = p.age > 34 || p.ovr < 44;
      const expired = p.years <= 0;
      if (retiring || expired) {
        leftLeague.push(p.id);
        const legendary = retiring && isLegendary(p);
        if (retiring) {
          retirees.push({
            id: p.id, name: p.name, pos: p.pos, teamAbbr: t.abbr, age: p.age,
            seasonsPlayed: p.seasonsPlayed || 0, accolades: p.accolades || [],
            careerStats: p.careerStats || {}, legendary,
          });
          news.push(legendary
            ? `🏛️ ${p.name} (${t.abbr}) pendura as chuteiras após ${p.seasonsPlayed || 0} temporada(s) — uma carreira para o Hall da Fama.`
            : `${p.name} (${t.abbr}) se aposentou.`);
        } else if (p.ovr >= 75) {
          // A contract that simply ran out — not a retirement.
          news.push(`${p.name} (${t.abbr}) deixou o clube ao fim do contrato.`);
        }
        const slotDef = teamSlots.find((s) => s.key === p.slot) || { pos: p.pos, tier: "backup" };
        const repl = makePlayer(rng, slotDef.pos, slotDef.tier === "star" ? "starter" : slotDef.tier, makeName(rng));
        repl.slot = p.slot;
        repl.years = Math.max(repl.years, 2);
        t.roster[i] = repl;
      }
    });
    normalizeSalaries(t.roster, rng);
  });
  if (allTimeLeaders) markLeadersRetired(allTimeLeaders, leftLeague);
  return { news, retirees };
}


export { retireAndRefreshLeague };
