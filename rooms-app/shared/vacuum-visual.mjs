import * as THREE from "three";
import { dockFacing } from "./vacuum.mjs";

/**
 * A robot vacuum and its dock, drawn by the viewer so a scanned room needs no
 * modelled robot. Home Assistant reports what the vacuum is doing, not where
 * it is, so the path while cleaning is a stand-in: the robot drives out of the
 * dock, bumps around the room (rays against the room's own geometry keep it
 * off walls and furniture and on the floor), and drives back along its own
 * trail when it returns.
 */
export const VACUUM_RADIUS = 0.175;
const HEIGHT = 0.075,
  SPEED = 0.28, // m/s, about a real robot's cleaning speed
  TURN = 2.4, // rad/s
  MARGIN = 0.05, // stop this far before an obstacle
  SENSE_Y = 0.07, // obstacle rays: above rugs and thresholds, below the bumper top
  // Robot centre when parked, and the point straight out from the dock it
  // drives to before it turns away (dock local +Z is "out").
  PARKED = -0.02,
  APPROACH = 0.55,
  TRAIL_STEP = 0.3,
  CELL = 0.25, // route grid
  PLAN_STEPS = 12, // route search steps per frame, so the page never stalls
  PLAN_LIMIT = 6000, // give up on a room further than this many steps
  ROOM_TIME = 60; // seconds in each chosen room before the next one

const LED = {
  cleaning: "#7cc4ff",
  returning: "#ffb14a",
  error: "#ff4d4d",
  paused: "#d8d8d8",
  idle: "#d8d8d8",
  docked: "#5fd18b",
};

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}
/** Tower dock with a glossy front, a base ramp and an opening for the robot. */
function buildDock(materials) {
  const dock = new THREE.Group();
  dock.name = "vacuum-dock";
  const { gloss, matte, seam } = materials;
  dock.add(box(0.44, 0.012, 0.47, matte, 0, 0.006, -0.015)); // base ramp
  dock.add(box(0.42, 0.43, 0.31, gloss, 0, 0.345, -0.095)); // tanks
  dock.add(box(0.42, 0.12, 0.12, matte, 0, 0.072, -0.19)); // back column
  for (const x of [-0.205, 0.205])
    dock.add(box(0.012, 0.12, 0.31, matte, x, 0.072, -0.095)); // side cheeks
  dock.add(box(0.36, 0.004, 0.002, seam, 0, 0.345, 0.061)); // tank seam
  dock.add(box(0.03, 0.002, 0.002, seam, 0, 0.47, 0.061)); // status light
  dock.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return dock;
}
function buildRobot(materials) {
  const robot = new THREE.Group();
  robot.name = "vacuum-robot";
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(VACUUM_RADIUS, VACUUM_RADIUS, HEIGHT, 40),
    materials.matte,
  );
  body.position.y = 0.01 + HEIGHT / 2;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(
      VACUUM_RADIUS - 0.012,
      VACUUM_RADIUS - 0.012,
      0.004,
      40,
    ),
    materials.gloss,
  );
  top.position.y = 0.01 + HEIGHT + 0.002;
  // Front sensor window and button panel (robot local +Z is forward).
  const sensor = box(
    0.12,
    0.022,
    0.012,
    materials.seam,
    0,
    0.055,
    VACUUM_RADIUS - 0.004,
  );
  const panel = box(
    0.07,
    0.003,
    0.03,
    materials.panel,
    0,
    0.01 + HEIGHT + 0.004,
    0.09,
  );
  const led = box(
    0.04,
    0.003,
    0.006,
    materials.led,
    0,
    0.01 + HEIGHT + 0.006,
    0.112,
  );
  const brush = new THREE.Group();
  brush.position.set(-0.11, 0.008, 0.11);
  for (let i = 0; i < 3; i++) {
    const bristle = box(0.07, 0.003, 0.006, materials.seam, 0.035, 0, 0);
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI * 2) / 3;
    arm.add(bristle);
    brush.add(arm);
  }
  robot.add(body, top, sensor, panel, led, brush);
  // The robot moves every frame; its shadow would mean a shadow-map refresh
  // per frame, so only the (still) dock casts one.
  robot.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return { robot, brush };
}
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

