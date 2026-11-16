// Three.js-free part of the scene asset cache, so the card can clear it and
// build cache keys before the 3D engine has loaded.
export const sceneSessions = new WeakMap();
export function clearSceneAssets(owner) {
  sceneSessions.delete(owner);
}
export function sceneAssetKey(model, variant = "original") {
  return `${model.id}:${model.sceneRevision || model.importedAt || "legacy"}:${variant}`;
}
