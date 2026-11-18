import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  vacuumState,
  vacuumActions,
  vacuumCommand,
  dockFacing,
  VACUUM_CAPABILITIES,
} from "../shared/vacuum.mjs";
import { createVacuumVisual, VACUUM_RADIUS } from "../shared/vacuum-visual.mjs";
import { markerAppearance } from "../shared/marker.mjs";
import { markerStateWords } from "../shared/marker-icons.mjs";
import { deviceGroup } from "../shared/workspace.mjs";
import { houseModels } from "../shared/house.mjs";
import {
  validateManifest,
  compatible,
  commandFor,
} from "../server/manifest.mjs";

const c = {
  id: "corridor-vacuum",
  label: "Robot vacuum",
  type: "vacuum",
  position: [0, 0, 0],
  facing: [0, 0, 1],
  capabilities: VACUUM_CAPABILITIES,
};
// Roborock over Matter: start, pause, stop, return home, locate (+ state).
const ALL = 8192 | 4 | 8 | 16 | 512 | 4096;
const entity = (state, attributes = {}) => ({
  entity_id: "vacuum.bubi_5_roborock",
  state,
  attributes: { supported_features: ALL, ...attributes },
});

test("vacuum state follows Home Assistant's vacuum activities", () => {
  assert.equal(vacuumState(entity("docked")).label, "Docked");
  assert.equal(vacuumState(entity("cleaning")).active, true);
  assert.equal(vacuumState(entity("returning")).active, true);
  assert.equal(vacuumState(entity("paused")).active, false);
  assert.equal(vacuumState(entity("error")).error, true);
  assert.equal(
    vacuumState(entity("docked", { battery_level: 80 })).battery,
    80,
  );
  for (const e of [
    undefined,
    entity("unavailable"),
    entity("unknown"),
    { entity_id: "lock.door", state: "docked" },
  ])
    assert.equal(vacuumState(e).unavailable, true);
});

test("vacuum commands need the model capability and the vacuum's feature", () => {
  assert.deepEqual(vacuumActions(entity("docked"), c), [
    "start",
    "pause",
    "stop",
    "return_to_base",
    "locate",
  ]);
  assert.deepEqual(vacuumCommand(entity("docked"), c, "start"), {
    domain: "vacuum",
    service: "start",
    target: { entity_id: "vacuum.bubi_5_roborock" },
    service_data: {},
  });
  // No STOP feature reported: no Stop button, and the command is refused.
  const noStop = entity("cleaning", { supported_features: ALL & ~8 });
  assert.equal(vacuumActions(noStop, c).includes("stop"), false);
  assert.throws(() => vacuumCommand(noStop, c, "stop"));
  assert.throws(() =>
    vacuumCommand(
      entity("docked"),
      { ...c, capabilities: ["start"] },
      "locate",
    ),
  );
  assert.throws(() => vacuumCommand(entity("docked"), c, "clean_spot"));
  assert.throws(() => vacuumCommand(entity("unavailable"), c, "start"));
});

test("dev server validates vacuum controls like the integration", async () => {
  const m = JSON.parse(await readFile("examples/manifest.json", "utf8"));
  m.controls = [c];
  assert.equal(validateManifest(m).controls[0].type, "vacuum");
  assert.equal(compatible(c, { entity_id: "vacuum.robot" }), true);
  assert.equal(compatible(c, { entity_id: "switch.robot" }), false);
  for (const facing of [
    [0, 1, 0],
    [0, 0, 2],
  ])
    assert.throws(() =>
      validateManifest({ ...m, controls: [{ ...c, facing }] }),
    );
  assert.throws(() =>
    validateManifest({ ...m, controls: [{ ...c, capabilities: ["pause"] }] }),
  );
  assert.equal(
    commandFor(
      "vacuum.robot",
      "return_to_base",
      undefined,
      c,
      {},
      entity("cleaning"),
    ).service,
    "return_to_base",
  );
});

test("vacuum markers, words and groups", () => {
  const cleaning = markerAppearance(c, entity("cleaning"), {});
  assert.equal(cleaning.active, true);
  assert.equal(cleaning.tone, "cleaning");
  assert.equal(markerAppearance(c, entity("returning"), {}).tone, "moving");
  assert.equal(markerAppearance(c, entity("error"), {}).tone, "jammed");
  assert.equal(markerAppearance(c, entity("docked"), {}).tone, undefined);
  assert.equal(markerAppearance(c, undefined, {}).badge, "—");
  assert.deepEqual(markerStateWords(c), ["Cleaning", "Docked"]);
  assert.equal(deviceGroup(c), "Cleaning");
  assert.deepEqual(dockFacing({}), [0, 0, 1]);
  assert.deepEqual(dockFacing({ facing: [3, 0, 4] }), [0.6, 0, 0.8]);
});

