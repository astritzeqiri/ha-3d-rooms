import { VIEW_FIELDS, resolveSavedView } from "../shared/saved-view.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/editor.js", import.meta.url), "utf8")
)
  .replace(/^import .*;\n/gm, "")
  .replace("export class", "class");
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
        closest() {
          return { after() {} };
        },
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
    VIEW_FIELDS,
    resolveSavedView,
    document: {
      createElement: () => ({
        append() {},
        setAttribute() {},
        addEventListener() {},
      }),
    },
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
test("saved view remains linked and only checked fields become overrides", () => {
  const { editor, field, events } = harness();
  const component = {
    id: "saved",
    title: "Saved kitchen",
    height: 402,
    layers: [
      { model: "kitchen", view: "front", heading: 12, tilt: 34, zoom: 2 },
    ],
  };
  editor._components = [component];
  field("component").value = "saved";
  editor._component();
  assert.equal(events[0].detail.config.saved_view, "saved");
  assert.equal(events[0].detail.config.title, undefined);
  assert.equal(field("title").value, "Saved kitchen");
  assert.equal(field("zoom").disabled, true);
  field("override-zoom").checked = true;
  editor._override("zoom");
  field("zoom").type = "number";
  field("zoom").value = "3";
  editor._change("zoom");
  component.title = "Renamed";
  component.layers[0].zoom = 4;
  editor._sync();
  assert.equal(field("title").value, "Renamed");
  assert.equal(field("zoom").value, 3);
  assert.equal(field("component").value, "saved");
  field("override-zoom").checked = false;
  editor._override("zoom");
  assert.equal(editor._config.zoom, undefined);
  assert.equal(field("zoom").value, 4);
  assert.equal(editor._config.extra, "preserved");
  field("component").value = "";
  editor._component();
  assert.equal(editor._config.saved_view, undefined);
  assert.equal(editor._config.zoom, 4);
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

test("field reset appears only for a changed override and resumes live inheritance", () => {
  const { editor, field, events } = harness();
  const saved = {
    id: "saved",
    title: "Kitchen",
    height: 500,
    layers: [
      { model: "kitchen", view: "front", heading: 0, tilt: 28, zoom: 2 },
    ],
  };
  editor._components = [saved];
  editor.setConfig({ saved_view: "saved", zoom: 2, title: "Card title" });
  assert.equal(field("reset-field-zoom").hidden, true);
  assert.equal(field("reset-field-title").hidden, false);
  field("zoom").type = "number";
  field("zoom").value = "3";
  editor._change("zoom");
  assert.equal(field("reset-field-zoom").hidden, false);
  editor._resetField("zoom");
  assert.equal(editor._config.zoom, undefined);
  assert.equal(editor._config.title, "Card title");
  assert.equal(field("override-zoom").checked, false);
  assert.equal(field("zoom").disabled, true);
  assert.equal(field("zoom").value, 2);
  assert.equal(field("reset-field-zoom").hidden, true);
  saved.layers[0].zoom = 4;
  editor._sync();
  assert.equal(field("zoom").value, 4);
  assert.equal(events.at(-1).detail.config.saved_view, "saved");
  editor.setConfig({ model: "kitchen", zoom: 3 });
  assert.equal(field("override-controls-zoom").hidden, true);
  assert.equal(field("reset-field-zoom").hidden, true);
});
