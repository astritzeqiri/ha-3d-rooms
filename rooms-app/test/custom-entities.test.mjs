import test from "node:test";
import assert from "node:assert/strict";
import {
  customEntitySettings,
  customEntityDefaultIcon,
  customEntityShown,
  customEntityState,
  customEntityTap,
  newCustomEntityId,
  validateCustomEntities,
} from "../shared/custom-entities.mjs";
import {
  markerTrayHeight,
  validateMarkers,
} from "../shared/marker-settings.mjs";

test("extra entities keep their entity, spot and non-default options", () => {
  assert.deepEqual(
    validateCustomEntities({
      e1: { entity: "sensor.hall_temp", position: [1, 1.2, -2] },
      e2: {
        entity: "switch.fan",
        position: [0, 0, 0],
        room: "office",
        name: "  Fan  ",
        icon: "mdi:fan",
        size: 44,
        show_state: false,
      },
      e3: {
        entity: "light.x",
        position: [0, 0, 0],
        size: 32,
        show_state: true,
        name: " ",
      },
    }),
    {
      e1: { entity: "sensor.hall_temp", position: [1, 1.2, -2] },
      e2: {
        entity: "switch.fan",
        position: [0, 0, 0],
        room: "office",
        name: "Fan",
        icon: "mdi:fan",
        size: 44,
        show_state: false,
      },
      // Set on the entity, so kept: they override the view's defaults.
      e3: {
        entity: "light.x",
        position: [0, 0, 0],
        size: 32,
        show_state: true,
      },
    },
  );
});

test("extra entities are bounded and strict", () => {
  const ok = { entity: "sensor.a", position: [0, 0, 0] };
  for (const bad of [
    null,
    [],
    { "Bad Id": ok },
    { e1: { ...ok, entity: "not an entity" } },
    { e1: { ...ok, entity: "Sensor.A" } },
    { e1: { position: [0, 0, 0] } },
    { e1: { ...ok, position: [0, 0] } },
    { e1: { ...ok, position: [0, 0, 5000] } },
    { e1: { ...ok, position: [0, NaN, 0] } },
    { e1: { ...ok, size: 12 } },
    { e1: { ...ok, size: 30.5 } },
    { e1: { ...ok, icon: "fan" } },
    { e1: { ...ok, show_state: "no" } },
    { e1: { ...ok, room: "Bad Room" } },
    { e1: { ...ok, name: "x".repeat(81) } },
    { e1: { ...ok, extra: 1 } },
    Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`e${i}`, ok])),
  ])
    assert.throws(
      () => validateCustomEntities(bad),
      undefined,
      JSON.stringify(bad),
    );
});

test("view markers carry extra entities beside devices and room buttons", () => {
  const markers = validateMarkers({
    lamp: { size: 40, placement: "tray" },
    _rooms: { office: { mode: "always" } },
    _entities: { e1: { entity: "sensor.a", position: [0, 1, 0] } },
  });
  assert.deepEqual(markers._entities, {
    e1: { entity: "sensor.a", position: [0, 1, 0] },
  });
  assert.equal(validateMarkers({ _entities: {} })._entities, undefined);
  // Not a device: it never takes a tray row.
  assert.equal(markerTrayHeight(markers), 100);
});

test("a tap toggles switchable entities and opens more info for the rest", () => {
  assert.deepEqual(customEntityTap("switch.fan"), {
    domain: "switch",
    service: "toggle",
  });
  assert.deepEqual(customEntityTap("script.bedtime"), {
    domain: "script",
    service: "turn_on",
  });
  assert.deepEqual(customEntityTap("scene.movie"), {
    domain: "scene",
    service: "turn_on",
  });
  assert.deepEqual(customEntityTap("input_button.ring"), {
    domain: "input_button",
    service: "press",
  });
  for (const id of ["sensor.t", "lock.front", "cover.blind", "climate.ac"])
    assert.equal(customEntityTap(id), null);
});

test("an extra entity shows Home Assistant's state words", () => {
  const sensor = {
    entity_id: "sensor.t",
    state: "21.5",
    attributes: { unit_of_measurement: "°C" },
  };
  assert.deepEqual(customEntityState(sensor), {
    active: false,
    unavailable: false,
    badge: "21.5 °C",
    description: "21.5 °C",
  });
  assert.equal(customEntityState(sensor, () => "21,5 °C").badge, "21,5 °C");
  assert.equal(
    customEntityState({ entity_id: "switch.a", state: "on", attributes: {} })
      .active,
    true,
  );
  assert.equal(
    customEntityState({
      entity_id: "switch.a",
      state: "unavailable",
      attributes: {},
    }).unavailable,
    true,
  );
  assert.equal(customEntityState(undefined).unavailable, true);
  assert.equal(
    customEntityState({
      entity_id: "sensor.long",
      state: "a very long state value",
      attributes: {},
    }).badge.length,
    14,
  );
});

