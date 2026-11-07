import test from "node:test";
import assert from "node:assert/strict";
import {
  roomName,
  libraryGroups,
  connectionState,
  deviceGroup,
} from "../shared/workspace.mjs";
import { packageSummary } from "../shared/package-summary.mjs";
import { zipSync, strToU8 } from "fflate";
const floors = [
  { id: "first", name: "First floor" },
  { id: "second", name: "Second floor" },
];
const hallway = {
  id: "hall",
  title: "Hallway · your scan · edited",
  bindings: {},
  controls: [],
  housePlacement: {
    houseId: "house",
    houseName: "Home",
    floorIds: ["first", "second"],
    floors,
  },
};
const office = {
  ...hallway,
  id: "office",
  title: "Office",
  housePlacement: { ...hallway.housePlacement, floorIds: ["second"] },
};
const house = {
  id: "h-house",
  houseView: true,
  houseId: "house",
  title: "Home",
};
const catalog = [
  hallway,
  office,
  house,
  { ...house, id: "h-house--first", houseFloor: floors[0] },
  { id: "loose", title: "Other room" },
];
test("house library includes multi-floor rooms on each occupied floor without altering identities", () => {
  const group = libraryGroups(catalog).houses[0];
  assert.deepEqual(
    group.floors.map((f) => f.rooms.map((m) => m.id)),
    [["hall"], ["hall", "office"]],
  );
  assert.equal(roomName(hallway), "Hallway");
  assert.equal(hallway.title, "Hallway · your scan · edited");
  assert.deepEqual(
    libraryGroups(catalog).other.map((m) => m.id),
    ["loose"],
  );
  assert.deepEqual(
    libraryGroups(catalog, "office").houses[0].rooms.map((m) => m.id),
    ["office"],
  );
  assert.equal(libraryGroups(catalog, "not found").houses.length, 0);
});
test("entity readiness distinguishes missing mappings, unavailable entities and simulation", () => {
  const control = { id: "shade", type: "cover" },
    model = { bindings: {} },
    status = { connected: true, entities: [] };
  assert.equal(connectionState(control, model, status).label, "Not connected");
  model.bindings.shade = "cover.demo";
  assert.equal(connectionState(control, model, status).label, "Unavailable");
  status.entities = [{ entity_id: "cover.demo", state: "closed" }];
  assert.equal(connectionState(control, model, status).label, "Ready");
  assert.equal(
    connectionState(control, model, status, true).label,
    "Simulation",
  );
  assert.equal(deviceGroup(control), "Shades & doors");
  assert.equal(deviceGroup({ device: {} }), "Furniture");
});
const manifest = (id) => ({
  id,
  title: id,
  controls: [{ id: "lamp" }],
  housePlacement: { floors },
});
const roomZip = (id) =>
  zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest(id))),
    "scene.glb": new Uint8Array(5000),
  });
const houseZip = () =>
  zipSync({
    "house-manifest.json": strToU8(
      JSON.stringify({
        format: "three-d-rooms-house/1",
        houseName: "Home",
        rooms: ["rooms/office.zip", "rooms/hall.zip"],
      }),
    ),
    "rooms/office.zip": roomZip("office"),
    "rooms/hall.zip": roomZip("hall"),
  });
test("ZIP preview reads nested rooms, floors, controls and existing ID conflicts", () => {
  const result = packageSummary(houseZip(), catalog);
  assert.equal(result.title, "Home");
  assert.equal(result.rooms.length, 2);
  assert.equal(result.floors.length, 2);
  assert.equal(result.controls, 2);
  assert.deepEqual(result.conflicts, ["office", "hall"]);
  assert.equal(packageSummary(roomZip("new")).rooms[0].id, "new");
  assert.throws(
    () => packageSummary(zipSync({ "house-project.json": strToU8("{}") })),
    /manifest/,
  );
});

test("compact sidebar lists a multi-floor room once and filters without changing membership", async () => {
  const { sidebarRooms, sidebarLabel } =
    await import("../shared/workspace.mjs");
  assert.deepEqual(
    sidebarRooms(catalog, "house").map((m) => m.id),
    ["hall", "office"],
  );
  assert.deepEqual(
    sidebarRooms(catalog, "house", "second").map((m) => m.id),
    ["hall", "office"],
  );
  assert.deepEqual(
    sidebarRooms(catalog, "house", "first").map((m) => m.id),
    ["hall"],
  );
  assert.deepEqual(
    sidebarRooms(catalog, "other").map((m) => m.id),
    ["loose"],
  );
  assert.deepEqual(
    sidebarRooms(catalog, "house", "all", "office").map((m) => m.id),
    ["office"],
  );
  const copy = { id: "copy", title: "Office – copy · Window desk row" };
  assert.equal(sidebarLabel(copy, [copy]), "Office");
  assert.equal(
    sidebarLabel(copy, [copy, office]),
    "Office – copy · Window desk row",
  );
  assert.deepEqual(hallway.housePlacement.floorIds, ["first", "second"]);
});
