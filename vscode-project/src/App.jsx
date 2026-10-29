import React, { useState, useEffect, useCallback } from "react";
import { mulberry32, seedFromString, randInt, pick, clamp } from "./lib/rng.js";
import { CAP } from "./data/teams.js";
import { buildSchedule, generateFreeAgents, generateDraftClass, capUsed, upgradeCareerPlayers } from "./engine/playerGen.js";
import { snapshotRosterStats, diffRosterStats, simGameDetailed, simGameQuick } from "./engine/simulation.js";
import { buildPressEvent } from "./engine/press.js";
import { recordMeeting, rivalryTier, headToHeadLine, detectStandoutPerformances, updateNemeses } from "./season/rivalries.js";
import { conferenceSeeds, draftOrderFromStandings, applyResult } from "./season/standings.js";
import { findSlotForRookie, insertPlayer } from "./season/roster.js";
import { rollFuturePicks, resolvePickOwner, consumePick, pickLabel } from "./season/picks.js";
import { resetSeasonStats } from "./season/stats.js";
import { retireAndRefreshLeague } from "./season/offseason.js";
import { aiOffersWave, resolveMarket, submitUserOffer, withdrawUserOffer } from "./season/negotiation.js";
import { pickForTeamAI, pickValueRead } from "./season/scouting.js";
import { updateWeeklyMorale } from "./season/morale.js";
import { buildWeeklyRecap } from "./season/weeklyRecap.js";
import { teamScore, buildPowerRankings, rankingMap, hotTake, winProbability, computePowerRankings } from "./season/powerRankings.js";
import { checkGameRecords, checkSeasonRecords } from "./season/records.js";
import { evaluateTrade, executeTrade } from "./season/trades.js";
import { autoSortDepth } from "./season/depth.js";
import { extensionAsk, processAIContracts, releaseToMarket } from "./season/contracts.js";
import { computeSeasonAwards, applyCareerRollover } from "./season/legacy.js";
import { snapshotLeaders, archiveSeason } from "./season/archive.js";
import { ensureCoachingState } from "./engine/coachesGen.js";
import { ensureAllTimeLeaders, markRetiredLeaders } from "./season/allTime.js";
import { ensureEventsState, rollWeeklyEvents, resolveEvent, checkPromises, tickTempMods, withWeekMods } from "./season/events.js";
import { runCoachingCarousel, applyCoachDevelopment, hireCoach, fireCoach, renewCoach } from "./season/coachingCarousel.js";
import { newCareerState, AI_TEND } from "./season/careerState.js";
import { TopBar, BottomNav } from "./components/ui.jsx";
import { MenuScreen, NewCareerScreen, FiredScreen } from "./screens/MenuScreens.jsx";
import { TeamDetailScreen, PlayerDetailScreen } from "./screens/TeamAndPlayer.jsx";
import { HubScreen } from "./screens/HubScreen.jsx";
import { RosterScreen, DepthChartScreen, TacticsScreen, ContractsScreen, StaffScreen } from "./screens/TeamManagementScreens.jsx";
import { ScheduleScreen, ResultsScreen, GameScreen, PressModal, EventModal, HonorsScreen } from "./screens/SeasonScreens.jsx";
import { HistoryScreen } from "./screens/HistoryScreen.jsx";
import { FreeAgencyScreen, FreeAgentDetailScreen, DraftScreen, ProspectDetailScreen, StatsScreen, TradeScreen, CoachMarketScreen } from "./screens/MarketScreens.jsx";

// Current win/loss/tie streak for `abbr`, most recent game first — shared
// by the press-conference context (win_streak/loss_streak flavor) and
// could be reused anywhere else a "hot or cold" read is useful.
function computeStreak(schedule, abbr) {
  const played = [];
  schedule.forEach((wk) => {
    const g = wk.find((g) => (g.home === abbr || g.away === abbr) && g.homeScore !== undefined);
    if (g) played.push(g);
  });
  let streak = 0, type = null;
  for (let i = played.length - 1; i >= 0; i--) {
    const g = played[i];
    const my = g.home === abbr ? g.homeScore : g.awayScore;
    const opp = g.home === abbr ? g.awayScore : g.homeScore;
    const t = my === opp ? "E" : my > opp ? "V" : "D";
    if (streak === 0) { type = t; streak = 1; } else if (t === type) streak++; else break;
  }
  return { streak, type };
}

// Fires the "how do you feel about your draft class" press moment exactly
// once, the instant the draft wraps up (draftPickIndex reaching the very
// last slot) — reused by both the manual pick and the auto-sim path.
function maybeFireDraftGrade(c, rng) {
  const total = c.draftOrder.length * 7;
  if (c.draftPickIndex !== total) return;
  const mine = (c.draftHistory || []).filter((h) => h.teamAbbr === c.teamAbbr);
  const steals = mine.filter((h) => h.projectedRound && ["ROUBADA!", "Ótimo valor"].includes(pickValueRead(h.projectedRound, h.round).label)).length;
  if (!c.pressPending) c.pressPending = buildPressEvent("draft_grade", { pickCount: mine.length, steals }, rng);
}

