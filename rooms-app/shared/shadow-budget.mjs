/** Keep shadow samplers within the GPU's per-fragment texture limit.
 * Lights without a shadow map still illuminate the room and remain controllable.
 * Call once after adding the asset, fixture lights and daylight sources.
 */
export function applyShadowBudget(scene, maxTextures) {
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
  const budget = Math.max(0, Math.floor(maxTextures) - materialTextures - 2);
  // Window shadows prevent daylight leaking through walls; then prefer stronger fixtures.
  lights.sort(
    (a, b) =>
      Number(!!b.isSpotLight) - Number(!!a.isSpotLight) ||
      b.intensity - a.intensity,
  );
  lights.forEach((light, index) => {
    light.castShadow = index < budget;
  });
  return {
    budget,
    shadowLights: Math.min(lights.length, budget),
    materialTextures,
  };
}
