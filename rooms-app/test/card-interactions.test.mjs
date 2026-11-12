import {
  markerSettings,
  markerLayout,
  markerTrayHeight,
  validateMarkers,
} from "../shared/marker-settings.mjs";
import { resolveSavedView } from "../shared/saved-view.mjs";
import { actionState } from "../shared/action.mjs";
import {
  allLights,
  roomLightCommands,
  roomLights,
  roomLightSummary,
} from "../shared/room-lights.mjs";
import { roomRoute } from "../shared/room-route.mjs";
import { shortRoomTitle } from "../shared/workspace.mjs";
import {
  focusableRooms,
  roomTitleOf,
  roomButtonShows,
  roomFocusView,
  spreadButtons,
} from "../shared/room-focus.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/card.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export class", "class");
const timers = { fn: null };
const windowCalls = [];
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
    setTimeout: (fn) => {
      timers.fn = fn;
      return 1;
    },
    clearTimeout: () => {
      timers.fn = null;
    },
    window: { open: (...args) => windowCalls.push(args) },
    requestAnimationFrame: (fn) => fn(),
    URLSearchParams,
    CSS: { escape: (value) => value },
    document: {
      createElement: () => ({
        dataset: {},
        style: {
          setProperty(name, value) {
            this[name] = value;
          },
        },
        listeners: {},
        setAttribute() {},
        addEventListener(type, fn) {
          this.listeners[type] = fn;
        },
        remove() {},
        focus() {},
        querySelector(selector) {
          this.found ||= {};
          return (this.found[selector] ||= { textContent: "", hidden: true });
        },
      }),
    },
    hexToRgb: () => [255, 240, 212],
    actionState,
    resolveSavedView,
    markerSettings,
    markerLayout,
    markerTrayHeight,
    validateMarkers,
    roomRoute,
    shortRoomTitle,
    roomTitleOf,
    allLights,
    roomLightCommands,
    roomLights,
    roomLightSummary,
    focusableRooms,
    roomButtonShows,
    spreadButtons,
    roomFocusView,
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
  card._syncRoomTags = () => {};
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
    source.indexOf("  async _load({ fresh = false } = {}) {"),
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

test("time-of-day options mark the chosen one and save only a new choice", async () => {
  const card = cardHarness(),
    saved = [],
    option = (mode) => ({
      dataset: { mode },
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    }),
    options = ["auto", "day", "night"].map(option);
  card._daylightSwitch = {
    hidden: false,
    dataset: {},
    querySelectorAll: () => options,
  };
  card._model = {
    id: "kitchen",
    daylight: { mode: "auto", entity: "sun.sun" },
  };
  card._states = () => {};
  card._hass.callWS = async (message) => {
    saved.push(message.data.mode);
    return { daylight: { mode: message.data.mode } };
  };
  const checked = () =>
    options.map((o) => [o.attributes["aria-checked"], o.tabIndex]);
  card._showDaylightMode("auto");
  assert.equal(card._daylightSwitch.dataset.mode, "auto");
  assert.deepEqual(checked(), [
    ["true", 0],
    ["false", -1],
    ["false", -1],
  ]);
  card._chooseDaylight("night");
  // The highlight moves at once; the save follows.
  assert.equal(card._daylightSwitch.dataset.mode, "night");
  assert.deepEqual(checked(), [
    ["false", -1],
    ["false", -1],
    ["true", 0],
  ]);
  await Promise.resolve();
  card._chooseDaylight("night");
  card._chooseDaylight("day");
  await Promise.resolve();
  assert.deepEqual(saved, ["night", "day"]);
  assert.equal(card._model.daylight.mode, "day");
  // An unknown saved mode is shown as Auto rather than leaving nothing chosen.
  card._showDaylightMode("dusk");
  assert.equal(card._daylightSwitch.value, "auto");
});

