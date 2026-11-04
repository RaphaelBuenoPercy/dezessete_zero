// ============================================================
// PERSISTÊNCIA DOS SAVES (IndexedDB, sem dependências)
//
// Substitui o localStorage (~5 MB, JSON.stringify bloqueando a thread) por IndexedDB:
//   - store "careers": { id, savedAt, data: career }   (clone estruturado, sem JSON)
//   - store "meta":    resumo leve de cada save, para o menu listar sem carregar a carreira inteira
// Retrocompatível: saves antigos em localStorage ("nflcareer:<id>") são migrados na primeira
// abertura do menu (migrateLegacy) ou na primeira carga individual (loadLegacyCareer).
// Sem IndexedDB (modo privado antigo, etc.) cai para localStorage com a mesma API.
// ============================================================

const DB_NAME = "gridiron-gm";
const DB_VERSION = 1;
const CAREERS = "careers";
const META = "meta";
const LEGACY_PREFIX = "nflcareer:";

const hasIDB = () => typeof indexedDB !== "undefined" && indexedDB !== null;
const hasLocal = () => typeof localStorage !== "undefined";

function summarize(c) {
  return {
    id: c.id, coachName: c.coachName, teamAbbr: c.teamAbbr, year: c.year, week: c.week,
    spectator: !!c.spectator, forkOf: c.forkOf || null,
    titles: Object.keys(c.seasonArchive || {}).length, savedAt: Date.now(),
  };
}

// ---------- IndexedDB ----------
let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CAREERS)) db.createObjectStore(CAREERS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };   // outra aba atualizando o banco
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => { dbPromise = null; reject(new Error("IndexedDB bloqueado")); };
    });
  }
  return dbPromise;
}

// Executa `work(tx)` numa transação e resolve com o que `work` devolver, depois do commit.
async function withTx(stores, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let out;
    const tx = db.transaction(stores, mode);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transação abortada"));
    try { out = work(tx); } catch (e) { try { tx.abort(); } catch (_) { /* já abortada */ } reject(e); }
  });
}
const reqValue = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

// ---------- localStorage (legado e fallback) ----------
function legacyKeys() {
  if (!hasLocal()) return [];
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LEGACY_PREFIX)) keys.push(k); }
  return keys;
}
function loadLegacyCareer(id) {
  if (!hasLocal()) return null;
  try { const raw = localStorage.getItem(LEGACY_PREFIX + id); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function removeLegacy(id) { try { if (hasLocal()) localStorage.removeItem(LEGACY_PREFIX + id); } catch (e) { /* ignora */ } }

// ---------- API pública ----------
async function saveCareer(c) {
  if (!hasIDB()) {                                               // fallback
    localStorage.setItem(LEGACY_PREFIX + c.id, JSON.stringify(c));
    return;
  }
  await withTx([CAREERS, META], "readwrite", (tx) => {
    tx.objectStore(CAREERS).put({ id: c.id, savedAt: Date.now(), data: c });
    tx.objectStore(META).put(summarize(c));
  });
}

async function loadCareer(id) {
  if (!hasIDB()) return loadLegacyCareer(id);
  const db = await openDB();
  const rec = await reqValue(db.transaction(CAREERS, "readonly").objectStore(CAREERS).get(id));
  return rec ? rec.data : null;
}

async function listSaves() {
  if (!hasIDB()) {
    return legacyKeys().map((k) => { try { return summarize(JSON.parse(localStorage.getItem(k))); } catch (e) { return null; } }).filter(Boolean);
  }
  const db = await openDB();
  const all = await reqValue(db.transaction(META, "readonly").objectStore(META).getAll());
  return all.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

async function deleteCareer(id) {
  if (hasIDB()) {
    await withTx([CAREERS, META], "readwrite", (tx) => { tx.objectStore(CAREERS).delete(id); tx.objectStore(META).delete(id); });
  }
  removeLegacy(id);
}

// Move saves antigos do localStorage para o IndexedDB. A chave antiga só é removida depois que
// o novo registro foi gravado e relido com sucesso. Devolve quantos saves foram migrados.
async function migrateLegacy() {
  if (!hasIDB() || !hasLocal()) return 0;
  let migrated = 0;
  for (const k of legacyKeys()) {
    try {
      const c = JSON.parse(localStorage.getItem(k));
      if (!c || !c.id) continue;
      await saveCareer(c);
      const check = await loadCareer(c.id);
      if (check && check.id === c.id) { localStorage.removeItem(k); migrated++; }
    } catch (e) { /* mantém o save antigo intacto; tenta de novo na próxima abertura */ }
  }
  return migrated;
}

// Pede ao navegador para não despejar os dados sob pressão de espaço (best effort).
async function requestPersistence() {
  try { if (typeof navigator !== "undefined" && navigator.storage?.persist) await navigator.storage.persist(); } catch (e) { /* ignora */ }
}

export { saveCareer, loadCareer, listSaves, deleteCareer, migrateLegacy, loadLegacyCareer, removeLegacy, requestPersistence, summarize };
