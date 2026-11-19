import test from "node:test";
import assert from "node:assert/strict";
import { houseSummary } from "../shared/house-summary.mjs";

const model = {
  controls: [
    { id: "l1", type: "light", label: "Ceiling" },
    { id: "l2", type: "light", label: "Lamp" },
    { id: "l3", type: "light", label: "Group", lightGroupPrimary: false },
    { id: "l4", type: "light", label: "Hidden", hidden: true },
    { id: "s1", type: "cover", label: "Shade" },
    { id: "d1", type: "cover", label: "Balcony door", roomTitle: "Living" },
    { id: "w1", type: "cover", label: "Window" },
    { id: "k1", type: "lock", label: "Front door" },
    { id: "v1", type: "vacuum", label: "Robot" },
    { id: "c1", type: "climate", label: "AC" },
  ],
  bindings: {
    l1: "light.a",
    l2: "light.b",
    l3: "light.c",
    l4: "light.d",
    s1: "cover.shade",
    d1: "binary_sensor.balcony",
    w1: "cover.window",
    k1: "lock.front",
    v1: "vacuum.robot",
    c1: "climate.ac",
  },
};
const states = (over = {}) => ({
  "light.a": { state: "on" },
  "light.b": { state: "off" },
  "light.c": { state: "on" },
  "light.d": { state: "on" },
  "cover.shade": { state: "open", attributes: { device_class: "shade" } },
  "binary_sensor.balcony": {
    state: "off",
    attributes: { device_class: "door" },
  },
  "cover.window": { state: "closed", attributes: { device_class: "window" } },
  "lock.front": { state: "locked" },
  "vacuum.robot": { state: "docked" },
  "climate.ac": { state: "off" },
  ...over,
});
const texts = (s) => houseSummary(model, s).map((c) => c.text);

test("a quiet house: lights, closed doors, locked; idle robot and AC say nothing", () => {
  assert.deepEqual(texts(states()), [
    "1 light on",
    "Doors & windows closed",
    "Locked",
  ]);
});

test("exceptions are named and toned", () => {
  const chips = houseSummary(
    model,
    states({
      "light.a": { state: "off" },
      "binary_sensor.balcony": {
        state: "on",
        attributes: { device_class: "door" },
      },
      "lock.front": { state: "unlocked" },
      "vacuum.robot": { state: "cleaning" },
      "climate.ac": { state: "cool" },
    }),
  );
  assert.deepEqual(
    chips.map((c) => [c.kind, c.text, c.tone]),
    [
      ["light", "Lights off", ""],
      ["opening", "Balcony door open", "open"],
      ["lock", "Front door unlocked", "unlocked"],
      ["vacuum", "Vacuum cleaning", "cleaning"],
      ["climate", "Cooling", "cool"],
    ],
  );
  assert.deepEqual(chips[1].ids, ["d1"]);
});

test("several open, unavailable devices skipped, nothing shown for an empty view", () => {
  assert.deepEqual(
    texts(
      states({
        "binary_sensor.balcony": {
          state: "on",
          attributes: { device_class: "door" },
        },
        "cover.window": {
          state: "open",
          attributes: { device_class: "window" },
        },
        "light.a": { state: "unavailable" },
        "light.b": { state: "unavailable" },
      }),
    ),
    ["2 doors & windows open", "Locked"],
  );
  assert.deepEqual(houseSummary({ controls: [], bindings: {} }, {}), []);
});

test("extra entities on the view count: an open garage is not 'closed'", () => {
  const all = states({
    "cover.garage": {
      state: "open",
      attributes: { device_class: "garage", friendly_name: "Garage opener" },
    },
    "binary_sensor.side": {
      state: "off",
      attributes: { device_class: "garage_door" },
    },
    "binary_sensor.motion": {
      state: "on",
      attributes: { device_class: "motion" },
    },
    "cover.blind": { state: "open", attributes: { device_class: "blind" } },
  });
  const extras = [
    { entity: "cover.garage" },
    { entity: "binary_sensor.side", name: "Side door" },
    { entity: "binary_sensor.motion" },
    { entity: "cover.blind" },
    { entity: "lock.front" }, // already a device of the house: counted once
    { entity: "cover.gone" }, // no state: ignored
  ];
  const chips = houseSummary(model, all, extras);
  const opening = chips.find((c) => c.kind === "opening");
  assert.equal(opening.text, "Garage opener open");
  assert.deepEqual(opening.ids, ["entity:cover.garage"]);
  assert.equal(chips.find((c) => c.kind === "lock").ids.length, 1);

  all["binary_sensor.side"].state = "on";
  assert.equal(
    houseSummary(model, all, extras).find((c) => c.kind === "opening").text,
    "2 doors & windows open",
  );
});
