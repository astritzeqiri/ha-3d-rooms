import test from "node:test";
import assert from "node:assert/strict";
import { createDaylight } from "../shared/daylight.mjs";

const window = (id, sourceModel) => ({
  id,
  sourceModel,
  position: [0, 1, 0],
  inward: [0, 0, 1],
  width: 1,
  height: 1,
});

test("a house view lights only through the windows of the rooms it shows", () => {
  const daylight = createDaylight({
    mode: "day",
    windows: [window("a", "office"), window("b", "hall"), window("c")],
  });
  const sky = (id) =>
    daylight.group.children.find((o) => o.name === `daylight-sky-${id}`);
  daylight.setScope(["office"]);
  assert.equal(sky("a").visible, true);
  assert.equal(sky("b").visible, false);
  assert.equal(sky("c").visible, true, "windows without a room always show");
  daylight.update("day");
  const lights = daylight.group.children.filter((o) => o.isSpotLight);
  assert.deepEqual(
    lights.map((l) => l.visible),
    [true, false, true],
  );
  assert.equal(lights[1].intensity, 0, "hidden windows are not updated");
  daylight.setScope(null);
  assert.ok(daylight.group.children.every((o) => o.visible));
});
