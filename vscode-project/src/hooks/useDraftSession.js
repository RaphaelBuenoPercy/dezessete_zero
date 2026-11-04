import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK, createDraftSession, draftOverlay, isDraftComplete, liveTick as liveTickPure, skipToUser,
  userPick as userPickPure, scoutPure, chooseEventPure, commitDraftSession,
} from "../season/draftSession.js";

// Interface única do draft ao vivo para as telas (padrão "provider decide como o estado é gerenciado"):
// as telas só enxergam `view` (career + sessão) e as ações abaixo. Por dentro, o estado volátil mora em
// um ref + um state pequeno e o `career` só recebe merges em bloco (commit).
//   active: true enquanto o usuário está na tela do draft (ou num prospect); ao sair, a sessão é gravada.
//   onFinalize(mergedCareer, rng): chamado só no merge final (ex.: coletiva de nota do draft).
function useDraftSession({ career, setCareer, active, onFinalize }) {
  const careerRef = useRef(career);
  careerRef.current = career;
  const sessRef = useRef(null);
  const [session, setSessionState] = useState(null);

  const setSess = useCallback((d) => { sessRef.current = d; setSessionState(d); }, []);

  const ensure = useCallback(() => {
    if (sessRef.current) return sessRef.current;
    const c = careerRef.current;
    if (!c || !c.draftClass || !c.draftOrder) return null;
    sessRef.current = createDraftSession(c);
    return sessRef.current;
  }, []);

  const commit = useCallback((d = sessRef.current) => {
    if (!d) return;
    const merged = commitDraftSession(careerRef.current, d, { final: isDraftComplete(d), onFinalize });
    careerRef.current = merged;                       // evita criar nova sessão em cima de um career defasado
    setCareer(merged);
    setSess(null);
  }, [setCareer, setSess, onFinalize]);

  // Ao sair da tela do draft, grava o que está pendente.
  useEffect(() => { if (!active && sessRef.current) commit(); }, [active, commit]);
  // Aba escondida/fechada: grava também (o autosave grava o career logo em seguida).
  useEffect(() => {
    const onHide = () => { if (sessRef.current) commit(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); };
  }, [commit]);

  const liveTick = useCallback(() => {
    const d = ensure();
    if (!d) return;
    const n = liveTickPure(d);
    if (n === d) return;
    if (isDraftComplete(n) || n.picksSinceCommit >= BLOCK) commit(n); else setSess(n);
  }, [ensure, commit, setSess]);

  const userPick = useCallback((prospect) => {
    const d = ensure();
    if (!d) return;
    const n = userPickPure(d, prospect);
    if (n !== d) commit(n);                            // o elenco do usuário precisa refletir a escolha na hora
  }, [ensure, commit]);

  const skipToMyPick = useCallback(() => {
    const d = ensure();
    if (d) commit(skipToUser(d));
  }, [ensure, commit]);

  const scout = useCallback((prospectId, actionId) => {
    const d = ensure();
    if (!d) return { ok: false, msg: "Draft indisponível." };
    const { d: n, result } = scoutPure(d, prospectId, actionId);
    if (n !== d) setSess(n);
    return result;
  }, [ensure, setSess]);

  const chooseEvent = useCallback((eventUid, optionIdx) => {
    const d = ensure();
    if (d) setSess(chooseEventPure(d, eventUid, optionIdx));
  }, [ensure, setSess]);

  const view = useMemo(() => (session ? draftOverlay(career, session) : career), [career, session]);

  return { view, liveTick, userPick, skipToMyPick, scout, chooseEvent, commit };
}

export { useDraftSession };
