import { floorFrame, perspectiveFrame } from "../shared/floor-view.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  captureCameraView,
  restoreCameraView,
  validateCameraSnapshot,
} from "../shared/camera-view.mjs";
const target = new THREE.Vector3(0.7, 1.1, -0.3);
function restoredCamera(frame, orthographic) {
  const camera = orthographic
    ? new THREE.OrthographicCamera(
        frame.left,
        frame.right,
        frame.top,
        frame.bottom,
        frame.near,
        frame.far,
      )
    : new THREE.PerspectiveCamera(
        frame.fov,
        frame.aspect,
        frame.near,
        frame.far,
      );
  camera.position.fromArray(frame.position);
  camera.up.fromArray(frame.up);
  camera.zoom = frame.zoom;
  camera.lookAt(new THREE.Vector3().fromArray(frame.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
function capture(camera) {
  return captureCameraView({
    position: camera.position.toArray(),
    target: target.toArray(),
    up: camera.up.toArray(),
    aspect: camera.aspect || 1.5,
    zoom: camera.zoom,
    fov: camera.fov,
    ...(camera.isOrthographicCamera
      ? { halfHeight: (camera.top - camera.bottom) / 2 }
      : {}),
    min: [-3, 0, -4],
    max: [3, 3, 4],
  });
}
for (const orthographic of [false, true])
  test(`camera export reproduces ${orthographic ? "floor" : "perspective"} orbit, pan and zoom after JSON round-trip`, () => {
    const source = orthographic
      ? new THREE.OrthographicCamera(-6, 6, 4, -4, 0.05, 500)
      : new THREE.PerspectiveCamera(45, 1.5, 0.05, 500);
    source.position.set(4, 8, -6);
    source.zoom = 1.37;
    source.lookAt(target);
    source.updateProjectionMatrix();
    source.updateMatrixWorld();
    const saved = JSON.parse(JSON.stringify(capture(source)));
    const frame = restoreCameraView(saved.camera, { aspect: 1.5, ...saved });
    const copy = restoredCamera(frame, orthographic);
    for (const point of [[0, 0, 0], [-2, 2, 3], [3, 1, -2], target.toArray()]) {
      const before = new THREE.Vector3(...point).project(source),
        after = new THREE.Vector3(...point).project(copy);
      assert.ok(Math.abs(before.x - after.x) < 1e-5);
      assert.ok(Math.abs(before.y - after.y) < 1e-5);
    }
    assert.ok(saved.heading > 90 && saved.heading < 180);
    assert.ok(saved.zoom > 0);
    const narrower = restoreCameraView(saved.camera, {
      aspect: 0.75,
      ...saved,
    });
    assert.ok(
      narrower.zoom < frame.zoom,
      "narrow cards retain the captured scene instead of cropping it",
    );
    const closer = restoreCameraView(saved.camera, {
      aspect: 1.5,
      ...saved,
      zoom: saved.zoom * 2,
    });
    assert.ok(Math.abs(closer.zoom / frame.zoom - 2) < 1e-8);
    const rotated = restoreCameraView(saved.camera, {
      aspect: 1.5,
      ...saved,
      heading: 0,
    });
    assert.equal(
      rotated.target[0],
      saved.camera.target[0],
      "rotation preserves the panned target",
    );
  });
test("invalid camera snapshots are rejected before rendering", () => {
  const c = new THREE.PerspectiveCamera(45, 1.5, 0.05, 500);
  c.position.set(4, 8, -6);
  c.lookAt(target);
  const { camera } = capture(c);
  for (const changed of [
    { position: [NaN, 0, 0] },
    { target: camera.position },
    { up: [0, 0, 0] },
    { referenceZoom: 0 },
    { fov: 180 },
  ])
    assert.throws(
      () => validateCameraSnapshot({ ...camera, ...changed }),
      /Invalid/,
    );
});

test("top and bottom captures keep a stable heading at the camera poles", () => {
  for (const sign of [-1, 1]) {
    const saved = captureCameraView({
      position: [0, sign * 10, -1e-15],
      target: [0, 0, 0],
      up: [0, 0, -sign],
      aspect: 1.5,
      zoom: 1,
      fov: 35,
      min: [-3, 0, -4],
      max: [3, 3, 4],
    });
    assert.equal(saved.heading, 0);
    assert.equal(saved.tilt, sign === 1 ? 0 : 180);
  }
});

for (const orthographic of [false, true])
  test(`responsive ${orthographic ? "floor" : "perspective"} framing uses room bounds and does not shrink on every resize`, () => {
    const min = [-1, 0, -4],
      max = [1, 2, 4];
    const base = orthographic
      ? floorFrame(min, max, 2, 28, 0)
      : perspectiveFrame(min, max, 2, 28, 0);
    const source = restoredCamera(
      { ...base, aspect: 2, zoom: 1 },
      orthographic,
    );
    const saved = captureCameraView({
      position: source.position.toArray(),
      target: base.target,
      up: source.up.toArray(),
      aspect: 2,
      zoom: 1,
      ...(orthographic ? { halfHeight: base.top } : { fov: base.fov }),
      min,
      max,
    });
    const original = JSON.stringify(saved);
    const legacy = restoreCameraView(saved.camera, { ...saved, aspect: 0.7 });
    const phone = restoreCameraView(saved.camera, {
      ...saved,
      aspect: 0.7,
      min,
      max,
    });
    assert.ok(
      phone.zoom > legacy.zoom * 1.2,
      "unused wide space must not make a tall room tiny on a phone",
    );
    const camera = restoredCamera(phone, orthographic);
    for (let corner = 0; corner < 8; corner++) {
      const point = new THREE.Vector3(
        ...min.map((n, i) => ((corner >> i) & 1 ? max[i] : n)),
      ).project(camera);
      assert.ok(
        Math.abs(point.x) <= 1.001 && Math.abs(point.y) <= 1.001,
        "all room corners remain visible",
      );
    }
    for (const aspect of [0.5, 2, 0.7, 1.2, 2])
      restoreCameraView(saved.camera, { ...saved, aspect, min, max });
    assert.equal(
      JSON.stringify(saved),
      original,
      "rendering does not rewrite the authored snapshot",
    );
    const desktop = restoreCameraView(saved.camera, {
      ...saved,
      aspect: 2,
      min,
      max,
    });
    assert.equal(desktop.zoom, 1);
    assert.deepEqual(desktop.target, saved.camera.target);
  });