/**
 * `sense(origin, direction, far)` returns the distance to the nearest obstacle
 * along a horizontal ray (Infinity for none); `floorAt(x, y, z)` says whether
 * there is floor at that spot near height `y`; `roomAt(x, y, z)` names the
 * room whose floor that is, and `roomCenter(room)` roughly where it lies.
 * Without them the robot only drives out of the dock and back.
 *
 * Cleaning by area (`setRooms`): the robot plans a route on a coarse grid
 * (cells with floor and room for its body, steps a ray says are clear) to
 * each chosen room in turn, cleans there without leaving that room's floor,
 * and moves on after a while; it stays in the last one until it returns.
 */
export function createVacuumVisual(
  control,
  {
    sense = () => Infinity,
    floorAt = () => true,
    roomAt = () => null,
    roomCenter = () => null,
    reducedMotion = false,
    random = Math.random,
  } = {},
) {
  const facing = new THREE.Vector3(...dockFacing(control)),
    origin = new THREE.Vector3(...control.position),
    yaw = Math.atan2(facing.x, facing.z),
    parked = origin.clone().addScaledVector(facing, PARKED),
    approach = origin.clone().addScaledVector(facing, APPROACH);
  const materials = {
    gloss: new THREE.MeshStandardMaterial({
      color: "#111214",
      roughness: 0.12,
      metalness: 0.4,
    }),
    matte: new THREE.MeshStandardMaterial({
      color: "#1b1c1f",
      roughness: 0.55,
    }),
    seam: new THREE.MeshStandardMaterial({ color: "#3a3c40", roughness: 0.4 }),
    panel: new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.3 }),
    led: new THREE.MeshStandardMaterial({
      color: "#101010",
      emissive: LED.docked,
      emissiveIntensity: 1.4,
    }),
  };
  const dock = buildDock(materials);
  dock.position.copy(origin);
  dock.rotation.y = yaw;
  const { robot, brush } = buildRobot(materials);
  const pos = parked.clone();
  let heading = yaw,
    mode = "parked", // parked | leaving | wander | turning | homing | docking | still
    status = "docked",
    turnTarget = 0,
    turns = 0,
    clear = 0, // metres known to be free ahead
    hurry = 1,
    last,
    // Cleaning by area: the chosen rooms in order, the one being cleaned
    // (the robot keeps to its floor) and the route being driven or searched.
    rooms = [],
    roomIndex = 0,
    inRoom = null,
    leaveAt = Infinity,
    planner = null,
    route = [],
    // Cleaning a room this view does not show (from a current-room sensor):
    // the robot is hidden until it is back or heads home.
    away = false;
  const trail = [];
  const showRobot = () => {
    robot.visible = !away || status === "returning" || status === "docked";
  };
  const place = () => {
    robot.position.copy(pos);
    robot.rotation.y = heading;
  };
  place();
  const forward = (angle = heading) =>
    new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  /** Free distance ahead: centre and both edges, at bumper height, plus floor. */
  function measure() {
    const dir = forward(),
      side = new THREE.Vector3(dir.z, 0, -dir.x);
    let free = Infinity;
    for (const offset of [0, VACUUM_RADIUS * 0.8, -VACUUM_RADIUS * 0.8]) {
      const from = pos
        .clone()
        .addScaledVector(side, offset)
        .setY(origin.y + SENSE_Y);
      free = Math.min(free, sense(from, dir, 3) - VACUUM_RADIUS - MARGIN);
    }
    // Look for floor a little beyond the bumper; no floor means a stair,
    // a gap between rooms or the edge of the scan.
    for (const step of [0.1, 0.25, 0.4]) {
      if (step > free + VACUUM_RADIUS) break;
      const probe = pos.clone().addScaledVector(dir, VACUUM_RADIUS + step);
      if (!onFloor(probe.x, probe.z)) {
        free = Math.min(free, step - 0.05);
        break;
      }
    }
    return Math.max(0, free);
  }
  /** Floor the robot may drive on: anywhere, or only the room it cleans. */
  function onFloor(x, z) {
    return inRoom ? roomAt(x, origin.y, z) === inRoom : floorAt(x, origin.y, z);
  }
  // ---- route search ----
  const cells = new Map();
  const cellPoint = (i, j) =>
    new THREE.Vector3(origin.x + i * CELL, origin.y, origin.z + j * CELL);
  /** A cell is usable with floor under it and room for the robot's body. */
  function usable(i, j) {
    const key = `${i},${j}`;
    if (cells.has(key)) return cells.get(key);
    const p = cellPoint(i, j);
    let ok = floorAt(p.x, origin.y, p.z);
    if (ok) {
      const from = p.clone().setY(origin.y + SENSE_Y);
      for (const [x, z] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (sense(from, new THREE.Vector3(x, 0, z), 1) < VACUUM_RADIUS * 0.9) {
          ok = false;
          break;
        }
    }
    cells.set(key, ok);
    return ok;
  }
  /** Nothing in the way of the robot's whole width from `a` to `b`, on floor. */
  function clearLine(a, b, edges = true) {
    const d = b.clone().sub(a).setY(0),
      length = d.length();
    if (length < 1e-6) return true;
    d.normalize();
    const side = new THREE.Vector3(d.z, 0, -d.x);
    for (const offset of edges
      ? [0, VACUUM_RADIUS * 0.85, -VACUUM_RADIUS * 0.85]
      : [0]) {
      const from = a
        .clone()
        .addScaledVector(side, offset)
        .setY(origin.y + SENSE_Y);
      if (sense(from, d, length + 0.05) < length + (offset ? 0 : 0.02))
        return false;
    }
    for (let t = 0.3; t < length; t += 0.3) {
      const q = a.clone().addScaledVector(d, t);
      if (!floorAt(q.x, origin.y, q.z)) return false;
    }
    return true;
  }
  /**
   * Best-first search from `start` to any usable cell on `room`'s floor,
   * yielding between steps; returns the route as points, or null.
   */
  function* plan(start, room) {
    const goal = roomCenter(room),
      si = Math.round((start.x - origin.x) / CELL),
      sj = Math.round((start.z - origin.z) / CELL);
    const guess = (i, j) =>
      goal
        ? cellPoint(i, j).distanceTo(
            new THREE.Vector3(goal[0], origin.y, goal[2]),
          )
        : 0;
    const from = new Map([[`${si},${sj}`, null]]),
      cost = new Map([[`${si},${sj}`, 0]]),
      open = [[guess(si, sj), si, sj]];
    let steps = 0;
    while (open.length && steps < PLAN_LIMIT) {
      let best = 0;
      for (let k = 1; k < open.length; k++)
        if (open[k][0] < open[best][0]) best = k;
      const [, i, j] = open.splice(best, 1)[0],
        here = cellPoint(i, j),
        key = `${i},${j}`;
      if ((i !== si || j !== sj) && roomAt(here.x, origin.y, here.z) === room) {
        const cellsOut = [];
        for (let k = key; k; k = from.get(k)) {
          const [a, b] = k.split(",").map(Number);
          cellsOut.unshift(cellPoint(a, b));
        }
        cellsOut[0] = start.clone();
        return smooth(cellsOut);
      }
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di,
            nj = j + dj,
            next = `${ni},${nj}`,
            step = Math.hypot(di, dj) * CELL,
            total = cost.get(key) + step;
          if (cost.has(next) && cost.get(next) <= total) continue;
          if (!usable(ni, nj) || !clearLine(here, cellPoint(ni, nj), false))
            continue;
          cost.set(next, total);
          from.set(next, key);
          open.push([total + guess(ni, nj), ni, nj]);
        }
      if (++steps % PLAN_STEPS === 0) yield;
    }
    return null;
  }
  /** Straighten a grid route wherever the robot fits along a direct line. */
  function smooth(points) {
    const out = [points[0]];
    let i = 0;
    while (i < points.length - 1) {
      let j = Math.min(points.length - 1, i + 10);
      while (j > i + 1 && !clearLine(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out.slice(1);
  }
  /** Head for the next chosen room, or keep cleaning where it is. */
  function nextRoom(time) {
    planner = null;
    route = [];
    while (roomIndex < rooms.length) {
      const room = rooms[roomIndex];
      if (roomAt(pos.x, origin.y, pos.z) === room) {
        inRoom = room;
        leaveAt =
          roomIndex < rooms.length - 1 ? (time ?? 0) + ROOM_TIME : Infinity;
        clear = 0;
        mode = "wander";
        return;
      }
      inRoom = null;
      planner = plan(pos.clone(), room);
      mode = "planning";
      return;
    }
    // No (more) rooms to reach: the last room keeps the robot, if any.
    clear = 0;
    mode = "wander";
  }
  function startTurn() {
    const amount = (Math.PI / 2) * (1 + random()) * (random() < 0.5 ? -1 : 1);
    turnTarget = wrap(heading + amount);
    mode = "turning";
  }
  function remember() {
    const near = trail.findIndex((p) => p.distanceTo(pos) < TRAIL_STEP);
    // Coming back near an earlier point drops the loop in between, so the
    // way home stays short.
    if (near >= 0) trail.length = near + 1;
    else trail.push(pos.clone());
  }
  function rotateTowards(target, dt) {
    const diff = wrap(target - heading),
      step = TURN * hurry * dt;
    heading =
      Math.abs(diff) <= step ? target : wrap(heading + Math.sign(diff) * step);
    return Math.abs(wrap(target - heading)) < 1e-3;
  }
  /** Drive to `target`, turning on the spot first when far off course. */
  function driveTo(target, dt, backwards = false) {
    const distance = pos.distanceTo(target);
    if (distance < 0.01) {
      pos.copy(target);
      return true;
    }
    const want = wrap(headingTo(pos, target) + (backwards ? Math.PI : 0));
    if (!rotateTowards(want, dt) && Math.abs(wrap(want - heading)) > 0.35)
      return false;
    const move = Math.min(distance, SPEED * hurry * dt);
    pos.addScaledVector(target.clone().sub(pos).normalize(), move);
    return false;
  }
  function home(fast = false) {
    hurry = fast ? 3 : 1;
    mode = "homing";
  }
  function forgetRooms() {
    rooms = [];
    roomIndex = 0;
    inRoom = null;
    planner = null;
    route = [];
    leaveAt = Infinity;
  }
  const posed = () => {
    // Reduced motion: no driving, just a pose that matches the state.
    if (["cleaning", "paused", "idle", "error"].includes(status)) {
      pos.copy(approach).addScaledVector(facing, 0.35);
      mode = "still";
    } else {
      pos.copy(parked);
      mode = "parked";
    }
    heading = yaw;
  };
  const visual = {
    objects: [dock, robot],
    // The robot's view of the room, for checks.
    sensors: { sense, floorAt, roomAt },
    dock,
    robot,
    get mode() {
      return mode;
    },
    /** The room being cleaned while cleaning by area, if any. */
    get room() {
      return inRoom;
    },
    /**
     * Clean these rooms (in order) instead of roaming: from a "clean by area"
     * call. An empty list goes back to roaming.
     */
    setRooms(list = []) {
      rooms = [...list];
      roomIndex = 0;
      inRoom = null;
      leaveAt = Infinity;
      if (reducedMotion || status !== "cleaning") return;
      if (["wander", "turning", "still", "planning", "travel"].includes(mode))
        nextRoom(last);
      // Still leaving the dock: it heads for the rooms once out.
    },
    get position() {
      return pos.toArray();
    },
    get animating() {
      return (
        !reducedMotion &&
        ([
          "leaving",
          "wander",
          "turning",
          "homing",
          "docking",
          "planning",
          "travel",
        ].includes(mode) ||
          (status === "cleaning" && mode !== "parked"))
      );
    },
    /** The robot is cleaning a room outside this view: hide it (or show it again). */
    setAway(value) {
      away = !!value;
      showRobot();
    },
    get away() {
      return away;
    },
    setState(s = {}) {
      const next = s.unavailable ? "unavailable" : s.state || "unavailable";
      materials.led.emissive.set(LED[next] || "#000000");
      materials.led.emissiveIntensity = LED[next] ? 1.4 : 0;
      const before = status;
      status = next;
      showRobot();
      if (reducedMotion) {
        posed();
        place();
        return;
      }
      if (next === before) return;
      const away = mode !== "parked";
      if (next === "cleaning") {
        if (mode === "parked") {
          trail.length = 0;
          trail.push(approach.clone());
          hurry = 1;
          mode = "leaving";
        } else if (
          mode === "still" ||
          mode === "homing" ||
          mode === "docking"
        ) {
          hurry = 1;
          clear = 0;
          if (rooms.length && !inRoom) nextRoom(last);
          else mode = "wander";
        }
      } else if (next === "returning") {
        forgetRooms();
        if (away) home();
      } else if (next === "docked") {
        forgetRooms();
        // Already home in Home Assistant: hurry the rest of the way.
        if (away) home(true);
      } else if (
        away &&
        !["homing", "docking", "planning", "travel"].includes(mode)
      ) {
        // Paused, stopped (idle), error or unavailable: stay where it is.
        mode = "still";
      }
    },
    update(time) {
      const dt =
        last === undefined ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      if (reducedMotion || !dt) return;
      if (status === "cleaning" && mode !== "parked")
        brush.rotation.y -= 14 * dt;
      if (["planning", "travel"].includes(mode) && status !== "cleaning") {
        // Paused or stopped on the way: wait where it is.
      } else if (mode === "leaving") {
        if (driveTo(approach, dt)) {
          clear = 0;
          if (rooms.length) nextRoom(time);
          else mode = "wander";
        }
      } else if (mode === "planning") {
        const step = planner.next();
        if (step.done) {
          if (step.value?.length) {
            route = step.value;
            mode = "travel";
          } else {
            roomIndex++; // cannot reach it: try the next room
            nextRoom(time);
          }
        }
      } else if (mode === "travel") {
        if (driveTo(route[0], dt)) {
          route.shift();
          remember();
          if (!route.length) nextRoom(time);
        } else if (pos.distanceTo(trail.at(-1) || approach) >= TRAIL_STEP)
          remember();
      } else if (mode === "wander" && inRoom && time >= leaveAt) {
        roomIndex++;
        nextRoom(time);
      } else if (mode === "wander") {
        if (clear <= 0.001) clear = measure();
        if (clear <= 0.001) {
          if (++turns > 40)
            home(); // boxed in: give up and go home
          else startTurn();
        } else {
          const step = Math.min(clear, SPEED * dt);
          pos.addScaledVector(forward(), step);
          clear -= step;
          turns = 0;
          // Re-check now and then: rays are cheap and the room can change.
          if (clear > 0.6) clear = 0.6;
          if (pos.distanceTo(trail.at(-1) || approach) >= TRAIL_STEP)
            remember();
        }
      } else if (mode === "turning") {
        if (rotateTowards(turnTarget, dt)) {
          clear = measure();
          mode = clear > 0.05 ? "wander" : "turning";
          if (mode === "turning") {
            if (++turns > 40) home();
            else startTurn();
          }
        }
      } else if (mode === "homing") {
        const target = trail.at(-1) || approach;
        if (driveTo(target, dt)) {
          if (trail.length) trail.pop();
          else mode = "docking";
        }
      } else if (mode === "docking") {
        // Face out of the dock, then reverse onto the contacts.
        if (rotateTowards(yaw, dt) && driveTo(parked, dt, true)) {
          heading = yaw;
          hurry = 1;
          mode = "parked";
        }
      }
      place();
    },
    dispose() {
      for (const object of [dock, robot]) {
        object.parent?.remove(object);
        object.traverse((o) => o.geometry?.dispose());
      }
      for (const material of Object.values(materials)) material.dispose();
    },
  };
  return visual;
}
