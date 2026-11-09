import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import {
  roomLights,
  roomLightSummary,
  roomLightCommands,
  allLights,
  roomDevices,
  PANEL_KINDS,
} from "../shared/room-lights.mjs";
import { houseModels } from "../shared/house.mjs";

const house = {
  id: "h-home",
  title: "Home",
  houseView: true,
  controls: [
    {
      id: "k1",
      type: "light",
      label: "Kitchen · Spot 1",
      roomTitle: "Kitchen",
      sourceModel: "kitchen",
    },
    {
      id: "k2",
      type: "light",
      label: "Kitchen · Spots",
      lightGroup: "g",
      lightGroupLabel: "Kitchen · Spots",
      lightGroupPrimary: true,
      roomTitle: "Kitchen",
      sourceModel: "kitchen",
    },
    {
      id: "k3",
      type: "light",
      label: "Kitchen · Spot 3",
      lightGroup: "g",
      lightGroupPrimary: false,
      roomTitle: "Kitchen",
      sourceModel: "kitchen",
    },
    {
      id: "k4",
      type: "light",
      label: "Kitchen · Hidden",
      hidden: true,
      roomTitle: "Kitchen",
      sourceModel: "kitchen",
    },
    {
      id: "k5",
      type: "cover",
      label: "Kitchen · Shade",
      sourceModel: "kitchen",
    },
    {
      id: "b1",
      type: "light",
      label: "Bedroom · Lamp",
      roomTitle: "Bedroom",
      sourceModel: "bedroom",
    },
    {
      id: "b2",
      type: "light",
      label: "Bedroom · Strip",
      roomTitle: "Bedroom",
      sourceModel: "bedroom",
    },
  ],
  bindings: {
    k1: "light.spot_1",
    k2: "light.spots",
    k3: "light.spots",
    k5: "cover.shade",
    b1: "switch.lamp",
    b2: "light.strip",
  },
};

test("lights are listed per room once, without hidden or non-light controls", () => {
  const rooms = roomLights(house);
  assert.deepEqual(
    rooms.map((r) => [r.id, r.title, r.lights.map((l) => l.label), r.entities]),
    [
      [
        "kitchen",
        "Kitchen",
        ["Spot 1", "Spots"],
        ["light.spot_1", "light.spots"],
      ],
      ["bedroom", "Bedroom", ["Lamp", "Strip"], ["switch.lamp", "light.strip"]],
    ],
  );
  assert.equal(rooms[0].lights[1].group, true);
});

test("a single room is one section named after the room", () => {
  const rooms = roomLights({
    id: "office",
    title: "Office",
    controls: [{ id: "a", type: "light", label: "Desk lamp" }],
    bindings: { a: "climate.wrong" },
  });
  assert.deepEqual(rooms, [
    {
      id: "office",
      kind: "light",
      title: "Office",
      lights: [
        { id: "a", label: "Desk lamp", entityId: undefined, group: false },
      ],
      entities: [],
    },
  ]);
  assert.deepEqual(roomLights({ controls: [] }), []);
});

test("room switch turns everything off when any light is on, else on", () => {
  const [kitchen, bedroom] = roomLights(house);
  const entities = {
    "light.spot_1": { state: "on" },
    "light.spots": { state: "off" },
    "switch.lamp": { state: "off" },
    "light.strip": { state: "unavailable" },
  };
  const states = new Map([
    ["k1", { on: true }],
    ["k2", { on: false }],
    ["b1", { on: false }],
    ["b2", { on: false, unavailable: true }],
  ]);
  assert.deepEqual(roomLightSummary(kitchen, states), {
    on: 1,
    available: 2,
    total: 2,
  });
  assert.deepEqual(roomLightCommands(kitchen, states, entities), {
    turnOn: false,
    calls: [
      ["light", "turn_off", { entity_id: ["light.spot_1", "light.spots"] }],
    ],
  });
  // Unavailable entities are skipped; switch-backed lights use their domain.
  assert.deepEqual(roomLightCommands(bedroom, states, entities), {
    turnOn: true,
    calls: [["switch", "turn_on", { entity_id: ["switch.lamp"] }]],
  });
});

