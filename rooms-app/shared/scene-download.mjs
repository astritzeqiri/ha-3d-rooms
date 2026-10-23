/** Keep private room bytes within the current HA connection, shared by cards/panel.
 * Bound retained data; failed loads never become a cached result.
 */
const sessions = new WeakMap();
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_AGE = 5 * 60 * 1000;
export async function sceneBlob(hass, model) {
  if (hass.user?.is_admin === false)
    throw new Error("Administrator access is required.");
  const owner = hass.connection || hass.auth || hass;
  let cache = sessions.get(owner);
  if (!cache) sessions.set(owner, (cache = new Map()));
  const revision = model.sceneRevision || model.importedAt || "legacy";
  const key = `${model.id}:${revision}`;
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.expires < now) cache.delete(id);
  let entry = cache.get(key);
  if (entry) {
    cache.delete(key);
    cache.set(key, entry);
    return entry.promise;
  }
  entry = { bytes: 0, expires: now + MAX_AGE };
  entry.promise = (async () => {
    const path = `/api/three_d_rooms/models/${encodeURIComponent(model.id)}/scene.glb?v=${encodeURIComponent(revision)}`;
    const response = await hass.fetchWithAuth(path);
    if (!response.ok)
      throw new Error(
        "Could not download your room. Check your login and the 3D Rooms integration.",
      );
    const blob = await response.blob();
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