test("room buttons focus one room in place and go back to the house or floor", () => {
  const card = cardHarness();
  const shown = [],
    log = [];
  const element = () => ({
    hidden: true,
    dataset: {},
    style: {},
    attributes: {},
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    querySelector() {
      return { textContent: "" };
    },
    focus() {
      log.push("focus");
    },
  });
  card._roomTags = {
    dataset: {},
    children: [],
    replaceChildren(...items) {
      this.children = items;
    },
    querySelector: () => null,
  };
  card._roomBack = element();
  card._roomNav = element();
  card._roomSteps = [element(), element()];
  card._container = { clientWidth: 500, clientHeight: 400 };
  card._controls = { offsetTop: 340 };
  card._loading = false;
  card._buildAccess = () => log.push("access");
  card._states = () => log.push("states");
  card._syncCameraButtons = () => {};
  card._config = {};
  const house = {
    id: "h-home",
    title: "Home",
    houseView: true,
    houseFloor: { id: "f2" },
    roomTitles: { office: "Office" },
    members: [{ model: "office" }, { model: "hall" }],
    controls: [
      { id: "a", sourceModel: "office" },
      { id: "b", sourceModel: "hall", roomTitle: "Hallway" },
    ],
  };
  card._model = house;
  card._view = {
    setHouseView: (view, options) => {
      assert.equal(options.render, false);
      shown.push(view);
      return true;
    },
    roomFrontPoints: () => [
      { room: "office", x: 40, y: 90, visible: true, exposure: 0.1 },
      { room: "hall", x: 400, y: 90, visible: false, exposure: 0.1 },
    ],
  };
  card._syncRoomTags();
  assert.equal(card._roomTags.children.length, 2);
  assert.equal(card._roomBack.hidden, true);
  assert.equal(card._roomTags.children[0].hidden, false);
  assert.equal(
    card._roomTags.children[0].style.left,
    "48px",
    "kept inside the card",
  );
  assert.equal(card._roomTags.children[0].style.top, "90px");
  assert.equal(card._roomTags.children[1].hidden, true, "off screen");
  // A room that can be seen from the house view has no button unless asked.
  card._view.roomFrontPoints = () => [
    { room: "office", x: 40, y: 90, visible: true, exposure: 0.9 },
    { room: "hall", x: 100, y: 90, visible: true, exposure: 0.9 },
  ];
  card._positionRoomTags();
  assert.equal(card._roomTags.children[0].hidden, true, "seen: no button");
  card._config.markers = {
    _rooms: { hall: { mode: "always", position: [1, 2, 3] } },
  };
  let asked;
  card._view.roomFrontPoints = (positions) => {
    asked = positions;
    return [
      { room: "office", x: 40, y: 90, visible: true, exposure: 0.9 },
      {
        room: "hall",
        x: 100,
        y: 90,
        visible: true,
        exposure: 0.9,
        manual: true,
      },
    ];
  };
  card._positionRoomTags();
  assert.equal(
    JSON.stringify(asked),
    JSON.stringify({ hall: [1, 2, 3] }),
    "the room's chosen spot",
  );
  assert.equal(card._roomTags.children[1].hidden, false, "always shows");
  delete card._config.markers;
  card._view.roomFrontPoints = () => [
    { room: "office", x: 40, y: 90, visible: true, exposure: 0.1 },
    { room: "hall", x: 400, y: 90, visible: false, exposure: 0.1 },
  ];
  card._positionRoomTags();
  card._focusRoom("office");
  const focused = shown[0];
  assert.equal(focused.id, "h-home", "backend calls keep addressing the house");
  assert.equal(focused.focusRoom, "office");
  assert.deepEqual(
    focused.controls.map((c) => c.id),
    ["a"],
  );
  assert.equal(card._model, focused);
  assert.equal(card._focus.base, house);
  assert.equal(card._roomBack.hidden, false);
  assert.equal(card._roomTags.children.length, 0, "no buttons inside a room");
  card._focusRoom("hall");
  assert.equal(shown.length, 1, "already focused");
  // A model update compares against the house view, not the derived room.
  card._exitRoom();
  assert.equal(shown[1], house);
  assert.equal(card._model, house);
  assert.equal(card._focus, null);
  assert.equal(card._roomBack.hidden, true);
  assert.equal(card._roomTags.children.length, 2);
  // Picking a floor while focused leaves the room, even for the same view.
  card._floors = [{ id: "h-home" }, { id: "h-home--f2" }];
  card._views = [house];
  card._syncFloorSwitch = () => {};
  card._focusRoom("hall");
  card._selectFloor("h-home");
  assert.equal(card._focus, null);
  assert.equal(card._model, house);
  // When the house cannot be shown again in place, reload it.
  let loads = 0;
  card._load = () => loads++;
  card._focusRoom("hall");
  card._view.setHouseView = () => false;
  card._exitRoom();
  assert.equal(loads, 1);
  // The setting and unfocusable views hide the buttons.
  card._focus = null;
  card._model = house;
  card._config = { room_focus: false };
  card._syncRoomTags();
  assert.equal(card._roomTags.children.length, 0);
});

