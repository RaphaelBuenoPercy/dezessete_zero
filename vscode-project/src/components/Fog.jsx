import React, { useState } from "react";
import { Card, Bar, OvrBadge } from "./ui.jsx";
import { SUB_ATTRS, ATTR_LABELS } from "../data/rosterSlots.js";
import { SCOUT_ACTIONS, revealOf, fogRead, traitKnown, traitInfo } from "../season/fog.js";

// Peças de interface do Fog of War do draft.

// OVR do prospect: faixa embaçada (ex.: "68–84") até o scouting revelar tudo.
function FogOvr({ career, p, size = 40 }) {
  const f = fogRead(career, p);
  if (f.exact) return <OvrBadge ovr={p.ovr} size={size} />;
  const color = f.mid >= 85 ? "#4ade80" : f.mid >= 70 ? "#fbbf24" : "#94a3b8";
  return (
    <div className="rounded-lg flex flex-col items-center justify-center shrink-0 border"
      style={{ width: size, height: size, borderColor: color + "55", background: color + "1a" }}>
      <div className="font-black tabular-nums leading-none" style={{ color, fontSize: size * 0.24 }}>{f.lo}–{f.hi}</div>
      <div className="text-[8px] text-slate-500 uppercase tracking-wide leading-none mt-1">ovr ?</div>
    </div>
  );
}

// Atributos: só os revelados têm valor; os demais aparecem como "??".
function FogAttrBars({ career, p, top }) {
  const rev = new Set(revealOf(career, p.id).keys);
  let keys = (SUB_ATTRS[p.pos] || []).slice();
  keys.sort((a, b) => (rev.has(b) - rev.has(a)) || (rev.has(a) && rev.has(b) ? p.attrs[b] - p.attrs[a] : 0));
  if (top) keys = keys.slice(0, top);
  if (!keys.length) return null;
  return (
    <div className={`grid ${keys.length <= 4 ? "grid-cols-2" : "grid-cols-3"} gap-x-3 gap-y-1.5 mt-1.5`}>
      {keys.map((k) => (
        <div key={k} title={ATTR_LABELS[k] || k}>
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
            <span>{k}</span><span className="tabular-nums">{rev.has(k) ? p.attrs[k] : "??"}</span>
          </div>
          {rev.has(k) ? <Bar value={p.attrs[k]} max={99} color="#38bdf8" /> : <div className="h-1.5 w-full rounded-full border border-dashed border-white/15" />}
        </div>
      ))}
    </div>
  );
}

function TraitLine({ career, p }) {
  if (!traitKnown(career, p)) return <div className="text-[11px] text-slate-500 mt-1">🧠 Perfil pessoal: não investigado</div>;
  const t = traitInfo(p);
  return <div className="text-[11px] mt-1" style={{ color: t.color }}>🧠 {t.label} <span className="text-slate-500">· {t.desc}</span></div>;
}

// Painel de ações de scouting para um prospect.
function ScoutPanel({ career, p, onScout }) {
  const [msg, setMsg] = useState("");
  const pts = career.scouting?.points ?? 0, total = career.scouting?.total ?? 0;
  const rev = revealOf(career, p.id), nAttrs = (SUB_ATTRS[p.pos] || []).length;
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">🔍 Scouting</div>
        <div className="text-xs text-slate-400 tabular-nums">{pts}/{total} pontos</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SCOUT_ACTIONS.map((a) => {
          const done = a.id === "interview" ? rev.trait : rev.keys.length >= nAttrs;
          const off = pts < a.cost || done;
          return (
            <button key={a.id} disabled={off} onClick={() => { const r = onScout(p.id, a.id); setMsg(r?.msg || ""); }}
              className="text-left px-2.5 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-35 disabled:cursor-not-allowed">
              <div className="text-xs font-semibold">{a.label} <span className="text-sky-300">· {a.cost} pt</span></div>
              <div className="text-[10px] text-slate-500 leading-snug">{a.desc}</div>
            </button>
          );
        })}
      </div>
      {msg && <div className="text-[11px] text-amber-300 mt-2">{msg}</div>}
      <TraitLine career={career} p={p} />
    </Card>
  );
}

export { FogOvr, FogAttrBars, TraitLine, ScoutPanel };
