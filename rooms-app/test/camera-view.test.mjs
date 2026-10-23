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
