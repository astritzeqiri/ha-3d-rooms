import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { applyShadowBudget } from "../shared/shadow-budget.mjs";

test("textured rooms reserve texture slots before enabling fixture and window shadows", () => {
  const scene = new THREE.Scene();
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    roughnessMap: texture,
    metalnessMap: texture,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  scene.add(mesh);
  const lights = Array.from({ length: 18 }, (_, i) => {
    const light = i < 13 ? new THREE.PointLight() : new THREE.SpotLight();
    light.castShadow = true;
    scene.add(light);
    return light;
  });
  const result = applyShadowBudget(scene, 16);
  assert.deepEqual(result, {
    budget: 10,
    shadowLights: 10,
    materialTextures: 4,
  });
  assert.equal(lights.filter((l) => l.castShadow).length, 10);
  assert.ok(lights.slice(13).every((l) => l.castShadow));
  assert.ok(
    lights.every((l) => l.visible && l.intensity === 1 && l.parent === scene),
  );
  assert.equal(mesh.visible, true);
  assert.equal(material.map, texture);
});

test("small rooms retain all shadows and limited GPUs remain within capacity", () => {
  for (const capacity of [2, 8, 16, 32]) {
    const scene = new THREE.Scene();
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight();
      light.castShadow = true;
      scene.add(light);
    }
    const result = applyShadowBudget(scene, capacity);
    assert.equal(result.shadowLights, Math.min(3, capacity - 2));
  }
});

test("shadow lights stay within the GPU's varying vectors so lit materials still link", () => {
  const scene = new THREE.Scene();
  const texture = new THREE.Texture();
  scene.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshPhysicalMaterial({ map: texture, normalMap: texture }),
    ),
  );
  for (let i = 0; i < 26; i++) {
    const light = i < 14 ? new THREE.PointLight() : new THREE.SpotLight();
    light.castShadow = true;
    scene.add(light);
  }
  // 32 texture units would allow 28; 31 varyings minus 8 reserved minus
  // one per map leaves 17.
  assert.equal(
    applyShadowBudget(scene, 32, Infinity, { maxVaryings: 31 }).shadowLights,
    17,
  );
  // A limit learned from a failed link wins.
  assert.equal(
    applyShadowBudget(scene, 32, Infinity, { maxVaryings: 31, maxLights: 9 })
      .shadowLights,
    9,
  );
});
