import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  SceneAssetCache,
  sceneAssetKey,
  sceneBytes,
} from "../shared/scene-assets.mjs";
function room() {
  const scene = new THREE.Group();
  const map = new THREE.Texture({ width: 16, height: 16 });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ map }),
  );
  mesh.userData.controlId = "lamp";
  scene.add(mesh);
  return scene;
}
test("revisits and concurrent viewers decode once but own mutable resources", async () => {
  const cache = new SceneAssetCache(),
    template = room();
  let calls = 0;
  const loader = async () => {
    calls++;
    return template;
  };
  const [first, second] = await Promise.all([
    cache.load("room:v1", loader),
    cache.load("room:v1", loader),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.hit, false);
  assert.equal(second.hit, true);
  const a = first.scene.children[0],
    b = second.scene.children[0],
    source = template.children[0];
  assert.notEqual(a.geometry, b.geometry);
  assert.notEqual(a.material, b.material);
  assert.notEqual(a.material.map, b.material.map);
  a.material.color.set("red");
  a.userData.controlId = "house-lamp";
  a.position.x = 10;
  a.geometry.dispose();
  a.material.map.dispose();
  a.material.dispose();
  assert.equal(b.userData.controlId, "lamp");
  assert.equal(b.position.x, 0);
  assert.equal(b.material.color.getHex(), source.material.color.getHex());
  assert.equal((await cache.load("room:v1", loader)).hit, true);
});
test("revision, failure, expiry and LRU memory limits do not serve stale scenes", async () => {
  let now = 0,
    calls = 0;
  const source = room(),
    cost = sceneBytes(source);
  const cache = new SceneAssetCache({
    maxBytes: cost * 1.5,
    maxAge: 100,
    now: () => now,
  });
  const loader = async () => {
    calls++;
    return source;
  };
  const model = { id: "room", sceneRevision: "one" };
  await cache.load(sceneAssetKey(model), loader);
  await cache.load(sceneAssetKey({ ...model, sceneRevision: "two" }), loader);
  assert.equal(cache.entries.size, 1);
  assert.equal((await cache.load(sceneAssetKey(model), loader)).hit, false);
  now = 101;
  assert.equal((await cache.load(sceneAssetKey(model), loader)).hit, false);
  await assert.rejects(
    cache.load("bad", async () => {
      throw new Error("retry");
    }),
    /retry/,
  );
  assert.equal((await cache.load("bad", loader)).hit, false);
  assert.equal(calls, 5);
});
test("oversized models render without staying in the decoded cache", async () => {
  const cache = new SceneAssetCache({ maxBytes: 1 });
  assert.ok((await cache.load("large", async () => room())).scene);
  assert.equal(cache.entries.size, 0);
});

test("authenticated sessions and manual refresh have independent decoded caches", async () => {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { loadSceneAsset, clearSceneAssets } =
    await import("../shared/scene-assets.mjs");
  const original = GLTFLoader.prototype.loadAsync;
  let calls = 0;
  GLTFLoader.prototype.loadAsync = async () => {
    calls++;
    return { scene: room() };
  };
  try {
    const a = { owner: {}, key: "room:v1" },
      b = { owner: {}, key: "room:v1" };
    await loadSceneAsset("blob:first", a);
    assert.equal((await loadSceneAsset("blob:second", a)).hit, true);
    assert.equal((await loadSceneAsset("blob:other-session", b)).hit, false);
    clearSceneAssets(a.owner);
    assert.equal((await loadSceneAsset("blob:refresh", a)).hit, false);
    assert.equal((await loadSceneAsset("blob:other-retained", b)).hit, true);
    assert.equal(calls, 3);
  } finally {
    GLTFLoader.prototype.loadAsync = original;
  }
});

test("an oversized scene does not flush useful smaller models", async () => {
  const small = room(),
    large = room();
  large.children[0].material.map.image = { width: 4096, height: 4096 };
  const cache = new SceneAssetCache({ maxBytes: sceneBytes(small) * 2 });
  await cache.load("small", async () => small);
  await cache.load("large", async () => large);
  assert.equal((await cache.load("small", async () => small)).hit, true);
  assert.equal(cache.entries.size, 1);
});
