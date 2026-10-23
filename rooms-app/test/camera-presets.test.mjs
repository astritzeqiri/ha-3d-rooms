import test from "node:test";
import assert from "node:assert/strict";
import { cameraPreset, CAMERA_PRESETS } from "../shared/camera-presets.mjs";
import { floorFrame, perspectiveFrame } from "../shared/floor-view.mjs";

test("fixed camera views face all six room axes and clear old pan/zoom", () => {
  const directions = {
    top: [0, 1, 0],
    bottom: [0, -1, 0],
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
  };
  for (const name of Object.keys(directions)) {
    for (const mode of ["front", "floor"]) {
      const preset = cameraPreset(name, mode);
      assert.equal(preset.camera, undefined);
      assert.equal(preset.zoom, 1);
      const frame = (mode === "floor" ? floorFrame : perspectiveFrame)(
        [-3, 0, -4],
        [3, 3, 4],
        1.5,
        preset.tilt,
        preset.heading,
      );
      const delta = frame.position.map((v, i) => v - frame.target[i]);
      const length = Math.hypot(...delta);
      delta.forEach((v, i) =>
        assert.ok(Math.abs(v / length - directions[name][i]) < 1e-10),
      );
      assert.ok(
        Math.abs(
          frame.up.reduce((sum, v, i) => sum + (v * delta[i]) / length, 0),
        ) < 1e-10,
        "pole views keep a valid up axis",
      );
    }
  }
  assert.equal(cameraPreset("reset").tilt, 28);
  assert.equal(cameraPreset("reset", "floor").tilt, 8);
  assert.throws(() => cameraPreset("unknown"), /Unknown/);
});
