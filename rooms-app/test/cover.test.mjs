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
test("binary cover states move the door without inventing position services", () => {
  const binary = {
    entity_id: "cover.door",
    state: "open",
    attributes: { supported_features: 11 },
  };
  const door = new THREE.Group();
  door.userData.hingedDoor = {
    axis: "y",
    closedAngle: 0,
    openAngle: Math.PI / 2,
  };
  for (const state of ["closed", "open", "closed", "open"]) {
    const reported = coverState({ ...binary, state });
    setShadePosition(door, reported.motionPosition);
    assert.equal(door.rotation.y, state === "open" ? Math.PI / 2 : 0);
  }
  assert.equal(coverState(binary).label, "open");
  assert.equal(coverState(binary).position, undefined);
  assert.equal(coverFeatures(binary).position, false);
  assert.throws(() => coverCommand(binary, cover, "position", 50));
  for (const state of ["opening", "closing", "unknown", "unavailable"]) {
    setShadePosition(door, coverState({ ...binary, state }).motionPosition);
    assert.equal(door.rotation.y, Math.PI / 2);
  }
  // A position-capable cover with a temporarily missing reading stays unknown.
  assert.equal(
    coverState({ ...binary, attributes: { supported_features: 15 } }).position,
    undefined,
  );
  assert.equal(
    coverState({
      ...binary,
      attributes: { supported_features: 11, current_position: 42 },
    }).position,
    42,
  );
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

test("hinged doors use their local pivot and restore repeatedly without drift", () => {
  const holder = new THREE.Group();
  holder.rotation.y = 0.7;
  const door = new THREE.Group();
  door.position.set(2, 0, -0.03);
  holder.add(door);
  door.userData.hingedDoor = {
    axis: "y",
    closedAngle: 0,
    openAngle: Math.PI / 2,
  };
  const handle = new THREE.Object3D();
  handle.position.set(-0.75, 1, 0.07);
  door.add(handle);
  const hinge = door.position.clone(),
    handleRest = handle.position.clone();
  for (const position of [0, 50, 100, 0, 100, 50, 0]) {
    setShadePosition(door, position);
    assert.equal(door.rotation.y, ((Math.PI / 2) * position) / 100);
    assert.deepEqual(door.position, hinge);
    assert.deepEqual(handle.position, handleRest);
  }
  setShadePosition(door, 100);
  setShadePosition(door, undefined);
  assert.equal(door.rotation.y, Math.PI / 2);
});

test("sliding doors translate along local x between authored rest positions", () => {
  const holder = new THREE.Group();
  holder.rotation.y = Math.PI;
  const door = new THREE.Group();
  door.position.set(-0.39, 0, 0.04);
  door.userData.slidingDoor = {
    axis: "x",
    closedOffset: -0.39,
    openOffset: 0.45,
    defaultPosition: 100,
  };
  door.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 2, 0.04)));
  holder.add(door);
  for (const position of [0, 100, 50, 0, 100]) {
    setShadePosition(door, position);
    assert.ok(
      Math.abs(door.position.x - (-0.39 + (0.84 * position) / 100)) < 1e-12,
    );
    assert.equal(door.position.y, 0);
    assert.equal(door.position.z, 0.04);
    assert.equal(door.rotation.y, 0);
  }
  // Unknown readings and invalid metadata keep the last rendered position.
  setShadePosition(door, undefined);
  assert.ok(Math.abs(door.position.x - 0.45) < 1e-12);
  door.userData.slidingDoor.axis = "y";
  setShadePosition(door, 0);
  assert.ok(Math.abs(door.position.x - 0.45) < 1e-12);
  // Binary open/closed covers report endpoints.
  door.userData.slidingDoor.axis = "x";
  const binary = {
    entity_id: "cover.slider",
    attributes: { supported_features: 3 },
  };
  setShadePosition(
    door,
    coverState({ ...binary, state: "closed" }).motionPosition,
  );
  assert.ok(Math.abs(door.position.x + 0.39) < 1e-12);
  setShadePosition(
    door,
    coverState({ ...binary, state: "open" }).motionPosition,
  );
  assert.ok(Math.abs(door.position.x - 0.45) < 1e-12);
});

test("door/window contact sensors drive read-only opening state", () => {
  const sensor = (state) => ({
    entity_id: "binary_sensor.kitchen_window",
    state,
    attributes: { device_class: "window" },
  });
  assert.deepEqual(coverState(sensor("on")), {
    position: 100,
    motionPosition: 100,
    unavailable: false,
    label: "Open",
  });
  assert.equal(coverState(sensor("off")).position, 0);
  assert.equal(coverState(sensor("off")).label, "Closed");
  assert.equal(coverState(sensor("unavailable")).unavailable, true);
  assert.deepEqual(coverFeatures(sensor("on")), {
    open: false,
    close: false,
    position: false,
    stop: false,
  });
});
