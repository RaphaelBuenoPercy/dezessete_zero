import React, { useState, useMemo } from "react";
import { TEAM_META } from "../data/teams.js";
import { Card, Btn } from "../components/ui.jsx";

// The pre-career screens: pick a save, create a new one, and (if things
// go badly) the "you got fired" screen.

function MenuScreen({ saves, onNew, onLoad, onDelete }) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col items-center justify-center px-6 py-10">
      <div className="text-center mb-8">
        <div className="text-xs tracking-wide text-slate-500 mb-1">simulador de carreira</div>
        <h1 className="text-4xl font-black tracking-tight">GRIDIRON GM</h1>
        <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">
          Assuma o comando de um time da NFL. Escale o elenco, defina táticas, negocie na free agency, faça trocas, comande o draft e viva cada jogo na marra.
        </p>
      </div>
      <div className="w-full max-w-md space-y-3">
        <Btn className="w-full py-3" onClick={onNew}>Começar nova carreira</Btn>
        {saves.length > 0 && (
          <Card>
            <div className="text-xs text-slate-400 mb-2">Carreiras salvas</div>
            <div className="space-y-2">
              {saves.map((s) => {
                const tm = TEAM_META.find((t) => t.abbr === s.teamAbbr);
                return (
                  <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                    <button className="text-left" onClick={() => onLoad(s.id)}>
                      <div className="text-sm font-semibold">{s.coachName} — {tm?.city} {tm?.name}</div>
                      <div className="text-xs text-slate-500">{s.year} · Semana {s.week}</div>
                    </button>
                    <button className="text-slate-500 hover:text-red-400" onClick={() => onDelete(s.id)}>✕</button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
      <p className="text-[11px] text-slate-600 mt-8 max-w-sm text-center">
        Times e nomes de jogadores usados de forma ilustrativa para fins de simulação; elencos são aproximados e não refletem transações recentes. Projeto independente, sem afiliação com a NFL.
      </p>
    </div>
  );
}

function NewCareerScreen({ onCreate, onBack }) {
  const [name, setName] = useState("");
  const [teamAbbr, setTeamAbbr] = useState(null);
  const grouped = useMemo(() => {
    const byDiv = {};
    TEAM_META.forEach((t) => { const k = `${t.conf} ${t.div}`; byDiv[k] = byDiv[k] || []; byDiv[k].push(t); });
    return byDiv;
  }, []);
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 px-4 py-8 pb-24">
      <button onClick={onBack} className="text-slate-400 text-sm flex items-center gap-1 mb-4">← Voltar</button>
      <h2 className="text-2xl font-black mb-1">Nova carreira</h2>
      <p className="text-slate-400 text-sm mb-6">Escolha seu nome de técnico e o time que vai comandar.</p>
      <label className="text-xs text-slate-400">Nome do técnico</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ricardo Alves"
        className="w-full mt-1 mb-6 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-white/30" />
      <div className="space-y-5">
        {Object.entries(grouped).map(([div, teams]) => (
          <div key={div}>
            <div className="text-xs text-slate-500 mb-2">{div}</div>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button key={t.abbr} onClick={() => setTeamAbbr(t.abbr)}
                  className={`text-left rounded-md px-3 py-2 border ${teamAbbr === t.abbr ? "border-white" : "border-white/10"}`}
                  style={{ background: teamAbbr === t.abbr ? `linear-gradient(135deg, ${t.c1}cc, ${t.c2}66)` : "rgba(255,255,255,0.03)" }}>
                  <div className="text-sm font-bold">{t.city}</div>
                  <div className="text-xs text-slate-300">{t.name}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-[#0B1220] border-t border-white/10 p-4">
        <Btn className="w-full py-3" disabled={!name.trim() || !teamAbbr} onClick={() => onCreate(teamAbbr, name.trim())}>
          Assinar contrato
        </Btn>
      </div>
    </div>
  );
}


function FiredScreen({ career, onRestart }) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">📦</div>
      <h1 className="text-2xl font-black mb-2">Você foi demitido</h1>
      <p className="text-slate-400 mb-1 max-w-sm">A diretoria perdeu a confiança em {career.coachName} depois de {career.seasonsCoached} temporada(s) no comando do {career.teamAbbr}.</p>
      <Btn className="mt-6" onClick={onRestart}>Começar nova carreira</Btn>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */

export { MenuScreen, NewCareerScreen, FiredScreen };
