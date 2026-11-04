import { useCallback, useEffect, useRef, useState } from "react";
import { saveCareer, requestPersistence } from "../lib/storage.js";

// Autosave com debounce: grava o career no IndexedDB ~1,2 s depois da última mudança (e quando a
// aba some ou fecha), em vez de serializar o career inteiro a cada setState.
//   paused: true durante simulações em lote (o resultado final é salvo ao terminar)
// Devolve { status: "idle" | "ok" | "error", flush } (sem estado intermediário, para não re-renderizar o app a cada gravação).
function useAutoSave(career, { paused = false, delay = 1200 } = {}) {
  const latest = useRef(career);
  latest.current = career;
  const dirty = useRef(false);
  const inflight = useRef(Promise.resolve());
  const [status, setStatus] = useState("idle");

  const flush = useCallback(() => {
    const c = latest.current;
    if (!c || !dirty.current) return inflight.current;
    dirty.current = false;
    inflight.current = inflight.current
      .then(() => saveCareer(c))
      .then(() => setStatus("ok"))
      .catch(() => { dirty.current = true; setStatus("error"); });
    return inflight.current;
  }, []);

  useEffect(() => { if (career) dirty.current = true; }, [career]);

  useEffect(() => {
    if (!career || paused) return undefined;
    const t = setTimeout(flush, delay);
    return () => clearTimeout(t);
  }, [career, paused, delay, flush]);

  useEffect(() => {
    requestPersistence();
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); };
  }, [flush]);

  return { status, flush };
}

export { useAutoSave };