test("room buttons count the room's lights that are on and a long press switches them", async () => {
  const card = cardHarness();
  const calls = [];
  card._config = {};
  card._roomTags = {
    dataset: {},
    children: [],
    replaceChildren(...items) {
      this.children = items;
    },
  };
  card._roomBack = {
    hidden: true,
    querySelector: () => ({}),
    setAttribute() {},
  };
  card._roomNav = { hidden: true };
  card._roomSteps = [{ setAttribute() {} }, { setAttribute() {} }];
  card._pendingRooms = new Set();
  card._loading = false;
  const house = {
    id: "h-home",
    houseView: true,
    roomTitles: { office: "Office", hall: "Hallway" },
    members: [{ model: "office" }, { model: "hall" }],
    controls: [
      { id: "a", type: "light", sourceModel: "office", roomTitle: "Office" },
      { id: "b", type: "light", sourceModel: "office", roomTitle: "Office" },
      { id: "c", type: "cover", sourceModel: "hall", roomTitle: "Hallway" },
    ],
    bindings: { a: "light.a", b: "light.b" },
  };
  card._model = house;
  card._view = { highlightRoom: (room) => calls.push(["outline", room]) };
  card._hass = {
    states: { "light.a": { state: "on" }, "light.b": { state: "on" } },
    callService: async (...args) => calls.push(args),
  };
  card._positionRoomTags = () => {};
  card._lightStates = new Map([
    ["a", { on: true }],
    ["b", { on: false }],
  ]);
  card._syncRoomTags();
  const [office, hall] = card._roomTags.children;
  assert.equal(office.found[".room-tag-count"].hidden, false);
  assert.equal(office.found[".room-tag-count"].textContent, 1);
  assert.equal(office.dataset.active, "true");
  assert.equal(
    hall.found[".room-tag-count"].hidden,
    true,
    "no lights: no count",
  );
  assert.match(office.title, /hold to switch its lights/);
  assert.doesNotMatch(hall.title, /hold/);
  // Hovering outlines the room.
  office.listeners.pointerenter({ pointerType: "mouse" });
  office.listeners.pointerenter({ pointerType: "touch" });
  office.listeners.pointerleave();
  assert.deepEqual(calls.splice(0), [
    ["outline", "office"],
    ["outline", null],
  ]);
  // A short tap opens the room (here: nothing loaded, so it does nothing),
  // holding switches the lights: one is on, so all turn off.
  card._focusRoom = (room) => calls.push(["focus", room]);
  office.onclick();
  assert.deepEqual(calls.splice(0), [["focus", "office"]]);
  office.listeners.pointerdown({ button: 0, clientX: 5, clientY: 5 });
  assert.equal(office.dataset.pressing, "true");
  assert.equal(typeof timers.fn, "function");
  // Moving away cancels the hold.
  office.listeners.pointermove({ clientX: 60, clientY: 5 });
  assert.equal(timers.fn, null);
  assert.equal(office.dataset.pressing, undefined);
  office.listeners.pointerdown({ button: 0, clientX: 5, clientY: 5 });
  timers.fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.splice(0), [
    ["light", "turn_off", { entity_id: ["light.a", "light.b"] }],
  ]);
  // The click that ends a hold does not also open the room.
  office.onclick();
  assert.deepEqual(calls, []);
  office.onclick();
  assert.deepEqual(calls, [["focus", "office"]]);
});

