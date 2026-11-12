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
/** A read slower than this downloads the room instead of waiting. */
export const STORE_READ_TIMEOUT = 2000;

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Model storage timed out.")),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

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
      req.onsuccess = () => {
        const db = req.result;
        // Let another page upgrade or delete the database instead of
        // leaving it waiting on this connection.
        db.onversionchange = db.onclose = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
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

/**
 * The stored model when it is still the given revision, else `null`.
 * Entries hold the raw bytes, not a Blob: Safari can hand back a stored
 * Blob whose file is gone once the app restarts, which then fails to load
 * ("Load failed"). Anything unreadable or the wrong size is dropped, so the
 * room downloads again instead.
 */
export async function readStoredScene(
  key,
  revision,
  timeout = STORE_READ_TIMEOUT,
) {
  const store = sceneStore();
  if (!store) return null;
  let entry;
  try {
    // Safari can leave IndexedDB hanging; never let that hold up a room.
    entry = await withTimeout(store.get(key), timeout);
  } catch {
    return null;
  }
  if (!entry || entry.revision !== revision) return null;
  const data = entry.data;
  if (
    !(data instanceof ArrayBuffer) ||
    !data.byteLength ||
    data.byteLength !== entry.size
  ) {
    // An older (Blob) or damaged copy: forget it.
    store.delete(key).catch?.(() => {});
    return null;
  }
  // Remember the use for eviction; failing to does not matter.
  store.put(key, { ...entry, usedAt: Date.now() }).catch?.(() => {});
  return new Blob([data], { type: entry.type || "model/gltf-binary" });
}

/** Forget a stored model, e.g. when it could not be shown. */
export async function forgetStoredScene(key) {
  try {
    await sceneStore()?.delete(key);
  } catch {
    /* Nothing stored, or storage unavailable. */
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
    const data = await blob.arrayBuffer();
    const entries = (await store.entries()).filter(([id]) => id !== key);
    let total = entries.reduce((sum, [, e]) => sum + (e?.size || 0), 0);
    entries.sort(([, a], [, b]) => (a?.usedAt || 0) - (b?.usedAt || 0));
    for (const [id, entry] of entries) {
      if (total + data.byteLength <= limit) break;
      await store.delete(id);
      total -= entry?.size || 0;
    }
    const now = Date.now();
    await store.put(key, {
      revision,
      data,
      type: blob.type || "model/gltf-binary",
      size: data.byteLength,
      savedAt: now,
      usedAt: now,
    });
    return true;
  } catch {
    return false;
  }
}
