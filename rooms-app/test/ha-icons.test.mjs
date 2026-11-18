import test from "node:test";
import assert from "node:assert/strict";
import {
  pickEntityIcon,
  createEntityIconSource,
  FALLBACK_DOMAIN_ICONS,
} from "../shared/ha-icons.mjs";

// Shapes as Home Assistant's frontend/get_icons returns them.
const COMPONENT = {
  cover: {
    _: { default: "mdi:window-open", state: { closed: "mdi:window-closed" } },
    shutter: {
      default: "mdi:window-shutter-open",
      state: { closed: "mdi:window-shutter" },
    },
  },
  light: {
    _: { default: "mdi:lightbulb", state: { off: "mdi:lightbulb-off" } },
  },
  sensor: {
    battery: {
      default: "mdi:battery-unknown",
      range: {
        0: "mdi:battery-outline",
        50: "mdi:battery-50",
        100: "mdi:battery",
      },
    },
  },
};
const PLATFORM = {
  sensor: { filter_time_left: { default: "mdi:air-filter" } },
  select: { mop_mode: { default: "mdi:waves" } },
};
const state = (entity_id, s, attributes = {}) => ({
  entity_id,
  state: s,
  attributes,
});

test("Home Assistant's icon order: own icon, integration, code, domain, fallback", () => {
  const shutter = (s) =>
    pickEntityIcon(
      state("cover.window_shutter", s, { device_class: "shutter" }),
      {
        component: COMPONENT.cover,
      },
    );
  assert.equal(shutter("open"), "mdi:window-shutter-open");
  assert.equal(shutter("closed"), "mdi:window-shutter");
  const light = (s) =>
    pickEntityIcon(state("light.hall", s), { component: COMPONENT.light });
  assert.equal(light("on"), "mdi:lightbulb");
  assert.equal(light("off"), "mdi:lightbulb-off");
  assert.equal(
    pickEntityIcon(state("cover.blind", "closed"), {
      component: COMPONENT.cover,
    }),
    "mdi:window-closed",
  );
  // Integration icon by translation key wins over the domain's.
  assert.equal(
    pickEntityIcon(state("sensor.saros_10r_filter_time_left", "500"), {
      entry: { pl: "roborock", tk: "filter_time_left" },
      platform: PLATFORM,
      component: COMPONENT.sensor,
    }),
    "mdi:air-filter",
  );
  // Ranges pick the highest threshold at or below the value.
  const battery = (s) =>
    pickEntityIcon(state("sensor.b", s, { device_class: "battery" }), {
      component: COMPONENT.sensor,
    });
  assert.equal(battery("72"), "mdi:battery-50");
  assert.equal(battery("100"), "mdi:battery");
  assert.equal(battery("unknown"), "mdi:battery-unknown");
  // The state's own icon and the registry's come first.
  assert.equal(
    pickEntityIcon(state("light.x", "on", { icon: "mdi:lamp" }), {
      component: COMPONENT.light,
    }),
    "mdi:lamp",
  );
  assert.equal(
    pickEntityIcon(state("light.x", "on"), {
      entry: { ic: "mdi:ceiling-light" },
      component: COMPONENT.light,
    }),
    "mdi:ceiling-light",
  );
  assert.equal(
    pickEntityIcon(state("sun.sun", "below_horizon")),
    "mdi:weather-night",
  );
  assert.equal(
    pickEntityIcon(state("vacuum.robot", "docked")),
    "mdi:robot-vacuum",
  );
  assert.equal(pickEntityIcon(state("foo.bar", "x")), "mdi:bookmark");
  assert.equal(FALLBACK_DOMAIN_ICONS.time, "mdi:clock");
});

test("icon tables are asked for once per integration, only when needed", async () => {
  const asked = [];
  const connection = {
    sendMessagePromise: async (message) => {
      asked.push(`${message.category}:${message.integration.join()}`);
      const [name] = message.integration;
      return {
        resources: {
          [name]:
            message.category === "entity_component"
              ? COMPONENT[name]
              : PLATFORM,
        },
      };
    },
  };
  const source = createEntityIconSource(connection, {
    entities: [
      { ei: "select.saros_10r_mop_mode", pl: "roborock", tk: "mop_mode" },
    ],
  });
  assert.equal(
    await source.iconFor(state("light.a", "off")),
    "mdi:lightbulb-off",
  );
  assert.equal(
    await source.iconFor(state("select.saros_10r_mop_mode", "standard")),
    "mdi:waves",
  );
  assert.equal(
    await source.iconFor(state("select.saros_10r_mop_mode", "deep")),
    "mdi:waves",
  );
  assert.deepEqual(asked, [
    "entity_component:light",
    "entity_component:select",
    "entity:roborock",
  ]);
});

test("an icon table that never arrives falls back to the built-in icons", async () => {
  let pending;
  const timers = {
    setTimeout(fn) {
      pending = fn;
      return 1;
    },
    clearTimeout() {},
  };
  const connection = { sendMessagePromise: () => new Promise(() => {}) };
  const source = createEntityIconSource(connection, null, { timers });
  const icon = source.iconFor(state("camera.demo", "idle"));
  pending();
  assert.equal(await icon, pickEntityIcon(state("camera.demo", "idle")));
});
