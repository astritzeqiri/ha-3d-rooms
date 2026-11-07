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
