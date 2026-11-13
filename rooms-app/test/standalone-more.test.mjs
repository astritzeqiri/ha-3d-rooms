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
    mdiPath: async (name) =>
      name === "mdi:bed-king" ? "M1 1h2v2H1z" : undefined,
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

test("an alarm panel offers its supported modes and asks for the code when needed", async () => {
  const { alarmNeedsCode } = await import("../dashboard/more-info-model.mjs");
  // Alarmo: Home + Away supported, numeric code, arming needs the code too.
  const alarm = describeEntity({
    entity_id: "alarm_control_panel.alarmo",
    state: "disarmed",
    attributes: {
      friendly_name: "Alarmo",
      supported_features: 3,
      code_format: "number",
      code_arm_required: true,
    },
  });
  const control = alarm.controls[0];
  assert.equal(control.kind, "alarm");
  assert.deepEqual(
    control.modes.map((m) => m.label),
    ["Home", "Away", "Disarmed"],
  );
  assert.equal(control.mode, "disarmed");
  assert.equal(alarmNeedsCode(control, "alarm_arm_away"), true);
  assert.deepEqual(
    controlCall(alarm, control, { service: "alarm_arm_away", code: "1234" }),
    [
      "alarm_control_panel",
      "alarm_arm_away",
      { entity_id: "alarm_control_panel.alarmo", code: "1234" },
    ],
  );
  assert.throws(() =>
    controlCall(alarm, control, { service: "alarm_arm_night" }),
  );

  // No arming code: arm straight away, but disarming still asks.
  const quick = describeEntity({
    entity_id: "alarm_control_panel.house",
    state: "arming",
    attributes: {
      supported_features: 63,
      code_format: "number",
      code_arm_required: false,
      next_state: "armed_night",
    },
  }).controls[0];
  assert.equal(quick.modes.length, 6);
  assert.equal(quick.mode, "armed_night");
  assert.equal(alarmNeedsCode(quick, "alarm_arm_home"), false);
  assert.equal(alarmNeedsCode(quick, "alarm_disarm"), true);

  // No code at all.
  const open = describeEntity({
    entity_id: "alarm_control_panel.open",
    state: "armed_home",
    attributes: { supported_features: 1, code_format: null },
  });
  assert.equal(alarmNeedsCode(open.controls[0], "alarm_disarm"), false);
  assert.deepEqual(
    controlCall(open, open.controls[0], { service: "alarm_disarm" }),
    [
      "alarm_control_panel",
      "alarm_disarm",
      { entity_id: "alarm_control_panel.open" },
    ],
  );
});