test("in a room, previous and next go to the neighbouring rooms and wrap round", () => {
  const card = cardHarness();
  const shown = [],
    steps = [{ setAttribute() {} }, { setAttribute() {} }];
  card._roomTags = {
    dataset: {},
    children: [],
    replaceChildren(...items) {
      this.children = items;
    },
    querySelector: () => null,
  };
  card._roomBack = {
    hidden: true,
    querySelector: () => ({}),
    setAttribute() {},
    focus() {},
  };
  card._roomNav = { hidden: true };
  card._roomSteps = steps;
  card._config = {};
  card._loading = false;
  card._buildAccess = () => {};
  card._states = () => {};
  card._syncCameraButtons = () => {};
  const house = {
    id: "h-home",
    houseView: true,
    roomTitles: { a: "Office", b: "Hallway", c: "Living room" },
    members: [{ model: "a" }, { model: "b" }, { model: "c" }],
    controls: [],
  };
  card._model = house;
  card._view = {
    setHouseView: (view) => {
      shown.push(view.focusRoom ?? "house");
      return true;
    },
    roomFrontPoints: () => [],
  };
  card._syncRoomTags();
  card._focusRoom("a");
  assert.equal(card._roomNav.hidden, false);
  assert.match(
    steps[0].title,
    /Previous room · Living room/,
    "wraps to the last",
  );
  assert.match(steps[1].title, /Next room · Hallway/);
  card._stepRoom(1);
  assert.equal(card._model.focusRoom, "b");
  assert.equal(card._focus.room, "b");
  assert.equal(card._focus.base, house, "the house is still the way back");
  card._stepRoom(1);
  card._stepRoom(1);
  assert.equal(card._model.focusRoom, "a", "wraps round to the first");
  card._stepRoom(-1);
  assert.equal(card._model.focusRoom, "c");
  assert.deepEqual(shown, ["a", "b", "c", "a", "c"]);
  card._exitRoom();
  assert.equal(card._model, house);
  assert.equal(card._roomNav.hidden, true);
  card._stepRoom(1);
  assert.equal(shown.length, 6, "nothing to step outside a room");
});

test("icons covered by another room are hidden once the camera settles, and shown again when it clears", () => {
  const card = cardHarness();
  const lamp = { dataset: { control: "lamp" }, style: {} },
    other = { dataset: { control: "other" }, style: {} };
  card._config = {};
  card._container = { clientWidth: 500, clientHeight: 400 };
  card.shadowRoot.querySelectorAll = () => [lamp, other];
  card._groupIcons = () => {};
  card._positionRoomTags = () => {};
  card._model = {
    houseView: true,
    controls: [
      { id: "lamp", sourceModel: "office" },
      { id: "other", sourceModel: "hall" },
    ],
  };
  let covered = new Set(["lamp"]);
  const asked = [];
  card._view = {
    fixtureScreenPosition: () => ({ x: 100, y: 100, visible: true }),
    coveredMarkers: (entries) => {
      asked.push(entries.map((e) => `${e.id}:${e.room}`));
      return covered;
    },
  };
  card._positionButtons();
  assert.equal(lamp.hidden, false, "shown until the camera has settled");
  assert.equal(typeof timers.fn, "function", "check scheduled");
  timers.fn();
  assert.equal(
    JSON.stringify(asked),
    JSON.stringify([["lamp:office", "other:hall"]]),
  );
  assert.equal(lamp.hidden, true, "covered icon hidden");
  assert.equal(other.hidden, false);
  // The scene says it is clear again (the camera moved).
  covered = new Set();
  card._checkCovered();
  assert.equal(lamp.hidden, false);
  // Rooms on their own, and previews without the scene check, are untouched.
  card._model.focusRoom = "office";
  card._covered = new Set(["lamp"]);
  card._scheduleCoverCheck();
  assert.equal(card._covered.size, 0);
});

