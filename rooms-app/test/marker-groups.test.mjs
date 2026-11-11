import test from "node:test";
import assert from "node:assert/strict";
import { groupMarkers, roomCrowded } from "../shared/marker-groups.mjs";

const icon = (id, room, x, y, size = 32) => ({ id, room, x, y, size });

test("a room whose icons overlap becomes one group at their centre", () => {
  const groups = groupMarkers([
    icon("a", "living", 100, 100),
    icon("b", "living", 110, 100),
    icon("c", "living", 300, 100),
    icon("d", "office", 500, 100),
    icon("e", "office", 600, 100),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].room, "living");
  assert.deepEqual(groups[0].ids, ["a", "b", "c"]);
  assert.equal(groups[0].x, 170);
  assert.equal(groups[0].y, 100);
});

test("separate icons, single icons, open rooms and room-less icons stay as they are", () => {
  const items = [
    icon("a", "living", 100, 100),
    icon("b", "living", 105, 100),
    icon("c", "hall", 100, 300),
    icon("d", undefined, 100, 302),
    icon("e", undefined, 101, 302),
  ];
  assert.deepEqual(groupMarkers(items, { open: new Set(["living"]) }), []);
  assert.equal(roomCrowded(items, "living"), true);
  assert.equal(roomCrowded(items, "hall"), false);
});
