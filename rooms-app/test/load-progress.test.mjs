import test from "node:test";
import assert from "node:assert/strict";
import { loadProgress } from "../shared/load-progress.mjs";
import { sceneBlob } from "../shared/scene-download.mjs";
import { shortRoomTitle, deviceLabel } from "../shared/workspace.mjs";

test("one room shows a percentage when its size is known", () => {
  assert.deepEqual(
    loadProgress({ index: 0, count: 1, loaded: 50, total: 200 }),
    { value: 0.25, text: "Downloading your room… 25%" },
  );
});

test("one room of unknown size shows megabytes and no bar position", () => {
  assert.deepEqual(loadProgress({ loaded: 3 * 1024 * 1024 }), {
    value: undefined,
    text: "Downloading your room… · 3.0 MB",
  });
  assert.equal(loadProgress(undefined).text, "Downloading your room…");
});

test("a house counts its rooms", () => {
  const second = loadProgress({ index: 1, count: 4, loaded: 5, total: 10 });
  assert.equal(second.text, "Downloading room 2 of 4…");
  assert.equal(second.value, 0.375);
  assert.equal(loadProgress({ index: 3, count: 4, loaded: 0 }).value, 0.75);
});

test("a download reports its bytes to every card waiting for it", async () => {
  const chunks = [new Uint8Array(4), new Uint8Array(6)];
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const hass = {
    connection: {},
    fetchWithAuth: async () => ({
      ok: true,
      headers: new Map([["content-length", "10"]]),
      body: {
        getReader: () => ({
          async read() {
            if (chunks.length === 1) await gate;
            const value = chunks.shift();
            return value ? { done: false, value } : { done: true };
          },
        }),
      },
    }),
  };
  const first = [],
    second = [];
  const model = { id: "kitchen", sceneRevision: "1" };
  const a = sceneBlob(hass, model, "full", (p) => first.push(p.loaded));
  await new Promise((resolve) => setTimeout(resolve));
  const b = sceneBlob(hass, model, "full", (p) => second.push(p.loaded));
  release();
  const [blob, same] = await Promise.all([a, b]);
  assert.equal(blob, same);
  assert.equal(blob.size, 10);
  assert.deepEqual(first, [0, 4, 10]);
  // A late listener starts from where the download already is.
  assert.deepEqual(second, [4, 10]);
});

test("compressed transfers report no total", async () => {
  const seen = [];
  const hass = {
    connection: {},
    fetchWithAuth: async () => ({
      ok: true,
      headers: new Map([
        ["content-length", "3"],
        ["content-encoding", "gzip"],
      ]),
      body: {
        getReader: () => {
          let sent = false;
          return {
            async read() {
              if (sent) return { done: true };
              sent = true;
              return { done: false, value: new Uint8Array(9) };
            },
          };
        },
      },
    }),
  };
  await sceneBlob(hass, { id: "z", sceneRevision: "1" }, "full", (p) =>
    seen.push(p.total),
  );
  assert.deepEqual(seen, [undefined, undefined]);
});

test("scan suffixes are dropped from room names and device labels", () => {
  assert.equal(shortRoomTitle("Corridor · November scan"), "Corridor");
  assert.equal(shortRoomTitle("Office · your scan · edited"), "Office");
  assert.equal(shortRoomTitle("Scan room"), "Scan room");
  assert.equal(
    shortRoomTitle("Garden · scanned shed"),
    "Garden · scanned shed",
  );
  assert.equal(
    deviceLabel({
      label: "Hallway · your scan · Entrance light",
      roomTitle: "Hallway · your scan",
    }),
    "Hallway · Entrance light",
  );
  assert.equal(deviceLabel({ label: "Desk lamp" }), "Desk lamp");
  assert.equal(deviceLabel({}, "light"), "light");
});
