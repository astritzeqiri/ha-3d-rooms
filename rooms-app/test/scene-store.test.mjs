import test from "node:test";
import assert from "node:assert/strict";
import { sceneBlob } from "../shared/scene-download.mjs";
import {
  readStoredScene,
  setSceneStore,
  storedSceneKey,
  storeScene,
} from "../shared/scene-store.mjs";

function memoryStore() {
  const map = new Map();
  return {
    map,
    get: async (key) => map.get(key),
    put: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
    entries: async () => [...map],
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function counting(body = "model bytes") {
  const calls = [];
  return {
    calls,
    hass: () => ({
      connection: {},
      user: { id: "u1", is_admin: true },
      fetchWithAuth: async (path, init) => {
        calls.push({ path, init });
        return new Response(new Blob([body]));
      },
    }),
  };
}

test("a room kept on the device opens without downloading again", async (t) => {
  const store = memoryStore();
  setSceneStore(store);
  t.after(() => setSceneStore(null));
  const { calls, hass } = counting();
  const model = { id: "kitchen", sceneRevision: "r1" };
  await sceneBlob(hass(), model, "phone");
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(store.map.get("u1:kitchen:phone").revision, "r1");
  // A new HA connection (the app was closed and opened) reads the stored copy.
  const progress = [];
  const kept = await sceneBlob(hass(), model, "phone", (p) => progress.push(p));
  assert.equal(calls.length, 1);
  assert.equal(await kept.text(), "model bytes");
  assert.deepEqual(progress.at(-1), { loaded: 11, total: 11 });
});

test("a replaced room downloads once and replaces the stored copy", async (t) => {
  const store = memoryStore();
  setSceneStore(store);
  t.after(() => setSceneStore(null));
  const { calls, hass } = counting();
  await sceneBlob(hass(), { id: "hall", sceneRevision: "r1" }, "full");
  await settle();
  await sceneBlob(hass(), { id: "hall", sceneRevision: "r2" }, "full");
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(store.map.size, 1);
  assert.equal(store.map.get("u1:hall:full").revision, "r2");
});

test("Reload model skips the stored copy, bypasses HTTP caches and stores anew", async (t) => {
  const store = memoryStore();
  setSceneStore(store);
  t.after(() => setSceneStore(null));
  const { calls, hass } = counting("new bytes");
  const key = storedSceneKey("u1", { id: "bed" }, "full");
  await storeScene(key, "r1", new Blob(["old"]));
  const blob = await sceneBlob(
    hass(),
    { id: "bed", sceneRevision: "r1" },
    "full",
    undefined,
    { fresh: true },
  );
  await settle();
  assert.equal(await blob.text(), "new bytes");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].init, { cache: "reload" });
  assert.equal(await (await readStoredScene(key, "r1")).text(), "new bytes");
});

test("stored rooms stay within the limit, least recently opened first", async (t) => {
  const store = memoryStore();
  setSceneStore(store);
  t.after(() => setSceneStore(null));
  await storeScene("a", "1", new Blob(["aaaa"]), 10);
  await new Promise((resolve) => setTimeout(resolve, 2));
  await storeScene("b", "1", new Blob(["bbbb"]), 10);
  await new Promise((resolve) => setTimeout(resolve, 2));
  await readStoredScene("a", "1"); // opened again: now the newest
  await settle();
  assert.equal(await storeScene("c", "1", new Blob(["cccc"]), 10), true);
  assert.deepEqual([...store.map.keys()].sort(), ["a", "c"]);
  assert.equal(
    await storeScene("big", "1", new Blob(["x".repeat(11)]), 10),
    false,
  );
  assert.equal(await readStoredScene("a", "2"), null, "other revision");
});

test("a failing or missing store never breaks loading", async (t) => {
  setSceneStore({
    get: async () => {
      throw new Error("quota");
    },
    put: async () => {
      throw new Error("quota");
    },
    delete: async () => {},
    entries: async () => {
      throw new Error("quota");
    },
  });
  t.after(() => setSceneStore(null));
  const { calls, hass } = counting();
  const blob = await sceneBlob(hass(), { id: "x", sceneRevision: "1" });
  assert.equal(await blob.text(), "model bytes");
  assert.equal(calls.length, 1);
  setSceneStore(null);
  await sceneBlob(hass(), { id: "x", sceneRevision: "1" });
  assert.equal(calls.length, 2);
});

test("Blob entries from 0.43.0 and damaged copies are dropped and downloaded again", async (t) => {
  // Safari can return a stored Blob whose file is gone after a restart.
  const store = memoryStore();
  setSceneStore(store);
  t.after(() => setSceneStore(null));
  const key = storedSceneKey("u1", { id: "hall" }, "phone");
  store.map.set(key, { revision: "r1", blob: new Blob(["gone"]), size: 4 });
  assert.equal(await readStoredScene(key, "r1"), null);
  assert.equal(store.map.has(key), false);
  store.map.set(key, { revision: "r1", data: new ArrayBuffer(3), size: 9 });
  assert.equal(await readStoredScene(key, "r1"), null);
  const { calls, hass } = counting();
  await sceneBlob(hass(), { id: "hall", sceneRevision: "r1" }, "phone");
  await settle();
  assert.equal(calls.length, 1);
  const entry = store.map.get(key);
  assert.ok(entry.data instanceof ArrayBuffer);
  assert.equal(entry.size, 11);
  // Each read hands out a fresh in-memory Blob of the stored bytes.
  const blob = await sceneBlob(
    hass(),
    { id: "hall", sceneRevision: "r1" },
    "phone",
  );
  assert.equal(await blob.text(), "model bytes");
  assert.equal(calls.length, 1);
});

test("a stuck store is given up on and the room downloads", async (t) => {
  setSceneStore({
    get: () => new Promise(() => {}),
    put: () => new Promise(() => {}),
    delete: async () => {},
    entries: () => new Promise(() => {}),
  });
  t.after(() => setSceneStore(null));
  assert.equal(await readStoredScene("k", "1", 20), null);
});
