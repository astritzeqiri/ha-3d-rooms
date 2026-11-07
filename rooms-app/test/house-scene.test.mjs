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
test("floor view clips the same geometry in world height and fits floor bounds", () => {
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
  assert.equal(view.prepareAsset(model, asset, performance.now()), true);
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
