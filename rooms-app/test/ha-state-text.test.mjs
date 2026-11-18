import test from "node:test";
import assert from "node:assert/strict";
import { pageLanguage, pickStateText } from "../shared/ha-state-text.mjs";

const resources = {
  "component.binary_sensor.entity_component.door.state.off": "Closed",
  "component.binary_sensor.entity_component.door.state.on": "Open",
  "component.binary_sensor.entity_component._.state.off": "Off",
  "component.roborock.entity.select.mop_mode.state.deep": "Deep",
};
const door = (state) => ({
  entity_id: "binary_sensor.balcony_door",
  state,
  attributes: { device_class: "door" },
});

test("state words follow Home Assistant's translations", () => {
  assert.equal(pickStateText(door("off"), resources), "Closed");
  assert.equal(pickStateText(door("on"), resources), "Open");
  assert.equal(
    pickStateText(
      { entity_id: "binary_sensor.x", state: "off", attributes: {} },
      resources,
    ),
    "Off",
  );
  assert.equal(
    pickStateText({ entity_id: "select.mop", state: "deep" }, resources, {
      pl: "roborock",
      tk: "mop_mode",
    }),
    "Deep",
  );
  assert.equal(pickStateText(door("off"), resources, undefined, "on"), "Open");
});

test("without a translation: shared words, numbers with units, tidy text", () => {
  assert.equal(pickStateText(door("unavailable")), "Unavailable");
  assert.equal(
    pickStateText({
      entity_id: "sensor.t",
      state: "21.456",
      attributes: { unit_of_measurement: "°C" },
    }),
    "21.46 °C",
  );
  assert.equal(
    pickStateText({
      entity_id: "sensor.b",
      state: "80",
      attributes: { unit_of_measurement: "%" },
    }),
    "80%",
  );
  assert.equal(
    pickStateText({ entity_id: "sensor.s", state: "above_horizon" }),
    "Above horizon",
  );
});

test("the page language follows Home Assistant's choice", () => {
  const storage = { getItem: () => '"de"' };
  assert.equal(pageLanguage(storage, { language: "fr" }, "it-IT"), "de");
  assert.equal(pageLanguage({ getItem: () => null }, {}, "it-IT"), "it");
  assert.equal(pageLanguage(null, null, undefined), "en");
});
