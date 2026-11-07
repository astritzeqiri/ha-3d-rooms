import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { connectNative } from "../web/native.js";

const source = (
  await readFile(new URL("../dashboard/panel.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replaceAll("import.meta.url", '"http://localhost/panel.js"');

function panelHarness() {
  let Panel;
  const events = [],
    frame = { contentWindow: { dispatchEvent() {} } };
  const context = vm.createContext({
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = { querySelector: () => frame };
      }
      dispatchEvent(event) {
        events.push(event);
      }
    },
    customElements: {
      get: () => false,
      define: (_, value) => {
        Panel = value;
      },
    },
    location: { origin: "http://localhost" },
    Event,
    CustomEvent: class extends Event {
      constructor(type, options) {
        super(type, options);
        this.detail = options?.detail;
      }
    },
  });
  vm.runInContext(source, context);
  const panel = new Panel();
  panel.hass = {
    connected: true,
    states: {
      "climate.living_room_ac": {
        entity_id: "climate.living_room_ac",
        state: "heat",
        attributes: { temperature: 23 },
      },
      "light.living": { entity_id: "light.living", state: "on" },
      "sensor.unrelated": { entity_id: "sensor.unrelated", state: "25" },
    },
  };
  panel._ready({
    source: frame.contentWindow,
    origin: "http://localhost",
    data: { type: "three-d-rooms-ready" },
  });
  return { panel, bridge: frame.contentWindow.threeDRoomsBridge, events };
}

test("native manager receives climate state on initial publish and live updates", () => {
  const { panel, bridge } = panelHarness(),
    updates = [];
  const unsubscribe = bridge.subscribe((state) => updates.push(state));
  assert.equal(
    updates[0].entities.find((e) => e.entity_id === "climate.living_room_ac")
      ?.state,
    "heat",
  );
  assert.ok(updates[0].entities.some((e) => e.entity_id === "light.living"));
  assert.ok(
    !updates[0].entities.some((e) => e.entity_id === "sensor.unrelated"),
  );
  panel.hass = {
    ...panel._hass,
    states: {
      ...panel._hass.states,
      "climate.living_room_ac": {
        entity_id: "climate.living_room_ac",
        state: "cool",
      },
    },
  };
  assert.equal(
    updates
      .at(-1)
      .entities.find((e) => e.entity_id === "climate.living_room_ac")?.state,
    "cool",
  );
  unsubscribe();
  panel._publish();
  assert.equal(updates.length, 2);
});

test("manager native adapter opens the real HA AC dialog through its panel", async () => {
  const { bridge, events } = panelHarness();
  const previousWindow = globalThis.window,
    previousLocation = globalThis.location;
  const window = new EventTarget();
  window.threeDRoomsBridge = bridge;
  window.parent = {
    postMessage: () =>
      queueMicrotask(() =>
        window.dispatchEvent(new Event("three-d-rooms-connected")),
      ),
  };
  globalThis.window = window;
  globalThis.location = {
    href: "http://localhost/index.html?native=1",
    origin: "http://localhost",
  };
  try {
    const native = await connectNative();
    assert.equal(typeof native.moreInfo, "function");
    native.moreInfo("climate.living_room_ac");
    const event = events.at(-1);
    assert.equal(event.type, "hass-more-info");
    assert.equal(event.detail.entityId, "climate.living_room_ac");
    assert.equal(event.bubbles, true);
    assert.equal(event.composed, true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});
