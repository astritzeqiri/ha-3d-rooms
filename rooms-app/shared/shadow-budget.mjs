/** Keep shadow samplers within the GPU's per-fragment texture limit.
 * Lights without a shadow map still illuminate the room and remain controllable.
 * `maxPasses` optionally limits shadow render passes for slower GPUs.
 * `maxVaryings` (the GPU's MAX_VARYING_VECTORS) keeps the shaders linkable:
 * every shadow-casting light adds one vec4 the vertex shader hands to the
 * fragment shader, beside the material's own (one per texture map at worst).
 * Over the limit the lit materials fail to link and walls and floors vanish,
 * leaving only unlit window panes. `maxLights` caps the count outright.
 * Call once after adding the asset, fixture lights and daylight sources.
 */
// Varyings every lit material uses besides its maps' UVs and the shadow
// coordinates: view position, normal, tangent frame, world position, colour,
// fog depth, clipping, plus what the browser's GL layer adds itself. Measured:
// with 31 vectors and 4-map materials, 17 shadow lights draw and 19 draw
// nothing, without any error. 12 keeps a margin for other drivers.
const VARYING_RESERVE = 12;

export function applyShadowBudget(
  scene,
  maxTextures,
  maxPasses = Infinity,
  { maxVaryings = Infinity, maxLights = Infinity } = {},
) {
  let materialTextures = 0;
  const lights = [];
  scene.traverse((object) => {
    if (object.isLight && object.castShadow) lights.push(object);
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      // Count slots rather than distinct textures: one image may feed several uniforms.
      const count = Object.values(material || {}).filter(
        (value) => value?.isTexture,
      ).length;
      materialTextures = Math.max(materialTextures, count);
    }
  });
  // Leave room for renderer-provided environment/transmission textures.
  const budget = Math.max(
    0,
    Math.min(
      Math.floor(maxTextures) - materialTextures - 2,
      Math.floor(maxVaryings) - VARYING_RESERVE - materialTextures,
      maxLights,
    ),
  );
  // Window shadows prevent daylight leaking through walls; then prefer stronger fixtures.
  lights.sort(
    (a, b) =>
      Number(!!b.isSpotLight) - Number(!!a.isSpotLight) ||
      b.intensity - a.intensity,
  );
  // Each shadow pass redraws the scene; a point light needs six (cube faces).
  let passes = 0,
    shadowLights = 0;
  for (const light of lights) {
    const cost = light.isPointLight ? 6 : 1;
    light.castShadow = shadowLights < budget && passes + cost <= maxPasses;
    if (!light.castShadow) continue;
    passes += cost;
    shadowLights++;
  }
  return {
    budget,
    shadowLights,
    materialTextures,
  };
}
