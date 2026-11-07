import { markerTrayHeight } from "../shared/marker-settings.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLightGroups,
  validateLightGroups,
} from "../shared/light-groups.mjs";
import { deviceEntries } from "../shared/device.mjs";
import { houseModels } from "../shared/house.mjs";
const controls = [
  { id: "a", type: "light", label: "A", position: [0, 2, 0] },
  { id: "b", type: "light", label: "B", position: [2, 4, 0] },
  { id: "c", type: "climate", label: "AC", position: [3, 2, 0] },
];
const group = {
  id: "lights",
  label: "Dining lights",
  controls: ["a", "b"],
  entityId: "light.dining",
};
test("one logical control keeps two original fixture positions and a shared binding", () => {
  const source = {
    id: "room",
    title: "Room",
    controls,
    bindings: { a: "light.old", b: "light.other" },
    lightGroups: [group],
  };
  const model = applyLightGroups(source);
  assert.deepEqual(
    deviceEntries(model).map((c) => c.label),
    ["Dining lights", "AC"],
  );
  assert.deepEqual(
    model.controls.map((c) => c.position),
    controls.map((c) => c.position),
  );
  assert.deepEqual(model.controls[0].markerPosition, [1, 3, 0]);
  assert.equal(model.bindings.a, "light.dining");
  assert.equal(model.bindings.b, "light.dining");
  assert.equal(source.bindings.a, "light.old");
  assert.equal(
    markerTrayHeight({ _defaults: { placement: "tray" } }, model.controls),
    176,
  );
});
test("groups reject invalid membership, overlapping groups and incompatible entities", () => {
  assert.deepEqual(validateLightGroups([group], controls), [group]);
  for (const bad of [
    [{ ...group, controls: ["a"] }],
    [{ ...group, controls: ["a", "c"] }],
    [{ ...group, controls: ["a", "missing"] }],
    [{ ...group, entityId: "cover.bad" }],
    [group, { ...group, id: "other" }],
  ])
    assert.throws(() => validateLightGroups(bad, controls));
});
test("a clipped house floor picks a visible group representative and transforms its anchor", () => {
  const model = applyLightGroups({
    id: "room",
    title: "Room",
    controls,
    bindings: {},
    lightGroups: [group],
    housePlacement: {
      schemaVersion: 1,
      houseId: "home",
      houseName: "Home",
      roomId: "room",
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1],
      floors: [{ id: "up", name: "Up", minY: 3, maxY: 6 }],
      floorIds: ["up"],
    },
  });
  const floor = houseModels([model]).find((m) => m.houseFloor);
  assert.equal(floor.controls.length, 1);
  assert.equal(floor.controls[0].lightGroupPrimary, true);
  assert.deepEqual(floor.controls[0].markerPosition, [12, 4, 0]);
});

test("a hidden group member cannot be revealed by grouping or tray defaults", () => {
  const source = {
    id: "room",
    controls: structuredClone(controls),
    bindings: {},
    lightGroups: [group],
  };
  source.controls[1].hidden = true;
  const model = applyLightGroups(source);
  assert.ok(model.controls.slice(0, 2).every((c) => c.hidden));
  assert.deepEqual(
    deviceEntries(model).map((c) => c.id),
    ["c"],
  );
  assert.equal(
    markerTrayHeight(
      { _defaults: { visible: true, placement: "tray" } },
      model.controls,
    ),
    100,
  );
  assert.equal(deviceEntries(model, { includeHidden: true }).length, 2);
  assert.equal(source.controls[0].hidden, undefined);
});
