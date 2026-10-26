import test from "node:test";
import assert from "node:assert/strict";
import {
  CUBE_DIRECTIONS,
  directionName,
  projectViewCube,
} from "../shared/view-cube.mjs";
import { CAMERA_PRESETS, cameraPreset } from "../shared/camera-presets.mjs";
import { floorFrame } from "../shared/floor-view.mjs";
test("view cube exposes six faces, twelve edges and eight distinct corners", () => {
  assert.equal(CUBE_DIRECTIONS.length, 26);
  assert.equal(new Set(CUBE_DIRECTIONS.map((d) => d.name)).size, 26);
  for (const [kind, count] of [
    ["face", 6],
    ["edge", 12],
    ["corner", 8],
  ])
    assert.equal(CUBE_DIRECTIONS.filter((d) => d.kind === kind).length, count);
  for (const d of CUBE_DIRECTIONS) {
    const preset = cameraPreset(d.name);
    const frame = floorFrame(
      [-1, -1, -1],
      [1, 1, 1],
      1,
      preset.tilt,
      preset.heading,
    );
    const offset = frame.position.map((v, i) => v - frame.target[i]),
      len = Math.hypot(...offset),
      expected = Math.hypot(...d.vector);
    offset.forEach((v, i) =>
      assert.ok(Math.abs(v / len - d.vector[i] / expected) < 1e-10),
    );
    assert.deepEqual(preset.camera, undefined);
  }
  assert.equal(Object.keys(CAMERA_PRESETS).length, 26);
});
test("projected cube hit regions identify faces, edges and corners as camera turns", () => {
  const root = Math.sqrt;
  const iso = {
    normal: [1 / root(3), 1 / root(3), 1 / root(3)],
    right: [1 / root(2), 0, -1 / root(2)],
    up: [-1 / root(6), 2 / root(6), -1 / root(6)],
  };
  const faces = projectViewCube(iso);
  assert.deepEqual(
    new Set(faces.map((f) => f.name)),
    new Set(["top", "front", "right"]),
  );
  assert.equal(faces.length, 3);
  assert.equal(
    faces.flatMap((f) => f.zones).filter((z) => z.name === "top-front-right")
      .length,
    3,
    "the corner is clickable from every adjacent face",
  );
  for (const face of faces)
    for (const zone of face.zones) {
      assert.ok(CAMERA_PRESETS[zone.name]);
      assert.ok(zone.points.flat().every(Number.isFinite));
      const area =
        Math.abs(
          zone.points.reduce((sum, [x, y], i) => {
            const [nx, ny] = zone.points[(i + 1) % 4];
            return sum + x * ny - nx * y;
          }, 0),
        ) / 2;
      assert.ok(area > 1, "hit polygons must have usable nonzero area");
    }
  const front = projectViewCube({
    normal: [0, 0, 1],
    right: [1, 0, 0],
    up: [0, 1, 0],
  });
  assert.equal(front.length, 1);
  assert.equal(front[0].name, "front");
  assert.ok(front[0].zones.some((z) => z.name === "top-front-right"));
  const back = projectViewCube({
    normal: [0, 0, -1],
    right: [-1, 0, 0],
    up: [0, 1, 0],
  });
  assert.equal(back[0].name, "back");
  assert.equal(directionName([1, 1, -1]), "top-back-right");
});
