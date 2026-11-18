import test from "node:test";
import assert from "node:assert/strict";
import {
  deviceCameraKey,
  readDeviceCamera,
  writeDeviceCamera,
} from "../shared/device-camera.mjs";

const camera = {
  projection: "perspective",
  position: [4, 5, 6],
  target: [0, 1, 0],
  up: [0, 1, 0],
  aspect: 0.5,
  zoom: 1.2,
  referenceZoom: 1,
  heading: 30,
  tilt: 40,
  fov: 45,
};
const memory = () => {
  const store = new Map();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
};

test("framings are kept per card, view, 3D or plan, and screen shape", () => {
  const key = (o) => deviceCameraKey({ card: "v1", view: "h-home", ...o });
  assert.equal(
    key({ aspect: 0.46 }),
    "three-d-rooms:device-camera:v1:h-home:3d:portrait",
  );
  assert.equal(
    key({ aspect: 1.6, plan: true }),
    "three-d-rooms:device-camera:v1:h-home:plan:landscape",
  );
  assert.notEqual(key({ view: "h-home:floor-1" }), key({}));
  assert.equal(deviceCameraKey({ view: "x" }), null);
});

test("a saved framing reads back; forgetting and broken data read as none", () => {
  const storage = memory(),
    key = deviceCameraKey({ card: "v1", view: "room", aspect: 0.5 });
  assert.equal(readDeviceCamera(storage, key), undefined);
  assert.equal(writeDeviceCamera(storage, key, camera), true);
  assert.deepEqual(readDeviceCamera(storage, key), camera);
  storage.setItem(key, "{not json");
  assert.equal(readDeviceCamera(storage, key), undefined);
  storage.setItem(key, JSON.stringify({ ...camera, zoom: -1 }));
  assert.equal(readDeviceCamera(storage, key), undefined);
  assert.equal(writeDeviceCamera(storage, key, undefined), true);
  assert.equal(storage.store.has(key), false);
});

test("blocked storage never throws", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const key = deviceCameraKey({ card: "v", view: "r" });
  assert.equal(readDeviceCamera(blocked, key), undefined);
  assert.equal(writeDeviceCamera(blocked, key, camera), false);
  assert.equal(writeDeviceCamera(undefined, key, camera), false);
});
