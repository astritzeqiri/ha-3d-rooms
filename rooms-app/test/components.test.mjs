import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import { validateComponent, componentYaml } from "../shared/component.mjs";
const component = () => ({
  schemaVersion: 1,
  id: "kitchen-overview",
  title: "Kitchen: overview",
  height: 500,
  layers: [
    { model: "kitchen", view: "front", heading: 90, tilt: 28, zoom: 1.5 },
  ],
});
test("components persist independently with multiple views of one room", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rooms-components-"));
  try {
    const store = await new Store(dir).open();
    store.state.models = [{ id: "kitchen" }];
    await store.putComponent(component());
    await store.putComponent({
      ...component(),
      id: "kitchen-close-up",
      title: "Close-up",
      layers: [{ ...component().layers[0], zoom: 2 }],
    });
    const reopened = await new Store(dir).open();
    assert.equal(reopened.state.components.length, 2);
    assert.equal(reopened.state.components[1].layers[0].zoom, 2);
    await reopened.putComponent({ ...component(), title: "Updated" });
    assert.equal(reopened.state.components.length, 2);
    assert.equal(reopened.state.models.length, 1);
    await reopened.removeComponent("kitchen-overview");
    assert.equal((await new Store(dir).open()).state.components.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("component imports reject invalid cameras, missing rooms and unsupported compositions", () => {
  for (const bad of [
    null,
    {},
    { ...component(), height: 0 },
    { ...component(), id: "../bad" },
    { ...component(), layers: [] },
    ...["zoom", "heading", "tilt"].flatMap((key) =>
      [NaN, Infinity, -1, 10000].map((value) => ({
        ...component(),
        layers: [{ ...component().layers[0], [key]: value }],
      })),
    ),
  ])
    assert.throws(() => validateComponent(bad, ["kitchen"]));
  assert.throws(() => validateComponent(component(), []), /Import/);
  assert.throws(
    () =>
      validateComponent(
        {
          ...component(),
          layers: [component().layers[0], component().layers[0]],
        },
        ["kitchen"],
      ),
    /one room/,
  );
});
test("portable component configurations preserve camera and quote titles safely", () => {
  const c = validateComponent(JSON.parse(JSON.stringify(component())), [
    "kitchen",
  ]);
  const yaml = componentYaml(c);
  assert.equal(
    yaml,
    "type: custom:three-d-rooms-card\nsaved_view: kitchen-overview",
  );
});

test("components API saves, lists and removes portable views", async () => {
  const { EventEmitter } = await import("node:events");
  const { createApp } = await import("../server/index.mjs");
  const dir = await mkdtemp(join(tmpdir(), "rooms-component-api-"));
  const bridge = new EventEmitter();
  Object.assign(bridge, { start() {}, stop() {}, connected: false });
  const app = await createApp({ dataDir: dir, bridge, production: true });
  try {
    app.store.state.models = [{ id: "kitchen" }];
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${app.server.address().port}/api/components`;
    const put = (value) =>
      fetch(base, {
        method: "PUT",
        headers: { "X-Rooms-Request": "1" },
        body: JSON.stringify(value),
      });
    assert.equal((await put(component())).status, 200);
    assert.equal((await (await fetch(base)).json())[0].layers[0].zoom, 1.5);
    assert.equal((await put({ ...component(), height: 0 })).status, 400);
    assert.equal((await (await fetch(base)).json()).length, 1);
    assert.equal(
      (
        await fetch(base + "/kitchen-overview", {
          method: "DELETE",
          headers: { "X-Rooms-Request": "1" },
        })
      ).status,
      200,
    );
    assert.deepEqual(await (await fetch(base)).json(), []);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("saved components preserve exact camera geometry and reject malformed snapshots", async () => {
  const camera = {
    projection: "perspective",
    position: [3, 7, -4],
    target: [0.7, 1, 0.4],
    up: [0, 1, 0],
    aspect: 1.8,
    zoom: 1,
    referenceZoom: 1.3,
    heading: 143.2,
    tilt: 48,
    fov: 45,
  };
  const value = component();
  Object.assign(value.layers[0], {
    camera,
    tilt: 48,
    heading: 143.2,
    zoom: 1.3,
  });
  const clean = validateComponent(JSON.parse(JSON.stringify(value)), [
    "kitchen",
  ]);
  assert.deepEqual(clean.layers[0].camera, camera);
  assert.match(componentYaml(clean), /saved_view: kitchen-overview/);
  const dir = await mkdtemp(join(tmpdir(), "rooms-camera-components-"));
  try {
    const store = await new Store(dir).open();
    store.state.models = [{ id: "kitchen" }];
    await store.putComponent(clean);
    assert.deepEqual((await new Store(dir).open()).state.components[0], clean);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  for (const change of [
    { position: [Infinity, 0, 0] },
    { projection: "orthographic" },
    { referenceZoom: 0 },
  ])
    assert.throws(() =>
      validateComponent(
        {
          ...value,
          layers: [{ ...value.layers[0], camera: { ...camera, ...change } }],
        },
        ["kitchen"],
      ),
    );
});
