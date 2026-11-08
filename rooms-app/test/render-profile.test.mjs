import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  capShadowMapSize,
  isMobileDevice,
  renderProfile,
} from "../shared/render-profile.mjs";
import { applyShadowBudget } from "../shared/shadow-budget.mjs";

const env = (queries, mobile) => ({
  navigator: { userAgentData: mobile === undefined ? undefined : { mobile } },
  matchMedia: (q) => ({ matches: !!queries[q] }),
});

test("touch-only and self-reported mobile browsers use the phone profile", () => {
  assert.equal(isMobileDevice(env({ "(pointer: coarse)": true })), true);
  assert.equal(isMobileDevice(env({}, true)), true);
  // Tablets with a trackpad or mouse, and desktops, keep full quality.
  assert.equal(
    isMobileDevice(
      env({ "(pointer: coarse)": true, "(any-pointer: fine)": true }),
    ),
    false,
  );
  assert.equal(isMobileDevice(env({ "(any-pointer: fine)": true })), false);
  assert.equal(isMobileDevice({}), false);
});

test("phones render fewer pixels and shadow passes unless high quality is chosen", () => {
  const phone = renderProfile({ mobile: true, devicePixelRatio: 3 });
  assert.deepEqual(phone, {
    low: true,
    pixelRatio: 1.5,
    antialias: false,
    shadowPasses: 8,
    shadowMapSize: 512,
  });
  assert.equal(
    renderProfile({ mobile: true, devicePixelRatio: 1 }).antialias,
    true,
  );
  const desktop = renderProfile({ devicePixelRatio: 3 });
  assert.equal(desktop.low, false);
  assert.equal(desktop.pixelRatio, 2);
  assert.equal(desktop.antialias, true);
  assert.equal(desktop.shadowPasses, Infinity);
  assert.equal(
    renderProfile({ quality: "high", mobile: true, devicePixelRatio: 3 }).low,
    false,
  );
  assert.equal(
    renderProfile({ quality: "low", devicePixelRatio: 1 }).low,
    true,
  );
  assert.equal(renderProfile({ devicePixelRatio: NaN }).pixelRatio, 1);
});

test("a shadow-pass limit keeps window shadows and counts point lights as six passes", () => {
  const scene = new THREE.Scene();
  const windows = Array.from({ length: 3 }, () => new THREE.SpotLight());
  const fixtures = [5, 20, 12].map((i) => new THREE.PointLight("#fff", i));
  for (const light of [...windows, ...fixtures]) {
    light.castShadow = true;
    scene.add(light);
  }
  const result = applyShadowBudget(scene, 16, 8);
  assert.equal(result.shadowLights, 3);
  assert.ok(windows.every((l) => l.castShadow));
  assert.deepEqual(
    fixtures.map((l) => l.castShadow),
    [false, false, false],
  );
  for (const light of [...windows, ...fixtures]) light.castShadow = true;
  scene.remove(...windows);
  assert.equal(applyShadowBudget(scene, 16, 8).shadowLights, 1);
  // The brightest fixture keeps its shadow; lights still illuminate the room.
  assert.deepEqual(
    fixtures.map((l) => l.castShadow),
    [false, true, false],
  );
  assert.ok(fixtures.every((l) => l.parent === scene && l.intensity > 0));
});

test("shadow maps are capped and reallocated at the smaller size", () => {
  const scene = new THREE.Scene();
  const spot = new THREE.SpotLight();
  spot.shadow.mapSize.set(1024, 1024);
  const disposed = [];
  spot.shadow.map = { dispose: () => disposed.push("spot") };
  const point = new THREE.PointLight();
  point.shadow.mapSize.set(256, 256);
  scene.add(spot, point, new THREE.HemisphereLight());
  capShadowMapSize(scene, 512);
  assert.deepEqual(spot.shadow.mapSize.toArray(), [512, 512]);
  assert.equal(spot.shadow.map, null);
  assert.deepEqual(disposed, ["spot"]);
  assert.deepEqual(point.shadow.mapSize.toArray(), [256, 256]);
  capShadowMapSize(scene, Infinity);
  assert.deepEqual(spot.shadow.mapSize.toArray(), [512, 512]);
});
