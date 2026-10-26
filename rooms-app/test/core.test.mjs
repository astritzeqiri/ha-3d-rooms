import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { WebSocketServer } from "ws";
import { validateManifest, commandFor } from "../server/manifest.mjs";
import { extractPackage, validateGLB } from "../server/import.mjs";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
import { HABridge } from "../server/ha.mjs";
const manifest = JSON.parse(await readFile("examples/manifest.json", "utf8"));
const sample = await readFile("examples/sample-floor.zip");
const temp = () => mkdtemp(join(tmpdir(), "ha-rooms-test-"));
test("manifest rejects duplicate IDs, unsupported controls and unsafe model IDs", () => {
  assert.equal(validateManifest(structuredClone(manifest)).id, "sample-floor");
  for (const bad of [
    { ...manifest, id: "../escape" },
    { ...manifest, controls: [manifest.controls[0], manifest.controls[0]] },
    { ...manifest, controls: [{ ...manifest.controls[0], type: "lock" }] },
    {
      ...manifest,
      controls: [{ ...manifest.controls[0], position: [null, 0, 0] }],
    },
  ])
    assert.throws(() => validateManifest(bad));
});
test("command allowlist uses explicit services and validates brightness", () => {
  const c = manifest.controls[0];
  assert.equal(
    commandFor("light.kitchen", "off", undefined, c).service,
    "turn_off",
  );
  assert.equal(
    commandFor("light.kitchen", "on", 120, c).service_data.brightness,
    120,
  );
  assert.throws(() => commandFor("lock.door", "on", undefined, c));
  assert.throws(() => commandFor("switch.lamp", "on", 100, c));
  assert.throws(() => commandFor("light.kitchen", "toggle", undefined, c));
  assert.throws(() => commandFor("light.kitchen", "on", 999, c));
});
test("import validates scene references and rejects external resources", async () => {
  const dir = await temp();
  try {
    const m = await extractPackage(sample, join(dir, "good"));
    assert.equal(m.controls.length, 2);
    const glb = await readFile(join(dir, "good", "scene.glb"));
    assert.doesNotThrow(() => validateGLB(glb, m));
    assert.throws(() =>
      validateGLB(glb, {
        ...m,
        controls: [{ ...m.controls[0], nodeIds: ["missing"] }],
      }),
    );
    const doc = {
      asset: { version: "2.0" },
      images: [{ uri: "https://example.com/private" }],
    };
    let json = Buffer.from(JSON.stringify(doc));
    json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
    const b = Buffer.alloc(20 + json.length);
    b.write("glTF");
    b.writeUInt32LE(2, 4);
    b.writeUInt32LE(b.length, 8);
    b.writeUInt32LE(json.length, 12);
    b.writeUInt32LE(0x4e4f534a, 16);
    json.copy(b, 20);
    assert.throws(() => validateGLB(b, m), /External/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("import rejects traversal, executable files, duplicate/malformed packages and expansion bombs", async () => {
  const dir = await temp();
  try {
    for (const files of [
      { "../outside.txt": strToU8("bad") },
      { "script.js": strToU8("bad") },
      { "manifest.json": strToU8("{}") },
    ])
      await assert.rejects(extractPackage(zipSync(files), join(dir, "stage")));
    // Oversized declared uncompressed length is rejected before expansion.
    const zip = Buffer.from(zipSync({ "scene.glb": new Uint8Array(1) }));
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(400 * 1024 * 1024, central + 24);
    await assert.rejects(extractPackage(zip, join(dir, "bomb")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("catalog preserves models and bindings across restart, rejects duplicate imports", async () => {
  const dir = await temp();
  try {
    const store = await new Store(dir).open(),
      stage = join(dir, "stage");
    const m = await extractPackage(sample, stage);
    await store.install(stage, m);
    store.find(m.id).bindings["kitchen-ceiling"] = "light.kitchen";
    await store.save();
    const restarted = await new Store(dir).open();
    assert.equal(
      restarted.find(m.id).bindings["kitchen-ceiling"],
      "light.kitchen",
    );
    const next = join(dir, "next");
    await extractPackage(sample, next);
    await assert.rejects(restarted.install(next, m), /already exists/);
    assert.equal(restarted.state.models.length, 1);
    await restarted.remove(m.id);
    assert.equal((await new Store(dir).open()).state.models.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
class FakeHA extends EventEmitter {
  connected = true;
  entities = [
    {
      entity_id: "light.kitchen",
      state: "on",
      attributes: {
        friendly_name: "Kitchen",
        supported_color_modes: ["brightness"],
      },
    },
  ];
  calls = [];
  start() {}
  stop() {}
  async call(c) {
    this.calls.push(c);
  }
  async isAdmin(id) {
    return id === "admin";
  }
}
async function running(fn, options = {}) {
  const dir = await temp(),
    bridge = new FakeHA(),
    app = await createApp({
      dataDir: dir,
      bridge,
      production: true,
      exportDir: join(dir, "exports"),
      ...options,
    });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    await fn({ app, bridge, base, dir });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
const headers = { "X-Rooms-Request": "1" };
test("API imports, maps and restricts commands to mapped controls; no simulated real actions", async () =>
  running(async ({ base, bridge, dir }) => {
    let r = await fetch(base + "/api/models", {
      method: "POST",
      headers,
      body: sample,
    });
    assert.equal(r.status, 201);
    assert.deepEqual(
      await readFile(join(dir, "exports/sample-floor.zip")),
      sample,
    );
    r = await fetch(base + "/api/models/sample-floor/command", {
      method: "POST",
      headers,
      body: JSON.stringify({ controlId: "kitchen-ceiling", action: "off" }),
    });
    assert.equal(r.status, 400);
    assert.equal(bridge.calls.length, 0);
    r = await fetch(base + "/api/models/sample-floor/bindings", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        controlId: "kitchen-ceiling",
        entityId: "light.kitchen",
      }),
    });
    assert.equal(r.status, 200);
    r = await fetch(base + "/api/models/sample-floor/command", {
      method: "POST",
      headers,
      body: JSON.stringify({
        controlId: "kitchen-ceiling",
        action: "off",
        entityId: "light.injected",
      }),
    });
    assert.equal(r.status, 200);
    assert.equal(bridge.calls[0].target.entity_id, "light.kitchen");
    const exported = await fetch(base + "/api/models/sample-floor/export.zip");
    assert.equal(exported.status, 200);
    const zip = unzipSync(new Uint8Array(await exported.arrayBuffer()));
    assert.equal(
      JSON.parse(new TextDecoder().decode(zip["bindings.json"]))[
        "kitchen-ceiling"
      ],
      "light.kitchen",
    );
    assert.ok(zip["scene.glb"].length);
    bridge.entities[0].state = "unavailable";
    r = await fetch(base + "/api/models/sample-floor/command", {
      method: "POST",
      headers,
      body: JSON.stringify({ controlId: "kitchen-ceiling", action: "on" }),
    });
    assert.equal(r.status, 400);
    r = await fetch(base + "/api/models/sample-floor", { method: "DELETE" });
    assert.equal(r.status, 400);
    r = await fetch(base + "/api/models/sample-floor", {
      method: "DELETE",
      headers,
    });
    assert.equal(r.status, 200);
  }));
test("Ingress rejects direct connections even with forged user headers", async () =>
  running(
    async ({ base }) => {
      const r = await fetch(base + "/api/models", {
        headers: { "X-Remote-User-Id": "admin", "X-Remote-User-Admin": "true" },
      });
      assert.equal(r.status, 403);
      assert.equal((await fetch(base + "/health")).status, 200);
    },
    { ingress: true },
  ));
test("HA WebSocket authenticates, reads states, updates externally, calls services and denies non-admin users", async () => {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((r) => wss.once("listening", r));
  let peer, subscription, called;
  wss.on("connection", (socket) => {
    peer = socket;
    socket.send(JSON.stringify({ type: "auth_required" }));
    socket.on("message", (bytes) => {
      const m = JSON.parse(bytes);
      if (m.type === "auth") {
        assert.equal(m.access_token, "test-token");
        socket.send(JSON.stringify({ type: "auth_ok" }));
        return;
      }
      let result = null;
      if (m.type === "get_states")
        result = [{ entity_id: "light.kitchen", state: "on", attributes: {} }];
      if (m.type === "subscribe_events") subscription = m.id;
      if (m.type === "config/auth/list")
        result = [
          { id: "admin", is_active: true, group_ids: ["system-admin"] },
          { id: "viewer", is_active: true, group_ids: ["system-users"] },
        ];
      if (m.type === "call_service") called = m;
      socket.send(
        JSON.stringify({ type: "result", id: m.id, success: true, result }),
      );
    });
  });
  const bridge = new HABridge({
    token: "test-token",
    url: `ws://127.0.0.1:${wss.address().port}`,
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Connect timed out")), 2000);
      bridge.on("change", () => {
        if (bridge.connected) {
          clearTimeout(timer);
          resolve();
        }
      });
      bridge.start();
    });
    assert.equal(bridge.entities[0].state, "on");
    assert.equal(await bridge.isAdmin("admin"), true);
    assert.equal(await bridge.isAdmin("viewer"), false);
    await bridge.call(
      commandFor("light.kitchen", "off", undefined, manifest.controls[0]),
    );
    assert.equal(called.service, "turn_off");
    const changed = new Promise((resolve) => bridge.once("change", resolve));
    peer.send(
      JSON.stringify({
        type: "event",
        id: subscription,
        event: {
          data: {
            entity_id: "light.kitchen",
            new_state: {
              entity_id: "light.kitchen",
              state: "off",
              attributes: {},
            },
          },
        },
      }),
    );
    await changed;
    assert.equal(bridge.entities[0].state, "off");
  } finally {
    bridge.stop();
    for (const client of wss.clients) client.terminate();
    await new Promise((r) => wss.close(r));
  }
});
test("HA reconnect refreshes state without replaying device commands", async () => {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((r) => wss.once("listening", r));
  let connections = 0,
    calls = 0,
    peer;
  wss.on("connection", (socket) => {
    connections++;
    peer = socket;
    socket.send(JSON.stringify({ type: "auth_required" }));
    socket.on("message", (bytes) => {
      const m = JSON.parse(bytes);
      if (m.type === "auth") {
        socket.send(JSON.stringify({ type: "auth_ok" }));
        return;
      }
      if (m.type === "call_service") calls++;
      const result =
        m.type === "get_states"
          ? [
              {
                entity_id: "light.kitchen",
                state: connections === 1 ? "on" : "off",
                attributes: {},
              },
            ]
          : null;
      socket.send(
        JSON.stringify({ type: "result", id: m.id, success: true, result }),
      );
    });
  });
  const bridge = new HABridge({
    token: "test-token",
    url: `ws://127.0.0.1:${wss.address().port}`,
    retryDelay: 10,
  });
  const waitFor = (predicate) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        bridge.off("change", check);
        reject(Error("State timeout"));
      }, 2000);
      function check() {
        if (predicate()) {
          clearTimeout(timer);
          bridge.off("change", check);
          resolve();
        }
      }
      bridge.on("change", check);
      check();
    });
  try {
    const ready = waitFor(() => bridge.connected);
    bridge.start();
    await ready;
    await bridge.call(
      commandFor("light.kitchen", "off", undefined, manifest.controls[0]),
    );
    const refreshed = waitFor(() => connections === 2 && bridge.connected);
    peer.terminate();
    await refreshed;
    assert.equal(bridge.entities[0].state, "off");
    assert.equal(calls, 1);
  } finally {
    bridge.stop();
    for (const socket of wss.clients) socket.terminate();
    await new Promise((r) => wss.close(r));
  }
});

test("color, temperature, effects and fades follow entity capabilities and limits", () => {
  const control = manifest.controls[0],
    rich = {
      entity_id: "light.rgb",
      attributes: {
        supported_color_modes: ["xy", "color_temp"],
        min_color_temp_kelvin: 2200,
        max_color_temp_kelvin: 6000,
        supported_features: 36,
        effect_list: ["off", "colorloop"],
      },
    };
  const make = (settings) =>
    commandFor(rich.entity_id, "on", undefined, control, settings, rich);
  assert.deepEqual(make({ rgb_color: [255, 0, 100] }).service_data, {
    rgb_color: [255, 0, 100],
  });
  assert.deepEqual(
    make({ color_temp_kelvin: 2200, transition: 2 }).service_data,
    { color_temp_kelvin: 2200, transition: 2 },
  );
  assert.equal(make({ effect: "colorloop" }).service_data.effect, "colorloop");
  for (const settings of [
    { rgb_color: [300, 0, 0] },
    { rgb_color: [1.5, 0, 0] },
    { rgb_color: [0, 0] },
    { color_temp_kelvin: 2100 },
    { color_temp_kelvin: 6001 },
    { color_temp_kelvin: NaN },
    { rgb_color: [0, 0, 0], color_temp_kelvin: 3000 },
    { effect: "not-advertised" },
    { transition: 61 },
  ])
    assert.throws(() => make(settings));
  for (const mode of ["brightness", "onoff"]) {
    const entity = {
      entity_id: "light.basic",
      attributes: { supported_color_modes: [mode] },
    };
    assert.throws(() =>
      commandFor(
        entity.entity_id,
        "on",
        undefined,
        control,
        { rgb_color: [255, 0, 0] },
        entity,
      ),
    );
    assert.throws(() =>
      commandFor(
        entity.entity_id,
        "on",
        undefined,
        control,
        { color_temp_kelvin: 3000 },
        entity,
      ),
    );
  }
  const switchEntity = { entity_id: "switch.lamp", attributes: {} };
  assert.throws(() =>
    commandFor(
      switchEntity.entity_id,
      "on",
      undefined,
      control,
      { transition: 1 },
      switchEntity,
    ),
  );
  assert.throws(() =>
    commandFor(
      rich.entity_id,
      "off",
      undefined,
      control,
      { rgb_color: [0, 0, 0] },
      rich,
    ),
  );
});
test("light capabilities and appearance respect active color mode", async () => {
  const { lightFeatures, entityAppearance, kelvinToRgb, commandConfirmed } =
    await import("../shared/light.mjs");
  for (const mode of ["hs", "xy", "rgb", "rgbw", "rgbww"])
    assert.equal(
      lightFeatures({
        entity_id: "light.color",
        attributes: { supported_color_modes: [mode] },
      }).color,
      true,
    );
  assert.equal(
    lightFeatures({
      entity_id: "light.white",
      attributes: { supported_color_modes: ["color_temp"] },
    }).color,
    false,
  );
  assert.equal(lightFeatures({ entity_id: "switch.lamp" }).temperature, false);
  const warm = kelvinToRgb(2700),
    cool = kelvinToRgb(6500);
  assert.ok(warm[2] < cool[2]);
  assert.ok(warm[0] >= warm[2]);
  assert.deepEqual(
    entityAppearance({
      attributes: {
        color_mode: "color_temp",
        color_temp_kelvin: 2700,
        rgb_color: [0, 0, 255],
      },
    }).rgb,
    warm,
  );
  const rgb = {
    state: "on",
    attributes: { color_mode: "xy", rgb_color: [250, 5, 100] },
  };
  assert.equal(commandConfirmed(rgb, true, { rgb_color: [255, 0, 100] }), true);
  assert.equal(commandConfirmed(rgb, true, { rgb_color: [0, 0, 255] }), false);
  assert.equal(
    commandConfirmed(
      {
        state: "on",
        attributes: { color_mode: "color_temp", color_temp_kelvin: 3000 },
      },
      true,
      { color_temp_kelvin: 3000 },
    ),
    true,
  );
  assert.equal(commandConfirmed(rgb, true, { color_temp_kelvin: 3000 }), false);
});
test("API forwards only validated color settings to the mapped entity", async () =>
  running(async ({ base, bridge }) => {
    bridge.entities[0].attributes = {
      supported_color_modes: ["rgb", "color_temp"],
      min_color_temp_kelvin: 2500,
      max_color_temp_kelvin: 6500,
      supported_features: 36,
      effect_list: ["off", "colorloop"],
    };
    await fetch(base + "/api/models", {
      method: "POST",
      headers,
      body: sample,
    });
    await fetch(base + "/api/models/sample-floor/bindings", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        controlId: "kitchen-ceiling",
        entityId: "light.kitchen",
      }),
    });
    const send = (extra) =>
      fetch(base + "/api/models/sample-floor/command", {
        method: "POST",
        headers,
        body: JSON.stringify({
          controlId: "kitchen-ceiling",
          action: "on",
          ...extra,
        }),
      });
    assert.equal(
      (await send({ rgb_color: [255, 0, 40], transition: 1 })).status,
      200,
    );
    assert.deepEqual(bridge.calls[0].service_data, {
      rgb_color: [255, 0, 40],
      transition: 1,
    });
    assert.equal((await send({ color_temp_kelvin: 2200 })).status, 400);
    assert.equal(bridge.calls.length, 1);
    assert.equal((await send({ color_temp_kelvin: 4000 })).status, 200);
    assert.equal((await send({ effect: "colorloop" })).status, 200);
    assert.equal(
      (await send({ rgb_color: [255, 0, 0], color_temp_kelvin: 4000 })).status,
      400,
    );
    assert.equal(bridge.calls.length, 3);
  }));
