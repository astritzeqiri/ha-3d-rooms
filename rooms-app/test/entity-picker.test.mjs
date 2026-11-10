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

test("confident matches are suggested for unconnected devices only", async () => {
  const { suggestBindings } = await import("../shared/entity-picker.mjs");
  const devices = [
    { id: "ceiling", label: "Ceiling light", pattern: lights },
    { id: "spots", label: "Worktop spots", pattern: lights },
    { id: "fan", label: "Extractor fan", pattern: lights },
    { id: "blind", label: "Window blind", pattern: /^cover\./ },
    { id: "mystery", label: "Pendant", pattern: lights },
  ];
  assert.deepEqual(
    suggestBindings(devices, entities, {
      bindings: { fan: "switch.fan" },
      context: "Kitchen",
    }),
    [
      {
        controlId: "ceiling",
        entityId: "light.kitchen_ceiling",
        name: "Kitchen ceiling light",
        strong: true,
      },
      {
        controlId: "spots",
        entityId: "light.kitchen_spots",
        name: "Kitchen spots",
        strong: false,
      },
      {
        controlId: "blind",
        entityId: "cover.kitchen_blind",
        name: "Kitchen blind",
        strong: false,
      },
    ],
  );
});

test("ambiguous matches and shared entities are not suggested twice", async () => {
  const { suggestBindings } = await import("../shared/entity-picker.mjs");
  const two = [
    entity("light.bed_left", "Bedroom lamp left"),
    entity("light.bed_right", "Bedroom lamp right"),
  ];
  // "Bedside" matches neither; "Bedroom" alone comes only from the room.
  assert.deepEqual(
    suggestBindings([{ id: "a", label: "Bedside", pattern: lights }], two, {
      context: "Bedroom",
    }),
    [],
  );
  const matches = suggestBindings(
    [
      { id: "a", label: "Left reading", pattern: lights },
      { id: "b", label: "Bedroom left reading", pattern: lights },
    ],
    two,
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].entityId, "light.bed_left");
});

test("a single shared word in a long device name is not suggested", async () => {
  const { suggestBindings } = await import("../shared/entity-picker.mjs");
  const house = [
    entity("light.kitchen_lights", "Kitchen Lights"),
    entity("light.ceiling_lights", "Ceiling Lights"),
  ];
  assert.deepEqual(
    suggestBindings(
      [
        { id: "row", label: "Sliding-door row · kitchen end", pattern: lights },
        {
          id: "mid",
          label: "Middle ceiling light · sofa side",
          pattern: lights,
        },
      ],
      house,
      { context: "Living room" },
    ),
    [],
  );
});
