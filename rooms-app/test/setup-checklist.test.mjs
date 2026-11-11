import test from "node:test";
import assert from "node:assert/strict";
import { roomSetupProgress, setupChecklist } from "../shared/workspace.mjs";

const room = (id, controls, bindings = {}, extra = {}) => ({
  id,
  controls,
  bindings,
  ...extra,
});
const light = (id, extra = {}) => ({ id, type: "light", ...extra });

test("progress counts visible devices, groups once and desks as one device", () => {
  const kitchen = room(
    "kitchen",
    [
      light("a"),
      light("b", { hidden: true }),
      light("c", { lightGroupPrimary: false }),
      { id: "h", type: "number" },
      { id: "m", type: "cover" },
    ],
    { a: "light.a", m: "cover.desk" },
    { devices: [{ id: "desk", height: "h", motion: "m", macros: [] }] },
  );
  assert.deepEqual(roomSetupProgress(kitchen), { total: 2, connected: 2 });
});

test("the checklist follows connections, icons and saved views", () => {
  const office = room("office", [light("a"), light("b")], { a: "light.a" });
  const hall = room("hall", [light("c")], {});
  let list = setupChecklist({ rooms: [office, hall], spaceIds: ["house"] });
  assert.equal(list.done, 0);
  assert.equal(list.steps[0].detail, "1 of 3 connected");
  assert.equal(list.steps[0].room, "office");
  hall.controls[0].icon = "mdi:lamp";
  list = setupChecklist({
    rooms: [office, hall],
    views: [{ layers: [{ model: "house" }] }],
    spaceIds: ["house", "office", "hall"],
  });
  assert.deepEqual(
    list.steps.map((s) => s.done),
    [false, true, true],
  );
  office.bindings.b = "light.b";
  hall.bindings.c = "light.c";
  assert.equal(
    setupChecklist({ rooms: [office, hall], views: [], spaceIds: [] }).steps[0]
      .done,
    true,
  );
});
