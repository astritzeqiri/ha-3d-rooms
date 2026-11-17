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

test("cameras get a live view; their access token is never listed", async () => {
  const { cameraUrls } = await import("../dashboard/more-info-model.mjs");
  const camera = describeEntity({
    entity_id: "camera.garage",
    state: "idle",
    attributes: {
      friendly_name: "Garagecamera",
      supported_features: 2,
      access_token: "secret-token",
      entity_picture: "/api/camera_proxy/camera.garage?token=secret-token",
      frontend_stream_type: "hls",
      brand: "Reolink",
    },
  });
  assert.deepEqual(camera.controls, [
    { kind: "camera", stream: true, token: "secret-token" },
  ]);
  assert.deepEqual(camera.attributes, [["Brand", "Reolink"]]);
  assert.ok(!JSON.stringify(camera.attributes).includes("secret"));
  assert.deepEqual(cameraUrls("camera.garage", "a b"), {
    still: "/api/camera_proxy/camera.garage?token=a%20b",
    mjpeg: "/api/camera_proxy_stream/camera.garage?token=a%20b",
  });
  const still = describeEntity({
    entity_id: "camera.snapshot",
    state: "idle",
    attributes: { supported_features: 0, access_token: "t" },
  });
  assert.equal(still.controls[0].stream, false);
  assert.deepEqual(
    describeEntity({
      entity_id: "camera.x",
      state: "unavailable",
      attributes: {},
    }).controls,
    [],
  );
});

test("a vacuum gets Home Assistant's buttons, fan speed and clean by area", async () => {
  const { describeEntity, controlCall, vacuumControl } =
    await import("../dashboard/more-info-model.mjs");
  const { vacuumVisualState, VACUUM_STATUS_SVG } =
    await import("../dashboard/vacuum-art.mjs");
  // Demo vacuum 0: every feature (32700 = all but turn on/off/send command…).
  const all = 4 | 8 | 16 | 32 | 512 | 1024 | 4096 | 8192 | 16384;
  const vac = (state, attributes = {}) => ({
    entity_id: "vacuum.robot",
    state,
    attributes: {
      supported_features: all,
      fan_speed: "medium",
      fan_speed_list: ["min", "medium", "max"],
      ...attributes,
    },
  });
  const control = (e) =>
    describeEntity(e).controls.find((c) => c.kind === "vacuum");
  const docked = control(vac("docked"));
  assert.deepEqual(
    docked.buttons.map((b) => [b.key, b.icon, b.disabled]),
    [
      ["start_pause", "play", false],
      ["stop", "stop", true], // nothing to stop at the dock
      ["return_to_base", "dock", false],
      ["locate", "locate", false],
      ["clean_spot", "spot", false],
    ],
  );
  assert.deepEqual(docked.fanSpeeds, ["min", "medium", "max"]);
  assert.equal(docked.cleanArea, true);
  const cleaning = control(vac("cleaning"));
  assert.deepEqual(
    [
      cleaning.buttons[0].service,
      cleaning.buttons[0].icon,
      cleaning.buttons[1].disabled,
    ],
    ["pause", "pause", false],
  );
  assert.equal(control(vac("returning")).buttons[2].disabled, true);
  // Matter Roborock: start, pause, stop, return home, locate; no fan or areas.
  const matter = control(
    vac("docked", {
      supported_features: 4 | 8 | 16 | 512 | 4096 | 8192,
      fan_speed_list: undefined,
    }),
  );
  assert.equal(matter.buttons.length, 4);
  assert.deepEqual(matter.fanSpeeds, []);
  assert.equal(matter.cleanArea, false);
  // Legacy vacuums (no STATE or START) use start_pause.
  assert.equal(
    control(vac("idle", { supported_features: 4 })).buttons[0].service,
    "start_pause",
  );
  // Status text replaces the state when the STATUS feature is set.
  assert.equal(
    control(
      vac("cleaning", { supported_features: all | 128, status: "Mopping" }),
    ).status,
    "Mopping",
  );
  const d = describeEntity(vac("docked"));
  assert.deepEqual(controlCall(d, docked, "start"), [
    "vacuum",
    "start",
    { entity_id: "vacuum.robot" },
  ]);
  assert.throws(() => controlCall(d, docked, "stop"));
  assert.deepEqual(controlCall(d, docked, { fan_speed: "max" }), [
    "vacuum",
    "set_fan_speed",
    { entity_id: "vacuum.robot", fan_speed: "max" },
  ]);
  assert.throws(() => controlCall(d, docked, { fan_speed: "turbo" }));
  assert.deepEqual(controlCall(d, docked, { areas: ["kitchen", "corridor"] }), [
    "vacuum",
    "clean_area",
    { entity_id: "vacuum.robot", cleaning_area_id: ["kitchen", "corridor"] },
  ]);
  assert.throws(() => controlCall(d, docked, { areas: [] }));
  assert.equal(vacuumVisualState(vac("on")), "cleaning");
  assert.equal(vacuumVisualState(vac("unavailable")), "idle");
  assert.match(VACUUM_STATUS_SVG, /dock-indicator/);
});

