/** Rendering cost settings. Phones get fewer pixels and shadow passes; room content is unchanged. */
export const QUALITIES = ["auto", "high", "low"];

/** A touch-only device (phone, tablet without trackpad) or a browser that reports itself as mobile. */
export function isMobileDevice(env = globalThis) {
  if (env.navigator?.userAgentData?.mobile) return true;
  const media = (query) => !!env.matchMedia?.(query)?.matches;
  return media("(pointer: coarse)") && !media("(any-pointer: fine)");
}

export function renderProfile({
  quality = "auto",
  mobile = false,
  devicePixelRatio = 1,
} = {}) {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const low = quality === "low" || (quality !== "high" && mobile);
  if (!low)
    return {
      low,
      pixelRatio: Math.min(dpr, 2),
      antialias: true,
      shadowPasses: Infinity,
      shadowMapSize: Infinity,
    };
  return {
    low,
    pixelRatio: Math.min(dpr, 1.5),
    // MSAA costs most on dense screens, where jagged edges are least visible.
    antialias: dpr < 1.5,
    // A point light renders six shadow faces, a spot light one.
    shadowPasses: 8,
    shadowMapSize: 512,
  };
}

/** Which optimized copy of a room to download: phones get smaller textures. */
export function sceneVariant(quality = "auto", env = globalThis) {
  return renderProfile({
    quality,
    mobile: isMobileDevice(env),
    devicePixelRatio: env.devicePixelRatio,
  }).low
    ? "phone"
    : "full";
}

/** Cap shadow-map resolution; an already allocated map is released so it is recreated at the new size. */
export function capShadowMapSize(scene, maxSize) {
  if (!Number.isFinite(maxSize)) return;
  scene.traverse((object) => {
    const shadow = object.isLight && object.shadow;
    if (!shadow?.mapSize) return;
    const width = Math.min(shadow.mapSize.x, maxSize),
      height = Math.min(shadow.mapSize.y, maxSize);
    if (width === shadow.mapSize.x && height === shadow.mapSize.y) return;
    shadow.mapSize.set(width, height);
    shadow.map?.dispose();
    shadow.map = null;
  });
}
