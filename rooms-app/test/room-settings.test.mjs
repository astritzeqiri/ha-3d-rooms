import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { createApp } from "../server/index.mjs";
import { Store } from "../server/store.mjs";
test("room settings persist a real area without changing room identity, mappings or portable geometry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "room-area-test-"));
  class Bridge extends EventEmitter {
    connected = true;
    entities = [];
    start() {}
    stop() {}
    async request(type) {
      assert.equal(type, "config/area_registry/list");
      return [{ area_id: "kitchen", name: "Kitchen" }];
    }
  }
  const app = await createApp({
    dataDir: dir,
    bridge: new Bridge(),
    production: true,
  });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (path, options = {}) =>
    fetch(base + "/api/" + path, {
      ...options,
      headers: { "X-Rooms-Request": "1", ...options.headers },
    });
  try {
    const upload = await request("models", {
      method: "POST",
      body: await readFile("examples/sample-floor.zip"),
    });
    assert.equal(upload.status, 201);
    const areas = await (await request("areas")).json();
    assert.equal(areas[0].area_id, "kitchen");
    const changed = await request("models/sample-floor/room", {
      method: "PUT",
      body: JSON.stringify({ title: "My room", areaId: "kitchen" }),
    });
    assert.equal(changed.status, 200);
    const reopened = await new Store(dir).open();
    assert.equal(reopened.find("sample-floor").areaId, "kitchen");
    assert.equal(reopened.find("sample-floor").title, "My room");
    const rejected = await request("models/sample-floor/room", {
      method: "PUT",
      body: JSON.stringify({ title: "Wrong", areaId: "unknown" }),
    });
    assert.equal(rejected.status, 400);
    assert.equal(app.store.find("sample-floor").title, "My room");
    const exported = unzipSync(
      new Uint8Array(
        await (await request("models/sample-floor/export.zip")).arrayBuffer(),
      ),
    );
    const manifest = JSON.parse(strFromU8(exported["manifest.json"]));
    assert.equal(manifest.id, "sample-floor");
    assert.equal(manifest.title, "My room");
    assert.equal(manifest.areaId, undefined);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
