import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SceneView } from "../web/scene.js";
import {
  focusableRooms,
  frontPoint,
  roomButtonShows,
  roomFocusView,
  roomTitleOf,
  spreadButtons,
} from "../shared/room-focus.mjs";

const house = {
  id: "h-home",
  title: "Home",
  houseView: true,
  houseFloor: { id: "f1", name: "Ground", minY: 0, maxY: 3 },
  roomTitles: { office: "Home office", hall: "Hallway" },
  members: [
    { model: "office", transform: [1] },
    { model: "hall", transform: [2] },
    { model: "empty" },
  ],
  controls: [
    { id: "a", sourceModel: "office", roomTitle: "Home office" },
    { id: "b", sourceModel: "hall", roomTitle: "Hallway" },
  ],
  bindings: { a: "light.office" },
};

test("room titles come from the house view, then the room's devices", () => {
  assert.equal(roomTitleOf(house, "office"), "Home office");
  assert.equal(
    roomTitleOf({ ...house, roomTitles: undefined }, "hall"),
    "Hallway",
  );
  assert.equal(roomTitleOf(house, "empty"), "Room");
});

test("only houses and floors with several rooms offer room buttons", () => {
  assert.deepEqual(
    focusableRooms(house).map((r) => r.room),
    ["office", "hall", "empty"],
  );
  assert.deepEqual(focusableRooms({ ...house, houseView: false }), []);
  assert.deepEqual(
    focusableRooms({ ...house, members: [house.members[0]] }),
    [],
  );
  assert.deepEqual(focusableRooms({ ...house, focusRoom: "office" }), []);
  assert.deepEqual(focusableRooms(undefined), []);
});

test("a focused room keeps the house id, shows only its room and is not floor-clipped", () => {
  const view = roomFocusView(house, "office");
  assert.equal(view.id, "h-home");
  assert.equal(view.title, "Home office");
  assert.equal(view.focusRoom, "office");
  assert.equal(view.houseFloor, null);
  assert.deepEqual(view.members, [house.members[0]]);
  assert.deepEqual(
    view.controls.map((c) => c.id),
    ["a"],
  );
  assert.equal(view.bindings, house.bindings);
  assert.equal(roomFocusView(house, "attic"), null);
  assert.equal(roomFocusView(view, "hall"), null, "no focusing a focused room");
  assert.equal(house.members.length, 3, "the house view is not changed");
});

test("the room button goes at the floor edge lowest on screen", () => {
  assert.deepEqual(
    frontPoint([
      { x: 1, y: 10 },
      { x: 2, y: 80 },
      { x: 3, y: 40 },
    ]),
    { x: 2, y: 80 },
  );
  assert.equal(frontPoint([]), null);
});

test("each shown room reports a screen point in front of it", () => {
  const view = Object.create(SceneView.prototype);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  Object.assign(view, {
    camera,
    container: { clientWidth: 400, clientHeight: 400 },
    roomBoxes: new Map([
      [
        "office",
        new THREE.Box3(
          new THREE.Vector3(-2, 0, -2),
          new THREE.Vector3(2, 3, 2),
        ),
      ],
      [
        "far",
        new THREE.Box3(
          new THREE.Vector3(200, 0, 200),
          new THREE.Vector3(204, 3, 204),
        ),
      ],
    ]),
  });
  const [office, far] = view.roomFrontPoints();
  assert.equal(office.exposure, 1, "nothing in front of it");
  assert.equal(office.room, "office");
  assert.equal(office.visible, true);
  // The camera sits at +z, so the front edge is the lower middle of the room.
  assert.ok(office.y > 200, "below the screen centre");
  assert.ok(Math.abs(office.x - 200) < 1);
  assert.equal(far.visible, false);
  view.roomBoxes = undefined;
  assert.deepEqual(view.roomFrontPoints(), []);
});

test("a room's chosen spot is used for its button and exposure sees rooms in front", () => {
  const view = Object.create(SceneView.prototype);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 20, 0.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const box = (y) =>
    new THREE.Box3(
      new THREE.Vector3(-2, y, -2),
      new THREE.Vector3(2, y + 3, 2),
    );
  Object.assign(view, {
    camera,
    container: { clientWidth: 400, clientHeight: 400 },
    // Looking down: the upper room covers the one below it.
    roomBoxes: new Map([
      ["upper", box(3)],
      ["lower", box(0)],
    ]),
  });
  const [upper, lower] = view.roomFrontPoints({ upper: [0, 3, 0] });
  assert.equal(upper.manual, true);
  assert.ok(Math.abs(upper.x - 200) < 1 && Math.abs(upper.y - 200) < 5);
  assert.equal(upper.exposure, 1);
  assert.equal(lower.manual, false);
  assert.ok(lower.exposure < 0.2, `covered, got ${lower.exposure}`);
});

test("buttons show for hidden rooms unless the room says always or never", () => {
  assert.equal(roomButtonShows("auto", 0.2), true);
  assert.equal(roomButtonShows("auto", 0.9), false);
  assert.equal(roomButtonShows("always", 1), true);
  assert.equal(roomButtonShows("never", 0), false);
  // A shown button waits until the room is clearly visible.
  assert.equal(roomButtonShows("auto", 0.65, true), true);
  assert.equal(roomButtonShows("auto", 0.65, false), false);
  assert.equal(roomButtonShows("auto", 0.75, true), false);
});