test("a view whose shaders are not built yet opens behind a spinner", async () => {
  const card = cardHarness(),
    overlay = { hidden: true },
    label = { textContent: "" },
    order = [],
    tick = () => new Promise((done) => setImmediate(done));
  Object.assign(card, {
    _switchOverlay: overlay,
    _switchLabel: label,
    _container: { setAttribute() {} },
    _generation: 1,
    _loading: false,
  });
  let ready = false,
    release;
  card._view = {
    isHouseViewPrepared: () => ready,
    prepareHouseView: () =>
      new Promise((done) => {
        release = () => {
          ready = true;
          done(true);
        };
      }),
  };
  const target = { id: "h", houseView: true };
  card._showView(target, "Living room", () => order.push("applied"));
  assert.equal(overlay.hidden, false, "spinner shown");
  assert.equal(label.textContent, "Opening Living room…");
  assert.deepEqual(order, [], "nothing switches while preparing");
  card._showView(target, "Office", () => order.push("second"));
  await tick();
  release();
  await tick();
  assert.equal(overlay.hidden, true);
  assert.deepEqual(order, ["applied"], "one switch; the second tap is ignored");
  assert.equal(card._switching, false);
  // A prepared view switches at once, without a spinner.
  card._showView(target, "Living room", () => order.push("instant"));
  assert.deepEqual(order, ["applied", "instant"]);
  assert.equal(overlay.hidden, true);
  // A reload that began meanwhile wins: the old switch is dropped.
  ready = false;
  card._showView(target, "Living room", () => order.push("stale"));
  card._generation = 2;
  await tick();
  release();
  await tick();
  assert.deepEqual(order, ["applied", "instant"]);
  assert.equal(overlay.hidden, true);
  // Views without a prepare step (older scenes) still switch at once.
  card._view = {};
  card._showView(target, "Living room", () => order.push("plain"));
  assert.equal(order.at(-1), "plain");
});

test("the Edit button opens the saved view in the manager, for administrators only", () => {
  const card = cardHarness();
  card._editButton = { hidden: true };
  card._view = {};
  card._hass = { user: { is_admin: true } };
  card._config = { model: "h-home--f2" };
  card._sourceConfig = { saved_view: "my-view" };
  assert.equal(
    card._editorURL(),
    "/three_d_rooms?model=h-home--f2&saved_view=my-view&tab=views",
  );
  card._syncEditButton();
  assert.equal(card._editButton.hidden, false);
  card._openEditor();
  assert.deepEqual(windowCalls.at(-1), [
    "/three_d_rooms?model=h-home--f2&saved_view=my-view&tab=views",
    "_blank",
    "noopener",
  ]);
  // A card without a saved view opens its room or house.
  card._sourceConfig = {};
  assert.equal(card._editorURL(), "/three_d_rooms?model=h-home--f2");
  // Behind a Home Assistant base URL the link follows it.
  card._hass.hassUrl = (path) => `https://ha.example${path}`;
  assert.equal(
    card._editorURL(),
    "https://ha.example/three_d_rooms?model=h-home--f2",
  );
  delete card._hass.hassUrl;
  // Not for other users, previews, the option, or an unloaded card.
  card._hass = { user: { is_admin: false } };
  card._syncEditButton();
  assert.equal(card._editButton.hidden, true, "not an administrator");
  card._hass = { user: { is_admin: true } };
  card._config.edit_button = false;
  card._syncEditButton();
  assert.equal(card._editButton.hidden, true, "turned off");
  delete card._config.edit_button;
  card._preview = true;
  card._syncEditButton();
  assert.equal(card._editButton.hidden, true, "preview");
  card._preview = false;
  card._view = null;
  card._syncEditButton();
  assert.equal(card._editButton.hidden, true, "not loaded");
  // An id the manager route would not accept gives no link.
  card._view = {};
  card._config.model = "Bad Id!";
  assert.equal(card._editorURL(), null);
});