test("house views rotate the dock with its room", () => {
  const quarter = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 2, 3, 1];
  const room = {
    id: "corridor",
    title: "Corridor",
    controls: [c],
    bindings: {},
    housePlacement: {
      schemaVersion: 1,
      houseId: "h",
      houseName: "Home",
      roomId: "r",
      transform: quarter,
      floors: [],
      floorIds: [],
    },
  };
  const house = houseModels([room]).find((m) => m.houseView);
  const placed = house.controls[0];
  assert.deepEqual(placed.position, [5, 2, 3]);
  assert.deepEqual(placed.facing, [1, 0, 0]);
});

/**
 * A 3 m × 2 m room (walls at x = ±1.5, z = -0.3 and z = 1.7) with the dock
 * against the back wall. Rays stop at the walls; there is floor everywhere
 * inside.
 */
function room() {
  const walls = { minX: -1.5, maxX: 1.5, minZ: -0.3, maxZ: 1.7 };
  const sense = (from, dir, far) => {
    let best = Infinity;
    if (dir.x > 1e-9) best = Math.min(best, (walls.maxX - from.x) / dir.x);
    if (dir.x < -1e-9) best = Math.min(best, (walls.minX - from.x) / dir.x);
    if (dir.z > 1e-9) best = Math.min(best, (walls.maxZ - from.z) / dir.z);
    if (dir.z < -1e-9) best = Math.min(best, (walls.minZ - from.z) / dir.z);
    return best <= far ? best : Infinity;
  };
  const floorAt = (x, y, z) =>
    x > walls.minX && x < walls.maxX && z > walls.minZ && z < walls.maxZ;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return { walls, sense, floorAt, random };
}
const run = (visual, seconds, from = 0) => {
  for (let t = from; t <= from + seconds; t += 1 / 30) visual.update(t);
  return from + seconds;
};

test("the robot drives out, cleans inside the walls, and goes home", () => {
  const { walls, ...sensors } = room();
  const visual = createVacuumVisual(c, sensors);
  const start = visual.position;
  assert.equal(visual.mode, "parked");
  assert.equal(visual.animating, false);
  visual.setState(vacuumState(entity("cleaning")));
  assert.equal(visual.animating, true);
  let t = run(visual, 1);
  assert.equal(visual.mode, "leaving");
  let travelled = 0,
    last = visual.position;
  for (let i = 0; i < 60 * 30; i++) {
    t += 1 / 30;
    visual.update(t);
    const [x, , z] = visual.position;
    travelled += Math.hypot(x - last[0], z - last[2]);
    last = visual.position;
    // Never through a wall (allowing for the robot's own radius).
    assert.ok(x - VACUUM_RADIUS > walls.minX - 0.01, `x ${x}`);
    assert.ok(x + VACUUM_RADIUS < walls.maxX + 0.01, `x ${x}`);
    assert.ok(z + VACUUM_RADIUS < walls.maxZ + 0.01, `z ${z}`);
  }
  assert.ok(travelled > 8, `cleaned ${travelled} m in a minute`);
  // Paused: it stops where it is.
  visual.setState(vacuumState(entity("paused")));
  const paused = visual.position;
  t = run(visual, 2, t);
  assert.deepEqual(visual.position, paused);
  // Returning: back along its trail, then reversing into the dock.
  visual.setState(vacuumState(entity("returning")));
  t = run(visual, 90, t);
  assert.equal(visual.mode, "parked");
  assert.ok(
    Math.hypot(visual.position[0] - start[0], visual.position[2] - start[2]) <
      1e-6,
  );
  assert.equal(visual.robot.rotation.y, 0);
  visual.setState(vacuumState(entity("docked")));
  assert.equal(visual.animating, false);
  visual.dispose();
});

test("docked in Home Assistant while away: the robot hurries home", () => {
  const visual = createVacuumVisual(c, room());
  visual.setState(vacuumState(entity("cleaning")));
  let t = run(visual, 30);
  visual.setState(vacuumState(entity("docked")));
  t = run(visual, 30, t);
  assert.equal(visual.mode, "parked");
});

test("reduced motion shows a still pose for the state", () => {
  const visual = createVacuumVisual(c, { ...room(), reducedMotion: true });
  visual.setState(vacuumState(entity("cleaning")));
  assert.equal(visual.animating, false);
  assert.ok(visual.position[2] > 0.5);
  visual.setState(vacuumState(entity("docked")));
  assert.ok(Math.abs(visual.position[2]) < 0.1);
});

