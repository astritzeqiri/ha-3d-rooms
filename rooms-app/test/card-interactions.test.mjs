import {
  markerSettings,
  markerLayout,
  markerTrayHeight,
  validateMarkers,
} from "../shared/marker-settings.mjs";
import { resolveSavedView } from "../shared/saved-view.mjs";
import { actionState } from "../shared/action.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/card.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export class", "class");
function cardHarness() {
  let Card;
  const context = vm.createContext({
    HTMLElement: class {},
    customElements: {
      get: () => false,
      define: (_, value) => {
        Card = value;
      },
    },
    window: {},
    document: { createElement: () => ({ setAttribute() {}, remove() {} }) },
    hexToRgb: () => [255, 240, 212],
    actionState,
    resolveSavedView,
    markerSettings,
    markerLayout,
    markerTrayHeight,
    validateMarkers,
  });
  vm.runInContext(source, context);
  const card = Object.create(Card.prototype);
  card._model = {
    controls: [{ id: "lamp" }],
    bindings: { lamp: "light.office" },
  };
  card.shadowRoot = { querySelectorAll: () => [], querySelector: () => null };
  card._hass = { states: { "light.office": { state: "on" } } };
  return card;
}
test("quick toggle targets the bound light and prevents overlapping commands", async () => {
  const card = cardHarness(),
    calls = [];
  let finish;
  card._hass.callService = (...args) => {
    calls.push(args);
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const first = card._toggle("lamp");
  await card._toggle("lamp");
  assert.deepEqual(
    calls.map((args) => [args[0], args[1], args[2].entity_id]),
    [["light", "toggle", "light.office"]],
  );
  finish();
  await first;
  assert.equal(card._pendingToggles.size, 0);
});
test("quick toggle uses the bound entity's own domain for switch-backed lights", async () => {
  const cases = [
    ["switch.front_room", "switch"],
    ["input_boolean.lamp", "input_boolean"],
    ["group.front_lights", "homeassistant"],
  ];
  for (const [entityId, domain] of cases) {
    const card = cardHarness(),
      calls = [];
    card._model.bindings.lamp = entityId;
    card._hass.states = { [entityId]: { state: "off" } };
    card._hass.callService = (...args) => calls.push(args);
    await card._toggle("lamp");
    assert.deepEqual(
      calls.map((args) => [args[0], args[1], args[2].entity_id]),
      [[domain, "toggle", entityId]],
    );
  }
});
test("unavailable and unbound lights never send commands", async () => {
  const card = cardHarness();
  card._hass.callService = () => assert.fail("unexpected device command");
  card._hass.states["light.office"].state = "unavailable";
  await card._toggle("lamp");
  card._model.bindings = {};
  await card._toggle("lamp");
});
test("preview toggle changes local state without device commands", async () => {
  const card = cardHarness();
  card._preview = true;
  card._previewStates = new Map();
  card._states = () => {};
  await card._toggle("lamp");
  assert.equal(card._previewStates.get("lamp").on, false);
  await card._toggle("lamp");
  assert.equal(card._previewStates.get("lamp").on, true);
});

test("cover click opens its position controls without sending a light toggle", async () => {
  const card = cardHarness();
  card._model.controls = [{ id: "shade", type: "cover" }];
  let picked;
  card._pick = (id) => {
    picked = id;
  };
  card._hass.callService = () =>
    assert.fail("cover must not send light.toggle");
  await card._toggle("shade");
  assert.equal(picked, "shade");
});
function daylightCard() {
  const card = cardHarness();
  card._model = {
    id: "kitchen",
    controls: [],
    bindings: {},
    sceneRevision: "a",
    daylight: { mode: "auto", entity: "sun.sun", windows: [] },
  };
  card._daylightSwitch = { value: "auto", hidden: true };
  card._states = () => {};
  card._config = { model: "kitchen" };
  card._generation = 1;
  card._container = { append() {} };
  return card;
}
test("card daylight switch saves the room setting and applies it immediately", async () => {
  const card = daylightCard(),
    calls = [];
  card._hass.callWS = async (message) => {
    calls.push(message);
    return { daylight: { mode: message.data.mode, entity: "sun.sun" } };
  };
  card._syncDaylightSwitch();
  assert.equal(card._daylightSwitch.hidden, false);
  await card._setDaylight("night");
  assert.equal(card._model.daylight.mode, "night");
  assert.equal(
    JSON.stringify(calls),
    JSON.stringify([
      {
        type: "three_d_rooms/request",
        operation: "daylight",
        data: { model: "kitchen", mode: "night", entity: "sun.sun" },
      },
    ]),
  );
});
test("card daylight switch is hidden without windows or in previews and reverts on failure", async () => {
  const card = daylightCard();
  card._model.daylight = undefined;
  card._syncDaylightSwitch();
  assert.equal(card._daylightSwitch.hidden, true);
  card._model.daylight = { mode: "day", entity: "sun.sun", windows: [] };
  card._preview = true;
  card._syncDaylightSwitch();
  assert.equal(card._daylightSwitch.hidden, true);
  card._hass.callWS = () => assert.fail("previews never save");
  await card._setDaylight("night");
  assert.equal(card._model.daylight.mode, "day");
  card._preview = false;
  card._hass.callWS = async () => {
    throw new Error("nope");
  };
  card.shadowRoot.querySelector = () => null;
  assert.equal(card._model.daylight.mode, "day");
  assert.equal(card._daylightSwitch.value, "day");
});
test("daylight-only updates apply in place; room changes reload the card", async () => {
  const card = daylightCard();
  let loads = 0;
  card._load = () => loads++;
  const catalog = (changes) => [
    { ...JSON.parse(JSON.stringify(card._model)), ...changes },
  ];
  card._hass.callWS = async () =>
    catalog({ daylight: { mode: "night", entity: "sun.sun", windows: [] } });
  await card._modelsChanged();
  assert.equal(card._model.daylight.mode, "night");
  assert.equal(card._daylightSwitch.value, "night");
  assert.equal(loads, 0);
  card._hass.callWS = async () => catalog({ sceneRevision: "b" });
  await card._modelsChanged();
  assert.equal(loads, 1);
  card._hass.callWS = async () => {
    throw new Error("offline");
  };
  await card._modelsChanged();
  assert.equal(loads, 2);
});

test("preset clicks invoke only the saved mapping through the native backend and ignore overlap", async () => {
  const card = cardHarness();
  card._model = {
    id: "office",
    controls: [{ id: "sit", type: "button", capabilities: ["press"] }],
    bindings: { sit: "button.desk_sit" },
  };
  card._hass.states = {
    "button.desk_sit": { entity_id: "button.desk_sit", state: "unknown" },
  };
  const calls = [];
  let finish;
  card._hass.callWS = (message) => {
    calls.push(message);
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const first = card._toggle("sit");
  await card._toggle("sit");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "command");
  assert.equal(calls[0].data.controlId, "sit");
  assert.equal(calls[0].data.action, "press");
  assert.equal(calls[0].data.entityId, undefined);
  finish();
  await first;
  card._hass.states["button.desk_sit"].state = "unavailable";
  await card._toggle("sit");
  assert.equal(calls.length, 1);
});

test("saved view notifications reload inherited changes but ignore overridden changes", async () => {
  const card = daylightCard();
  const view = {
    id: "saved",
    title: "Office",
    height: 500,
    layers: [
      { model: "kitchen", view: "front", heading: 0, tilt: 28, zoom: 1 },
    ],
  };
  card._sourceConfig = { saved_view: "saved", zoom: 3 };
  card._config = resolveSavedView(card._sourceConfig, [view]);
  let reloads = 0;
  card._load = () => reloads++;
  card._hass.callWS = async ({ operation }) =>
    operation === "components" ? [view] : [card._model];
  view.layers[0].zoom = 2;
  await card._modelsChanged();
  assert.equal(reloads, 0);
  view.title = "Updated office";
  await card._modelsChanged();
  assert.equal(reloads, 1);
});

test("card applies per-device offsets and leaves tray controls visible when outside the camera", () => {
  const card = cardHarness();
  const room = { dataset: { control: "lamp" }, style: {} };
  const tray = { dataset: { control: "desk" }, style: {} };
  card._config = {
    markers: {
      lamp: { size: 44, offset: [1, 2, 3], show_label: false },
      desk: { placement: "tray" },
    },
  };
  card._container = { clientWidth: 500, clientHeight: 400 };
  card.shadowRoot.querySelectorAll = () => [room, tray];
  card._view = {
    fixtureScreenPosition(id, offset) {
      assert.equal(id, "lamp");
      assert.deepEqual(offset, [1, 2, 3]);
      return { x: 200, y: 150, visible: true };
    },
  };
  card._positionButtons();
  assert.equal(room.style.left, "178px");
  assert.equal(room.style.top, "128px");
  assert.equal(tray.hidden, false);
  card._config.markers.lamp.visible = false;
  card._positionButtons();
  assert.equal(room.hidden, true);
});

test("house and floor cards toggle their composed bindings and open mapped entity details", async () => {
  const card = cardHarness(),
    calls = [];
  card._model.houseView = true;
  card._hass.callService = (...args) => calls.push(args);
  await card._toggle("lamp");
  assert.equal(calls[0][2].entity_id, "light.office");
  card._pick = (id) => calls.push(id);
  card._model.controls = [
    { id: "shade", type: "cover" },
    { id: "ac", type: "climate" },
  ];
  await card._toggle("shade");
  await card._toggle("ac");
  assert.deepEqual(calls.slice(1), ["shade", "ac"]);
});

test("floor buttons switch the loaded house in place and hide when disabled", () => {
  const card = cardHarness();
  let loads = 0,
    built = 0;
  const shown = [];
  card._load = () => loads++;
  card._buildAccess = () => built++;
  card._states = () => {};
  card._syncFloorSwitch = () => {};
  card._syncCameraButtons = () => {};
  const house = { id: "h-home", houseView: true, controls: [] },
    upper = { id: "h-home--f2", houseView: true, controls: [] };
  card._config = { model: "h-home" };
  card._cameraFree = true;
  card._model = house;
  card._views = [house, upper];
  card._floors = [
    { id: "h-home", floorId: null, label: "Whole house" },
    { id: "h-home--f2", floorId: "f2", label: "First floor" },
  ];
  card._view = {
    setHouseView: (view, options) => {
      assert.equal(options.render, false);
      shown.push([view.id, options.keepCamera]);
      return true;
    },
  };
  card._selectFloor("h-home--f2");
  assert.deepEqual(shown, [["h-home--f2", true]]);
  assert.equal(card._model, upper);
  assert.equal(card._floor, "h-home--f2");
  assert.equal(loads, 0);
  assert.equal(built, 1);
  card._selectFloor("h-home--f2");
  card._selectFloor("h-unknown");
  assert.equal(shown.length, 1);
  card._cameraFree = false;
  card._selectFloor("h-home");
  assert.deepEqual(shown[1], ["h-home", false]);
  assert.equal(card._floor, null);
  // Missing rooms in the loaded scene fall back to a full load.
  card._view.setHouseView = () => false;
  card._selectFloor("h-home--f2");
  assert.equal(loads, 1);
  card._loading = true;
  card._selectFloor("h-home");
  assert.equal(loads, 1);
});

test("floor switcher stays hidden when turned off or with one view", () => {
  const card = cardHarness();
  card._floorSwitch = { hidden: false, dataset: {}, children: [] };
  card._config = { floor_selector: false };
  card._floors = [{ id: "a" }, { id: "b" }];
  card._syncFloorSwitch();
  assert.equal(card._floorSwitch.hidden, true);
  card._config = {};
  card._floors = [{ id: "a" }];
  card._syncFloorSwitch();
  assert.equal(card._floorSwitch.hidden, true);
});

test("model updates compare the displayed floor, not the configured whole house", async () => {
  const card = cardHarness();
  let loads = 0;
  card._load = () => loads++;
  card._states = () => {};
  card._syncDaylightSwitch = () => {};
  card._generation = 1;
  card._config = { model: "h-home" };
  card._model = { id: "h-home--f2", houseView: true, controls: [] };
  card._hass.callWS = async () => [
    { id: "h-home", houseView: true, controls: [{ id: "x" }] },
    { id: "h-home--f2", houseView: true, controls: [] },
  ];
  await card._modelsChanged();
  assert.equal(loads, 0);
  // A change to another loaded floor reloads the house.
  card._views = [{ id: "h-home", houseView: true, controls: [] }, card._model];
  await card._modelsChanged();
  assert.equal(loads, 1);
});

test("camera buttons toggle movement for this session and reset the framing", () => {
  const card = cardHarness();
  const calls = [];
  const button = () => ({
    hidden: true,
    attributes: {},
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
  });
  card._moveCamera = button();
  card._resetCamera = button();
  card._config = { interactive: false };
  card._cameraFree = false;
  card._syncCameraButtons();
  assert.equal(card._moveCamera.hidden, true, "hidden until a scene loads");
  card._view = {
    setInteractive: (on) => calls.push(["interactive", on]),
    reset: () => calls.push(["reset"]),
  };
  card._syncCameraButtons();
  assert.equal(card._moveCamera.hidden, false);
  assert.equal(card._moveCamera.attributes["aria-pressed"], "false");
  assert.equal(card._resetCamera.hidden, true);
  card._setCameraMovement(true);
  assert.deepEqual(calls, [["interactive", true]]);
  assert.equal(card._moveCamera.attributes["aria-pressed"], "true");
  assert.equal(card._resetCamera.hidden, false);
  assert.equal(card._cameraTouched, true);
  card._cameraMoved = true;
  card._setCameraMovement(false);
  assert.equal(card._resetCamera.hidden, false, "moved view can still reset");
  card._resetView();
  assert.deepEqual(calls.at(-1), ["reset"]);
  assert.equal(card._cameraMoved, false);
  assert.equal(card._resetCamera.hidden, true);
  card._config.camera_controls = false;
  card._syncCameraButtons();
  assert.equal(card._moveCamera.hidden, true);
  assert.equal(card._resetCamera.hidden, true);
  assert.deepEqual(card._config, {
    interactive: false,
    camera_controls: false,
  });
});
test("room changes during a load are rechecked once the load finishes", () => {
  const card = cardHarness();
  let checks = 0;
  card._modelsChanged = () => checks++;
  Object.defineProperty(card, "isConnected", { value: true });
  // While loading, an update (e.g. hiding a device) is remembered, not lost.
  card._loading = true;
  card._modelsEvent();
  card._modelsEvent();
  assert.equal(checks, 0);
  card._loading = false;
  card._recheckAfterLoad();
  assert.equal(checks, 1);
  // Nothing pending: no extra check after the next load.
  card._recheckAfterLoad();
  assert.equal(checks, 1);
  // When idle, updates are checked immediately.
  card._modelsEvent();
  assert.equal(checks, 2);
});
test("loads keep the update subscription instead of dropping it", async () => {
  const source = await readFile(
    new URL("../dashboard/card.js", import.meta.url),
    "utf8",
  );
  const load = source.slice(
    source.indexOf("  async _load() {"),
    source.indexOf("  /** Rooms changed: check now"),
  );
  // Only previews/add-on configurations drop it; normal loads reuse it.
  assert.match(
    load,
    /preview_url \|\| this\._config\.addon\) \{\n\s+this\._unsubModels\?\.\(\);/,
  );
  assert.equal(load.match(/this\._unsubModels\?\.\(\)/g).length, 1);
  assert.match(load, /!this\._unsubModels &&/);
});
