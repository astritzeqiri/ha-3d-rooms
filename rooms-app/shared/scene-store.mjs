/**
 * Keeps downloaded room models on the device (IndexedDB), so a card or the
 * full-screen page opens a room without downloading it again, even after the
 * app was closed. IndexedDB also works on plain-HTTP Home Assistant, where
 * the Cache API does not exist.
 *
 * One entry per user, room and variant: a newer revision replaces it, so a
 * replaced room downloads once and old copies never pile up. The total is
 * bounded; the least recently opened rooms go first.
 */
const DB_NAME = "three-d-rooms";
const STORE = "scenes";
export const MAX_STORED_BYTES = 512 * 1024 * 1024;

export function storedSceneKey(user, model, variant) {
  return `${user || "user"}:${model.id}:${variant}`;
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** An IndexedDB-backed store; `null` where the browser has none. */
export function indexedSceneStore(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let opening;
  const db = () =>
    (opening ??= new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Model storage is blocked."));
    }).catch((error) => {
      opening = null;
      throw error;
    }));
  const run = async (mode, work) => {
    const tx = (await db()).transaction(STORE, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    const result = await work(tx.objectStore(STORE));
    await done;
    return result;
  };
  return {
    get: (key) => run("readonly", (store) => request(store.get(key))),
    put: (key, value) => run("readwrite", (store) => store.put(value, key)),
    delete: (key) => run("readwrite", (store) => store.delete(key)),
    async entries() {
      return run("readonly", async (store) => {
        const [keys, values] = await Promise.all([
          request(store.getAllKeys()),
          request(store.getAll()),
        ]);
        return keys.map((key, i) => [key, values[i]]);
      });
    },
  };
}

let current;
/** Tests swap the store; `null` turns storing off. */
export function setSceneStore(store) {
  current = store;
}
function sceneStore() {
  if (current === undefined) {
    try {
      current = indexedSceneStore();
    } catch {
      current = null;
    }
  }
  return current;
}

/** The stored model when it is still the given revision, else `null`. */
export async function readStoredScene(key, revision) {
  const store = sceneStore();
  if (!store) return null;
  try {
    const entry = await store.get(key);
    if (!entry || entry.revision !== revision || !(entry.blob instanceof Blob))
      return null;
    // Remember the use for eviction; failing to does not matter.
    store.put(key, { ...entry, usedAt: Date.now() }).catch(() => {});
    return entry.blob;
  } catch {
    return null;
  }
}

/** Store a downloaded model. Never fails the load; storage is a bonus. */
export async function storeScene(
  key,
  revision,
  blob,
  limit = MAX_STORED_BYTES,
) {
  const store = sceneStore();
  if (!store || !blob?.size || blob.size > limit) return false;
  try {
    // Ask once that the browser keeps it (home-screen apps usually may).
    globalThis.navigator?.storage?.persist?.().catch?.(() => {});
    const entries = (await store.entries()).filter(([id]) => id !== key);
    let total = entries.reduce((sum, [, e]) => sum + (e?.size || 0), 0);
    entries.sort(([, a], [, b]) => (a?.usedAt || 0) - (b?.usedAt || 0));
    for (const [id, entry] of entries) {
      if (total + blob.size <= limit) break;
      await store.delete(id);
      total -= entry?.size || 0;
    }
    const now = Date.now();
    await store.put(key, {
      revision,
      blob,
      size: blob.size,
      savedAt: now,
      usedAt: now,
    });
    return true;
  } catch {
    return false;
  }
}
