import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/editor.js", import.meta.url), "utf8")
).replace("export class", "class");
function harness() {
  let Editor;
  const fields = new Map();
  const field = (id) => {
    if (!fields.has(id))
      fields.set(id, {
        value: "",
        options: [],
        hidden: false,
        type: "text",
        checkValidity: () => true,
        addEventListener() {},
        add(option) {
          this.options.push(option);
        },
        replaceChildren(...options) {
          this.options = options;
        },
      });
    return fields.get(id);
  };
  const events = [];
  vm.runInNewContext(source, {
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = { getElementById: field };
      }
      dispatchEvent(event) {
        events.push(event);
      }
    },
    Option: class {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    },
    CustomEvent: class {
      constructor(type, options) {
        Object.assign(this, { type }, options);
      }
    },
    structuredClone,
    customElements: {
      get: () => false,
      define: (_, Class) => {
        Editor = Class;
      },
    },
  });
  const editor = new Editor();
  editor.setConfig({
    type: "custom:three-d-rooms-card",
    model: "kitchen",
    camera: { heading: 12, tilt: 34, referenceZoom: 2 },
    extra: "preserved",
  });
  return { editor, field, events };
}

test("editor preserves exact camera and unknown configuration when changing title", () => {
  const { editor, field, events } = harness();
  assert.equal(field("heading").value, 12);
  field("title").value = "Kitchen view";
  editor._change("title");
  assert.equal(events[0].detail.config.camera.referenceZoom, 2);
  assert.equal(events[0].detail.config.extra, "preserved");
  assert.equal(events[0].composed, true);
  assert.equal(events[0].bubbles, true);
});
test("changing models and projections resets stale camera geometry", () => {
  const { editor, field, events } = harness();
  field("view").value = "floor";
  editor._change("view");
  assert.equal(events[0].detail.config.camera, undefined);
  assert.equal(events[0].detail.config.tilt, 8);
  field("model").value = "office";
  editor._change("model");
  assert.equal(events[1].detail.config.model, "office");
});
test("saved components copy framing without mutating the source component", () => {
  const { editor, field, events } = harness();
  const component = {
    id: "saved",
    title: "Saved kitchen",
    height: 402,
    layers: [
      { model: "kitchen", view: "front", camera: { position: [1, 2, 3] } },
    ],
  };
  editor._components = [component];
  field("component").value = "saved";
  editor._component();
  const config = events[0].detail.config;
  assert.equal(config.title, component.title);
  assert.equal(config.height, 402);
  config.camera.position[0] = 99;
  assert.equal(component.layers[0].camera.position[0], 1);
});
test("invalid or empty numeric fields do not publish a card configuration", () => {
  const { editor, field, events } = harness();
  field("height").type = "number";
  field("height").value = "";
  editor._change("height");
  field("height").value = "20";
  field("height").checkValidity = () => false;
  editor._change("height");
  assert.equal(events.length, 0);
  assert.equal(field("error").hidden, false);
});
test("library load errors allow explicit retry and do not erase existing config", async () => {
  const { editor, field } = harness();
  editor._hass = {
    connection: {},
    callWS: async () => {
      throw new Error("Offline");
    },
  };
  await editor._load();
  assert.equal(field("retry").hidden, false);
  assert.equal(editor._config.model, "kitchen");
  editor._hass.callWS = async ({ operation }) =>
    operation === "models" ? [{ id: "kitchen", name: "Kitchen" }] : [];
  await editor._load();
  assert.equal(field("retry").hidden, true);
  assert.equal(field("model").value, "kitchen");
});
test("time of day is saved to the room's daylight settings, not the card", async () => {
  const { editor, field, events } = harness();
  const calls = [];
  editor._hass = {
    callWS: async (message) => {
      calls.push(message);
      return { daylight: { mode: message.data.mode, entity: "sun.sun" } };
    },
  };
  editor._models = [
    {
      id: "kitchen",
      daylight: { mode: "auto", entity: "sun.sun", windows: [] },
    },
  ];
  editor._sync();
  assert.equal(field("daylight-setting").hidden, false);
  assert.equal(field("daylight").value, "auto");
  field("daylight").value = "night";
  await editor._daylight();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      type: "three_d_rooms/request",
      operation: "daylight",
      data: { model: "kitchen", mode: "night", entity: "sun.sun" },
    },
  ]);
  assert.equal(events.length, 0);
  assert.equal(editor._models[0].daylight.mode, "night");
  assert.equal(editor._models[0].daylight.windows.length, 0);
});
test("time of day is hidden without daylight windows and reverts on failure", async () => {
  const { editor, field } = harness();
  editor._models = [{ id: "kitchen" }];
  editor._sync();
  assert.equal(field("daylight-setting").hidden, true);
  editor._models = [
    {
      id: "kitchen",
      daylight: { mode: "day", entity: "sun.sun", windows: [] },
    },
  ];
  editor._hass = {
    callWS: async () => {
      throw new Error("Choose an existing sun entity for Auto daylight.");
    },
  };
  editor._sync();
  field("daylight").value = "auto";
  await editor._daylight();
  assert.equal(field("daylight").value, "day");
  assert.equal(field("error").hidden, false);
});
