import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// CPU-only templates, scoped to the authenticated HA connection. Never render or
// mutate a template: each viewer owns and disposes its own geometry/materials.
const sessions = new WeakMap();
export function clearSceneAssets(owner) {
  sessions.delete(owner);
}
export function sceneAssetKey(model, variant = "original") {
  return `${model.id}:${model.sceneRevision || model.importedAt || "legacy"}:${variant}`;
}
/* The bundled Basis transcoder ships beside the card (frontend/basis/). Each build
 * defines where that folder is relative to its own module. */
const BASIS_PATH =
  typeof __THREE_D_ROOMS_BASIS__ === "string"
    ? __THREE_D_ROOMS_BASIS__
    : "./basis/";
let ktx2;
/** Decoders for optimized copies: meshopt geometry and KTX2 (GPU-compressed) textures. */
export function sceneLoader(renderer) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (renderer?.extensions && !ktx2) {
    const candidate = new KTX2Loader().setTranscoderPath(
      new URL(BASIS_PATH, import.meta.url).href,
    );
    try {
      // Formats depend on the GPU, not the canvas; one detection serves every viewer.
      candidate.detectSupport(renderer);
      ktx2 = candidate;
    } catch {
      // Without detection only KTX2 rooms fail to load; others are unaffected.
    }
  }
  if (ktx2) loader.setKTX2Loader(ktx2);
  return loader;
}
export function cloneScene(scene) {
  const result = clone(scene),
    resources = new Map();
  const copy = (value) => {
    if (!resources.has(value)) resources.set(value, value.clone());
    return resources.get(value);
  };
  result.traverse((object) => {
    if (object.geometry) object.geometry = copy(object.geometry);
    const material = (source) => {
      const target = copy(source);
      for (const [key, value] of Object.entries(source))
        if (value?.isTexture) target[key] = copy(value);
      return target;
    };
    if (object.material)
      object.material = Array.isArray(object.material)
        ? object.material.map(material)
        : material(object.material);
  });
  return result;
}
export function sceneBytes(scene) {
  const seen = new Set();
  let bytes = 0;
  const count = (resource, size) => {
    if (resource && !seen.has(resource)) {
      seen.add(resource);
      bytes += size;
    }
  };
  scene.traverse((object) => {
    const geometry = object.geometry;
    for (const attr of [
      geometry?.index,
      ...Object.values(geometry?.attributes || {}),
      ...Object.values(geometry?.morphAttributes || {}).flat(),
    ]) {
      const array = attr?.array || attr?.data?.array;
      if (array) count(array.buffer, array.buffer.byteLength);
    }
    for (const mat of Array.isArray(object.material)
      ? object.material
      : [object.material])
      for (const texture of Object.values(mat || {}))
        if (texture?.isTexture) {
          const image = texture.image;
          // GPU-compressed (KTX2) textures keep their compressed size in memory.
          if (texture.isCompressedTexture)
            count(
              image,
              (texture.mipmaps || []).reduce(
                (sum, level) => sum + (level.data?.byteLength || 0),
                0,
              ),
            );
          else
            count(
              image,
              ((image?.width || 0) * (image?.height || 0) * 4 * 4) / 3,
            );
        }
  });
  return bytes;
}
export class SceneAssetCache {
  constructor({
    maxBytes = 256 * 1024 * 1024,
    maxEntries = 8,
    maxAge = 10 * 60 * 1000,
    now = Date.now,
  } = {}) {
    Object.assign(this, { maxBytes, maxEntries, maxAge, now });
    this.entries = new Map();
  }
  async load(key, loader) {
    const now = this.now();
    for (const [id, entry] of this.entries)
      if (entry.expires <= now) this.entries.delete(id);
    let entry = this.entries.get(key);
    const hit = !!entry;
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      entry.expires = now + this.maxAge;
    } else {
      entry = { bytes: 0, expires: now + this.maxAge };
      entry.promise = Promise.resolve()
        .then(loader)
        .then((scene) => {
          entry.bytes = sceneBytes(scene);
          if (entry.bytes > this.maxBytes) {
            if (this.entries.get(key) === entry) this.entries.delete(key);
            return scene;
          }
          let bytes = [...this.entries.values()].reduce(
            (sum, item) => sum + item.bytes,
            0,
          );
          for (const [id, item] of this.entries) {
            if (bytes <= this.maxBytes && this.entries.size <= this.maxEntries)
              break;
            this.entries.delete(id);
            bytes -= item.bytes;
          }
          return scene;
        })
        .catch((error) => {
          if (this.entries.get(key) === entry) this.entries.delete(key);
          throw error;
        });
      this.entries.set(key, entry);
    }
    const scene = await entry.promise;
    return { scene: cloneScene(scene), hit, bytes: entry.bytes };
  }
}
export async function loadSceneAsset(url, context, renderer) {
  const loader = async () => (await sceneLoader(renderer).loadAsync(url)).scene;
  if (!context) return { scene: await loader(), hit: false };
  let cache = sessions.get(context.owner);
  if (!cache) sessions.set(context.owner, (cache = new SceneAssetCache()));
  return cache.load(context.key, loader);
}
