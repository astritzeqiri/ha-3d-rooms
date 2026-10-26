import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  coverFeatures,
  coverState,
  coverCommand,
  setShadePosition,
} from "../shared/cover.mjs";
import {
  validateManifest,
  validateBinding,
  commandFor,
} from "../server/manifest.mjs";
const cover = {
  id: "shade",
  label: "Shade",
  type: "cover",
  position: [0, 2, 0],
  nodeIds: ["shade"],
  defaultPosition: 85,
  capabilities: ["open_close", "position", "stop"],
};
const entity = {
  entity_id: "cover.demo",
  state: "open",
  attributes: { supported_features: 15, current_position: 42 },
};
test("cover manifest, compatible mapping and bounded supported services", () => {
  const m = {
    schemaVersion: 1,
    id: "room",
    title: "Room",
    units: "meters",
    up: "Y",
    scene: "scene.glb",
    controls: [cover],
  };
  assert.equal(validateManifest(m), m);
  assert.equal(validateBinding(cover, entity), "cover.demo");
  assert.throws(() => validateBinding(cover, { entity_id: "light.demo" }));
  assert.throws(() => validateBinding({ ...cover, type: "light" }, entity));
  assert.equal(
    coverCommand(entity, cover, "position", 37).service,
    "set_cover_position",
  );
  assert.deepEqual(
    commandFor(
      entity.entity_id,
      "position",
      undefined,
      cover,
      { position: 37 },
      entity,
    ).service_data,
    { position: 37 },
  );
  for (const value of [-1, 101, NaN, 50.5, "50", null])
    assert.throws(() => coverCommand(entity, cover, "position", value));
  assert.throws(() =>
    coverCommand(
      { ...entity, attributes: { supported_features: 3 } },
      cover,
      "position",
      50,
    ),
  );
  assert.throws(() =>
    validateManifest({ ...m, controls: [{ ...cover, defaultPosition: 101 }] }),
  );
});
test("HA reported height, moving state, unavailable and unknown position", () => {
  assert.equal(coverState(entity).position, 42);
  assert.equal(coverState({ ...entity, state: "opening" }).position, 42);
  assert.equal(
    coverState({ ...entity, state: "unavailable" }).position,
    undefined,
  );
  assert.equal(coverState({ ...entity, attributes: {} }).position, undefined);
  assert.equal(
    coverState({ ...entity, state: "closed", attributes: {} }).position,
    0,
  );
  assert.equal(coverFeatures(entity).stop, true);
});
test("exported local-space slats move without drifting and retain last known height", () => {
  const root = new THREE.Group();
  root.userData.rollerShade = { top: 2, height: 1 };
  const slat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.01));
  slat.userData.rollerShadePart = { center: 1.05, height: 0.1 };
  root.add(slat);
  setShadePosition(root, 50);
  assert.equal(slat.position.y, 1.55);
  setShadePosition(root, undefined);
  assert.equal(slat.position.y, 1.55);
  setShadePosition(root, 100);
  assert.equal(slat.visible, false);
  setShadePosition(root, 0);
  assert.equal(slat.visible, true);
  assert.equal(slat.position.y, 1.05);
});
