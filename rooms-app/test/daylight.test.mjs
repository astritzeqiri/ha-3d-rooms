import test from "node:test";
import assert from "node:assert/strict";
import { daylightFactor, createDaylight } from "../shared/daylight.mjs";
import { validateDaylight } from "../server/manifest.mjs";
const config = {
  mode: "night",
  entity: "sun.sun",
  windows: [
    {
      id: "window",
      nodeId: "glass",
      position: [0, 1.7, 2],
      inward: [0, 0, -1],
      width: 1,
      height: 1,
      coverId: "shade",
      defaultPosition: 0,
    },
  ],
};
test("day, night, dawn/dusk and unavailable sun preserve bounded daylight", () => {
  assert.equal(daylightFactor("day"), 1);
  assert.equal(daylightFactor("night"), 0);
  assert.equal(
    daylightFactor("auto", {
      state: "above_horizon",
      attributes: { elevation: 12 },
    }),
    1,
  );
  assert.equal(
    daylightFactor("auto", {
      state: "below_horizon",
      attributes: { elevation: -6 },
    }),
    0,
  );
  assert.equal(
    daylightFactor("auto", {
      state: "above_horizon",
      attributes: { elevation: 3 },
    }),
    0.5,
  );
  assert.equal(daylightFactor("auto", { state: "unavailable" }, 0.7), 0.7);
  assert.equal(daylightFactor("auto", undefined, 0.4), 0.4);
});
test("each window opening scales its own light, missing positions retain state, night stays dark", () => {
  const scene = createDaylight({
    ...config,
    windows: [
      config.windows[0],
      { ...config.windows[0], id: "second", coverId: "other" },
    ],
  });
  const lights = scene.group.children.filter((c) => c.isSpotLight);
  scene.update(
    "day",
    undefined,
    new Map([
      ["shade", 100],
      ["other", 50],
    ]),
  );
  assert.ok(lights[0].intensity > 0);
  assert.equal(lights[0].intensity, lights[1].intensity * 2);
  scene.update("day", undefined, new Map([["shade", 0]]));
  assert.equal(lights[0].intensity, 0);
  assert.ok(lights[1].intensity > 0);
  scene.update("night");
  assert.ok(lights.every((l) => l.intensity === 0));
  scene.update("day", undefined, new Map([["shade", 100]]));
  assert.ok(lights[0].intensity > 0);
});
test("daylight schema requires geometry and genuine declared covers", () => {
  const controls = [{ id: "shade", type: "cover" }];
  assert.equal(validateDaylight(config, controls), config);
  for (const bad of [
    { ...config, mode: "bad" },
    { ...config, entity: "light.sun" },
    { ...config, windows: [{ ...config.windows[0], inward: [0, 0, 0] }] },
    { ...config, windows: [{ ...config.windows[0], coverId: "missing" }] },
  ])
    assert.throws(() => validateDaylight(bad, controls));
});

test("saved daylight API validates its sun entity and never sends device commands", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { EventEmitter } = await import("node:events");
  const { createApp } = await import("../server/index.mjs");
  const dir = await mkdtemp(join(tmpdir(), "room-daylight-"));
  const bridge = new EventEmitter();
  Object.assign(bridge, {
    connected: true,
    entities: [
      {
        entity_id: "sun.sun",
        state: "above_horizon",
        attributes: { elevation: 30 },
      },
    ],
    start() {},
    stop() {},
    call() {
      assert.fail("daylight must not actuate a device");
    },
  });
  const app = await createApp({
    dataDir: dir,
    bridge,
    production: true,
    exportDir: join(dir, "exports"),
  });
  try {
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const headers = { "X-Rooms-Request": "1" };
    const response = await fetch(base + "/api/models", {
      method: "POST",
      headers,
      body: await readFile("examples/sample-floor.zip"),
    });
    assert.equal(response.status, 201);
    app.store.find("sample-floor").daylight = {
      ...config,
      windows: [{ ...config.windows[0], coverId: undefined }],
    };
    const save = (data) =>
      fetch(base + "/api/models/sample-floor/daylight", {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });
    const saved = await save({ mode: "auto", entity: "sun.sun" });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).daylight.mode, "auto");
    assert.equal(
      (await save({ mode: "auto", entity: "sun.missing" })).status,
      400,
    );
    assert.equal(app.store.find("sample-floor").daylight.mode, "auto");
    const data = JSON.parse(await readFile(join(dir, "catalog.json"), "utf8"));
    assert.equal(data.models[0].daylight.mode, "auto");
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
