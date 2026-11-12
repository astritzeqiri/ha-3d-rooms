/** Keep private room bytes within the current HA connection, shared by cards/panel.
 * Bound retained data; failed loads never become a cached result.
 */
import { readStoredScene, storedSceneKey, storeScene } from "./scene-store.mjs";
const sessions = new WeakMap();
const MAX_BYTES = 96 * 1024 * 1024;
const MAX_AGE = 10 * 60 * 1000;
export function sceneOwner(hass) {
  return hass.connection || hass.auth || hass;
}
export function clearSceneDownloads(hass) {
  sessions.delete(sceneOwner(hass));
}
/**
 * Read a response as a Blob, reporting `{ loaded, total }` bytes as they
 * arrive. `total` is undefined when the size is unknown or the transfer is
 * compressed (its length then counts compressed bytes).
 */
async function readBlob(response, report) {
  const reader = response.body?.getReader?.();
  if (!reader) return response.blob();
  const header = (name) => response.headers?.get?.(name),
    length = Number(header("content-length")),
    total =
      !header("content-encoding") && Number.isFinite(length) && length > 0
        ? length
        : undefined,
    chunks = [];
  let loaded = 0;
  report({ loaded, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    report({ loaded, total });
  }
  return new Blob(chunks, {
    type: header("content-type") || "model/gltf-binary",
  });
}
/**
 * `variant` is "original", "full" or "phone"; the server falls back to the upload.
 * `onProgress({ loaded, total })` follows the download, also when another
 * card already started it.
 * A copy kept on the device (scene-store) is used when it is still the
 * current revision; `{ fresh: true }` skips it, downloads and stores anew.
 */
export async function sceneBlob(
  hass,
  model,
  variant = "original",
  onProgress,
  { fresh = false } = {},
) {
  if (hass.user?.is_admin === false)
    throw new Error("Administrator access is required.");
  const owner = sceneOwner(hass);
  let cache = sessions.get(owner);
  if (!cache) sessions.set(owner, (cache = new Map()));
  const revision = model.sceneRevision || model.importedAt || "legacy";
  const key = `${model.id}:${revision}:${variant}`;
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.expires < now) cache.delete(id);
  let entry = cache.get(key);
  if (entry) {
    cache.delete(key);
    cache.set(key, entry);
    if (onProgress && entry.listeners) {
      entry.listeners.add(onProgress);
      if (entry.progress) onProgress(entry.progress);
    }
    return entry.promise;
  }
  entry = { bytes: 0, expires: now + MAX_AGE, listeners: new Set() };
  if (onProgress) entry.listeners.add(onProgress);
  const report = (progress) => {
    entry.progress = progress;
    for (const listener of entry.listeners || []) listener(progress);
  };
  const stored = storedSceneKey(hass.user?.id, model, variant);
  entry.promise = (async () => {
    let blob = fresh ? null : await readStoredScene(stored, revision);
    if (blob) report({ loaded: blob.size, total: blob.size });
    else {
      const path = `/api/three_d_rooms/models/${encodeURIComponent(model.id)}/scene.glb?v=${encodeURIComponent(revision)}&variant=${encodeURIComponent(variant)}`;
      // A reload asks the browser not to answer from its HTTP cache either.
      const response = await (fresh
        ? hass.fetchWithAuth(path, { cache: "reload" })
        : hass.fetchWithAuth(path));
      if (!response.ok)
        throw new Error(
          "Could not download your room. Check your login and the 3D Rooms integration.",
        );
      blob = await readBlob(response, report);
      storeScene(stored, revision, blob);
    }
    entry.listeners = null;
    entry.bytes = blob.size;
    let size = [...cache.values()].reduce((sum, item) => sum + item.bytes, 0);
    for (const [id, item] of cache) {
      if (size <= MAX_BYTES) break;
      cache.delete(id);
      size -= item.bytes;
    }
    return blob;
  })().catch((error) => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  cache.set(key, entry);
  return entry.promise;
}
