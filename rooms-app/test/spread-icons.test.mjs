import test from "node:test";
import assert from "node:assert/strict";
import { spreadIcons } from "../shared/spread-icons.mjs";

const apart = (a, b, offsets, items) =>
  Math.hypot(
    items[a].x + offsets[a].dx - items[b].x - offsets[b].dx,
    items[a].y + offsets[a].dy - items[b].y - offsets[b].dy,
  );

test("icons that do not touch stay exactly where they are", () => {
  const items = [
    { x: 10, y: 10, r: 16 },
    { x: 100, y: 10, r: 16 },
  ];
  assert.deepEqual(spreadIcons(items), [
    { dx: 0, dy: 0 },
    { dx: 0, dy: 0 },
  ]);
});

test("overlapping icons are pushed apart until they no longer touch", () => {
  const items = [
    { x: 100, y: 100, r: 16 },
    { x: 104, y: 112, r: 16 },
    { x: 96, y: 124, r: 16 },
    { x: 300, y: 300, r: 16 },
  ];
  const offsets = spreadIcons(items, { gap: 6 });
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [0, 2],
  ])
    assert.ok(apart(a, b, offsets, items) >= 32 + 6 - 0.5, `${a}-${b}`);
  assert.deepEqual(offsets[3], { dx: 0, dy: 0 }, "far icon never moves");
  // Same input, same answer: no jitter while the camera moves.
  assert.deepEqual(spreadIcons(items, { gap: 6 }), offsets);
});

test("icons move at most maxShift from their true spot, even when stacked", () => {
  const items = Array.from({ length: 6 }, () => ({ x: 50, y: 50, r: 16 }));
  for (const { dx, dy } of spreadIcons(items, { maxShift: 30 }))
    assert.ok(Math.hypot(dx, dy) <= 30.1);
  const two = spreadIcons([
    { x: 50, y: 50, r: 16 },
    { x: 50, y: 50, r: 16 },
  ]);
  assert.ok(Math.hypot(two[0].dx - two[1].dx, two[0].dy - two[1].dy) > 30);
});
