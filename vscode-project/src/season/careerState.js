import { buildLeague, buildSchedule, generateFreeAgents } from "../engine/playerGen.js";
import { TEAM_META } from "../data/teams.js";
import { DEFAULT_PERSONNEL } from "../engine/simulation.js";
import { rollFuturePicks } from "./picks.js";

// Builds a brand-new save (career), and the fixed tendencies used by
// every AI-controlled team in the league.

function newCareerState(teamAbbr, coachName) {
  const leagueTeams = buildLeague();
  const schedule = buildSchedule(leagueTeams);
  const meta = TEAM_META.find((t) => t.abbr === teamAbbr);
  return {
    id: `${teamAbbr}-${Date.now()}`,
    coachName, teamAbbr, year: 2026, week: 1, phase: "season", seasonsCoached: 0,
    leagueTeams, schedule,
    tendencies: { passRatio: 0.55, aggressive: 0.5, rb2CarryShare: 0.2, personnel: { ...DEFAULT_PERSONNEL }, lightFormationShare: 20 },
    lastGame: null, pressPending: null,
    freeAgentPool: generateFreeAgents(2026),
    freeAgencyActivity: [],
    draftClass: null, draftPickIndex: 0, draftOrder: null, draftHistory: [],
    futurePicks: rollFuturePicks([], Object.keys(leagueTeams), 2027),
    tradeHistory: [],
    hallOfFame: [], lastSeasonAwards: null, hotSeatWarned: false,
    rivalries: {}, nemeses: [],
    news: [`Bem-vindo, técnico ${coachName}! Você assume o comando do ${meta.city} ${meta.name} para a temporada 2026.`],
    playoffs: null,
  };
}

const AI_TEND = { passRatio: 0.55, aggressive: 0.45, rb2CarryShare: 0.22, personnel: { ...DEFAULT_PERSONNEL }, lightFormationShare: 18 };

export { newCareerState, AI_TEND };