test("an extra entity tied to a room hides with that room", () => {
  const shown = new Set(["office"]);
  assert.equal(customEntityShown({ room: "office" }, shown), true);
  assert.equal(customEntityShown({ room: "hall" }, shown), false);
  assert.equal(customEntityShown({}, shown), true);
  assert.equal(customEntityShown({ room: "hall" }, null), true);
});

test("new extra entities get the first free id", () => {
  assert.equal(newCustomEntityId({}), "e1");
  assert.equal(newCustomEntityId({ e1: {}, e3: {} }), "e2");
});

test("timestamps read as a time without Home Assistant's formatter", () => {
  const badge = customEntityState({
    entity_id: "sensor.next_dusk",
    state: "2026-11-13T16:07:09+00:00",
    attributes: { device_class: "timestamp" },
  }).badge;
  assert.match(badge, /\d{1,2}[:.]\d{2}/);
  assert.ok(!badge.includes("T16"));
});

test("extra entities name a plain icon by device class, else by domain", () => {
  assert.equal(
    customEntityDefaultIcon("sensor.t", {
      attributes: { device_class: "temperature" },
    }),
    "mdi:thermometer",
  );
  assert.equal(
    customEntityDefaultIcon("cover.garage_door"),
    "mdi:window-shutter",
  );
  assert.equal(customEntityDefaultIcon("media_player.tv"), "mdi:cast");
  assert.equal(customEntityDefaultIcon("zone.home"), "mdi:information-outline");
});

test("an extra entity can be hidden without removing it", () => {
  assert.deepEqual(
    validateCustomEntities({
      e1: { entity: "sensor.a", position: [0, 0, 0], visible: false },
      e2: { entity: "sensor.b", position: [0, 0, 0], visible: true },
    }),
    {
      e1: { entity: "sensor.a", position: [0, 0, 0], visible: false },
      e2: { entity: "sensor.b", position: [0, 0, 0], visible: true },
    },
  );
  assert.throws(() =>
    validateCustomEntities({
      e1: { entity: "sensor.a", position: [0, 0, 0], visible: "no" },
    }),
  );
  assert.equal(customEntityShown({ visible: false }, null), false);
});

test("an extra entity may have its own icon for each look", async () => {
  const { customEntityStateWords } =
    await import("../shared/custom-entities.mjs");
  assert.deepEqual(
    validateCustomEntities({
      e1: {
        entity: "cover.garage",
        position: [0, 0, 0],
        icon: "mdi:garage-open",
        icon_off: "mdi:garage",
      },
    }).e1,
    {
      entity: "cover.garage",
      position: [0, 0, 0],
      icon: "mdi:garage-open",
      icon_off: "mdi:garage",
    },
  );
  assert.throws(() =>
    validateCustomEntities({
      e1: { entity: "cover.g", position: [0, 0, 0], icon_off: "garage" },
    }),
  );
  assert.deepEqual(customEntityStateWords("cover.g"), ["Open", "Closed"]);
  assert.deepEqual(customEntityStateWords("lock.front"), [
    "Locked",
    "Unlocked",
  ]);
  assert.deepEqual(customEntityStateWords("switch.fan"), ["On", "Off"]);
  assert.deepEqual(
    customEntityStateWords("binary_sensor.door", {
      attributes: { device_class: "door" },
    }),
    ["Open", "Closed"],
  );
  assert.equal(customEntityStateWords("sensor.t"), null);
  // A lock's active look is locked, as for room locks.
  assert.equal(
    customEntityState({ entity_id: "lock.f", state: "locked", attributes: {} })
      .active,
    true,
  );
  assert.equal(
    customEntityState({
      entity_id: "lock.f",
      state: "unlocked",
      attributes: {},
    }).active,
    false,
  );
});

test("extra entities follow the view's device defaults unless set themselves", () => {
  const defaults = { size: 44, show_label: false, visible: true };
  assert.deepEqual(customEntitySettings({ entity: "sensor.a" }, defaults), {
    entity: "sensor.a",
    size: 44,
    show_state: false,
    visible: true,
  });
  assert.deepEqual(
    customEntitySettings(
      { entity: "sensor.a", show_state: true, size: 24 },
      defaults,
    ),
    { entity: "sensor.a", size: 24, show_state: true, visible: true },
  );
  assert.deepEqual(customEntitySettings({ entity: "sensor.a" }), {
    entity: "sensor.a",
    size: 32,
    show_state: true,
    visible: true,
  });
  assert.equal(customEntitySettings({}, { visible: false }).visible, false);
});
