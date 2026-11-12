import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SceneView } from "../web/scene.js";
test("house layers apply placement without baking source geometry and isolate node IDs", async () => {
  const original = GLTFLoader.prototype.loadAsync;
  const sources = [];
  GLTFLoader.prototype.loadAsync = async () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    mesh.userData.controlId = "same-fixture";
    group.add(mesh);
    sources.push(group);
    return { scene: group };
  };
  try {
    const view = Object.create(SceneView.prototype);
    view.renderer = { domElement: { dataset: {} } };
    view.generation = 0;
    view.disposeScene = () => {};
    let assembled;
    view.prepareAsset = (_model, root) => {
      assembled = root;
      // Camera fitting reads bounds before the renderer's first matrix update.
      const bounds = new THREE.Box3().setFromObject(root);
      assert.equal(bounds.min.x, 2.5);
      assert.equal(bounds.max.x, 8.5);
      return true;
    };
    const pose = (x) => new THREE.Matrix4().makeTranslation(x, 0, 0).toArray();
    assert.equal(
      await view.loadLayers({}, [
        { url: "a", transform: pose(3), nodeIds: { "same-fixture": "room-a" } },
        { url: "b", transform: pose(8), nodeIds: { "same-fixture": "room-b" } },
      ]),
      true,
    );
    assembled.updateMatrixWorld(true);
    assert.deepEqual(
      sources.map((g) => g.getWorldPosition(new THREE.Vector3()).x),
      [3, 8],
    );
    assert.deepEqual(
      sources.map((g) => g.children[0].userData.controlId),
      ["room-a", "room-b"],
    );
    assert.deepEqual(
      sources.map((g) => g.children[0].position.x),
      [0, 0],
    );
  } finally {
    GLTFLoader.prototype.loadAsync = original;
  }
});
test("cancelled house load disposes temporary geometry and leaves current scene untouched", async () => {
  const original = GLTFLoader.prototype.loadAsync;
  let resolve;
  GLTFLoader.prototype.loadAsync = () => new Promise((r) => (resolve = r));
  try {
    const view = Object.create(SceneView.prototype);
    view.renderer = { domElement: { dataset: {} } };
    view.generation = 0;
    const disposed = [];
    view.disposeScene = (o) => disposed.push(o);
    view.prepareAsset = () => assert.fail("stale scene committed");
    const loading = view.loadLayers({}, [
      { url: "a", transform: new THREE.Matrix4().toArray(), nodeIds: {} },
    ]);
    view.generation++;
    const group = new THREE.Group();
    resolve({ scene: group });
    assert.equal(await loading, false);
    assert.ok(disposed.includes(group));
  } finally {
    GLTFLoader.prototype.loadAsync = original;
  }
});
test("floor view clips the same geometry in world height and fits floor bounds", async () => {
  const view = Object.create(SceneView.prototype);
  view.renderer = { domElement: { dataset: {} } };
  view.scene = new THREE.Scene();
  view.disposeScene = () => {};
  view.options = { mode: "front", markers: false };
  view.renderer = {
    domElement: { dataset: {} },
    capabilities: { maxTextures: 16 },
  };
  view.setView = () => {};
  const asset = new THREE.Group(),
    material = new THREE.MeshStandardMaterial(),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), material);
  mesh.position.y = 3;
  asset.add(mesh);
  const model = {
    controls: [],
    houseFloor: { minY: 0, maxY: 2.8 },
    ambient: 0.4,
  };
  assert.equal(await view.prepareAsset(model, asset, performance.now()), true);
  assert.equal(view.renderer.localClippingEnabled, true);
  assert.equal(view.bounds.max.y, 2.8);
  assert.equal(mesh.material.clippingPlanes.length, 2);
  assert.equal(
    mesh.material.clippingPlanes[1].distanceToPoint(
      new THREE.Vector3(0, 3, 0),
    ) < 0,
    true,
  );
  assert.notEqual(mesh.material, material);
  assert.equal(material.clippingPlanes, null);
});

