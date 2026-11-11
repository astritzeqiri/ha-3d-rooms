import { houseViewSummary } from "../shared/house-presentation.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { validatePlacement, houseModels, houseKey } from "../shared/house.mjs";
const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 4, 1];
const floors = [
  { id: "first", name: "1st floor", minY: 0, maxY: 2.8 },
  { id: "second", name: "2nd floor", minY: 2.8, maxY: 6 },
];
const placement = () => ({
  schemaVersion: 1,
  houseId: "my-house",
  houseName: "My house",
  roomId: "hallway",
  transform: [...transform],
  floors: structuredClone(floors),
  floorIds: ["first", "second"],
});
const room = (id, y) => ({
  id,
  title: id,
  housePlacement: { ...placement(), roomId: id },
  controls: [
    {
      id: "light",
      label: "Light",
      type: "light",
      position: [0, y, 0],
      nodeIds: ["fixture"],
      capabilities: ["on_off"],
    },
  ],
  bindings: { light: `light.${id}` },
  sceneRevision: id,
  importedAt: "2026-11-07",
});
test("placement accepts multi-floor rooms and rejects scaling, mirror, bad floors and unknown membership", () => {
  assert.deepEqual(validatePlacement(placement()), placement());
  for (const mutate of [
    (p) => (p.transform[0] = 2),
    (p) => (p.transform[0] = -1),
    (p) => (p.transform[5] = -1),
    (p) => p.floorIds.push("unknown"),
    (p) => (p.floors[0].maxY = 0),
    (p) => p.floors.push(p.floors[0]),
    (p) => (p.transform[12] = NaN),
  ]) {
    const p = placement();
    mutate(p);
    assert.throws(() => validatePlacement(p));
  }
});
test("independent uploads assemble at saved positions, isolate duplicate control IDs and share bindings", () => {
  const a = room("office", 1),
    b = room("hallway", 4);
  a.housePlacement.floorIds = ["first"];
  const views = houseModels([b, a]);
  const all = views.find((v) => !v.houseFloor),
    first = views.find((v) => v.houseFloor?.id === "first"),
    second = views.find((v) => v.houseFloor?.id === "second");
  assert.equal(all.members.length, 2);
  assert.equal(all.controls.length, 2);
  assert.equal(new Set(all.controls.map((c) => c.id)).size, 2);
  assert.deepEqual(
    all.controls.find((c) => c.sourceModel === "office").position,
    [10, 1, 4],
  );
  assert.equal(first.members.length, 2);
  assert.equal(first.controls.length, 1);
  assert.equal(second.members.length, 1);
  assert.equal(second.controls[0].sourceModel, "hallway");
  assert.equal(all.bindings[all.controls[0].id], "light.hallway");
  b.bindings.light = "light.new";
  assert.equal(
    houseModels([b, a])[0].bindings[all.controls[0].id],
    "light.new",
  );
  assert.equal(
    houseModels([a, b])
      .find((v) => !v.houseFloor)
      .controls.find((c) => c.sourceModel === "office").id,
    all.controls.find((c) => c.sourceModel === "office").id,
  );
  assert.deepEqual(b.housePlacement.transform, transform);
});
test("house IDs separate homes and view IDs / control IDs stay stable", () => {
  const a = room("office", 1),
    b = room("other", 1);
  b.housePlacement.houseId = "other-home";
  const views = houseModels([a, b]);
  assert.equal(views.filter((v) => !v.houseFloor).length, 2);
  assert.equal(houseKey(""), "cbf29ce484222325");
});

test("house library summaries describe rooms and floor scope, never entity connection counts", () => {
  const model = {
    houseView: true,
    members: [{}, {}],
    controls: [{}, {}],
    bindings: {},
  };
  assert.equal(houseViewSummary(model), "2 rooms · Whole house");
  assert.equal(
    houseViewSummary({
      ...model,
      members: [{}],
      houseFloor: { name: "Upper floor" },
    }),
    "1 room · Upper floor",
  );
});

test("house and floor views combine room daylight windows at placed positions", () => {
  const a = room("office", 1),
    b = room("hallway", 4);
  a.controls.push({
    id: "blind",
    label: "Blind",
    type: "cover",
    position: [0, 1, 0],
    nodeIds: [],
  });
  a.daylight = {
    mode: "day",
    entity: "sun.sun",
    windows: [
      {
        id: "window",
        nodeId: "glass",
        position: [1, 1.5, 0],
        inward: [0, 0, 1],
        width: 1,
        height: 1.2,
        coverId: "blind",
      },
    ],
  };
  const views = houseModels([a, b]);
  const all = views.find((v) => !v.houseFloor),
    second = views.find((v) => v.houseFloor?.id === "second");
  assert.equal(all.daylight.mode, "day");
  assert.deepEqual(all.daylight.windows[0].position, [11, 1.5, 4]);
  assert.deepEqual(all.daylight.windows[0].inward, [0, 0, 1]);
  assert.equal(
    all.daylight.windows[0].coverId,
    all.controls.find(
      (c) => c.sourceModel === "office" && c.sourceControl === "blind",
    ).id,
  );
  assert.equal(second.daylight, undefined);
  assert.equal(a.daylight.windows[0].id, "window");
});
test("house views name their rooms", () => {
  const [all] = houseModels([room("office", 1), room("hallway", 4)]);
  assert.deepEqual(all.roomTitles, { office: "office", hallway: "hallway" });
});
