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
    hexToRgb: () => [255, 240, 212],
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