test("house views name each control's room", () => {
  const placement = (roomId) => ({
    schemaVersion: 1,
    houseId: "home",
    houseName: "Home",
    roomId,
    floorIds: ["f1"],
    floors: [{ id: "f1", name: "Ground", minY: -1, maxY: 3 }],
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  });
  const views = houseModels([
    {
      id: "kitchen",
      title: "Kitchen",
      controls: [
        { id: "a", type: "light", label: "Spot", position: [0, 1, 0] },
      ],
      bindings: { a: "light.spot" },
      housePlacement: placement("kitchen"),
    },
  ]);
  const rooms = roomLights(views[0]);
  assert.deepEqual(
    rooms.map((r) => [r.title, r.lights.map((l) => l.label), r.entities]),
    [["Kitchen", ["Spot"], ["light.spot"]]],
  );
});

const source = (
  await readFile(new URL("../dashboard/card.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export class", "class");
function card() {
  let Card;
  const context = vm.createContext({
    HTMLElement: class {},
    customElements: { get: () => false, define: (_, v) => (Card = v) },
    window: {},
    document: { createElement: () => ({ setAttribute() {}, remove() {} }) },
    hexToRgb: () => [255, 240, 212],
    roomLights,
    roomLightSummary,
    roomLightCommands,
    allLights,
    roomDevices,
    PANEL_KINDS,
  });
  vm.runInContext(source, context);
  const c = Object.create(Card.prototype);
  c._model = house;
  c._rooms = roomLights(house);
  c._pendingRooms = new Set();
  c._container = { append() {} };
  c.shadowRoot = { querySelectorAll: () => [], querySelector: () => null };
  return c;
}

test("card room switch sends one call per domain and ignores overlap", async () => {
  const c = card(),
    calls = [];
  let finish;
  c._lightStates = new Map([
    ["k1", { on: false }],
    ["k2", { on: false }],
  ]);
  c._hass = {
    states: {
      "light.spot_1": { state: "off" },
      "light.spots": { state: "off" },
    },
    callService: (...args) => {
      calls.push(args);
      return new Promise((resolve) => (finish = resolve));
    },
  };
  const first = c._toggleRoomLights("kitchen");
  await c._toggleRoomLights("kitchen");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["light", "turn_on", { entity_id: ["light.spot_1", "light.spots"] }],
  ]);
  finish();
  await first;
  assert.equal(c._pendingRooms.size, 0);
});

test("card room switch in a preview changes local state only", async () => {
  const c = card();
  c._preview = true;
  c._previewStates = new Map([["b1", { on: true }]]);
  c._lightStates = new Map([
    ["b1", { on: true }],
    ["b2", { on: false }],
  ]);
  let rendered = 0;
  c._states = () => rendered++;
  c._hass = { callService: () => assert.fail("unexpected device command") };
  await c._toggleRoomLights("bedroom");
  assert.equal(c._previewStates.get("b1").on, false);
  assert.equal(c._previewStates.get("b2").on, false);
  assert.equal(rendered, 1);
});

test("bulk switches skip hidden devices, even when they share an entity", () => {
  const model = {
    id: "office",
    title: "Office",
    controls: [
      { id: "desk", type: "light", label: "Desk" },
      { id: "shelf", type: "light", label: "Shelf" },
      { id: "secret", type: "light", label: "Secret", hidden: true },
      { id: "twin", type: "light", label: "Twin", hidden: true },
    ],
    bindings: {
      desk: "light.desk",
      shelf: "light.shared",
      secret: "light.secret",
      twin: "light.shared",
    },
  };
  const [office] = roomLights(model);
  assert.deepEqual(
    office.lights.map((l) => l.id),
    ["desk", "shelf"],
  );
  // light.shared also drives a hidden light, so only its own row switches it.
  assert.deepEqual(office.entities, ["light.desk"]);
  const states = new Map([["desk", { on: true }]]);
  const { calls } = roomLightCommands(office, states, {
    "light.desk": { state: "on" },
    "light.shared": { state: "on" },
    "light.secret": { state: "on" },
  });
  assert.deepEqual(calls, [
    ["light", "turn_off", { entity_id: ["light.desk"] }],
  ]);
});

test("All lights combines every room once", () => {
  const all = allLights(roomLights(house));
  assert.equal(all.lights.length, 4);
  assert.deepEqual(all.entities, [
    "light.spot_1",
    "light.spots",
    "switch.lamp",
    "light.strip",
  ]);
});

