import test from "node:test";
import assert from "node:assert/strict";
import {
  houseFloorOptions,
  houseLoadPlan,
  selectHouseView,
} from "../shared/house-floors.mjs";
import { connectModel } from "../dashboard/transport.mjs";

const view = (id, floor, houseId = "home") => ({
  id,
  title: id,
  houseView: true,
  houseId,
  houseFloor: floor,
  controls: [],
  bindings: {},
  members: [{ model: "room", transform: [], nodeIds: {} }],
});
const ground = { id: "f1", name: "Ground floor", minY: -1, maxY: 2.6 };
const upper = { id: "f2", name: "First floor", minY: 2.6, maxY: 6 };
const models = [
  { id: "room", controls: [], bindings: {} },
  view("h-home--f1", ground),
  view("h-home", null),
  view("h-home--f2", upper),
  view("h-other", null, "other"),
  view("h-other--f1", ground, "other"),
];

test("floor options list the whole house first, then its own floors in order", () => {
  assert.deepEqual(houseFloorOptions(models, models[2]), [
    { id: "h-home", floorId: null, label: "Whole house" },
    { id: "h-home--f1", floorId: "f1", label: "Ground floor" },
    { id: "h-home--f2", floorId: "f2", label: "First floor" },
  ]);
  // A floor card offers the same choices as its whole-house card.
  assert.deepEqual(
    houseFloorOptions(models, models[3]).map((o) => o.id),
    ["h-home", "h-home--f1", "h-home--f2"],
  );
  assert.deepEqual(houseFloorOptions(models, models[0]), []);
  assert.deepEqual(houseFloorOptions([models[2]], models[2]), []);
  assert.deepEqual(houseFloorOptions(models, undefined), []);
});

test("only floors of the configured house can be selected", () => {
  assert.equal(selectHouseView(models, models[2], "h-home--f2"), models[3]);
  assert.equal(selectHouseView(models, models[2], undefined), models[2]);
  assert.equal(selectHouseView(models, models[2], "h-other--f1"), models[2]);
  assert.equal(selectHouseView(models, models[2], "room"), models[2]);
  assert.equal(selectHouseView(models, models[2], "removed"), models[2]);
});

test("a house card loads the whole house once, unless its switcher is off", async () => {
  const load = (config) =>
    connectModel(
      {},
      { preview_url: "http://127.0.0.1:5190/", ...config },
      "http://127.0.0.1:5190",
      async () => ({ ok: true, json: async () => structuredClone(models) }),
    ).then((c) => c.load());
  // A floor-configured card still loads every room so other floors switch in place.
  const floor = await load({ model: "h-home--f1" });
  assert.equal(floor.model.id, "h-home");
  assert.equal(floor.configured.id, "h-home--f1");
  assert.deepEqual(
    floor.floors.map((o) => o.label),
    ["Whole house", "Ground floor", "First floor"],
  );
  assert.deepEqual(
    floor.views.map((v) => v.id),
    ["h-home", "h-home--f1", "h-home--f2"],
  );
  const fixed = await load({ model: "h-home--f1", floor_selector: false });
  assert.equal(fixed.model.id, "h-home--f1");
  assert.deepEqual(fixed.views, []);
  const room = await load({ model: "room" });
  assert.equal(room.model.id, "room");
  assert.deepEqual(room.floors, []);
  assert.deepEqual(
    houseLoadPlan(models, models[2], true).views.map((v) => v.id),
    ["h-home", "h-home--f1", "h-home--f2"],
  );
});