test("a vacuum's extra entities become device-page rows with their own controls", async () => {
  const { entityRow, entityRowCall, formatDuration } =
    await import("../dashboard/more-info-model.mjs");
  const row = (entity_id, state, attributes = {}) =>
    entityRow(
      {
        entity_id,
        state,
        attributes: {
          friendly_name: `Saros 10R ${attributes.name || "Thing"}`,
          ...attributes,
        },
      },
      { prefix: "Saros 10R", now: Date.parse("2026-11-17T12:00:00Z") },
    );
  const mode = row("select.saros_10r_cleaning_mode", "unknown", {
    name: "Cleaning mode",
    options: ["vacuum_only", "vacuum_and_mop", "mop_only"],
  });
  assert.equal(mode.name, "Cleaning mode");
  assert.equal(mode.kind, "select");
  assert.deepEqual(entityRowCall(mode, "mop_only"), [
    "select",
    "select_option",
    { entity_id: "select.saros_10r_cleaning_mode", option: "mop_only" },
  ]);
  assert.throws(() => entityRowCall(mode, "turbo"));
  const dnd = row("switch.saros_10r_do_not_disturb", "on");
  assert.equal(dnd.on, true);
  assert.deepEqual(entityRowCall(dnd, false)[1], "turn_off");
  const begin = row("time.saros_10r_do_not_disturb_begin", "22:00:00");
  assert.deepEqual(entityRowCall(begin, "23:30"), [
    "time",
    "set_value",
    { entity_id: "time.saros_10r_do_not_disturb_begin", time: "23:30:00" },
  ]);
  const volume = row("number.saros_10r_volume", "90.0", {
    min: 0,
    max: 100,
    step: 1,
    unit_of_measurement: "%",
  });
  assert.equal(volume.value, 90);
  assert.throws(() => entityRowCall(volume, 120));
  assert.equal(
    entityRowCall(row("button.dock_resolve", "unknown"))[1],
    "press",
  );
  assert.equal(
    row("sensor.f", "539400", {
      device_class: "duration",
      unit_of_measurement: "s",
    }).value,
    "149h 50m",
  );
  assert.equal(
    row("sensor.t", "136", {
      device_class: "duration",
      unit_of_measurement: "s",
    }).value,
    "2m 16s",
  );
  assert.equal(
    row("sensor.b", "96", { unit_of_measurement: "%" }).value,
    "96%",
  );
  assert.equal(
    row("sensor.a", "2.913", { unit_of_measurement: "m²" }).value,
    "2.91 m²",
  );
  assert.match(
    row("sensor.l", "2026-11-17T11:52:00Z", { device_class: "timestamp" })
      .value,
    /8 minutes ago/,
  );
  assert.equal(
    row("binary_sensor.w", "on", { device_class: "connectivity" }).value,
    "Connected",
  );
  assert.equal(
    row("binary_sensor.p", "off", { device_class: "problem" }).value,
    "OK",
  );
  assert.equal(row("sensor.s", "segment_cleaning").value, "Segment cleaning");
  assert.equal(row("sensor.x", "unavailable").unavailable, true);
  assert.equal(entityRow(undefined).value, "Not found");
  assert.equal(formatDuration("1.5", "h"), "1h 30m");
});

test("an image entity row tells when its picture last changed", async () => {
  const { entityRow } = await import("../dashboard/more-info-model.mjs");
  const row = entityRow(
    {
      entity_id: "image.saros_10r_map_0",
      state: "2026-11-17T11:46:43.304619+00:00",
      attributes: {
        friendly_name: "Saros 10R Map 0",
        entity_picture: "/api/image_proxy/image.saros_10r_map_0?token=x",
      },
    },
    { prefix: "Saros 10R", now: Date.parse("2026-11-17T12:08:43Z") },
  );
  assert.equal(row.name, "Map 0");
  assert.match(row.value, /22 minutes ago/);
});
