import test from "node:test";
import assert from "node:assert/strict";
import { rankEntities } from "../shared/entity-picker.mjs";

const entity = (id, name, state = "on") => ({
  entity_id: id,
  state,
  attributes: { friendly_name: name },
});
const entities = [
  entity("light.hall", "Hallway"),
  entity("light.kitchen_ceiling", "Kitchen ceiling light"),
  entity("light.kitchen_spots", "Kitchen spots"),
  entity("switch.fan", "Kitchen fan"),
  entity("cover.kitchen_blind", "Kitchen blind"),
];
const lights = /^(light|switch)\./;

test("only entities of the right domain are offered", () => {
  const rows = rankEntities(entities, { label: "Ceiling", pattern: lights });
  assert.deepEqual(rows.map((r) => r.entity.entity_id).sort(), [
    "light.hall",
    "light.kitchen_ceiling",
    "light.kitchen_spots",
    "switch.fan",
  ]);
});

test("entities sharing words with the device name are suggested first", () => {
  const rows = rankEntities(entities, {
    label: "Kitchen ceiling light",
    pattern: lights,
  });
  assert.equal(rows[0].entity.entity_id, "light.kitchen_ceiling");
  assert.ok(rows[0].suggested);
  assert.equal(rows.at(-1).entity.entity_id, "light.hall");
  assert.equal(rows.at(-1).suggested, false);
});

test("the current choice is listed first and is not shown as a suggestion", () => {
  const rows = rankEntities(entities, {
    label: "Kitchen ceiling light",
    pattern: lights,
    selectedId: "light.hall",
  });
  assert.equal(rows[0].entity.entity_id, "light.hall");
  assert.ok(rows[0].selected);
  assert.equal(rows[0].suggested, false);
});

test("search requires every term to match the name or entity id", () => {
  const rows = rankEntities(entities, {
    label: "Anything",
    pattern: lights,
    query: "kitchen spot",
  });
  assert.deepEqual(
    rows.map((r) => r.entity.entity_id),
    ["light.kitchen_spots"],
  );
  assert.equal(
    rankEntities(entities, { pattern: lights, query: "nothing here" }).length,
    0,
  );
});

test("a missing saved entity does not break ranking", () => {
  const rows = rankEntities(entities, {
    label: "Hall",
    pattern: lights,
    selectedId: "light.gone",
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !r.selected));
});
