import { actionState } from "../shared/action.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (
  await readFile(new URL("../dashboard/card.js", import.meta.url), "utf8")
)
  .replace(/^import .*;\n/gm, "")
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
