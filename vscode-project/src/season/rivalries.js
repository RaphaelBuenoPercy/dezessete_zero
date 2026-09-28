// ============================================================
// RIVALRIES & NEMESES
//
// Two lightweight, persistent trackers built entirely from games the
// user's team actually plays:
//   - career.rivalries[oppAbbr]: head-to-head record, streak, and whether
//     it's a division clash, a playoff grudge match, or just a team that's
//     had your number lately.
//   - career.nemeses: opposing players who've had big individual games
//     against you, most-frequent offender first.
// Both update every time the user's game resolves — regular season or
// playoffs — so the picture only gets richer over a long career.
// ============================================================

function ensureRivalry(rivalries, abbr) {
  if (!rivalries[abbr]) {
    rivalries[abbr] = { wins: 0, losses: 0, ties: 0, meetings: 0, playoffMeetings: 0, lastYear: null, lastResult: null, streak: 0, streakType: null };
  }
  return rivalries[abbr];
}

// Records one game's result into the ongoing series with `oppAbbr`.
function recordMeeting(rivalries, oppAbbr, myScore, oppScore, year, isPlayoff) {
  const r = ensureRivalry(rivalries, oppAbbr);
  r.meetings += 1;
  if (isPlayoff) r.playoffMeetings += 1;
  const result = myScore === oppScore ? "E" : myScore > oppScore ? "V" : "D";
  if (result === "V") r.wins += 1; else if (result === "D") r.losses += 1; else r.ties += 1;
  r.streak = r.streakType === result ? r.streak + 1 : 1;
  r.streakType = result;
  r.lastYear = year;
  r.lastResult = result;
  return r;
}

// How this rivalry reads right now — used both for badges/cards and to
// decide whether a game deserves rivalry-flavored press coverage.
function rivalryTier(r, isDivision) {
  if (!r) return isDivision ? { label: "Rival de divisão", color: "#38bdf8" } : null;
  if (r.playoffMeetings > 0) return { label: "Rivalidade de playoff", color: "#f87171" };
  if (isDivision && r.meetings >= 3 && Math.abs(r.wins - r.losses) <= 1) return { label: "Clássico de divisão", color: "#fbbf24" };
  if (isDivision) return { label: "Rival de divisão", color: "#38bdf8" };
  if (r.streak >= 3 && r.streakType === "V") return { label: "Domínio total", color: "#4ade80" };
  if (r.streak >= 3 && r.streakType === "D") return { label: "Pedra no sapato", color: "#f87171" };
  return null;
}

// A short "how the series stands" sentence for press-conference prompts.
function headToHeadLine(r, myAbbr) {
  if (!r || r.meetings === 0) return null;
  if (r.wins === r.losses) return `A série contra esse adversário está empatada em ${r.wins} a ${r.losses}`;
  const leading = r.wins > r.losses;
  return leading ? `Vocês lideram o confronto direto por ${r.wins} a ${r.losses}` : `O adversário lidera o confronto direto por ${r.losses} a ${r.wins}`;
}

// Standout opposing performances from one box-score list — the threshold
// for "this guy just wrecked us" and worth remembering.
function detectStandoutPerformances(boxScoreList) {
  const standouts = [];
  (boxScoreList || []).forEach((p) => {
    const s = p.stats || {};
    const tds = (s.receivingTD || 0) + (s.rushTD || 0);
    if (tds >= 2) standouts.push({ player: p, reason: `${tds} TDs contra você` });
    else if ((s.rushYards || 0) >= 120) standouts.push({ player: p, reason: `${s.rushYards} jardas de corrida contra você` });
    else if ((s.receivingYards || 0) >= 130) standouts.push({ player: p, reason: `${s.receivingYards} jardas recebidas contra você` });
    else if ((s.passYards || 0) >= 320) standouts.push({ player: p, reason: `${s.passYards} jardas aéreas contra você` });
    else if ((s.sacks || 0) >= 2) standouts.push({ player: p, reason: `${s.sacks} sacks em cima do seu QB` });
    else if ((s.interceptions || 0) >= 2) standouts.push({ player: p, reason: `${s.interceptions} interceptações contra você` });
  });
  return standouts;
}

// Folds this game's standouts into the running nemesis list, most games
// against you first, capped to keep it to the names that actually matter.
function updateNemeses(nemeses, standouts, oppAbbr, year) {
  const list = [...(nemeses || [])];
  standouts.forEach(({ player, reason }) => {
    const idx = list.findIndex((n) => n.playerId === player.id);
    if (idx >= 0) { list[idx].games += 1; list[idx].lastReason = reason; list[idx].lastYear = year; list[idx].teamAbbr = oppAbbr; }
    else list.push({ playerId: player.id, name: player.name, pos: player.pos, teamAbbr: oppAbbr, games: 1, lastReason: reason, lastYear: year });
  });
  return list.sort((a, b) => b.games - a.games).slice(0, 8);
}

export { ensureRivalry, recordMeeting, rivalryTier, headToHeadLine, detectStandoutPerformances, updateNemeses };
