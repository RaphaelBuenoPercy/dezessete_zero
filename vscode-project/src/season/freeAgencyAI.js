import { clamp } from "../lib/rng.js";
import { CAP } from "../data/teams.js";
import { capUsed } from "../engine/playerGen.js";
import { findSlotForRookie, insertPlayer } from "./roster.js";

// Position groups a team can have a "need" at during free agency.
const NEED_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

// How much a team's market size reads as a draw for players who care about
// endorsements/media exposure.
const MARKET_SIGNAL = { mega: 1, large: 0.7, mid: 0.4, small: 0.15 };

function climateSignal(playerPref, teamClimate) {
  if (!playerPref || playerPref === "any") return 0.6;
  if (playerPref === teamClimate) return 1;
  if (teamClimate === "dome") return 0.65; // climate-controlled reads as a safe middle ground
  const opposite = (playerPref === "warm" && teamClimate === "cold") || (playerPref === "cold" && teamClimate === "warm");
  return opposite ? 0 : 0.45;
}

// A team's current win% (or, before any games are played, its roster
// strength as a stand-in) as a 0-1 "this team is a winner" signal.
function teamWinSignal(team) {
  const played = team.wins + team.losses + team.ties;
  if (played > 0) return (team.wins + team.ties * 0.5) / played;
  const ovrs = team.roster.map((p) => p.ovr);
  const avg = ovrs.reduce((s, v) => s + v, 0) / (ovrs.length || 1);
  return clamp((avg - 55) / 30, 0, 1);
}

// The positions where a team's best player grades out the weakest, i.e.
// where free agency would help most.
function teamNeeds(team) {
  return NEED_POSITIONS
    .map((pos) => {
      const players = team.roster.filter((p) => p.pos === pos);
      const bestOvr = players.length ? Math.max(...players.map((p) => p.ovr)) : 0;
      return { pos, bestOvr };
    })
    .sort((a, b) => a.bestOvr - b.bestOvr);
}

// How attractive `team` looks to `player`, weighted by that player's own
// priorities (money, winning, playing time, climate, fan support, market).
// Returns a score roughly in [0, 1.15]; higher is more attractive.
function scoreTeamForFreeAgent(player, team) {
  const capRoom = CAP - capUsed(team.roster);
  const moneySignal = clamp(capRoom / (CAP * 0.25), 0, 1);
  const winningSignal = teamWinSignal(team);
  const incumbentOvr = Math.max(0, ...team.roster.filter((p) => p.pos === player.pos).map((p) => p.ovr));
  const playingTimeSignal = clamp((player.ovr - incumbentOvr + 15) / 30, 0, 1);
  const fanSignal = (team.fanSupport ?? 60) / 100;
  const marketSignal = MARKET_SIGNAL[team.market] ?? 0.4;
  const pr = player.priorities || { money: 0.2, winning: 0.2, playingTime: 0.2, climate: 0.1, fanSupport: 0.1, market: 0.2 };

  let score = pr.money * moneySignal
    + pr.winning * winningSignal
    + pr.playingTime * playingTimeSignal
    + pr.climate * climateSignal(player.climatePref, team.climate)
    + pr.fanSupport * fanSignal
    + pr.market * marketSignal;

  if (player.homeTeam === team.abbr) score += 0.15; // a hometown tie or a friend already in the building
  return score;
}

function shuffledAbbrs(abbrs, rng) {
  const a = [...abbrs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Runs one wave of AI free-agent shopping across the league (skipping
// `excludeAbbr`, normally the user's team). Every team checks its weakest
// `needsPerTeam` positions and, if a real upgrade is available and
// affordable under the cap (with `minCapReserve` left over), signs it —
// picking whichever affordable candidate scores best for *that* team given
// the player's own priorities. Mutates `leagueTeams` and `freeAgentPool` in
// place and returns a list of signing records for news/UI purposes.
function runFreeAgencyWave(leagueTeams, freeAgentPool, rng, opts = {}) {
  const { excludeAbbr = null, signingsPerTeam = 1, needsPerTeam = 3, minCapReserve = 3, upgradeMargin = 12 } = opts;
  const signings = [];
  const teamAbbrs = shuffledAbbrs(Object.keys(leagueTeams).filter((a) => a !== excludeAbbr), rng);

  teamAbbrs.forEach((abbr) => {
    const team = leagueTeams[abbr];
    let signed = 0;
    const needs = teamNeeds(team).slice(0, needsPerTeam).map((n) => n.pos);
    for (const pos of needs) {
      if (signed >= signingsPerTeam) break;
      const capRoom = CAP - capUsed(team.roster);
      const candidates = freeAgentPool.filter((p) => p.pos === pos && p.salary <= capRoom - minCapReserve);
      if (!candidates.length) continue;
      const incumbentOvr = Math.max(0, ...team.roster.filter((p) => p.pos === pos).map((p) => p.ovr));
      // Teams will take a plausible depth/rotational piece even if it isn't
      // a clear upgrade — not every free-agency move fills a glaring hole.
      const upgrades = candidates.filter((p) => p.ovr > incumbentOvr - upgradeMargin);
      if (!upgrades.length) continue;

      let best = null, bestScore = -Infinity;
      upgrades.forEach((p) => {
        const fit = scoreTeamForFreeAgent(p, team);
        const combined = fit * 0.7 + (p.ovr / 99) * 0.3; // teams also just want the best player, not only the best "fit"
        if (combined > bestScore) { bestScore = combined; best = p; }
      });
      if (!best) continue;

      const slot = findSlotForRookie(team.roster, best.pos);
      insertPlayer(team.roster, slot, { ...best, slot });
      const idx = freeAgentPool.findIndex((p) => p.id === best.id);
      if (idx >= 0) freeAgentPool.splice(idx, 1);
      signings.push({ playerId: best.id, name: best.name, pos: best.pos, ovr: best.ovr, teamAbbr: abbr });
      signed += 1;
    }
  });

  return signings;
}

export { teamNeeds, scoreTeamForFreeAgent, runFreeAgencyWave };