// Every AI team re-sorts its depth chart (promote a better bench player,
// order each group best-to-worst). Runs after anything that changes AI
// rosters or ratings — free agency, the draft, the yearly rollover — so a
// star rookie or signing actually starts. Your own team is never touched.
function sortAIDepth(c) {
  Object.values(c.leagueTeams).forEach((t) => { if (t.abbr !== c.teamAbbr) autoSortDepth(t); });
}

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [detail, setDetail] = useState(null);
  function openTeam(abbr) {
    const from = (screen === "teamDetail" || screen === "playerDetail") ? (detail?.from || "hub") : screen;
    setDetail({ type: "team", abbr, from });
    setScreen("teamDetail");
  }
  function openPlayer(playerId, teamAbbr) {
    const from = (screen === "teamDetail" || screen === "playerDetail") ? (detail?.from || "hub") : screen;
    setDetail({ type: "player", playerId, teamAbbr, from });
    setScreen("playerDetail");
  }
  function openFreeAgent(playerId) {
    const from = (screen === "teamDetail" || screen === "playerDetail") ? (detail?.from || "hub") : screen;
    setDetail({ type: "freeagent", playerId, from });
    setScreen("playerDetail");
  }
  function openProspect(playerId) {
    const from = (screen === "teamDetail" || screen === "playerDetail") ? (detail?.from || "hub") : screen;
    setDetail({ type: "draft", playerId, from });
    setScreen("playerDetail");
  }
  function closeDetail() { setScreen(detail?.from || "hub"); setDetail(null); }
  const [saves, setSaves] = useState([]);
  const [career, setCareer] = useState(null);
  const [pressChoice, setPressChoice] = useState(null);
  const [swapFrom, setSwapFrom] = useState(null);
  const [simProgress, setSimProgress] = useState(null);

  const refreshSaves = useCallback(() => {
    try {
      const list = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("nflcareer:")) continue;
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const c = JSON.parse(raw);
            list.push({ id: c.id, coachName: c.coachName, teamAbbr: c.teamAbbr, year: c.year, week: c.week });
          }
        } catch (e) {}
      }
      setSaves(list);
    } catch (e) { setSaves([]); }
  }, []);

  useEffect(() => { refreshSaves(); }, [refreshSaves]);

  const persist = useCallback((c) => {
    try { localStorage.setItem("nflcareer:" + c.id, JSON.stringify(c)); } catch (e) {}
  }, []);

  useEffect(() => { if (career) persist(career); }, [career, persist]);

  function go(s) { setScreen(s); }

  // ---- eventos dinâmicos ----
  function onChooseEvent(eventUid, optionIdx) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      resolveEvent(c, eventUid, optionIdx, mulberry32(seedFromString(c.id + "-evchoice-" + eventUid)));
      return c;
    });
  }
  function onDismissNotice(id) { setCareer((p) => ({ ...p, eventNotices: (p.eventNotices || []).filter((n) => n.id !== id) })); }

  // ---- comissão técnica ----
  function staffAction(fn) {
    const c = structuredClone(career);
    const r = fn(c);
    if (r.ok) setCareer(c);
    return r;
  }
  function onHireCoach(role, id) { return staffAction((c) => hireCoach(c, role, id, mulberry32(seedFromString(c.id + "-front-" + c.year + id)))); }
  function onFireCoach(role) { return staffAction((c) => fireCoach(c, role)); }
  function onRenewCoach(role) { return staffAction((c) => renewCoach(c, role)); }
  function onDismissAlert(id) { setCareer((p) => ({ ...p, staffAlerts: (p.staffAlerts || []).filter((a) => a.id !== id) })); }

  function onNewCareer() { setScreen("newcareer"); }
  function onCreateCareer(teamAbbr, coachName) {
    const c = newCareerState(teamAbbr, coachName);
    ensureCoachingState(c, mulberry32(seedFromString(c.id + "-staff")));
    ensureEventsState(c);
    ensureAllTimeLeaders(c);
    c.pendingEvents = rollWeeklyEvents(c, mulberry32(seedFromString(c.id + "-ev-" + c.year + "-1")));
    setCareer(c);
    setScreen("hub");
  }
  function onLoadCareer(id) {
    try {
      const raw = localStorage.getItem("nflcareer:" + id);
      if (raw) {
        const loaded = JSON.parse(raw);
        upgradeCareerPlayers(loaded); // saves antigos (2 atributos) -> novos atributos, mantendo o OVR
        ensureCoachingState(loaded, mulberry32(seedFromString(loaded.id + "-staff"))); // comissão técnica em saves antigos
        ensureEventsState(loaded); // eventos/promessas em saves antigos
        ensureAllTimeLeaders(loaded); // histórico de líderes em saves antigos
        setCareer(loaded); setScreen("hub");
      }
    } catch (e) {}
  }
  function onDeleteCareer(id) {
    try { localStorage.removeItem("nflcareer:" + id); refreshSaves(); } catch (e) {}
  }
  function onRestart() { setCareer(null); setScreen("menu"); refreshSaves(); }

  const myTeam = career ? career.leagueTeams[career.teamAbbr] : null;

  function advanceWeek(prev) {
    {
      const c = structuredClone(prev);
      const round = c.schedule[c.week - 1];
      const rng = mulberry32(seedFromString(c.id + "-w" + c.week));

      if (!round) {
        // regular season over -> seed playoffs
        const afc = conferenceSeeds(c.leagueTeams, "AFC");
        const nfc = conferenceSeeds(c.leagueTeams, "NFC");
        c.phase = "playoffs";
        c.playoffs = {
          roundLabel: "Wild Card",
          afcSeeds: afc, nfcSeeds: nfc,
          afcBracket: [{ a: afc[1], b: afc[6] }, { a: afc[2], b: afc[5] }, { a: afc[3], b: afc[4] }],
          nfcBracket: [{ a: nfc[1], b: nfc[6] }, { a: nfc[2], b: nfc[5] }, { a: nfc[3], b: nfc[4] }],
          afcBye: afc[0], nfcBye: nfc[0],
          rounds: [],
          champion: null,
        };
        c.news.push(`Temporada regular encerrada! Playoffs definidos.`);
        const madeIt = afc.some((s) => s.abbr === c.teamAbbr) || nfc.some((s) => s.abbr === c.teamAbbr);
        if (madeIt) c.pressPending = buildPressEvent("clinched_playoffs", {}, rng);
        return c;
      }

      let myGame = null;
      const weekRecordBreaks = [];
      round.forEach((g) => {
        if (g.home === c.teamAbbr || g.away === c.teamAbbr) { myGame = g; return; }
        const beforeH = snapshotRosterStats(c.leagueTeams[g.home].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[g.away].roster);
        const scores = simGameQuick(g.home, g.away, c.leagueTeams, { home: AI_TEND, away: AI_TEND }, rng);
        applyResult(c.leagueTeams, g.home, g.away, scores[g.home], scores[g.away]);
        g.homeScore = scores[g.home]; g.awayScore = scores[g.away];
        g.boxScore = {
          home: diffRosterStats(c.leagueTeams[g.home].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[g.away].roster, beforeA),
        };
        if (!c.leagueRecords) c.leagueRecords = { single_game: {}, single_season: {} };
        weekRecordBreaks.push(...checkGameRecords(c.leagueRecords, g.boxScore, g.home, g.away, c.year, c.week));
      });

      if (myGame) {
        const tendencies = {
          home: myGame.home === c.teamAbbr ? withWeekMods(c.tendencies, c.weekMods) : AI_TEND,
          away: myGame.away === c.teamAbbr ? withWeekMods(c.tendencies, c.weekMods) : AI_TEND,
        };
        const beforeH = snapshotRosterStats(c.leagueTeams[myGame.home].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[myGame.away].roster);
        // The media's pre-game read, using standings as they stand right now
        // (before this game changes them) — tracked afterward so "beating
        // the odds" means something over a season.
        const myIsHome = myGame.home === c.teamAbbr;
        const preHomeScore = teamScore(c.leagueTeams[myGame.home]), preAwayScore = teamScore(c.leagueTeams[myGame.away]);
        const myWinProb = myIsHome ? winProbability(preHomeScore, preAwayScore) : 1 - winProbability(preHomeScore, preAwayScore);
        const { score, log, scoreTimeline, plays, injuries: gameInjuries } = simGameDetailed(myGame.home, myGame.away, c.leagueTeams, tendencies, rng);
        applyResult(c.leagueTeams, myGame.home, myGame.away, score[myGame.home], score[myGame.away]);
        myGame.homeScore = score[myGame.home]; myGame.awayScore = score[myGame.away];
        {
          const myWon = score[c.teamAbbr] > score[myGame.home === c.teamAbbr ? myGame.away : myGame.home];
          const pr = c.predictionRecord || (c.predictionRecord = { correct: 0, wrong: 0, upsetWins: 0, games: 0 });
          pr.games += 1;
          const mediaPickedMe = myWinProb >= 0.5;
          if (mediaPickedMe === myWon) pr.correct += 1; else pr.wrong += 1;
          if (myWinProb < 0.4 && myWon) { pr.upsetWins += 1; c.news.push(`📊 A mídia dava só ${Math.round(myWinProb * 100)}% de chance — vocês provaram errado!`); }
        }
        myGame.boxScore = {
          home: diffRosterStats(c.leagueTeams[myGame.home].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[myGame.away].roster, beforeA),
        };
        if (!c.leagueRecords) c.leagueRecords = { single_game: {}, single_season: {} };
        weekRecordBreaks.push(...checkGameRecords(c.leagueRecords, myGame.boxScore, myGame.home, myGame.away, c.year, c.week));
        const oppAbbr = myGame.home === c.teamAbbr ? myGame.away : myGame.home;
        const won = score[c.teamAbbr] > score[oppAbbr];
        const myTeamMeta = c.leagueTeams[c.teamAbbr], oppTeamMeta = c.leagueTeams[oppAbbr];
        const isDivision = myTeamMeta.conf === oppTeamMeta.conf && myTeamMeta.div === oppTeamMeta.div;
        if (!c.rivalries) c.rivalries = {};
        const rival = recordMeeting(c.rivalries, oppAbbr, score[c.teamAbbr], score[oppAbbr], c.year, false);
        const tier = rivalryTier(rival, isDivision);
        const h2h = headToHeadLine(rival, c.teamAbbr);
        const oppBoxScore = oppAbbr === myGame.home ? myGame.boxScore.home : myGame.boxScore.away;
        const standouts = detectStandoutPerformances(oppBoxScore);
        c.nemeses = updateNemeses(c.nemeses, standouts, oppAbbr, c.year);
        const { streak } = computeStreak(c.schedule, c.teamAbbr);
        const starPlayer = [...myTeamMeta.roster].sort((a, b) => b.ovr - a.ovr)[0];
        c.lastGame = {
          home: myGame.home, away: myGame.away, score, log, scoreTimeline, plays, resolved: false,
          pressKey: buildPressEvent("game_result", { myScore: score[c.teamAbbr], oppScore: score[oppAbbr], oppAbbr, rivalryTier: tier, h2h, streak, starPlayer }, rng),
          newsLine: `Semana ${c.week}: ${won ? "Vitória" : "Derrota"} ${score[c.teamAbbr]}-${score[oppAbbr]} vs ${oppAbbr}.`,
        };
        gameInjuries.filter((inj) => inj.teamAbbr === c.teamAbbr).forEach((inj) => {
          c.news.push(`🏥 ${inj.name} sofreu lesão em campo e ficará fora por ${inj.weeks} semana(s).`);
        });
        c.gameRevealCount = Math.min(6, log.length);
      }

      const INJURY_RISK = { QB: 0.5, RB: 1.3, WR: 0.9, TE: 1.0, OL: 1.1, DL: 1.2, LB: 1.2, CB: 1.0, S: 1.0, K: 0.05, P: 0.05 };
      const INJURY_TIERS = [
        { chance: 0.55, weeks: [1, 2], label: "entorse leve no tornozelo" },
        { chance: 0.28, weeks: [3, 5], label: "lesão muscular" },
        { chance: 0.13, weeks: [6, 9], label: "lesão grave no joelho" },
        { chance: 0.04, weeks: [10, 16], label: "lesão severa — fora pelo resto da temporada" },
      ];
      // The two teams in this week's detailed game already had their injury
      // risk resolved play-by-play above — skip them here so a fresh in-game
      // injury isn't immediately decremented or double-rolled the same week.
      const detailedAbbrs = new Set(myGame ? [myGame.home, myGame.away] : []);
      Object.values(c.leagueTeams).forEach((t) => {
        if (detailedAbbrs.has(t.abbr)) return;
        t.roster.forEach((p) => { if (p.injuredWeeks > 0) p.injuredWeeks -= 1; });
        if (rng() < 0.12) {
          const cand = t.roster.filter((p) => p.injuredWeeks === 0);
          const weights = cand.map((p) => INJURY_RISK[p.pos] ?? 0.8);
          const total = weights.reduce((a, b) => a + b, 0);
          if (cand.length && total > 0) {
            let r = rng() * total, victim = cand[cand.length - 1];
            for (let i = 0; i < cand.length; i++) { r -= weights[i]; if (r <= 0) { victim = cand[i]; break; } }
            let roll = rng(), tier = INJURY_TIERS[0];
            for (const t2 of INJURY_TIERS) { if (roll < t2.chance) { tier = t2; break; } roll -= t2.chance; }
            victim.injuredWeeks = randInt(rng, tier.weeks[0], tier.weeks[1]);
            victim.injuryHistory = victim.injuryHistory || [];
            victim.injuryHistory.push({ year: c.year, weeks: victim.injuredWeeks, type: tier.label });
            if (t.abbr === c.teamAbbr) c.news.push(`${victim.name} sofreu ${tier.label} e ficará fora por ${victim.injuredWeeks} semana(s).`);
          }
        }
      });

      // Eventos: cobra as promessas com o resultado/box score deste jogo e expira modificadores temporários.
      ensureEventsState(c);
      checkPromises(c, myGame, mulberry32(seedFromString(c.id + "-promise-" + c.year + "-" + c.week)));
      tickTempMods(c);

      const moraleEvents = updateWeeklyMorale(c.leagueTeams);
      moraleEvents.filter((e) => e.teamAbbr === c.teamAbbr).forEach((e) => {
        c.news.push(e.type === "unhappy" ? `😠 ${e.name} está infeliz com a situação no time.` : `😊 ${e.name} está em alta, feliz com o momento no time.`);
      });

      const myT = c.leagueTeams[c.teamAbbr];
      if (myT.ownerConfidence < 25) {
        if (!c.hotSeatWarned && !c.pressPending) { c.pressPending = buildPressEvent("hot_seat", {}, rng); c.hotSeatWarned = true; }
      } else if (myT.ownerConfidence >= 40) {
        c.hotSeatWarned = false;
      }

      const prRng = mulberry32(seedFromString(c.id + "-powerrank-" + c.week));
      c.powerRankings = buildPowerRankings(c.leagueTeams, c.powerRankingsPrev, prRng);
      c.powerRankingsPrev = rankingMap(c.powerRankings);
      c.hotTake = hotTake(c.powerRankings, prRng);

      weekRecordBreaks.slice(0, 2).forEach((b) => {
        c.news.push(`📖 Novo recorde! ${b.label}: ${b.playerName} (${b.teamAbbr}) com ${b.value}.`);
      });

      const recap = buildWeeklyRecap(c.leagueTeams, round);
      if (recap) {
        if (recap.upsets.length) {
          const g = recap.upsets[0];
          const winner = g.homeScore > g.awayScore ? g.home : g.away, loser = winner === g.home ? g.away : g.home;
          c.news.push(`📰 Zebra da rodada: ${winner} surpreende e vence o ${loser}.`);
        } else if (recap.potw) {
          c.news.push(`📰 Destaque da rodada: ${recap.potw.name} (${recap.potw.teamAbbr}) — ${recap.potw.line}.`);
        }
      }
      c.week += 1;
      // Eventos da PRÓXIMA semana (o usuário responde no Hub antes de jogar).
      c.pendingEvents = c.week <= 17 ? rollWeeklyEvents(c, mulberry32(seedFromString(c.id + "-ev-" + c.year + "-" + c.week))) : [];
      return c;
    }
  }
  function playWeek() {
    if (career?.phase === "season" && career.pendingEvents?.length) return; // responda os eventos primeiro
    setCareer(advanceWeek);
    setScreen("game");
  }

  function advancePlayoffRound(prev) {
    {
      const c = structuredClone(prev);
      const rng = mulberry32(seedFromString(c.id + "-po" + c.playoffs.roundLabel));
      const po = c.playoffs;

      function resolveMatch(m) {
        if (!m.a) return { winnerObj: m.b, m };
        if (!m.b) return { winnerObj: m.a, m };
        const homeAbbr = m.a.abbr, awayAbbr = m.b.abbr;
        let score;
        const beforeH = snapshotRosterStats(c.leagueTeams[homeAbbr].roster);
        const beforeA = snapshotRosterStats(c.leagueTeams[awayAbbr].roster);
        if (homeAbbr === c.teamAbbr || awayAbbr === c.teamAbbr) {
          const tendencies = { home: homeAbbr === c.teamAbbr ? c.tendencies : AI_TEND, away: awayAbbr === c.teamAbbr ? c.tendencies : AI_TEND };
          const res = simGameDetailed(homeAbbr, awayAbbr, c.leagueTeams, tendencies, rng);
          score = res.score;
          const oppAbbr = homeAbbr === c.teamAbbr ? awayAbbr : homeAbbr;
          const myTeamMeta = c.leagueTeams[c.teamAbbr], oppTeamMeta = c.leagueTeams[oppAbbr];
          const won = score[c.teamAbbr] > score[oppAbbr];
          const isDivision = myTeamMeta.conf === oppTeamMeta.conf && myTeamMeta.div === oppTeamMeta.div;
          if (!c.rivalries) c.rivalries = {};
          const rival = recordMeeting(c.rivalries, oppAbbr, score[c.teamAbbr], score[oppAbbr], c.year, true);
          const tier = rivalryTier(rival, isDivision);
          const h2h = headToHeadLine(rival, c.teamAbbr);
          const earlyBox = { home: diffRosterStats(c.leagueTeams[homeAbbr].roster, beforeH), away: diffRosterStats(c.leagueTeams[awayAbbr].roster, beforeA) };
          const oppBoxScore = oppAbbr === homeAbbr ? earlyBox.home : earlyBox.away;
          const standouts = detectStandoutPerformances(oppBoxScore);
          c.nemeses = updateNemeses(c.nemeses, standouts, oppAbbr, c.year);
          let pressKey;
          if (won && po.roundLabel === "Super Bowl") pressKey = buildPressEvent("champion", {}, rng);
          else if (!won) pressKey = buildPressEvent("eliminated_playoffs", {}, rng);
          else {
            const starPlayer = [...myTeamMeta.roster].sort((a, b) => b.ovr - a.ovr)[0];
            pressKey = buildPressEvent("game_result", { myScore: score[c.teamAbbr], oppScore: score[oppAbbr], oppAbbr, rivalryTier: tier, h2h, streak: 0, starPlayer }, rng);
          }
          c.lastGame = {
            home: homeAbbr, away: awayAbbr, score, log: res.log, scoreTimeline: res.scoreTimeline, plays: res.plays, resolved: false,
            pressKey,
            newsLine: `${po.roundLabel}: ${won ? "Vitória" : "Derrota"} ${score[c.teamAbbr]}-${score[oppAbbr]} vs ${oppAbbr}.`,
          };
          res.injuries.filter((inj) => inj.teamAbbr === c.teamAbbr).forEach((inj) => {
            c.news.push(`🏥 ${inj.name} sofreu lesão em campo e ficará fora por ${inj.weeks} semana(s).`);
          });
          c.gameRevealCount = Math.min(6, res.log.length);
        } else {
          score = simGameQuick(homeAbbr, awayAbbr, c.leagueTeams, { home: AI_TEND, away: AI_TEND }, rng);
        }
        m.score = score;
        m.boxScore = {
          home: diffRosterStats(c.leagueTeams[homeAbbr].roster, beforeH),
          away: diffRosterStats(c.leagueTeams[awayAbbr].roster, beforeA),
        };
        if (!c.leagueRecords) c.leagueRecords = { single_game: {}, single_season: {} };
        checkGameRecords(c.leagueRecords, m.boxScore, homeAbbr, awayAbbr, c.year, po.roundLabel).slice(0, 2).forEach((b) => {
          c.news.push(`📖 Novo recorde (playoffs)! ${b.label}: ${b.playerName} (${b.teamAbbr}) com ${b.value}.`);
        });
        const winnerAbbr = score[homeAbbr] >= score[awayAbbr] ? homeAbbr : awayAbbr;
        m.winner = winnerAbbr;
        return { winnerObj: winnerAbbr === m.a.abbr ? m.a : m.b, m };
      }

      if (po.roundLabel === "Wild Card") {
        const afcResults = po.afcBracket.map(resolveMatch).map((r) => r.winnerObj);
        const nfcResults = po.nfcBracket.map(resolveMatch).map((r) => r.winnerObj);
        if (!po.rounds) po.rounds = [];
        po.rounds.push({ label: "Wild Card", afc: po.afcBracket, nfc: po.nfcBracket });
        const afcSorted = [...afcResults].sort((x, y) => x.seed - y.seed);
        const nfcSorted = [...nfcResults].sort((x, y) => x.seed - y.seed);
        po.afcBracket = [{ a: po.afcBye, b: afcSorted[2] }, { a: afcSorted[0], b: afcSorted[1] }];
        po.nfcBracket = [{ a: po.nfcBye, b: nfcSorted[2] }, { a: nfcSorted[0], b: nfcSorted[1] }];
        po.roundLabel = "Divisional";
        c.news.push("Wild Card concluído! Divisional definida.");
      } else if (po.roundLabel === "Divisional") {
        const afcW = po.afcBracket.map(resolveMatch).map((r) => r.winnerObj);
        const nfcW = po.nfcBracket.map(resolveMatch).map((r) => r.winnerObj);
        po.rounds.push({ label: "Divisional", afc: po.afcBracket, nfc: po.nfcBracket });
        po.afcBracket = [{ a: afcW[0], b: afcW[1] }];
        po.nfcBracket = [{ a: nfcW[0], b: nfcW[1] }];
        po.roundLabel = "Final de Conferência";
        c.news.push("Jogos divisionais concluídos! Finais de conferência definidas.");
      } else if (po.roundLabel === "Final de Conferência") {
        const afcChamp = resolveMatch(po.afcBracket[0]).winnerObj;
        const nfcChamp = resolveMatch(po.nfcBracket[0]).winnerObj;
        po.rounds.push({ label: "Final de Conferência", afc: po.afcBracket, nfc: po.nfcBracket });
        po.superBowl = { a: afcChamp, b: nfcChamp };
        po.roundLabel = "Super Bowl";
        c.news.push(`Final de conferência concluída! Super Bowl: ${afcChamp.abbr} x ${nfcChamp.abbr}.`);
      } else if (po.roundLabel === "Super Bowl") {
        const { winnerObj } = resolveMatch(po.superBowl);
        po.rounds.push({ label: "Super Bowl", superBowl: po.superBowl });
        po.champion = winnerObj.abbr;
        po.roundLabel = "Concluído";
        c.news.push(`🏆 ${winnerObj.abbr} venceu o Super Bowl ${c.year}!`);
      } else if (po.champion) {
        // move to offseason
        c.phase = "offseason";
        c.draftClass = generateDraftClass(c.year + 1);
        c.draftOrder = draftOrderFromStandings(c.leagueTeams);
        c.draftPickIndex = 0;
        c.draftHistory = [];
        c.futurePicks = rollFuturePicks(c.futurePicks, Object.keys(c.leagueTeams), c.year + 1);
        c.freeAgentPool = generateFreeAgents(c.year + 1);
        c.faMarket = {};
        c.freeAgencyActivity = [];
        c.seasonsCoached += 1;
        // Expiring contracts: every AI team keeps or releases its own. Releases
        // land in the pool as real named players before the opening rush.
        const contractRng = mulberry32(seedFromString(c.id + "-contracts-" + (c.year + 1)));
        c.news.push(...processAIContracts(c.leagueTeams, c.freeAgentPool, contractRng, c.teamAbbr));
        // Opening rush: a few days of pre-negotiation before the window
        // fully opens. Some deals close before the user even looks —
        // others are left mid-negotiation, with rival offers already on
        // the table, so the market feels alive the moment they walk in.
        const faRng = mulberry32(seedFromString(c.id + "-fa-open-" + (c.year + 1)));
        for (let wave = 0; wave < 3; wave++) {
          aiOffersWave(c.leagueTeams, c.freeAgentPool, c.faMarket, faRng, { excludeAbbr: c.teamAbbr, needsPerTeam: 4 });
          const openingSignings = resolveMarket(c.leagueTeams, c.freeAgentPool, c.faMarket, faRng);
          openingSignings.forEach((s) => {
            const t = c.leagueTeams[s.teamAbbr];
            c.news.push(`Free agency: ${s.name} (${s.pos}, OVR ${s.ovr}) assinou com o ${t.city} ${t.name} ${s.reason}.`);
          });
          c.freeAgencyActivity = [...openingSignings, ...c.freeAgencyActivity].slice(0, 20);
        }
        // Coaching carousel: times ruins demitem HCs e podem "roubar" coordenadores de times de sucesso.
        c.news.push(...runCoachingCarousel(c, mulberry32(seedFromString(c.id + "-carousel-" + c.year))));
        sortAIDepth(c);
      }
      return c;
    }
  }
  function simPlayoffRound() {
    setCareer(advancePlayoffRound);
    setScreen("game");
  }

  function advanceToNextSeason() {
    setCareer((prev) => {
      const c = structuredClone(prev);

      if (!c.leagueRecords) c.leagueRecords = { single_game: {}, single_season: {} };
      checkSeasonRecords(c.leagueRecords, c.leagueTeams, c.year).forEach((b) => {
        c.news.push(`📖 Recorde de temporada! ${b.label}: ${b.playerName} (${b.teamAbbr}) com ${b.value}.`);
      });

      const leadersSnap = snapshotLeaders(c.leagueTeams);

      const awards = computeSeasonAwards(c.leagueTeams, c.year);
      const rolloverNews = applyCareerRollover(c.leagueTeams, awards, c.allTimeLeaders); // também atualiza o Top 100 histórico
      c.news.push(...rolloverNews);
      const awardCard = (a) => a && { playerId: a.p.id, name: a.p.name, pos: a.p.pos, ovr: a.p.ovr, teamAbbr: a.t.abbr };
      c.lastSeasonAwards = {
        year: awards.year,
        mvp: awardCard(awards.mvp),
        opoy: awardCard(awards.opoy),
        dpoy: awardCard(awards.dpoy),
        oroy: awardCard(awards.oroy),
        droy: awardCard(awards.droy),
        coachOfYear: awards.coachOfYear && { teamAbbr: awards.coachOfYear.abbr, wins: awards.coachOfYear.wins, losses: awards.coachOfYear.losses },
        allPro: Object.fromEntries(Object.entries(awards.allPro).map(([pos, a]) => [pos, awardCard(a)])),
      };
      archiveSeason(c, leadersSnap);
      // A little recognition where it's due: the front office notices when
      // your own team produces hardware.
      const myTeam = c.leagueTeams[c.teamAbbr];
      const myAwardWinner = [awards.mvp, awards.opoy, awards.dpoy, awards.oroy, awards.droy].some((a) => a?.t.abbr === c.teamAbbr);
      if (myAwardWinner) { myTeam.ownerConfidence = Math.min(100, myTeam.ownerConfidence + 5); myTeam.fanSupport = Math.min(100, myTeam.fanSupport + 5); }
      if (awards.coachOfYear?.abbr === c.teamAbbr) { myTeam.ownerConfidence = Math.min(100, myTeam.ownerConfidence + 8); c.news.push(`📋 Você foi reconhecido como o técnico do ano de ${c.year}!`); }

      const { news: retirementNews, retirees } = retireAndRefreshLeague(c.leagueTeams, c.year + 1, c.allTimeLeaders); // marca isRetired nos líderes históricos
      markRetiredLeaders(c); // varredura de segurança: quem não está em elenco/mercado/draft também vira isRetired
      c.news.push(...retirementNews.slice(0, 5));
      c.news.push(...applyCoachDevelopment(c, mulberry32(seedFromString(c.id + "-mentor-" + c.year))));
      sortAIDepth(c);
      if (!c.hallOfFame) c.hallOfFame = [];
      retirees.filter((r) => r.legendary).forEach((r) => c.hallOfFame.push({ ...r, retiredYear: c.year }));

      Object.values(c.leagueTeams).forEach((t) => { t.wins = 0; t.losses = 0; t.ties = 0; t.pf = 0; t.pa = 0; });
      resetSeasonStats(c.leagueTeams);
      c.schedule = buildSchedule(c.leagueTeams);
      c.year += 1;
      c.week = 1;
      c.phase = "season";
      ensureEventsState(c);
      c.pendingEvents = rollWeeklyEvents(c, mulberry32(seedFromString(c.id + "-ev-" + c.year + "-1")));
      c.lastGame = null;
      c.playoffs = null;
      c.draftClass = null;
      c.draftPickIndex = 0;
      c.news.push(`Temporada ${c.year} começando!`);
      return c;
    });
    setScreen("hub");
  }

  // Simula a temporada inteira (semanas + playoffs) até chegar na offseason.
  // A cada semana reordena o depth chart do seu time (autoSortDepth) e descarta
  // coletivas/eventos de imprensa. Para sozinha só se você for demitido.
  function simSeason() {
    if (simProgress || !career || career.phase === "offseason" || career.pendingEvents?.length) return;
    let c = structuredClone(career);
    autoSortDepth(c.leagueTeams[c.teamAbbr]);
    let done = 0;
    const total = (c.phase === "season" ? 18 - (c.week - 1) : 0) + 5;
    const finish = () => { setCareer(c); setSimProgress(null); setScreen("hub"); };
    const step = () => {
      if (c.phase === "offseason" || c.leagueTeams[c.teamAbbr].ownerConfidence <= 0) return finish();
      c = c.phase === "season" ? advanceWeek(c) : advancePlayoffRound(c);
      c.pressPending = null;
      c.pendingEvents = []; // na simulação em lote os eventos são descartados
      if (c.lastGame && !c.lastGame.resolved) {
        if (c.lastGame.newsLine) c.news.push(c.lastGame.newsLine);
        c.lastGame.resolved = true;
      }
      autoSortDepth(c.leagueTeams[c.teamAbbr]);
      done++;
      setSimProgress({
        label: c.phase === "season" ? `Semana ${c.week}` : (c.playoffs?.roundLabel || ""),
        pct: Math.min(99, Math.round((done / total) * 100)),
      });
      setTimeout(step, 0);
    };
    setSimProgress({ label: "Iniciando…", pct: 0 });
    setTimeout(step, 0);
  }

  function onHubAction() {
    if (career.phase === "season") playWeek();
    else if (career.phase === "playoffs") simPlayoffRound();
    else if (career.phase === "offseason") advanceToNextSeason();
  }

  function advanceGameReveal() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const g = c.lastGame;
      if (!g) return c;
      const newCount = Math.min(g.log.length, (c.gameRevealCount || 6) + 6);
      c.gameRevealCount = newCount;
      if (newCount >= g.log.length && !g.resolved) {
        g.resolved = true;
        if (g.newsLine) c.news.push(g.newsLine);
        if (g.pressKey) c.pressPending = g.pressKey;
      }
      return c;
    });
  }

  const HIGHLIGHT_KINDS = new Set(["touchdown", "interception", "fumble", "sack", "fieldgoal-good", "injury"]);
  function isHighlightPlay(p) {
    if (!p) return false;
    if (HIGHLIGHT_KINDS.has(p.kind)) return true;
    if ((p.kind === "run" || p.kind === "pass") && (p.yards || 0) >= 20) return true;
    return false;
  }
  function advanceGameToHighlight() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const g = c.lastGame;
      if (!g) return c;
      const from = c.gameRevealCount || 6;
      let idx = from;
      while (idx < g.plays.length && !isHighlightPlay(g.plays[idx])) idx++;
      const newCount = Math.min(g.log.length, Math.max(from, idx + 1));
      c.gameRevealCount = newCount;
      if (newCount >= g.log.length && !g.resolved) {
        g.resolved = true;
        if (g.newsLine) c.news.push(g.newsLine);
        if (g.pressKey) c.pressPending = g.pressKey;
      }
      return c;
    });
  }

  function simGameToEnd() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const g = c.lastGame;
      if (!g) return c;
      c.gameRevealCount = g.log.length;
      if (!g.resolved) {
        g.resolved = true;
        if (g.newsLine) c.news.push(g.newsLine);
        if (g.pressKey) c.pressPending = g.pressKey;
      }
      return c;
    });
  }

  // Extends an expiring player on the terms they ask (shaped by morale).
  // years is stored +1 because the season whose rollover is pending counts.
  function extendContract(playerId) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      const p = t.roster.find((x) => x.id === playerId);
      if (!p) return c;
      const ask = extensionAsk(p);
      if (!ask.willing) return c;
      if (capUsed(t.roster) - p.salary + ask.salary > CAP) return c;
      p.salary = ask.salary;
      p.years = ask.years + 1;
      p.morale = clamp((p.morale ?? 65) + 6, 0, 100);
      c.news.push(`✍️ ${p.name} renovou por ${ask.years} ano(s) — $${ask.salary.toFixed(1)}M/ano.`);
      return c;
    });
  }

  // Lets an expiring player walk to the free-agent pool.
  function releaseExpiring(playerId) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      const rng = mulberry32(seedFromString(c.id + "-release-" + playerId));
      const fa = releaseToMarket(t, playerId, c.freeAgentPool, rng);
      if (fa) c.news.push(`${fa.name} não renovou e foi para o mercado.`);
      return c;
    });
  }

  function choosePress(opt) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      t.ownerConfidence = clamp(t.ownerConfidence + (opt.owner || 0), 0, 100);
      t.fanSupport = clamp(t.fanSupport + (opt.fan || 0), 0, 100);
      if (opt.moraleTarget) {
        const target = t.roster.find((p) => p.id === opt.moraleTarget);
        if (target) target.morale = clamp((target.morale ?? 65) + (opt.moraleDelta || 0), 0, 100);
      }
      c.pressPending = null;
      return c;
    });
  }

  function autoSortDepthChart() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      autoSortDepth(c.leagueTeams[c.teamAbbr]);
      return c;
    });
  }

  function swapSlot(fromSlot) {
    if (!swapFrom) { setSwapFrom(fromSlot); return; }
    if (swapFrom === fromSlot) { setSwapFrom(null); return; }
    setCareer((prev) => {
      const c = structuredClone(prev);
      const t = c.leagueTeams[c.teamAbbr];
      const pA = t.roster.find((p) => p.slot === swapFrom);
      const pB = t.roster.find((p) => p.slot === fromSlot);
      if (pA && pB && pA.pos === pB.pos) { pA.slot = fromSlot; pB.slot = swapFrom; }
      return c;
    });
    setSwapFrom(null);
  }

  // Logs the outcome of a batch of signings resolved this tick, phrased
  // differently depending on whether the user's team won, lost, or wasn't
  // involved in that particular negotiation.
  function logSignings(c, signings) {
    signings.forEach((s) => {
      const t = c.leagueTeams[s.teamAbbr];
      const beatUser = s.beatenTeams?.includes(c.teamAbbr);
      if (s.teamAbbr === c.teamAbbr) {
        const beat = s.beatenTeams?.length ? ` (superou proposta de ${s.beatenTeams.join(", ")})` : "";
        c.news.push(`Contratado: ${s.name} (${s.pos}, OVR ${s.ovr}) ${s.reason}${beat}.`);
      } else {
        c.news.push(`Free agency: ${s.name} (${s.pos}, OVR ${s.ovr}) assinou com o ${t.city} ${t.name} ${s.reason}${beatUser ? " — sua proposta não foi suficiente" : ""}.`);
      }
    });
    c.freeAgencyActivity = [...signings, ...(c.freeAgencyActivity || [])].slice(0, 20);
    sortAIDepth(c);
  }

  // Puts a contract offer (years + AAV) on the table for a free agent. This
  // no longer signs them outright — it enters them into the same bidding
  // war every rival team is fighting. A dominant offer can close on the
  // spot; a merely competitive one sits and waits for the market to move.
  function makeFreeAgentOffer(fa, offer) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      if (!c.faMarket) c.faMarket = {};
      const player = c.freeAgentPool.find((p) => p.id === fa.id);
      if (!player) return c;
      const t = c.leagueTeams[c.teamAbbr];
      if (CAP - capUsed(t.roster) < offer.salary) return c;
      const rng = mulberry32(seedFromString(c.id + "-fa-offer-" + player.id + "-" + Date.now()));
      submitUserOffer(c.faMarket, player, c.teamAbbr, offer, rng);
      // The rest of the league doesn't stand still while you negotiate.
      aiOffersWave(c.leagueTeams, c.freeAgentPool, c.faMarket, rng, { excludeAbbr: c.teamAbbr, needsPerTeam: 3 });
      const signings = resolveMarket(c.leagueTeams, c.freeAgentPool, c.faMarket, rng);
      logSignings(c, signings);
      return c;
    });
  }

  function withdrawFreeAgentOffer(playerId) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      if (c.faMarket) withdrawUserOffer(c.faMarket, playerId, c.teamAbbr);
      return c;
    });
  }

  function advanceFreeAgencyMarket() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      if (!c.faMarket) c.faMarket = {};
      const faRng = mulberry32(seedFromString(c.id + "-fa-advance-" + c.freeAgentPool.length + "-" + Date.now()));
      aiOffersWave(c.leagueTeams, c.freeAgentPool, c.faMarket, faRng, { excludeAbbr: c.teamAbbr, needsPerTeam: 3 });
      const signings = resolveMarket(c.leagueTeams, c.freeAgentPool, c.faMarket, faRng);
      logSignings(c, signings);
      return c;
    });
  }

  function draftPick(prospect) {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const order = c.draftOrder;
      const draftYear = c.year + 1;
      const round = Math.floor(c.draftPickIndex / order.length) + 1;
      const pickInRound = (c.draftPickIndex % order.length) + 1;
      const teamAbbr = resolvePickOwner(c.futurePicks, order, draftYear, round, c.draftPickIndex);
      const t = c.leagueTeams[teamAbbr];
      const slot = findSlotForRookie(t.roster, prospect.pos);
      insertPlayer(t.roster, slot, { ...prospect, slot });
      c.draftClass = c.draftClass.filter((p) => p.id !== prospect.id);
      consumePick(c.futurePicks, order, draftYear, round, c.draftPickIndex);
      if (teamAbbr === c.teamAbbr) c.news.push(`Draft: ${teamAbbr} seleciona ${prospect.name} (${prospect.pos}).`);
      if (!c.draftHistory) c.draftHistory = [];
      c.draftHistory.push({ round, pick: pickInRound, teamAbbr, name: prospect.name, pos: prospect.pos, ovr: prospect.ovr, projectedRound: prospect.draftRound });
      c.draftPickIndex += 1;
      const gradeRng = mulberry32(seedFromString(c.id + "-draftgrade"));
      maybeFireDraftGrade(c, gradeRng);
      return c;
    });
  }

  function simToMyPick() {
    setCareer((prev) => {
      const c = structuredClone(prev);
      const rng = mulberry32(seedFromString(c.id + "-draftauto" + c.draftPickIndex));
      const order = c.draftOrder;
      const draftYear = c.year + 1;
      const total = order.length * 7;
      if (!c.draftHistory) c.draftHistory = [];
      while (c.draftPickIndex < total) {
        const round = Math.floor(c.draftPickIndex / order.length) + 1;
        const pickInRound = (c.draftPickIndex % order.length) + 1;
        const teamAbbr = resolvePickOwner(c.futurePicks, order, draftYear, round, c.draftPickIndex);
        if (teamAbbr === c.teamAbbr) break;
        if (!c.draftClass.length) break;
        const t = c.leagueTeams[teamAbbr];
        const prospect = pickForTeamAI(rng, t, c.draftClass) || c.draftClass[0];
        const slot = findSlotForRookie(t.roster, prospect.pos);
        insertPlayer(t.roster, slot, { ...prospect, slot });
        c.draftHistory.push({ round, pick: pickInRound, teamAbbr, name: prospect.name, pos: prospect.pos, ovr: prospect.ovr, projectedRound: prospect.draftRound });
        c.draftClass = c.draftClass.filter((p) => p.id !== prospect.id);
        consumePick(c.futurePicks, order, draftYear, round, c.draftPickIndex);
        c.draftPickIndex += 1;
      }
      maybeFireDraftGrade(c, rng);
      sortAIDepth(c);
      return c;
    });
  }

  // A trade offer is any mix of players and future picks on both sides.
  // `mine`/`theirs` are { players: [...], picks: [...] }. The AI team's
  // verdict is recomputed here (not trusted from the UI) from its own
  // seat: position, age, talent and how much the roster actually needs it.
  function proposeTrade(mine, theirs, targetAbbr) {
    const verdict = evaluateTrade(career.leagueTeams, targetAbbr, mine, theirs, career.year);
    if (!verdict.fair) { alert("O outro time recusou: a proposta não vale o que eles estariam perdendo."); return; }
    setCareer((prev) => {
      const c = structuredClone(prev);
      const rng = mulberry32(seedFromString(c.id + "-trade-" + c.news.length));
      executeTrade(c, mine, theirs, targetAbbr, rng);

      const mineDesc = [...mine.players.map((p) => p.name), ...mine.picks.map(pickLabel)].join(", ") || "nada";
      const theirsDesc = [...theirs.players.map((p) => p.name), ...theirs.picks.map(pickLabel)].join(", ") || "nada";
      c.news.push(`Troca concluída com o ${targetAbbr}: você envia ${mineDesc} e recebe ${theirsDesc}.`);
      if (!c.tradeHistory) c.tradeHistory = [];
      c.tradeHistory.unshift({ year: c.year, targetAbbr, sent: mineDesc, received: theirsDesc });
      c.tradeHistory = c.tradeHistory.slice(0, 15);
      return c;
    });
  }

  // fired check
  useEffect(() => {
    if (career && myTeam && myTeam.ownerConfidence <= 0 && screen !== "fired") setScreen("fired");
  }, [career, myTeam, screen]);

  if (screen === "menu" || !career) {
    return screen === "newcareer"
      ? <NewCareerScreen onCreate={onCreateCareer} onBack={() => setScreen("menu")} />
      : <MenuScreen saves={saves} onNew={onNewCareer} onLoad={onLoadCareer} onDelete={onDeleteCareer} />;
  }

  if (screen === "fired") return <FiredScreen career={career} onRestart={onRestart} />;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 font-sans">
      <TopBar team={myTeam} career={career} />
      <div className="px-4 pt-4 max-w-lg mx-auto">
        {screen === "hub" && <HubScreen career={career} myTeam={myTeam} go={go} onPlayWeek={onHubAction} onSimPlayoffRound={onHubAction} onSimSeason={simSeason} onDismissAlert={onDismissAlert} onDismissNotice={onDismissNotice} onOpenTeam={openTeam} />}
        {screen === "roster" && <RosterScreen myTeam={myTeam} onOpenPlayer={(id) => openPlayer(id, myTeam.abbr)} />}
        {screen === "depth" && <DepthChartScreen myTeam={myTeam} onSwap={swapSlot} onAutoSort={autoSortDepthChart} />}
        {screen === "honors" && <HonorsScreen career={career} onBack={() => go("hub")} onOpenPlayer={openPlayer} />}
        {screen === "contracts" && <ContractsScreen myTeam={myTeam} onExtend={extendContract} onRelease={releaseExpiring} onBack={() => go("hub")} />}
        {screen === "staff" && <StaffScreen career={career} myTeam={myTeam} go={go} onFire={onFireCoach} onRenew={onRenewCoach} />}
        {screen === "coachmarket" && <CoachMarketScreen career={career} myTeam={myTeam} onHire={onHireCoach} go={go} />}
        {screen === "tactics" && <TacticsScreen myTeam={myTeam} tendencies={career.tendencies} onChange={(t) => setCareer((p) => ({ ...p, tendencies: t }))} />}
        {screen === "schedule" && <ScheduleScreen career={career} myTeam={myTeam} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />}
        {screen === "results" && <ResultsScreen career={career} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />}
        {screen === "history" && <HistoryScreen career={career} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />}
        {screen === "game" && <GameScreen career={career} myTeam={myTeam} go={go} onAdvance={advanceGameReveal} onSkipToHighlight={advanceGameToHighlight} onSimAll={simGameToEnd} />}
        {screen === "freeagency" && <FreeAgencyScreen career={career} myTeam={myTeam} onOffer={makeFreeAgentOffer} onOpenPlayer={openFreeAgent} onAdvanceMarket={advanceFreeAgencyMarket} />}
        {screen === "draft" && career.draftClass && <DraftScreen career={career} myTeam={myTeam} onDraftPick={draftPick} onSimToMyPick={simToMyPick} onOpenPlayer={openProspect} />}
        {screen === "trade" && <TradeScreen myTeam={myTeam} career={career} onTrade={proposeTrade} onOpenPlayer={openPlayer} />}
        {screen === "stats" && <StatsScreen career={career} myTeam={myTeam} onOpenPlayer={openPlayer} onOpenTeam={openTeam} />}
        {screen === "teamDetail" && detail?.type === "team" && <TeamDetailScreen abbr={detail.abbr} career={career} myTeam={myTeam} onBack={closeDetail} onOpenPlayer={openPlayer} />}
        {screen === "playerDetail" && detail?.type === "player" && <PlayerDetailScreen playerId={detail.playerId} teamAbbr={detail.teamAbbr} career={career} onBack={closeDetail} onOpenTeam={openTeam} onOpenPlayer={openPlayer} />}
        {screen === "playerDetail" && detail?.type === "freeagent" && <FreeAgentDetailScreen playerId={detail.playerId} career={career} myTeam={myTeam} onOffer={makeFreeAgentOffer} onWithdraw={withdrawFreeAgentOffer} onBack={closeDetail} />}
        {screen === "playerDetail" && detail?.type === "draft" && <ProspectDetailScreen playerId={detail.playerId} career={career} myTeam={myTeam} onBack={closeDetail} onDraftPick={(p) => { draftPick(p); closeDetail(); }} />}
      </div>
      <BottomNav screen={screen} go={go} hasUnwatchedGame={!!(career.lastGame && (career.gameRevealCount ?? 0) < career.lastGame.log.length)} />
      {career.pressPending && <PressModal event={career.pressPending} onChoose={choosePress} />}
      {!career.pressPending && career.pendingEvents?.[0] && <EventModal event={career.pendingEvents[0]} onChoose={onChooseEvent} />}
      {simProgress && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="w-64 text-center">
            <div className="text-sm mb-2">Simulando… {simProgress.label}</div>
            <div className="h-2 bg-white/10 rounded"><div className="h-2 bg-white rounded" style={{ width: simProgress.pct + "%" }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
