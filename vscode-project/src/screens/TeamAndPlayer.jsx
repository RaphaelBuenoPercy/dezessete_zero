import React from "react";
import { CAP } from "../data/teams.js";
import { SUB_ATTRS } from "../data/rosterSlots.js";
import { capUsed } from "../engine/playerGen.js";
import { Bar, Card, TeamLogo, PosPill, primaryStatLine, devLabel } from "../components/ui.jsx";
import { moraleLabel } from "../season/morale.js";
import { rivalryTier, headToHeadLine } from "../season/rivalries.js";
import { teamIdentity } from "../season/teamIdentity.js";

// Full-page detail views for a team and for a player already on a roster.

function TeamDetailScreen({ abbr, career, myTeam, onBack, onOpenPlayer }) {
  const team = career.leagueTeams[abbr];
  if (!team) return <div className="pb-24"><button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button><Card>Time não encontrado.</Card></div>;
  const isMine = abbr === myTeam.abbr;
  const identity = teamIdentity(abbr, team.city);

  const upcoming = [];
  career.schedule.forEach((wk, wi) => {
    const g = wk.find((g) => g.home === abbr || g.away === abbr);
    if (g && g.homeScore === undefined && upcoming.length < 5) upcoming.push({ week: wi + 1, game: g });
  });
  const played = [];
  career.schedule.forEach((wk, wi) => {
    const g = wk.find((g) => g.home === abbr || g.away === abbr);
    if (g && g.homeScore !== undefined) played.push({ week: wi + 1, game: g });
  });
  const last5 = played.slice(-5).reverse();

  let streak = 0, streakType = null;
  for (let i = played.length - 1; i >= 0; i--) {
    const g = played[i].game;
    const my = g.home === abbr ? g.homeScore : g.awayScore;
    const opp = g.home === abbr ? g.awayScore : g.homeScore;
    const type = my === opp ? "E" : my > opp ? "V" : "D";
    if (streak === 0) { streakType = type; streak = 1; }
    else if (type === streakType) streak++;
    else break;
  }
  const bestWin = played.reduce((best, p) => {
    const g = p.game;
    const my = g.home === abbr ? g.homeScore : g.awayScore;
    const opp = g.home === abbr ? g.awayScore : g.homeScore;
    const oppAbbr = g.home === abbr ? g.away : g.home;
    const margin = my - opp;
    return margin > (best?.margin ?? -999) ? { margin, my, opp, oppAbbr } : best;
  }, null);
  const rivals = Object.values(career.leagueTeams).filter((t) => t.abbr !== abbr && t.conf === team.conf && t.div === team.div);
  const rivalRecord = career.rivalries?.[abbr];
  const isDivisionRival = myTeam.conf === team.conf && myTeam.div === team.div;
  const rivalTierRead = rivalRecord ? rivalryTier(rivalRecord, isDivisionRival) : null;
  const h2hLine = rivalRecord ? headToHeadLine(rivalRecord, myTeam.abbr) : null;
  const topPlayers = [...team.roster].sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  const capLeft = (CAP - capUsed(team.roster)).toFixed(1);

  return (
    <div className="pb-24">
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
      <div className="flex items-center gap-3 mb-4">
        <TeamLogo abbr={abbr} size={56} />
        <div>
          <div className="text-2xl font-black leading-tight">{team.city} {team.name}</div>
          <div className="text-xs text-sky-400 italic">{identity.fanNickname}</div>
          <div className="text-xs text-slate-500">{team.conf} {team.div} · {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}{isMine ? " · Seu time" : ""}</div>
        </div>
      </div>
      <Card className="mb-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-slate-500 text-[11px]">Pontos feitos</div><div className="font-bold text-lg">{team.pf}</div></div>
          <div><div className="text-slate-500 text-[11px]">Pontos sofridos</div><div className="font-bold text-lg">{team.pa}</div></div>
          <div><div className="text-slate-500 text-[11px]">Sequência</div><div className="font-bold text-lg">{streak ? `${streakType}${streak}` : "—"}</div></div>
        </div>
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Próximos jogos</div>
        {upcoming.length === 0 && <div className="text-xs text-slate-500">Sem jogos futuros na temporada.</div>}
        {upcoming.map(({ week, game }) => {
          const opp = game.home === abbr ? game.away : game.home;
          const home = game.home === abbr;
          return (
            <div key={week} className="flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-slate-500 text-xs w-16">Semana {week}</span>
              <span className="text-slate-400 text-xs">{home ? "vs" : "@"}</span>
              <TeamLogo abbr={opp} size={18} /><span>{opp}</span>
            </div>
          );
        })}
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Últimos resultados</div>
        {last5.length === 0 && <div className="text-xs text-slate-500">Nenhum jogo disputado ainda.</div>}
        {last5.map(({ week, game }) => {
          const home = game.home === abbr;
          const my = home ? game.homeScore : game.awayScore;
          const opp = home ? game.awayScore : game.homeScore;
          const oppAbbr = home ? game.away : game.home;
          const won = my > opp, tie = my === opp;
          return (
            <div key={week} className="flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0">
              <span className={`text-xs font-black w-4 ${won ? "text-green-400" : tie ? "text-slate-400" : "text-red-400"}`}>{won ? "V" : tie ? "E" : "D"}</span>
              <TeamLogo abbr={oppAbbr} size={18} /><span className="flex-1">{oppAbbr}</span>
              <span className="tabular-nums text-slate-400">{my}-{opp}</span>
            </div>
          );
        })}
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Principais jogadores</div>
        {topPlayers.map((p) => (
          <button key={p.id} onClick={() => onOpenPlayer(p.id, abbr)} className="w-full flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0 text-left hover:text-sky-300">
            <span className="flex items-center gap-2"><PosPill pos={p.pos} />{p.name}</span>
            <span className="text-slate-400 tabular-nums">{p.ovr} OVR</span>
          </button>
        ))}
      </Card>
      {!isMine && rivalRecord && (
        <Card className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold">🔥 Confronto direto</div>
            {rivalTierRead && <span className="text-xs font-semibold" style={{ color: rivalTierRead.color }}>{rivalTierRead.label}</span>}
          </div>
          <div className="text-sm text-slate-300">{rivalRecord.wins}-{rivalRecord.losses}{rivalRecord.ties ? `-${rivalRecord.ties}` : ""} <span className="text-slate-500 text-xs">({rivalRecord.meetings} confronto(s){rivalRecord.playoffMeetings > 0 ? `, ${rivalRecord.playoffMeetings} nos playoffs` : ""})</span></div>
          {h2hLine && <div className="text-xs text-slate-500 mt-1">{h2hLine}.</div>}
        </Card>
      )}
      <Card>
        <div className="text-sm font-semibold mb-2">Curiosidades</div>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Mascote: <span className="text-slate-200">{team.city} {identity.mascot}</span> · Estádio: <span className="text-slate-200">{identity.stadiumName}</span></li>
          <li>Grito de guerra da torcida: <span className="text-slate-200 italic">"{identity.chant}"</span></li>
          <li>Esquema defensivo: <span className="text-slate-200">{team.scheme}</span></li>
          <li>Cap disponível: <span className="text-slate-200">${capLeft}M</span> de ${CAP}M</li>
          <li>Confiança do dono: <span className="text-slate-200">{team.ownerConfidence}/100</span> · Torcida: <span className="text-slate-200">{team.fanSupport}/100</span></li>
          {bestWin && <li>Maior vitória da temporada: <span className="text-slate-200">{bestWin.my}-{bestWin.opp} vs {bestWin.oppAbbr}</span></li>}
          {rivals.length > 0 && <li>Rivais de divisão: <span className="text-slate-200">{rivals.map((r) => r.abbr).join(", ")}</span></li>}
        </ul>
      </Card>
    </div>
  );
}

