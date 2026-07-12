/**
 * geocache.js - a large-quota async cache for the OSM geo layers.
 *
 * With the count caps gone, the layers download the REAL networks - a
 * dense city's buildings, its ~10k road ways, its full rail net, its
 * landuse. That is megabytes, and localStorage (~5 MB per origin) throws
 * QuotaExceededError on it, so the old `try { localStorage.setItem } catch
 * {}` silently cached NOTHING and every re-anchor (and every reload)
 * re-fetched the lot. IndexedDB holds hundreds of MB, so the full-detail
 * data is written once and reused: roam back to a place, or reload, and it
 * is instant, no re-download.
 *
 * Pure browser I/O (no reference gate, like the fetch calls it replaces):
 * an IndexedDB key/value store, degrading to localStorage and then to an
 * in-memory Map if IndexedDB is unavailable, so a caller can always await
 * get/set without guarding.
 */

const DB_NAME = 'horizon-geo';
const STORE = 'kv';
const mem = new Map();
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore(STORE);
        } catch {}
      };
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function lsGet(key) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

/** The cached value for `key`, or null. Never throws. */
export async function geoGet(key) {
  const db = await openDB();
  if (!db) return lsGet(key) ?? (mem.has(key) ? mem.get(key) : null);
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () =>
        resolve(req.result === undefined ? null : req.result);
      req.onerror = () => resolve(lsGet(key));
    } catch {
      resolve(lsGet(key));
    }
  });
}

/** Cache `val` under `key`. Never throws; falls back if IDB is absent. */
export async function geoSet(key, val) {
  const db = await openDB();
  if (!db) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      mem.set(key, val); // last resort: this session only
    }
    return;
  }
  return new Promise((resolve) => {
    try {
      const req = db
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
