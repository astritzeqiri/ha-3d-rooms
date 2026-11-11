import test from "node:test";
import assert from "node:assert/strict";
import {
  coveredByOtherRoom,
  unpackDepth,
  viewDistance,
} from "../shared/occlusion.mjs";

// What the shader writes for a window depth z (the same packing, in JS).
const pack = (z) => {
  let p = [1, 255, 65025].map((m) => (z * m) % 1);
  p = [p[0] - p[1] / 255, p[1] - p[2] / 255, p[2]];
  return p.map((v) => Math.round(v * 255));
};

test("depth survives the three-byte packing closely enough for decimetres", () => {
  for (const z of [0.1, 0.5, 0.97, 0.9993, 0.99999]) {
    const [g, b, a] = pack(z);
    assert.ok(Math.abs(unpackDepth(g, b, a) - z) < 1e-6, `z ${z}`);
  }
});

test("view distance matches for perspective and orthographic cameras", () => {
  // The near and far planes come back as themselves.
  assert.ok(Math.abs(viewDistance(-1, 0.05, 300) - 0.05) < 1e-9);
  assert.ok(Math.abs(viewDistance(1, 0.05, 300) - 300) < 1e-6);
  assert.ok(Math.abs(viewDistance(-1, 1, 100, true) - 1) < 1e-9);
  assert.ok(Math.abs(viewDistance(1, 1, 100, true) - 100) < 1e-9);
  assert.ok(Math.abs(viewDistance(0, 1, 100, true) - 50.5) < 1e-9);
});

test("an icon is covered when most pixels around it show another room nearer", () => {
  const near = { room: 2, distance: 20 },
    own = { room: 1, distance: 20.05 },
    empty = { room: 0, distance: 1000 };
  // The office (1) light at 20.5 m under the bedroom (2)'s floor at 20 m.
  assert.equal(coveredByOtherRoom(Array(9).fill(near), 1, 20.5), true);
  // Its own room's surface, or nothing, never covers it.
  assert.equal(coveredByOtherRoom(Array(9).fill(own), 1, 20.5), false);
  assert.equal(coveredByOtherRoom(Array(9).fill(empty), 1, 20.5), false);
  // Another room only just in front (a shared wall) is within tolerance.
  assert.equal(
    coveredByOtherRoom(Array(9).fill({ room: 2, distance: 20.45 }), 1, 20.5),
    false,
  );
  // Only an edge of the icon covered: it stays.
  assert.equal(
    coveredByOtherRoom(
      [...Array(3).fill(near), ...Array(6).fill(own)],
      1,
      20.5,
    ),
    false,
  );
  assert.equal(coveredByOtherRoom([], 1, 20.5), false);
});
