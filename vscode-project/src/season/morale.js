import { clamp } from "../lib/rng.js";

// ============================================================
// PLAYER MORALE
//
// Each player carries a 0-100 `morale`. Every week it drifts (doesn't
// jump) toward a target computed from a few readable signals: is the team
// winning, are they paid fairly for their talent, are they hurt, is their
// career trending up or down. This is deliberately a narrative/flavor
// layer — it doesn't feed back into game-simulation math — so it's safe
// to tune without touching anything about how games play out.
// ============================================================

// A simple "what a player of this OVR should roughly be paid" curve,
// mirroring the same shape playerGen.js uses when it first prices a
// player, so "underpaid star" / "overpaid bench player" reads consistently
// with how the game already thinks about value.
function expectedSalary(ovr) {
  return Math.max(0.8, Math.round(((ovr - 45) * (ovr - 45)) / 90 * 10) / 10);
}

function targetMorale(player, team) {
  const played = team.wins + team.losses + team.ties;
  const winPct = played ? (team.wins + team.ties * 0.5) / played : 0.5;
  let target = 38 + winPct * 42; // team success sets the baseline mood

  const expected = expectedSalary(player.ovr);
  const fairness = clamp((player.salary - expected) / Math.max(1, expected), -0.6, 0.6);
  target += fairness * 22; // underpaid stars sour, overpaid depth pieces relax

  if (player.injuredWeeks > 0) target -= 12;
  if (player.dev === "declining") target -= 4;
  if (player.dev === "rising") target += 4;
  if (player.age >= 33) target -= 3;

  return clamp(target, 5, 95);
}

function moraleLabel(m) {
  if (m >= 80) return { label: "Ótima", color: "#4ade80" };
  if (m >= 60) return { label: "Boa", color: "#a3e635" };
  if (m >= 40) return { label: "Neutra", color: "#fbbf24" };
  if (m >= 20) return { label: "Baixa", color: "#fb923c" };
  return { label: "Péssima", color: "#f87171" };
}

// Drifts every player's morale one notch toward their target for the week.
// Returns notable crossing events (a name-brand player tipping into "muito
// feliz" or "muito infeliz" territory) so the caller can turn the best ones
// into news for the user's own team without spamming every tiny change.
function updateWeeklyMorale(leagueTeams) {
  const events = [];
  Object.values(leagueTeams).forEach((t) => {
    t.roster.forEach((p) => {
      if (p.morale == null) p.morale = 65;
      const before = p.morale;
      const target = targetMorale(p, t);
      p.morale = Math.round(before + (target - before) * 0.18);
      if (p.ovr >= 80) {
        if (before >= 25 && p.morale < 25) events.push({ teamAbbr: t.abbr, name: p.name, type: "unhappy" });
        else if (before < 82 && p.morale >= 82) events.push({ teamAbbr: t.abbr, name: p.name, type: "happy" });
      }
    });
  });
  return events;
}

export { targetMorale, moraleLabel, updateWeeklyMorale, expectedSalary };