/**
 * Two rooms side by side: A (x -1.5…1.5, dock) and B (x 1.5…4.5), both
 * z -0.3…1.7, joined by an 80 cm doorway in the wall at x = 1.5.
 */
function twoRooms() {
  const walls = [
    [-1.5, -0.3, 4.5, -0.3],
    [-1.5, 1.7, 4.5, 1.7],
    [-1.5, -0.3, -1.5, 1.7],
    [4.5, -0.3, 4.5, 1.7],
    [1.5, -0.3, 1.5, 0.4],
    [1.5, 1.2, 1.5, 1.7],
  ];
  const sense = (from, dir, far) => {
    let best = Infinity;
    for (const [x1, z1, x2, z2] of walls) {
      const ex = x2 - x1,
        ez = z2 - z1,
        den = dir.x * ez - dir.z * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((x1 - from.x) * ez - (z1 - from.z) * ex) / den,
        u = ((x1 - from.x) * dir.z - (z1 - from.z) * dir.x) / den;
      if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
    }
    return best <= far ? best : Infinity;
  };
  const inside = (x, z) => x > -1.5 && x < 4.5 && z > -0.3 && z < 1.7;
  let seed = 11;
  return {
    sense,
    floorAt: (x, y, z) => inside(x, z),
    roomAt: (x, y, z) => (!inside(x, z) ? null : x < 1.5 ? "A" : "B"),
    roomCenter: (room) => (room === "B" ? [3, 0, 0.7] : [0, 0, 0.7]),
    random: () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646,
  };
}

test("cleaning by area: the robot drives to the chosen room and stays in it", () => {
  const world = twoRooms();
  const visual = createVacuumVisual(c, world);
  visual.setRooms(["B"]);
  visual.setState(vacuumState(entity("cleaning")));
  let t = 0,
    arrived;
  for (; t < 120; t += 1 / 30) {
    visual.update(t);
    if (visual.room === "B") {
      arrived = t;
      break;
    }
  }
  assert.ok(arrived !== undefined, `never reached room B (${visual.mode})`);
  // Then two minutes inside B without ever leaving its floor.
  for (let end = t + 120; t < end; t += 1 / 30) {
    visual.update(t);
    const [x, , z] = visual.position;
    assert.equal(world.roomAt(x, 0, z), "B", `left B at ${x}, ${z}`);
  }
  // Home again through the doorway, back onto the dock.
  visual.setState(vacuumState(entity("returning")));
  for (let end = t + 120; t < end && visual.mode !== "parked"; t += 1 / 30)
    visual.update(t);
  assert.equal(visual.mode, "parked");
  assert.equal(visual.room, null);
});

test("cleaning by area: unknown rooms are skipped and the robot roams", () => {
  const visual = createVacuumVisual(c, twoRooms());
  visual.setState(vacuumState(entity("cleaning")));
  run(visual, 5);
  visual.setRooms(["nowhere"]);
  run(visual, 30, 5);
  assert.equal(visual.room, null);
  assert.ok(["wander", "turning"].includes(visual.mode), visual.mode);
});

test("clean_area areas map to the linked 3D rooms, in the chosen order", async () => {
  const { vacuumRooms } = await import("../shared/vacuum.mjs");
  const house = {
    members: [
      { model: "room-corridor", areaId: "corridor" },
      { model: "room-bed", areaId: "bedroom" },
      { model: "room-office" },
    ],
  };
  assert.deepEqual(vacuumRooms(house, ["bedroom", "kitchen", "corridor"]), [
    "room-bed",
    "room-corridor",
  ]);
  assert.deepEqual(
    vacuumRooms({ id: "room-bed", areaId: "bedroom" }, ["bedroom"]),
    ["room-bed"],
  );
  assert.deepEqual(vacuumRooms({ id: "room-bed" }, ["bedroom"]), []);
});

test("vacuum activity lists the extra on/off controls that are on", async () => {
  const { vacuumActivity } = await import("../shared/vacuum.mjs");
  const states = {
    "switch.dock_mop_washing": { state: "on" },
    "switch.dock_mop_drying": { state: "off" },
    "switch.child_lock": { state: "on" },
    "binary_sensor.dock_drying": { state: "on" },
    "select.mop_mode": { state: "on" },
    "vacuum.robot": { state: "on" },
  };
  const category = (id) => (id === "switch.child_lock" ? "config" : null);
  assert.deepEqual(
    vacuumActivity(Object.keys(states), states, category, ["vacuum.robot"]),
    ["switch.dock_mop_washing", "binary_sensor.dock_drying"],
  );
  assert.deepEqual(vacuumActivity(undefined, states), []);
});