test("architecture visibility affects only the declared upper wall in room and composed views", async () => {
  const root = new THREE.Group(),
    wall = new THREE.Group(),
    upper = new THREE.Group(),
    door = new THREE.Group();
  wall.userData.wallNormal = [0, 0, 1];
  upper.userData.appearanceId = "entrance-upper-wall";
  wall.add(upper, door);
  root.add(wall);
  const view = Object.create(SceneView.prototype);
  view.renderer = { domElement: { dataset: {} } };
  view.asset = root;
  view.model = { appearance: [{ id: "entrance-upper-wall", visible: false }] };
  view.cutaway();
  assert.equal(wall.visible, true);
  assert.equal(door.visible, true);
  assert.equal(upper.visible, false);
  view.model.appearance[0].visible = true;
  view.cutaway();
  assert.equal(upper.visible, true);
  upper.userData.appearanceVisible = false;
  view.model = { houseView: true };
  view.cutaway();
  assert.equal(upper.visible, false);
  assert.equal(door.visible, true);
  const original = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => ({ scene: root });
  try {
    view.generation = 0;
    view.prepareAsset = (_m, asset) => {
      view.asset = asset;
      view.cutaway();
      return true;
    };
    await view.loadLayers(view.model, [
      {
        url: "room",
        nodeIds: {},
        transform: new THREE.Matrix4().toArray(),
        appearance: [{ id: "entrance-upper-wall", visible: true }],
      },
    ]);
    assert.equal(upper.visible, true);
    assert.equal(door.visible, true);
  } finally {
    GLTFLoader.prototype.loadAsync = original;
  }
});

test("house room selection highlights the placed room and replaces its previous outline", () => {
  const view = Object.create(SceneView.prototype);
  view.renderer = { domElement: { dataset: {} } };
  view.scene = new THREE.Scene();
  view.asset = new THREE.Group();
  const room = new THREE.Group();
  room.userData.pickRoom = "office";
  room.position.set(7, 3, 0);
  room.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial(),
    ),
  );
  view.asset.add(room);
  view.scene.add(view.asset);
  view.render = () => {};
  view.highlightRoom("office");
  assert.ok(view.roomHighlight);
  assert.equal(view.scene.children.length, 2);
  const previous = view.roomHighlight;
  view.highlightRoom("office");
  assert.notEqual(previous, view.roomHighlight);
  assert.equal(view.scene.children.length, 2);
  view.highlightRoom("missing");
  assert.equal(view.roomHighlight, null);
  assert.equal(view.scene.children.length, 1);
});

test("Floor plan clears an angled camera and uses the exact Top orthographic preset", () => {
  const view = Object.create(SceneView.prototype);
  view.renderer = { domElement: { dataset: {} } };
  view.model = { id: "house" };
  let event;
  view.options = {
    mode: "front",
    tilt: 60,
    heading: 135,
    zoom: 2,
    camera: { projection: "perspective" },
    onCameraChange: (value) => (event = value),
  };
  view.setView = (mode) => (view.options.mode = mode);
  view.setFloorPlan();
  assert.equal(view.options.mode, "floor");
  assert.equal(view.options.tilt, 0);
  assert.equal(view.options.heading, 0);
  assert.equal(view.options.camera, undefined);
  assert.equal(view.options.zoom, 1);
  assert.equal(event.source, "preset");
});

