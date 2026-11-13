import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  validateMarkers,
  markerSettings,
  offsetPoint,
  markerLayout,
  markerTrayHeight,
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
    { left: 84, top: 84 },
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

test("view defaults resolve with overrides and count inherited tray controls", () => {
  const markers = validateMarkers({
    _defaults: { size: 44, placement: "tray", show_label: false },
    light: { size: 24 },
    shade: { visible: false },
  });
  assert.equal(markerSettings(markers, "new-device").size, 44);
  assert.equal(markerSettings(markers, "light").size, 24);
  assert.equal(markerSettings(markers, "light").show_label, false);
  assert.equal(
    markerTrayHeight(markers, [
      { id: "light" },
      { id: "shade" },
      { id: "new-device" },
    ]),
    176,
  );
  assert.throws(() => validateMarkers({ _defaults: { offset: [0, 1, 0] } }));
});

test("marker circles stay centered on projected model anchors at every size", () => {
  for (const size of [24, 32, 44, 56, 64]) {
    for (const offset of [undefined, [0, 0, 0], [1, 0, -1]]) {
      const settings = {
        ...markerSettings({}, "light"),
        size,
        ...(offset ? { offset } : {}),
      };
      const layout = markerLayout({ x: 250, y: 180 }, settings, 600, 400);
      assert.equal(layout.left + size / 2, 250);
      assert.equal(layout.top + size / 2, 180);
    }
  }
  assert.deepEqual(
    markerLayout({ x: 2, y: 2 }, { size: 32, show_label: true }, 600, 400),
    { left: 0, top: 0 },
  );
  assert.deepEqual(
    markerLayout({ x: 599, y: 399 }, { size: 32, show_label: true }, 600, 400),
    { left: 568, top: 352 },
  );
});
test("views may choose any HA icon (MDI or a custom set) per device, never as a default", async () => {
  const { validateMarkers, markerSettings } =
    await import("../shared/marker-settings.mjs");
  const { MARKER_ICONS, markerIconPath } =
    await import("../shared/marker-icons.mjs");
  const markers = validateMarkers({ lamp: { icon: "mdi:floor-lamp" } });
  assert.equal(markerSettings(markers, "lamp").icon, "mdi:floor-lamp");
  assert.equal(markerSettings(markers, "other").icon, undefined);
  assert.match(markerIconPath("mdi:floor-lamp"), /^<path d="M/);
  assert.equal(markerIconPath("mdi:printer-3d-nozzle"), undefined);
  assert.equal(
    validateMarkers({ lamp: { icon: "mdi:printer-3d-nozzle" } }).lamp.icon,
    "mdi:printer-3d-nozzle",
  );
  for (const bad of [
    { lamp: { icon: "door" } },
    { lamp: { icon: "Mdi:door" } },
    { lamp: { icon: "local:a b" } },
    { lamp: { icon: "<svg>" } },
    { _defaults: { icon: "mdi:lamp" } },
  ])
    assert.throws(() => validateMarkers(bad));
  assert.ok(MARKER_ICONS.size >= 30);
});

test("icon catalog combines MDI with HA's registered custom icon sets", async () => {
  const { loadIconCatalog, iconArt } = await import("../web/icon-catalog.js");
  const { MARKER_ICONS, iconLabel } =
    await import("../shared/marker-icons.mjs");
  const asked = [];
  const sets = {
    local: {
      getIconList: async () => [
        { name: "front-door", keywords: ["entrance"] },
        { name: "hallway_lamp" },
      ],
      getIcon: async (name) => {
        asked.push(name);
        return name === "front-door"
          ? { path: "M0 0h24v24H0z", viewBox: "0 0 48 48" }
          : { path: '"/><script>alert(1)</script>' };
      },
    },
    broken: {
      getIconList: async () => {
        throw new Error("offline");
      },
    },
    legacy: { getIcon: async () => ({ path: "M1 1h2" }) },
  };
  // Stands in for Home Assistant's /static/mdi/ files.
  const { MDI_PATHS } = await import("./helpers/fake-ha-mdi.mjs");
  const pathCalls = [];
  const mdiSource = {
    list: async () =>
      Object.keys(MDI_PATHS).map((name) => ({ name, keywords: [] })),
    path: async (icon) => {
      pathCalls.push(icon);
      return MDI_PATHS[icon.replace(/^mdi:/, "")];
    },
  };
  const catalog = await loadIconCatalog(sets, mdiSource);
  assert.ok(catalog.mdiCount > 7000);
  assert.equal(catalog.count, catalog.mdiCount + 2);
  assert.deepEqual(catalog.sets, [{ prefix: "local", count: 2 }]);
  // Suggestions draw at once; any other icon loads from HA on demand.
  for (const icon of MARKER_ICONS.keys()) assert.ok(catalog.art(icon), icon);
  assert.equal(pathCalls.length, 0);
  for (const icon of ["mdi:dice-d20", "mdi:alpha-a-box", "mdi:door-open"])
    assert.match((await catalog.resolve(icon)).html, /^<path d="M/, icon);
  assert.ok(catalog.art("mdi:dice-d20"));
  await catalog.resolve("mdi:dice-d20");
  assert.equal(pathCalls.filter((i) => i === "mdi:dice-d20").length, 1);
  assert.equal(await catalog.resolve("mdi:not-a-real-icon"), undefined);
  const doors = catalog.search("door");
  assert.ok(doors.total > 10);
  assert.equal(doors.results[0].icon, "mdi:door");
  assert.ok(doors.results.some((r) => r.icon === "local:front-door"));
  assert.deepEqual(
    catalog.search("local:").results.map((r) => r.icon),
    ["local:front-door", "local:hallway_lamp"],
  );
  assert.equal(catalog.search("entrance").results[0].icon, "local:front-door");
  assert.ok(
    catalog.search("bulb").results.some((r) => r.icon === "mdi:lightbulb"),
  );
  assert.deepEqual(await catalog.resolve("local:front-door"), {
    viewBox: "0 0 48 48",
    html: '<path d="M0 0h24v24H0z"/>',
  });
  assert.equal(await catalog.resolve("local:hallway_lamp"), undefined);
  assert.ok(await catalog.resolve("legacy:any"));
  await catalog.resolve("local:front-door");
  assert.equal(asked.filter((n) => n === "front-door").length, 1);
  assert.equal(
    iconArt({ path: "M0 0", viewBox: '0 0 24 24"><x' }).viewBox,
    "0 0 24 24",
  );
  assert.equal(iconLabel("local:front_door"), "Front door · local");
  assert.equal(iconLabel("mdi:garage-open-variant"), "Garage open variant");
});
test("no runtime code bundles @mdi/js; suggestion paths match it", async () => {
  const { readdir, readFile: read } = await import("node:fs/promises");
  // Icons come from Home Assistant's /static/mdi/ (shared/ha-mdi.mjs).
  for (const dir of ["shared", "web", "dashboard"])
    for (const file of await readdir(dir)) {
      if (!/\.(m?js)$/.test(file)) continue;
      const source = await read(`${dir}/${file}`, "utf8");
      assert.doesNotMatch(source, /@mdi\/js"/, `${dir}/${file}`);
    }
  const all = await import("@mdi/js");
  const { SUGGESTED_ICON_PATHS } =
    await import("../shared/marker-icon-paths.mjs");
  const { MARKER_ICONS, mdiExportName } =
    await import("../shared/marker-icons.mjs");
  assert.deepEqual(
    Object.keys(SUGGESTED_ICON_PATHS).sort(),
    [...MARKER_ICONS.keys()].sort(),
  );
  for (const [icon, path] of Object.entries(SUGGESTED_ICON_PATHS))
    assert.equal(path, all[mdiExportName(icon)], icon);
});

test("an inactive-state icon is validated like the active icon", () => {
  assert.deepEqual(
    validateMarkers({ lamp: { icon: "mdi:lightbulb", icon_off: "mdi:lamp" } })
      .lamp,
    { icon: "mdi:lightbulb", icon_off: "mdi:lamp" },
  );
  assert.throws(() => validateMarkers({ lamp: { icon_off: "lamp" } }));
  assert.throws(() => validateMarkers({ _defaults: { icon_off: "mdi:lamp" } }));
});
