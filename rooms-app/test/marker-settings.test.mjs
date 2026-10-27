import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  validateMarkers,
  markerSettings,
  offsetPoint,
  markerLayout,
} from "../shared/marker-settings.mjs";
import { validateComponent } from "../shared/component.mjs";
import { SceneView } from "../web/scene.js";

test("marker settings are optional, independent and portable with a saved view", () => {
  assert.equal(validateMarkers(undefined), undefined);
  assert.deepEqual(markerSettings(undefined, "lamp"), {
    visible: true,
    show_label: true,
    size: 32,
    placement: "room",
  });
  const markers = {
    lamp: { visible: false, size: 44, show_label: false, offset: [1, 2, 3] },
    desk: { placement: "tray" },
  };
  const clean = validateComponent(
    {
      schemaVersion: 1,
      id: "view",
      title: "Office",
      height: 500,
      layers: [
        { model: "office", view: "front", heading: 0, tilt: 28, zoom: 1 },
      ],
      markers,
    },
    ["office"],
  );
  assert.deepEqual(clean.markers, markers);
  clean.markers.lamp.offset[0] = 9;
  assert.equal(markers.lamp.offset[0], 1);
  for (const bad of [
    null,
    [],
    { lamp: { size: 12 } },
    { lamp: { offset: [1, Infinity, 3] } },
    { lamp: { offset: [1, true, 3] } },
    { lamp: { visible: "no" } },
    { lamp: { placement: "screen" } },
    JSON.parse('{"__proto__":{}}'),
    { lamp: { callService: "light.toggle" } },
  ])
    assert.throws(() => validateMarkers(bad));
});

test("3D offsets stay relative to moving device anchors and project under camera rotation", () => {
  const view = Object.create(SceneView.prototype);
  view.container = { clientWidth: 600, clientHeight: 400 };
  const marker = new THREE.Object3D();
  marker.position.set(0, 0.75, 0);
  view.fixtures = new Map([["desk", { marker }]]);
  view.camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);
  view.camera.position.set(3, 4, 5);
  view.camera.lookAt(0, 0, 0);
  view.camera.updateMatrixWorld();
  const offset = [0.5, 0.25, -0.2];
  const expected = () => {
    const p = new THREE.Vector3()
      .fromArray(offsetPoint(marker.position.toArray(), offset))
      .project(view.camera);
    return { x: (p.x + 1) * 300, y: (1 - p.y) * 200 };
  };
  for (const position of [
    [3, 4, 5],
    [-4, 3, 2],
  ]) {
    view.camera.position.fromArray(position);
    view.camera.lookAt(0, 0, 0);
    view.camera.updateMatrixWorld();
    marker.position.y += 0.25;
    const actual = view.fixtureScreenPosition("desk", offset);
    assert.ok(Math.abs(actual.x - expected().x) < 1e-9);
    assert.ok(Math.abs(actual.y - expected().y) < 1e-9);
  }
  assert.equal(view.fixtureScreenPosition("missing"), null);
  assert.deepEqual(
    markerLayout({ x: 100, y: 100 }, markerSettings({}, "desk"), 500, 400),
    { left: 124, top: 84 },
  );
});

test("placing a marker raycasts visible model geometry and ignores hidden surfaces", () => {
  const view = Object.create(SceneView.prototype);
  view.renderer = {
    domElement: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 600,
        height: 400,
      }),
    },
  };
  view.camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);
  view.camera.position.set(0, 0, 5);
  view.camera.lookAt(0, 0, 0);
  view.camera.updateMatrixWorld();
  view.asset = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial(),
  );
  view.asset.add(plane);
  view.asset.updateMatrixWorld(true);
  const hit = view.pickMarkerPosition(300, 200);
  assert.ok(hit.every((n) => Math.abs(n) < 1e-9));
  view.asset.visible = false;
  assert.equal(view.pickMarkerPosition(300, 200), null);
  plane.geometry.dispose();
  plane.material.dispose();
});