test("house views switch floors in place: rooms, clipping, fixtures and bounds", () => {
  const room = (id, y) => {
    const placement = new THREE.Group();
    placement.userData.pickRoom = id;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 4),
      new THREE.MeshStandardMaterial(),
    );
    mesh.position.y = y;
    placement.add(mesh);
    return placement;
  };
  const asset = new THREE.Group();
  asset.add(room("ground", 1), room("upper", 4));
  const fixture = (type) => ({
    type,
    light: new THREE.PointLight(),
    marker: new THREE.Object3D(),
    companion: false,
  });
  const view = Object.create(SceneView.prototype);
  Object.assign(view, {
    asset,
    scene: new THREE.Scene(),
    renderer: { capabilities: { maxTextures: 16 } },
    options: { mode: "floor", markers: false },
    fixtures: new Map([
      ["low", fixture("light")],
      ["high", fixture("light")],
    ]),
    lastStates: new Map(),
  });
  let resets = 0,
    states = 0;
  view.reset = () => resets++;
  view.setStates = () => states++;
  view.render = () => {};
  view.cutaway = () => {};
  const member = (model) => ({ model });
  const whole = {
    houseView: true,
    houseId: "home",
    houseFloor: null,
    members: [member("ground"), member("upper")],
    controls: [{ id: "low" }, { id: "high" }],
  };
  const upper = {
    ...whole,
    houseFloor: { id: "f2", minY: 3, maxY: 6 },
    members: [member("upper")],
    controls: [{ id: "high" }],
  };
  view.model = whole;
  view.applyHouseScope();
  assert.equal(view.bounds.min.y, 0);
  assert.equal(view.bounds.max.y, 5);
  assert.equal(view.setHouseView(upper), true);
  assert.deepEqual([...view.roomBoxes.keys()], ["upper"]);
  assert.deepEqual(
    asset.children.map((p) => p.visible),
    [false, true],
  );
  assert.equal(view.fixtures.get("low").light.visible, false);
  assert.equal(view.fixtures.get("low").light.castShadow, false);
  assert.equal(view.fixtures.get("high").light.visible, true);
  assert.equal(view.bounds.min.y, 3);
  assert.equal(view.bounds.max.y, 5);
  assert.equal(asset.children[1].children[0].material.clippingPlanes.length, 2);
  assert.equal(resets, 1);
  assert.equal(states, 1);
  assert.equal(view.setHouseView(whole, { keepCamera: true }), true);
  assert.equal(resets, 1);
  assert.deepEqual(
    asset.children.map((p) => p.visible),
    [true, true],
  );
  assert.equal(view.fixtures.get("low").light.visible, true);
  // Whole house keeps open-ended planes so floor switches avoid recompiles.
  const [floorPlane, ceiling] =
    asset.children[0].children[0].material.clippingPlanes;
  assert.ok(floorPlane.constant >= 1e5 && ceiling.constant >= 1e5);
  view.setHouseView(upper, { render: false });
  assert.equal(states, 2);
  // Views of another house, or needing rooms that were not loaded, are refused.
  assert.equal(view.setHouseView({ ...upper, houseId: "other" }), false);
  assert.equal(
    view.setHouseView({ ...upper, members: [member("attic")] }),
    false,
  );
});

test("camera movement can be locked and unlocked at runtime", () => {
  const view = Object.create(SceneView.prototype);
  view.options = { interactive: false };
  view.orbit = { enabled: false };
  view.renderer = { domElement: { style: {} } };
  view.setInteractive(true);
  assert.equal(view.orbit.enabled, true);
  assert.equal(view.renderer.domElement.style.touchAction, "none");
  view.setInteractive(false);
  assert.equal(view.orbit.enabled, false);
  assert.equal(view.options.interactive, false);
  // A locked card lets phones scroll the page over the 3D view.
  assert.equal(view.renderer.domElement.style.touchAction, "");
});

test("a new scene compiles its shaders first and draws its first frame without shadow passes", async () => {
  const view = Object.create(SceneView.prototype);
  const calls = [];
  let frame;
  globalThis.requestAnimationFrame ??= undefined;
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => {
    frame = fn;
    return 1;
  };
  try {
    view.scene = new THREE.Scene();
    view.disposeScene = () => {};
    view.options = { mode: "front", markers: false };
    view.generation = 1;
    view.fixtures = new Map();
    view.container = { dispatchEvent: () => {} };
    view.camera = new THREE.PerspectiveCamera();
    view.camera.updateMatrixWorld();
    view.syncClimateAnimation = () => {};
    view.applyLightEffects = () => {};
    view.renderer = {
      domElement: { dataset: {} },
      capabilities: { maxTextures: 16 },
      shadowMap: {},
      compileAsync: async () => {
        // Nothing may draw while the shaders compile.
        view.render();
        calls.push("compile");
      },
      render(scene) {
        let casters = 0;
        scene.traverse((o) => (casters += o.castShadow && !o.isLight ? 1 : 0));
        calls.push(
          this.shadowMap.needsUpdate && casters ? "draw+shadows" : "draw",
        );
      },
    };
    view.setView = () => view.render({ cameraOnly: true });
    const asset = new THREE.Group();
    asset.add(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    );
    assert.equal(
      await view.prepareAsset({ controls: [], ambient: 0.4 }, asset, 0),
      true,
    );
    // Shadow maps exist after the first frame, but nothing cast into them.
    assert.deepEqual(calls, ["compile", "draw"]);
    assert.equal(view.shadowsCurrent, false);
    assert.equal(asset.children[0].castShadow, true, "casters restored");
    frame();
    assert.deepEqual(calls, ["compile", "draw", "draw+shadows"]);
    assert.equal(view.shadowsCurrent, true);
    assert.ok("compileMs" in view.renderer.domElement.dataset);
  } finally {
    globalThis.requestAnimationFrame = raf;
  }
});
