import test from "node:test";
import assert from "node:assert/strict";
import { describeEntity, controlCall } from "../dashboard/more-info.mjs";
import {
  createIconResolver,
  registryIcons,
} from "../dashboard/standalone-icons.mjs";

const light = (attributes = {}, state = "on") => ({
  entity_id: "light.lamp",
  state,
  attributes: { friendly_name: "Lamp", ...attributes },
});

test("a colour light offers power, brightness, temperature, colour and effects", () => {
  const d = describeEntity(
    light({
      supported_color_modes: ["color_temp", "xy"],
      min_color_temp_kelvin: 2000,
      max_color_temp_kelvin: 6500,
      supported_features: 4,
      effect_list: ["blink"],
      brightness: 128,
      rgb_color: [255, 0, 0],
    }),
  );
  assert.deepEqual(
    d.controls.map((c) => c.kind),
    ["toggle", "slider", "slider", "color", "select"],
  );
  assert.equal(d.controls[1].format(255), "100%");
  assert.deepEqual(d.controls[3].value, [0, 100]);
});

test("an on/off light has only the power switch; unavailable has no controls", () => {
  assert.deepEqual(
    describeEntity(light({ supported_color_modes: ["onoff"] })).controls.map(
      (c) => c.kind,
    ),
    ["toggle"],
  );
  assert.deepEqual(describeEntity(light({}, "unavailable")).controls, []);
  assert.equal(describeEntity(undefined).unavailable, true);
});

test("covers, locks and climate map to their own services", () => {
  const cover = describeEntity({
    entity_id: "cover.blind",
    state: "open",
    attributes: { supported_features: 15, current_position: 40 },
  });
  assert.deepEqual(
    cover.controls[0].buttons.map((b) => b.service),
    ["open_cover", "stop_cover", "close_cover"],
  );
  assert.deepEqual(controlCall(cover, cover.controls[1], 70), [
    "cover",
    "set_cover_position",
    { entity_id: "cover.blind", position: 70 },
  ]);
  const lock = describeEntity({
    entity_id: "lock.door",
    state: "locked",
    attributes: {},
  });
  assert.deepEqual(controlCall(lock, lock.controls[0], "unlock"), [
    "lock",
    "unlock",
    { entity_id: "lock.door" },
  ]);
  const ac = describeEntity({
    entity_id: "climate.ac",
    state: "cool",
    attributes: {
      temperature: 22,
      hvac_modes: ["off", "cool"],
      min_temp: 16,
      max_temp: 30,
    },
  });
  assert.deepEqual(
    ac.controls.map((c) => c.kind),
    ["stepper", "select"],
  );
  assert.deepEqual(controlCall(ac, ac.controls[1], "off"), [
    "climate",
    "set_hvac_mode",
    { entity_id: "climate.ac", hvac_mode: "off" },
  ]);
});

test("light commands go to the light domain with the changed value only", () => {
  const d = describeEntity(light({ supported_color_modes: ["brightness"] }));
  assert.deepEqual(controlCall(d, d.controls[0], false), [
    "light",
    "turn_off",
    { entity_id: "light.lamp" },
  ]);
  assert.deepEqual(controlCall(d, d.controls[1], 90), [
    "light",
    "turn_on",
    { entity_id: "light.lamp", brightness: 90 },
  ]);
});

test("dragging light brightness to the bottom turns the light off", () => {
  const d = describeEntity(light({ supported_color_modes: ["brightness"] }));
  const brightness = d.controls[1];
  assert.equal(brightness.min, 0);
  assert.deepEqual(controlCall(d, brightness, 0), [
    "light",
    "turn_off",
    { entity_id: "light.lamp" },
  ]);
  assert.equal(brightness.format(0), "Off");
  assert.equal(brightness.format(1), "1%");
  assert.equal(brightness.format(255), "100%");
});