/* ============================================================
   PLAYER DETAIL PAGE
   ============================================================ */
function PlayerDetailScreen({ playerId, teamAbbr, career, onBack, onOpenTeam, onOpenPlayer }) {
  const team = career.leagueTeams[teamAbbr];
  const player = team?.roster.find((p) => p.id === playerId);
  if (!player) {
    return (
      <div className="pb-24">
        <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
        <Card><div className="text-sm text-slate-400">Jogador não encontrado — pode ter sido cortado ou trocado desde então.</div></Card>
      </div>
    );
  }
  const subAttrs = SUB_ATTRS[player.pos] || [];
  const line = primaryStatLine(player);
  const careerLine = primaryStatLine({ pos: player.pos, seasonStats: player.careerStats });
  const classmate = player.rookieYear ? Object.values(career.leagueTeams)
    .flatMap((t) => t.roster.filter((p) => p.rookieYear === player.rookieYear && p.pos === player.pos && p.id !== player.id).map((p) => ({ p, teamAbbr: t.abbr })))
    .sort((a, b) => b.p.ovr - a.p.ovr)[0] : null;
  const upcoming = [];
  career.schedule.forEach((wk, wi) => {
    const g = wk.find((g) => g.home === teamAbbr || g.away === teamAbbr);
    if (g && g.homeScore === undefined && upcoming.length < 3) upcoming.push({ week: wi + 1, game: g });
  });

  return (
    <div className="pb-24">
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>
      <div className="flex items-center gap-3 mb-4">
        <TeamLogo abbr={teamAbbr} size={48} />
        <div>
          <div className="text-2xl font-black leading-tight">{player.name}</div>
          {player.nickname && <div className="text-xs text-sky-400 font-semibold italic mb-0.5">"{player.nickname}"</div>}
          <button onClick={() => onOpenTeam(teamAbbr)} className="text-xs text-slate-500 hover:text-slate-300 hover:underline">{team.city} {team.name}</button>
        </div>
      </div>
      <Card className="mb-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><div className="text-slate-500 text-[11px]">Posição</div><div className="mt-0.5"><PosPill pos={player.pos} /></div></div>
          <div><div className="text-slate-500 text-[11px]">Overall</div><div className="font-bold text-lg">{player.ovr}</div></div>
          <div><div className="text-slate-500 text-[11px]">Idade</div><div className="font-bold text-lg">{player.age}</div></div>
          <div><div className="text-slate-500 text-[11px]">Salário</div><div className="font-bold text-lg">${player.salary.toFixed(1)}M</div></div>
        </div>
      </Card>
      {subAttrs.length === 2 && (
        <Card className="mb-3">
          <div className="text-sm font-semibold mb-2">Atributos</div>
          {subAttrs.map((a) => (
            <div key={a} className="mb-2 last:mb-0">
              <div className="flex justify-between text-xs mb-1"><span>{a}</span><span>{player.attrs[a]}</span></div>
              <Bar value={player.attrs[a]} max={99} color="#38bdf8" />
            </div>
          ))}
        </Card>
      )}
      <Card className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold">Moral</div>
          <span className="text-xs font-semibold" style={{ color: moraleLabel(player.morale ?? 65).color }}>{moraleLabel(player.morale ?? 65).label}</span>
        </div>
        <Bar value={player.morale ?? 65} max={100} color={moraleLabel(player.morale ?? 65).color} />
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Estatísticas da temporada</div>
        {line ? <div className="text-sm text-slate-300">{line}</div> : <div className="text-xs text-slate-500">Sem estatísticas registradas ainda.</div>}
      </Card>
      {(player.seasonsPlayed > 0 || player.accolades?.length > 0) && (
        <Card className="mb-3">
          <div className="text-sm font-semibold mb-2">Carreira</div>
          <div className="text-xs text-slate-500 mb-2">{player.seasonsPlayed || 0} temporada(s) na liga.</div>
          {careerLine ? <div className="text-sm text-slate-300 mb-2">{careerLine}</div> : null}
          {player.accolades?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {player.accolades.map((a, i) => (
                <span key={i} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">🏆 {a}</span>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Próximos jogos do time</div>
        {upcoming.length === 0 && <div className="text-xs text-slate-500">Sem jogos futuros na temporada.</div>}
        {upcoming.map(({ week, game }) => {
          const opp = game.home === teamAbbr ? game.away : game.home;
          const home = game.home === teamAbbr;
          return (
            <div key={week} className="flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-slate-500 text-xs w-16">Semana {week}</span>
              <span className="text-slate-400 text-xs">{home ? "vs" : "@"}</span>
              <TeamLogo abbr={opp} size={16} /><span>{opp}</span>
            </div>
          );
        })}
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-2">Curiosidades</div>
        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Perfil de desenvolvimento: <span className="text-slate-200">{devLabel(player.dev)}</span></li>
          <li>Contrato: <span className="text-slate-200">{player.years} ano(s) restante(s)</span></li>
          {player.injuredWeeks > 0 && <li className="text-red-400 font-semibold">Lesionado — {player.injuredWeeks} semana(s) restantes</li>}
          {player.injuryHistory?.length > 0 && (
            <li>Histórico de lesões: <span className="text-slate-200">{player.injuryHistory.length} na carreira</span>{player.injuryHistory.length >= 4 && <span className="text-amber-400 font-semibold"> · propenso a lesões</span>}</li>
          )}
          {classmate && (
            <li>
              Colega de classe ({player.rookieYear}): <button onClick={() => (onOpenPlayer ? onOpenPlayer(classmate.p.id, classmate.teamAbbr) : onOpenTeam(classmate.teamAbbr))} className="text-slate-200 hover:text-sky-300 hover:underline">{classmate.p.name}</button>
              <span className="text-slate-500"> ({classmate.p.ovr} OVR{classmate.p.ovr !== player.ovr ? `, ${classmate.p.ovr > player.ovr ? "à frente" : "atrás"}` : ""})</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}


export { TeamDetailScreen, PlayerDetailScreen };
