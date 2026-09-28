// Standings, seeding, draft order and applying a final score to the league table.

function standingsSorted(teams) {
  return Object.values(teams).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa));
}
function conferenceSeeds(teams, conf) {
  return Object.values(teams)
    .filter((t) => t.conf === conf)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || (b.pf - b.pa) - (a.pf - a.pa))
    .slice(0, 7)
    .map((t, i) => ({ seed: i + 1, abbr: t.abbr }));
}
function draftOrderFromStandings(teams) {
  return Object.values(teams)
    .sort((a, b) => (a.wins - a.losses) - (b.wins - b.losses) || (a.pf - a.pa) - (b.pf - b.pa))
    .map((t) => t.abbr);
}
function applyResult(teams, home, away, hs, as) {
  teams[home].pf += hs; teams[home].pa += as;
  teams[away].pf += as; teams[away].pa += hs;
  if (hs > as) { teams[home].wins++; teams[away].losses++; }
  else if (as > hs) { teams[away].wins++; teams[home].losses++; }
  else { teams[home].ties++; teams[away].ties++; }
}

export { standingsSorted, conferenceSeeds, draftOrderFromStandings, applyResult };