test("icon resolver: curated and custom icons, modules loaded once and only when needed", async () => {
  let loads = 0;
  const sets = {};
  const resolver = createIconResolver({
    customIcons: () => sets,
    loadModules: async () => {
      loads++;
      sets.local = {
        getIcon: async (name) => ({
          path: "M0 0h24v24H0z",
          viewBox: "0 0 24 24",
          name,
        }),
      };
    },
    loadMdi: async () => ({ mdiBedKing: "M1 1h2v2H1z" }),
  });
  assert.match((await resolver.resolve("mdi:lightbulb")).html, /<path d="M/);
  assert.equal(loads, 0);
  assert.equal(
    (await resolver.resolve("mdi:bed-king")).html,
    '<path d="M1 1h2v2H1z"/>',
  );
  assert.equal(await resolver.resolve("mdi:not-a-real-icon"), undefined);
  assert.ok(await resolver.resolve("local:front-door"));
  await resolver.resolve("local:other");
  assert.equal(loads, 1);
  assert.equal(await resolver.resolve("nope:icon"), undefined);
  assert.equal(await resolver.resolve("plain"), undefined);
});

test("registry icons come from the entity registry display list", () => {
  const icon = registryIcons({
    entities: [{ ei: "light.a", ic: "mdi:ceiling-light" }, { ei: "light.b" }],
  });
  assert.equal(icon("light.a"), "mdi:ceiling-light");
  assert.equal(icon("light.b"), undefined);
  assert.equal(registryIcons(null)("x"), undefined);
});

import {
  rgbToHs,
  hsToRgb,
  relativeTime,
  attributeRows,
} from "../dashboard/more-info-model.mjs";
test("colour helpers round-trip and the colour command uses hs_color", () => {
  assert.deepEqual(rgbToHs([255, 0, 0]), [0, 100]);
  assert.deepEqual(rgbToHs([255, 255, 255]), [0, 0]);
  assert.deepEqual(hsToRgb([120, 100]), [0, 255, 0]);
  const d = describeEntity(
    light({ supported_color_modes: ["hs"], hs_color: [200, 40] }),
  );
  const color = d.controls.find((c) => c.kind === "color");
  assert.deepEqual(color.value, [200, 40]);
  assert.deepEqual(controlCall(d, color, [10, 20]), [
    "light",
    "turn_on",
    { entity_id: "light.lamp", hs_color: [10, 20] },
  ]);
});
test("last-changed text and the attributes list", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  assert.equal(relativeTime("2026-11-12T11:59:50Z", now), "just now");
  assert.match(relativeTime("2026-11-12T11:55:00Z", now), /5 minutes ago/);
  assert.equal(relativeTime("nonsense", now), "");
  const rows = attributeRows({
    friendly_name: "Hidden",
    supported_features: 4,
    brightness: 120,
    xy_color: [0.5, 0.4],
    note: "",
  });
  assert.deepEqual(rows, [
    ["Brightness", "120"],
    ["Xy color", "0.5, 0.4"],
  ]);
});

test("covers that only open and close get a two-way switch and a garage picture", async () => {
  const { describeEntity, coverIcon, sinceText } =
    await import("../dashboard/more-info-model.mjs");
  const garage = describeEntity({
    entity_id: "cover.garage_door",
    state: "closed",
    attributes: { supported_features: 3, device_class: "garage" },
  });
  assert.ok(garage.controls.some((c) => c.kind === "cover-toggle"));
  assert.equal(garage.deviceClass, "garage");
  const blind = describeEntity({
    entity_id: "cover.blind",
    state: "open",
    attributes: { supported_features: 15, current_position: 40 },
  });
  assert.ok(!blind.controls.some((c) => c.kind === "cover-toggle"));
  assert.equal(coverIcon("garage", false), "garage");
  assert.equal(coverIcon("garage", true), "garageOpen");
  assert.equal(coverIcon("door", true), "doorOpen");
  assert.equal(coverIcon("shade", false), "blindsClosed");
  assert.equal(coverIcon(undefined, true), "shutterOpen");
  const now = Date.parse("2026-11-12T12:00:00Z");
  assert.match(sinceText("2026-11-12T11:59:37Z", now), /23 seconds ago/);
  assert.match(sinceText("2026-11-12T11:55:00Z", now), /5 minutes ago/);
});
