import test from "node:test";
import assert from "node:assert/strict";
import { chunkFor, createHaMdi } from "../shared/ha-mdi.mjs";

const metadata = {
  version: "7.4.47",
  parts: [
    { file: "first" },
    { start: "door", file: "second" },
    { start: "lamp", file: "third" },
  ],
};

test("finds the chunk the way Home Assistant does", () => {
  assert.equal(chunkFor(metadata, "account"), "first");
  assert.equal(chunkFor(metadata, "door"), "second");
  assert.equal(chunkFor(metadata, "door-open"), "second");
  assert.equal(chunkFor(metadata, "lamp"), "third");
  assert.equal(chunkFor(metadata, "zzz"), "third");
  assert.equal(chunkFor({}, "door"), undefined);
});

test("loads metadata and each chunk once, from HA's static folder", async () => {
  const asked = [];
  const files = {
    "/static/mdi/iconMetadata.json": metadata,
    "/static/mdi/second.json": { "door-open": "M1 1z", door: "M2 2z" },
    "/static/mdi/iconList.json": [{ name: "door", keywords: ["entry"] }],
  };
  const mdi = createHaMdi({
    load: async (url) => {
      asked.push(url);
      if (!(url in files)) throw new Error("404");
      return files[url];
    },
  });
  assert.equal(await mdi.path("mdi:door-open"), "M1 1z");
  assert.equal(await mdi.path("door"), "M2 2z");
  assert.equal(await mdi.path("mdi:door-missing"), undefined);
  assert.deepEqual(asked, [
    "/static/mdi/iconMetadata.json",
    "/static/mdi/second.json",
  ]);
  await assert.rejects(mdi.path("mdi:lamp"));
  assert.deepEqual((await mdi.list())[0].name, "door");
  await mdi.list();
  assert.equal(asked.filter((u) => u.endsWith("iconList.json")).length, 1);
});

test("a failed metadata load is retried next time", async () => {
  let fail = true;
  const mdi = createHaMdi({
    load: async (url) => {
      if (fail) throw new Error("restarting");
      return url.endsWith("iconMetadata.json")
        ? metadata
        : { account: "M3 3z" };
    },
  });
  await assert.rejects(mdi.path("mdi:account"));
  fail = false;
  assert.equal(await mdi.path("mdi:account"), "M3 3z");
});