test("card All lights switch turns off every room, skipping unavailable", async () => {
  const c = card(),
    calls = [];
  c._lightStates = new Map([
    ["k1", { on: true }],
    ["k2", { on: false }],
    ["b1", { on: true }],
    ["b2", { on: false, unavailable: true }],
  ]);
  c._hass = {
    states: {
      "light.spot_1": { state: "on" },
      "light.spots": { state: "off" },
      "switch.lamp": { state: "on" },
      "light.strip": { state: "unavailable" },
    },
    callService: async (...args) => calls.push(args),
  };
  await c._toggleRoomLights("");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["light", "turn_off", { entity_id: ["light.spot_1", "light.spots"] }],
    ["switch", "turn_off", { entity_id: ["switch.lamp"] }],
  ]);
});

const shades = {
  id: "home",
  title: "Home",
  controls: [
    {
      id: "s1",
      type: "cover",
      label: "Bay shade",
      sourceModel: "living",
      roomTitle: "Living",
    },
    {
      id: "s2",
      type: "cover",
      label: "Side shade",
      sourceModel: "living",
      roomTitle: "Living",
    },
    {
      id: "door",
      type: "cover",
      label: "Garden door",
      sourceModel: "living",
      roomTitle: "Living",
    },
    {
      id: "desk",
      type: "cover",
      motion: "none",
      label: "Desk",
      sourceModel: "office",
      roomTitle: "Office",
    },
    {
      id: "sensor",
      type: "cover",
      label: "Sensor shade",
      sourceModel: "office",
      roomTitle: "Office",
    },
    {
      id: "gone",
      type: "cover",
      label: "Hidden shade",
      hidden: true,
      sourceModel: "office",
      roomTitle: "Office",
    },
    {
      id: "lamp",
      type: "light",
      label: "Lamp",
      sourceModel: "office",
      roomTitle: "Office",
    },
  ],
  bindings: {
    s1: "cover.bay",
    s2: "cover.side",
    door: "cover.garden",
    desk: "cover.desk",
    sensor: "binary_sensor.shade",
    gone: "cover.gone",
    lamp: "light.lamp",
  },
};
const isShade = (c) => !["door", "desk"].includes(c.id);

test("shades panel lists roller shades only; sensors and hidden shades stay out of bulk", () => {
  const rooms = roomDevices(shades, "shade", isShade);
  assert.deepEqual(
    rooms.map((r) => [r.title, r.lights.map((l) => l.id), r.entities]),
    [
      ["Living", ["s1", "s2"], ["cover.bay", "cover.side"]],
      ["Office", ["sensor"], []],
    ],
  );
});

test("shade switches close anything open, otherwise open everything", () => {
  const [living] = roomDevices(shades, "shade", isShade),
    entities = {
      "cover.bay": { state: "open" },
      "cover.side": { state: "closed" },
    };
  assert.deepEqual(
    roomLightCommands(
      living,
      new Map([
        ["s1", { position: 40 }],
        ["s2", { position: 0 }],
      ]),
      entities,
    ).calls,
    [["cover", "close_cover", { entity_id: ["cover.bay", "cover.side"] }]],
  );
  assert.deepEqual(
    roomLightCommands(
      living,
      new Map([
        ["s1", { position: 0 }],
        ["s2", { position: 0 }],
      ]),
      entities,
    ).calls,
    [["cover", "open_cover", { entity_id: ["cover.bay", "cover.side"] }]],
  );
  // Binary covers without a position count as open from their state.
  assert.equal(PANEL_KINDS.shade.isOn({ motionPosition: 100 }), true);
  assert.equal(allLights(roomDevices(shades, "shade", isShade)).kind, "shade");
});

test("card shade row opens a closed shade through the cover domain", async () => {
  const c = card(),
    calls = [];
  c._model = shades;
  c._lightStates = new Map([["s2", { position: 0 }]]);
  c._hass = {
    states: { "cover.side": { state: "closed" } },
    callService: async (...args) => calls.push(args),
  };
  await c._toggleShade("s2");
  c._lightStates.set("s2", { position: 100 });
  await c._toggleShade("s2");
  await c._toggleShade("sensor");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["cover", "open_cover", { entity_id: "cover.side" }],
    ["cover", "close_cover", { entity_id: "cover.side" }],
  ]);
});
