import React, { useState } from "react";
import { clamp } from "../lib/rng.js";
import { CAP } from "../data/teams.js";
import { capUsed } from "../engine/playerGen.js";
import { DEFAULT_PERSONNEL } from "../engine/simulation.js";
import { moraleLabel } from "../season/morale.js";
import { isExpiring, extensionAsk } from "../season/contracts.js";
import { Card, Btn, TeamLogo, PlayerRow } from "../components/ui.jsx";
import { CoachCard, ImpactRow } from "../components/CoachCard.jsx";
import { ROLE_LABEL } from "../engine/coachesGen.js";
import { staffImpact } from "../engine/staffEffects.js";

// Elenco, escalação (depth chart + formation diagram) e táticas — as
// três telas de gestão do próprio time.

/* ============================================================
   TACTICS
   ============================================================ */

// Ties the abstract sliders back to the user's actual personnel — cheap,
// derived entirely from attributes already on the roster, but it makes the
// tactics screen feel like it's reading *your* team instead of a generic
// settings panel.
function TacticalAdvice({ myTeam }) {
  const rb1 = myTeam.roster.find((p) => p.slot === "RB1"), rb2 = myTeam.roster.find((p) => p.slot === "RB2");
  const wr1 = myTeam.roster.find((p) => p.slot === "WR1"), wr3 = myTeam.roster.find((p) => p.slot === "WR3");
  const te1 = myTeam.roster.find((p) => p.slot === "TE1");
  const tips = [];
  if (rb1 && rb2 && rb2.attrs.SPD >= rb1.attrs.SPD - 3) tips.push(`${rb2.name} tem velocidade parecida com a de ${rb1.name} — dá pra dividir mais as corridas sem perder muito.`);
  if (rb1 && rb1.age >= 29) tips.push(`${rb1.name} já tem ${rb1.age} anos — mais rotação com o RB2 ajuda a poupar desgaste ao longo da temporada.`);
  if (wr1 && wr3 && wr1.ovr - wr3.ovr >= 15) tips.push(`${wr3.name} (WR3) é bem mais fraco que ${wr1.name} — talvez valha reduzir o 10 personnel.`);
  if (te1 && te1.attrs.RBK >= 78) tips.push(`${te1.name} bloqueia muito bem — 12 personnel tende a render bem com ele em campo.`);
  if (!tips.length) return null;
  return (
    <Card className="mb-3">
      <div className="text-sm font-semibold mb-2">💡 Sugestões pro seu elenco</div>
      <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
        {tips.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </Card>
  );
}

function TacticsScreen({ myTeam, tendencies, onChange }) {
  const personnel = tendencies.personnel ?? DEFAULT_PERSONNEL;
  const setPersonnel = (key, v) => {
    const others = ["p11", "p12", "p21"].filter((k) => k !== key).reduce((s, k) => s + (personnel[k] ?? 0), 0);
    const capped = clamp(v, 0, 100 - others);
    const p10 = clamp(100 - capped - others, 0, 100);
    onChange({ ...tendencies, personnel: { ...personnel, [key]: capped, p10 } });
  };
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Táticas</h2>
      <p className="text-xs text-slate-500 mb-4">Defina como seu time vai jogar nas próximas partidas.</p>
      {myTeam && <TacticalAdvice myTeam={myTeam} />}
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Estilo ofensivo</span><span className="text-slate-400">{Math.round(tendencies.passRatio*100)}% passe</span></div>
        <input type="range" min="20" max="85" value={Math.round(tendencies.passRatio*100)}
          onChange={(e) => onChange({ ...tendencies, passRatio: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Corrida pesada</span><span>Passe pesado</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Agressividade no 4º down / decisões</span><span className="text-slate-400">{Math.round(tendencies.aggressive*100)}%</span></div>
        <input type="range" min="0" max="100" value={Math.round(tendencies.aggressive*100)}
          onChange={(e) => onChange({ ...tendencies, aggressive: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>Conservador (chuta sempre)</span><span>Agressivo (vai pro tudo ou nada)</span></div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Rotação de corredores</span><span className="text-slate-400">{Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}% das corridas p/ RB2</span></div>
        <input type="range" min="0" max="50" value={Math.round((tendencies.rb2CarryShare ?? 0.2)*100)}
          onChange={(e) => onChange({ ...tendencies, rb2CarryShare: Number(e.target.value) / 100 })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB1 carrega tudo</span><span>Divide bem com o RB2</span></div>
      </Card>
      <Card className="mb-3">
        <div className="text-sm font-semibold mb-2">Personnel (agrupamentos em campo)</div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>11 (1 RB, 1 TE, 3 WR) — padrão</span><span className="text-slate-400">{personnel.p11}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p11} onChange={(e) => setPersonnel("p11", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>12 (1 RB, 2 TE, 2 WR) — reforça bloqueio</span><span className="text-slate-400">{personnel.p12}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p12} onChange={(e) => setPersonnel("p12", Number(e.target.value))} className="w-full" />
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1"><span>21 (2 RB, 1 TE, 2 WR) — pesado, corrida</span><span className="text-slate-400">{personnel.p21}%</span></div>
          <input type="range" min="0" max="100" value={personnel.p21} onChange={(e) => setPersonnel("p21", Number(e.target.value))} className="w-full" />
        </div>
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-white/10">
          <span>10 (1 RB, 0 TE, 4 WR) — formação leve/spread</span><span>{personnel.p10}% (resto automático)</span>
        </div>
      </Card>
      <Card className="mb-3">
        <div className="flex justify-between text-sm mb-1"><span>Formação ligeira (vazia) em 11 / 10 personnel</span><span className="text-slate-400">{tendencies.lightFormationShare ?? 20}%</span></div>
        <input type="range" min="0" max="60" value={tendencies.lightFormationShare ?? 20}
          onChange={(e) => onChange({ ...tendencies, lightFormationShare: Number(e.target.value) })} className="w-full" />
        <div className="flex justify-between text-[11px] text-slate-500"><span>RB sempre fica pra bloquear</span><span>RB solto como recebedor extra</span></div>
      </Card>
      <Card>
        <div className="text-sm text-slate-300 mb-2">Um perfil mais agressivo tenta mais 4ª descidas e FGs mais longos; um perfil conservador prioriza punt e field goals seguros.</div>
        <div className="text-sm text-slate-300 mb-2">Dar mais corridas ao RB2 poupa o RB1 (menos desgaste ao longo da temporada), mas o RB2 costuma render um pouco menos por jarda.</div>
        <div className="text-sm text-slate-300 mb-2">Personnel 12/21 traz um bloqueador extra (corrida mais forte, menos blitz sofrido), mas reduz as opções de rota — sem WR3 em campo. 10 personnel é o oposto: mais recebedores, porém corrida mais fraca.</div>
        <div className="text-sm text-slate-300">Formação vazia (só disponível em 11/10) manda o RB pra rota em vez de bloquear — mais um recebedor, mas qualquer blitz chega sem ninguém pra segurar.</div>
      </Card>
    </div>
  );
}


/* ============================================================
   CONTRACTS
   ============================================================ */

// Players in the final year of their deal. Each one asks for terms shaped
// by how they feel about the club — happy players discount, sour ones cost
// more, and a fed-up one won't sign at all. Anyone not extended leaves at
// the season rollover; "deixar ir" sends them to the market now, with a
// pull back toward your club.
function ContractsScreen({ myTeam, onExtend, onRelease, onBack }) {
  const expiring = myTeam.roster.filter(isExpiring).sort((a, b) => b.ovr - a.ovr);
  const used = capUsed(myTeam.roster);
  return (
    <div className="pb-24">
      {onBack && <button onClick={onBack} className="text-sm text-slate-400 mb-3">← Voltar</button>}
      <h2 className="text-xl font-black mb-1">Contratos</h2>
      <p className="text-xs text-slate-500 mb-4">
        Cap usado ${used.toFixed(1)}M / ${CAP}M · {expiring.length} contrato(s) no último ano. Quem não renovar sai ao fim da temporada.
      </p>
      {!expiring.length && <Card><div className="text-sm text-slate-400">Nenhum contrato vencendo agora — o elenco está estável. 👍</div></Card>}
      {expiring.map((p) => {
        const ask = extensionAsk(p);
        const mood = moraleLabel(p.morale ?? 65);
        const fits = ask.willing && used - p.salary + ask.salary <= CAP;
        return (
          <Card key={p.id} className="mb-3">
            <PlayerRow p={p} showMorale />
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-500">Moral: <span style={{ color: mood.color }} className="font-semibold">{mood.label}</span></span>
              {ask.willing
                ? <span className="text-slate-300">Pede <span className="font-bold">${ask.salary.toFixed(1)}M</span> · {ask.years} ano(s)</span>
                : <span className="text-red-400 font-semibold">Recusa renovar</span>}
            </div>
            {ask.willing && ask.note && <div className="text-[11px] text-slate-500 mt-1">{ask.note}</div>}
            {!ask.willing && <div className="text-[11px] text-red-400/80 mt-1">{ask.reason}</div>}
            {ask.willing && !fits && <div className="text-[11px] text-amber-400 mt-1">Sem espaço no cap pra esse contrato.</div>}
            <div className="flex gap-2 mt-3">
              <Btn className="flex-1" disabled={!fits} onClick={() => onExtend(p.id)}>Renovar</Btn>
              <Btn variant="ghost" onClick={() => onRelease(p.id)}>Deixar ir</Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   SCHEDULE / STANDINGS / PLAYOFFS
   ============================================================ */



/* ============================================================
   COMISSÃO TÉCNICA (coordenadores)
   ============================================================ */
function StaffScreen({ career, myTeam, go, onFire, onRenew }) {
  const [msg, setMsg] = useState("");
  const offseason = career.phase === "offseason";
  const impact = staffImpact(myTeam.roster, myTeam.coaches);
  const hires = (career.hcHires || []).slice(-4).reverse();
  const act = (fn, role) => { const r = fn(role); setMsg(r?.msg || ""); };
  return (
    <div className="pb-24">
      <h2 className="text-xl font-black mb-1">Comissão técnica</h2>
      <div className="text-xs text-slate-500 mb-3">Você é o Head Coach. Os coordenadores dão bônus nos atributos durante os jogos (o OVR guardado dos jogadores não muda). O nível é reputação: o rendimento real é imprevisível.</div>
      {Object.keys(impact).some((k) => Math.abs(impact[k]) >= 0.1) && <Card className="mb-3"><ImpactRow impact={impact} /></Card>}
      {msg && <div className="text-xs text-amber-300 mb-2">{msg}</div>}
      {["OC", "DC", "SC"].map((role) => {
        const co = myTeam.coaches?.[role];
        if (!co) {
          return (
            <Card key={role} className="mb-3 border-red-400/30">
              <div className="font-semibold text-sm mb-1">{ROLE_LABEL[role]}: vaga em aberto</div>
              <div className="text-xs text-slate-400 mb-3">Sem coordenador você joga sem bônus de esquema nessa área.</div>
              <Btn className="w-full" onClick={() => go("coachmarket")}>Ir ao mercado de técnicos</Btn>
            </Card>
          );
        }
        return (
          <CoachCard key={role} coach={co}>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ghost" disabled={co.years > 2} onClick={() => act(onRenew, role)}>Renovar +2 anos</Btn>
              <Btn variant="danger" disabled={!offseason} onClick={() => act(onFire, role)}>Dispensar</Btn>
            </div>
            {co.years <= 1 && <div className="text-[10px] text-amber-300 mt-1.5">⚠️ Contrato acabando: renove, ou ele vai ao mercado.</div>}
            {!offseason && <div className="text-[10px] text-slate-500 mt-1.5">Só dá para dispensar na offseason.</div>}
          </CoachCard>
        );
      })}
      <Btn variant="ghost" className="w-full mb-3" onClick={() => go("coachmarket")}>Mercado de técnicos</Btn>
      {hires.length > 0 && (
        <Card>
          <div className="text-xs text-slate-400 mb-2">Carrossel recente: coordenadores promovidos a Head Coach</div>
          {hires.map((h, i) => (
            <div key={i} className="text-xs text-slate-300 py-1 border-b border-white/5 last:border-0">{h.year}: {h.name} ({h.role}, ex-{h.fromTeam}) → {h.teamAbbr}</div>
          ))}
        </Card>
      )}
    </div>
  );
}

// Elenco e escalação foram redesenhados em LineupScreens.jsx; re-exportados aqui para manter os imports do App.
export { RosterScreen, DepthChartScreen } from "./LineupScreens.jsx";
export { TacticsScreen, ContractsScreen, StaffScreen };