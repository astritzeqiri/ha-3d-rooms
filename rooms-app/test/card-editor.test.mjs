import { VIEW_FIELDS, resolveSavedView } from "../shared/saved-view.mjs";
import { houseFloorOptions } from "../shared/house-floors.mjs";
import * as backdrop from "../shared/backdrop.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/editor.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
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
        setCustomValidity() {},
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
    houseFloorOptions,
    ...backdrop,
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
  assert.equal(events[0].detail.config.tilt, 0);
  field("model").value = "office";
  editor._change("model");
  assert.equal(events[1].detail.config.model, "office");
});
test("saved view remains linked and editing a field creates its override", () => {
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
  assert.equal(field("zoom").disabled, false);
  field("zoom").type = "number";
  field("zoom").value = "3";
  editor._change("zoom");
  component.title = "Renamed";
  component.layers[0].zoom = 4;
  editor._sync();
  assert.equal(field("title").value, "Renamed");
  assert.equal(field("zoom").value, 3);
  assert.equal(field("component").value, "saved");
  editor._resetField("zoom");
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
  assert.equal(field("zoom").disabled, false);
  assert.equal(field("zoom").value, 2);
  assert.equal(field("reset-field-zoom").hidden, true);
  field("zoom").value = "3";
  editor._change("zoom");
  field("zoom").value = "2";
  editor._change("zoom");
  assert.equal(editor._config.zoom, undefined);
  assert.equal(field("reset-field-zoom").hidden, true);
  saved.layers[0].zoom = 4;
  editor._sync();
  assert.equal(field("zoom").value, 4);
  assert.equal(events.at(-1).detail.config.saved_view, "saved");
  editor.setConfig({ model: "kitchen", zoom: 3 });
  assert.equal(field("override-controls-zoom").hidden, true);
  assert.equal(field("reset-field-zoom").hidden, true);
});

test("auto height is a card override and preserves saved camera and view", () => {
  const { editor, field, events } = harness();
  field("height-mode").value = "auto";
  field("height-mode").onchange();
  const config = events.at(-1).detail.config;
  assert.equal(config.height, "auto");
  assert.equal(config.camera.referenceZoom, 2);
  editor.setConfig(config);
  assert.equal(field("height").hidden, true);
  field("height-mode").value = "fixed";
  field("height-mode").onchange();
  assert.equal(events.at(-1).detail.config.height, 500);
});

test("floor switcher setting appears for houses with floors and saves only when turned off", () => {
  const { editor, field, events } = harness();
  editor._models = [
    { id: "kitchen" },
    { id: "h-home", houseView: true, houseId: "home", houseFloor: null },
    {
      id: "h-home--f1",
      houseView: true,
      houseId: "home",
      houseFloor: { id: "f1", name: "Ground floor" },
    },
  ];
  editor._sync();
  assert.equal(field("floor-selector-setting").hidden, true);
  editor.setConfig({ ...editor._config, model: "h-home" });
  assert.equal(field("floor-selector-setting").hidden, false);
  assert.equal(field("floor_selector").checked, true);
  field("floor_selector").checked = false;
  field("floor_selector").onchange();
  assert.equal(events.at(-1).detail.config.floor_selector, false);
  field("floor_selector").checked = true;
  field("floor_selector").onchange();
  assert.equal(
    Object.hasOwn(events.at(-1).detail.config, "floor_selector"),
    false,
  );
});

test("camera buttons setting is on by default and saves only when turned off", () => {
  const { editor, field, events } = harness();
  assert.equal(field("camera_controls").checked, true);
  field("camera_controls").checked = false;
  field("camera_controls").onchange();
  assert.equal(events.at(-1).detail.config.camera_controls, false);
  assert.equal(field("camera_controls").checked, false);
  field("camera_controls").checked = true;
  field("camera_controls").onchange();
  assert.equal(
    Object.hasOwn(events.at(-1).detail.config, "camera_controls"),
    false,
  );
});

test("Edit button setting is on by default and saves only when turned off", () => {
  const { field, events } = harness();
  assert.equal(field("edit_button").checked, true);
  field("edit_button").checked = false;
  field("edit_button").onchange();
  assert.equal(events.at(-1).detail.config.edit_button, false);
  field("edit_button").checked = true;
  field("edit_button").onchange();
  assert.equal(
    Object.hasOwn(events.at(-1).detail.config, "edit_button"),
    false,
  );
});

test("background defaults to the spotlight and saves only a changed choice", () => {
  const { field, events } = harness();
  assert.equal(field("background").value, "spotlight");
  assert.equal(field("background_shadow").checked, true);
  assert.equal(field("background-image-setting").hidden, true);
  field("background").value = "sky";
  field("background").onchange();
  assert.equal(events.at(-1).detail.config.background, "sky");
  field("background").value = "spotlight";
  field("background").onchange();
  assert.equal(Object.hasOwn(events.at(-1).detail.config, "background"), false);
});

test("the shadow checkbox follows the background's default and saves only overrides", () => {
  const { field, events } = harness();
  field("background_shadow").checked = false;
  field("background_shadow").onchange();
  assert.equal(events.at(-1).detail.config.background_shadow, false);
  field("background_shadow").checked = true;
  field("background_shadow").onchange();
  assert.equal(
    Object.hasOwn(events.at(-1).detail.config, "background_shadow"),
    false,
  );
  // Classic is flat by default, so turning the shadow on is the override.
  field("background").value = "classic";
  field("background_shadow").checked = true;
  field("background_shadow").onchange();
  assert.equal(events.at(-1).detail.config.background_shadow, true);
});

test("the image address field appears only for the custom image background", () => {
  const { field, events } = harness();
  field("background").value = "image";
  field("background").onchange();
  assert.equal(events.at(-1).detail.config.background, "image");
  field("background_image").value = "  /local/garden.jpg ";
  field("background_image").onchange();
  assert.equal(
    events.at(-1).detail.config.background_image,
    "/local/garden.jpg",
  );
  field("background_image").value = "";
  field("background_image").onchange();
  assert.equal(
    Object.hasOwn(events.at(-1).detail.config, "background_image"),
    false,
  );
});

test("a linked card shows the saved view's background and stores only overrides", () => {
  const { editor, field, events } = harness();
  editor._components = [
    {
      id: "saved",
      title: "Saved",
      height: 402,
      background: "sky",
      layers: [
        { model: "kitchen", view: "front", heading: 0, tilt: 28, zoom: 1 },
      ],
    },
  ];
  field("component").value = "saved";
  editor._component();
  assert.equal(field("background").value, "sky");
  // Choosing the view's own value stores nothing.
  field("background").value = "sky";
  editor._changeBackground();
  assert.equal(Object.hasOwn(events.at(-1).detail.config, "background"), false);
  field("background").value = "grid";
  editor._changeBackground();
  assert.equal(events.at(-1).detail.config.background, "grid");
  assert.equal(events.at(-1).detail.config.saved_view, "saved");
});
