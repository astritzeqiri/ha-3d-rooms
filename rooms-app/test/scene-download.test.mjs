import test from "node:test";
import assert from "node:assert/strict";
import { sceneBlob } from "../shared/scene-download.mjs";

test("cards and sidebar share one download per model revision and HA connection", async () => {
  const connection = {},
    calls = [];
  const hass = {
    connection,
    user: { is_admin: true },
    fetchWithAuth: async (path) => {
      calls.push(path);
      return new Response(new Blob(["model bytes"]));
    },
  };
  const model = { id: "kitchen", sceneRevision: "first" };
  const [a, b] = await Promise.all([
    sceneBlob(hass, model),
    sceneBlob({ ...hass }, model),
  ]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
  await sceneBlob(hass, { ...model, bindings: { ceiling: "light.changed" } });
  assert.equal(
    calls.length,
    1,
    "changing a mapping must not download the same scene",
  );
  await sceneBlob(hass, { ...model, sceneRevision: "second" });
  assert.equal(calls.length, 2);
  await sceneBlob({ ...hass, connection: {} }, model);
  assert.equal(
    calls.length,
    3,
    "another authenticated session gets its own cache",
  );
  await assert.rejects(
    sceneBlob({ ...hass, user: { is_admin: false } }, model),
    /Administrator/,
  );
});

test("failed scene requests can retry instead of poisoning the cache", async () => {
  let attempts = 0;
  const hass = {
    fetchWithAuth: async () =>
      ++attempts === 1
        ? new Response(null, { status: 500 })
        : new Response(new Blob(["scene"])),
  };
  const model = { id: "kitchen", importedAt: "original" };
  await assert.rejects(sceneBlob(hass, model), /download/);
  assert.equal((await sceneBlob(hass, model)).size, 5);
  assert.equal(attempts, 2);
});