test("automatically placed buttons move down instead of covering each other", () => {
  const item = (x, y, extra = {}) => ({ x, y, w: 100, h: 30, ...extra });
  assert.deepEqual(spreadButtons([item(100, 50), item(400, 50)]), [50, 50]);
  const ys = spreadButtons([item(100, 50), item(130, 60)]);
  assert.equal(ys[0], 50);
  assert.ok(ys[1] >= 84, `moved below the first, got ${ys[1]}`);
  // A button placed by hand stays; the automatic one makes room.
  const kept = spreadButtons([item(100, 50), item(110, 55, { fixed: true })]);
  assert.equal(kept[1], 55);
  assert.ok(kept[0] >= 89);
});

test("a button can be dragged on the plane at the room's floor, also beside the model", () => {
  const view = Object.create(SceneView.prototype);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 20, 0.5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  Object.assign(view, {
    camera,
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 400,
          height: 400,
        }),
      },
    },
  });
  const centre = view.groundPoint(200, 200, 3);
  assert.ok(Math.abs(centre[0]) < 0.1 && centre[1] === 3);
  // Further right on screen is further along x, at the same height.
  const right = view.groundPoint(380, 200, 3);
  assert.ok(right[0] > 3 && Math.abs(right[1] - 3) < 1e-9);
  // A ray that never meets the plane gives nothing.
  camera.position.set(0, 1, 0);
  camera.lookAt(0, 5, 0);
  camera.updateMatrixWorld(true);
  assert.equal(view.groundPoint(200, 200, 0), null);
  // Front points carry their world position, which is what a drag starts from.
  const box = new THREE.Box3(
    new THREE.Vector3(-2, 0, -2),
    new THREE.Vector3(2, 3, 2),
  );
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  Object.assign(view, {
    container: { clientWidth: 400, clientHeight: 400 },
    roomBoxes: new Map([["office", box]]),
  });
  const [auto] = view.roomFrontPoints();
  assert.deepEqual(auto.world, [0, 0, 2]);
  const [placed] = view.roomFrontPoints({ office: [5, 0, 5] });
  assert.deepEqual(placed.world, [5, 0, 5]);
  assert.equal(placed.manual, true);
});

test("two quick taps on the same room open it; slow, distant or different taps do not", () => {
  const view = Object.create(SceneView.prototype);
  const opened = [];
  view.options = { onRoomDoubleTap: (room) => opened.push(room) };
  assert.equal(view.recordRoomTap("office", 100, 100, 1000), false);
  assert.equal(view.recordRoomTap("office", 104, 98, 1250), true);
  assert.deepEqual(opened, ["office"]);
  // A third tap starts over.
  assert.equal(view.recordRoomTap("office", 100, 100, 1300), false);
  // Too slow, too far apart, or another room.
  assert.equal(view.recordRoomTap("office", 100, 100, 2000), false);
  assert.equal(view.recordRoomTap("office", 100, 100, 2500), false);
  assert.equal(view.recordRoomTap("office", 200, 100, 2600), false);
  assert.equal(view.recordRoomTap("hall", 200, 100, 2700), false);
  assert.deepEqual(opened, ["office"]);
});

test("a room opened on its own uses the angle its view chose", () => {
  const view = Object.create(SceneView.prototype);
  const box = new THREE.Box3(
    new THREE.Vector3(-2, 0, -2),
    new THREE.Vector3(2, 3, 2),
  );
  const frame = (model) => {
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
    Object.assign(view, {
      bounds: box,
      container: { getBoundingClientRect: () => ({ width: 400, height: 400 }) },
      camera,
      orbit: { target: new THREE.Vector3() },
      options: { mode: "front", tilt: 28, heading: 0, zoom: 2 },
      model,
    });
    view.fitFloor();
    const t = view.orbit.target;
    return [
      camera.position.x - t.x,
      camera.position.y - t.y,
      camera.position.z - t.z,
      camera.zoom,
    ];
  };
  // The card's own angle (heading 0 looks from +z) and zoom...
  const [x0, , z0, zoom0] = frame({ focusRoom: "a" });
  assert.ok(Math.abs(x0) < 1e-6 && z0 > 0);
  assert.equal(zoom0, 1, "a room is not zoomed like the house");
  // ...or the room's: heading 90 looks from +x, tilted 60 degrees.
  const [x1, y1, z1] = frame({
    focusRoom: "a",
    focusFrame: { heading: 90, tilt: 60 },
  });
  assert.ok(x1 > 0 && Math.abs(z1) < 1e-6);
  assert.ok(
    Math.abs(Math.atan2(Math.hypot(x1, z1), y1) * (180 / Math.PI) - 60) < 0.5,
  );
  // Only a heading (or a tilt) may be given.
  const [x2, , z2] = frame({ focusRoom: "a", focusFrame: { heading: 90 } });
  assert.ok(x2 > 0 && Math.abs(z2) < 1e-6);
});

test("a button can be raised and lowered on the plane facing the camera", () => {
  const view = Object.create(SceneView.prototype);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  Object.assign(view, {
    camera,
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 400,
          height: 400,
        }),
      },
    },
  });
  const level = view.verticalPoint(200, 200, [0, 3, 0]);
  assert.ok(Math.abs(level - 3) < 1e-6);
  assert.ok(view.verticalPoint(200, 100, [0, 3, 0]) > 3, "higher on screen");
  assert.ok(view.verticalPoint(200, 300, [0, 3, 0]) < 3);
  camera.position.set(0, 20, 0.0001);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(view.verticalPoint(200, 200, [0, 3, 0]), null, "top-down");
});
