import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { CUBE_DIRECTIONS, projectViewCube } from "../shared/view-cube.mjs";
import * as THREE from "three";
const source = (
  await readFile(
    new URL("../web/camera-navigation.js", import.meta.url),
    "utf8",
  )
)
  .replace(/^import .*;\n/gm, "")
  .replace("export function", "function");
function navigation() {
  class Element {
    children = [];
    listeners = {};
    dataset = {};
    captured = false;
    classList = { add() {}, remove() {} };
    setAttribute() {}
    append(...nodes) {
      this.children.push(...nodes);
    }
    replaceChildren() {
      this.children = [];
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    contains() {
      return false;
    }
    focus() {}
    setPointerCapture() {
      this.captured = true;
    }
    hasPointerCapture() {
      return this.captured;
    }
    releasePointerCapture() {
      this.captured = false;
    }
  }
  const container = new Element(),
    moves = [],
    presets = [];
  const scene = {
    model: {},
    rotateCamera: (...v) => moves.push(v),
    setCameraPreset: (n) => presets.push(n),
  };
  const context = vm.createContext({
    document: {
      createElement: () => new Element(),
      createElementNS: () => new Element(),
    },
    CUBE_DIRECTIONS,
    projectViewCube,
  });
  vm.runInContext(
    source + "\nglobalThis.mount = mountCameraNavigation;",
    context,
  );
  const nav = context.mount(container, () => scene),
    cube = nav.children[0];
  const emit = (type, x = 0, y = 0) =>
    cube.listeners[type]({
      type,
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      target: { closest: () => ({ dataset: { view: "front" } }) },
      preventDefault() {},
    });
  return { cube, emit, moves, presets };
}
test("cube tap snaps, but dragging rotates without snapping on release", () => {
  const h = navigation();
  h.emit("pointerdown");
  h.emit("pointerup");
  assert.deepEqual(h.presets, ["front"]);
  h.emit("pointerdown");
  h.emit("pointermove", 2, 1);
  assert.equal(h.moves.length, 0);
  h.emit("pointermove", 20, 10);
  h.emit("pointerup", 20, 10);
  assert.deepEqual(h.moves, [[0.24, 0.12]]);
  assert.deepEqual(h.presets, ["front"]);
  assert.equal(h.cube.captured, false);
});
test("cancelled cube gestures do not snap; arrow keys rotate", () => {
  const h = navigation();
  h.emit("pointerdown");
  h.emit("pointercancel");
  h.emit("pointermove", 20, 10);
  assert.equal(h.moves.length, 0);
  assert.equal(h.presets.length, 0);
  h.cube.listeners.keydown({ key: "ArrowRight", preventDefault() {} });
  assert.deepEqual(h.moves, [[0.12, 0]]);
});
const sceneSource = (
  await readFile(new URL("../web/scene.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "")
  .replace("export class", "class");
test("cube orbit keeps framing and zoom stable, including pole views", () => {
  const context = vm.createContext({ THREE });
  vm.runInContext(sceneSource + "\nglobalThis.View = SceneView;", context);
  for (const up of [
    [0, 1, 0],
    [0, 0, -1],
  ]) {
    const scene = Object.create(context.View.prototype);
    scene.model = {};
    scene.camera = new THREE.PerspectiveCamera();
    scene.camera.up.fromArray(up);
    scene.camera.position.set(3, 8, 7);
    scene.camera.zoom = 2;
    let updates = 0;
    scene.orbit = {
      enabled: true,
      target: new THREE.Vector3(1, 2, 3),
      update() {
        updates++;
      },
    };
    const distance = scene.camera.position.distanceTo(scene.orbit.target);
    scene.rotateCamera(0.3, 0.2);
    assert.ok(
      Math.abs(
        scene.camera.position.distanceTo(scene.orbit.target) - distance,
      ) < 1e-10,
    );
    assert.deepEqual(scene.orbit.target.toArray(), [1, 2, 3]);
    assert.equal(scene.camera.zoom, 2);
    assert.equal(updates, 1);
    scene.rotateCamera(0, 100);
    assert.ok(scene.camera.position.toArray().every(Number.isFinite));
  }
});
