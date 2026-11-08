import test from "node:test";
import assert from "node:assert/strict";
import { WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { optimizeScene, VARIANT_EDGES } from "../shared/optimize-scene.mjs";
import { EXTMaterialsBump } from "../shared/ext-materials-bump.mjs";
import { sceneVariant } from "../shared/render-profile.mjs";
import { sceneAssetKey } from "../shared/scene-assets.mjs";
import { sceneBlob } from "../shared/scene-download.mjs";
import { uploadNativeModel } from "../shared/upload.mjs";
import { textureSize } from "../web/room-optimizer.js";
import { describeOptimization } from "../web/optimize-panel.js";

// 1×1 PNG; the optimizer hands image bytes to an injected encoder.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

/** A room-like GLB: a hinged door root with a moving child, a lamp leaf, bump maps. */
function glb({ extensionsUsed = [] } = {}) {
  const positions = new Float32Array([
    0.123456, 0, 0, 1, 0, 0, 0, 1.987654, 0, 1, 1, 0,
  ]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
  const parts = [positions, normals, uvs, indices, PNG];
  const views = [];
  let length = 0;
  for (const part of parts) {
    length += -length & 3;
    views.push({ buffer: 0, byteOffset: length, byteLength: part.byteLength });
    length += part.byteLength;
  }
  const bin = new Uint8Array(length + (-length & 3));
  parts.forEach((part, i) =>
    bin.set(
      new Uint8Array(part.buffer, part.byteOffset, part.byteLength),
      views[i].byteOffset,
    ),
  );
  const primitive = {
    attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
    indices: 3,
    material: 0,
  };
  const json = {
    asset: { version: "2.0" },
    extensionsUsed: ["EXT_materials_bump", ...extensionsUsed],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: views,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1.987654, 0],
      },
      { bufferView: 1, componentType: 5126, count: 4, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 6, type: "SCALAR" },
    ],
    images: [{ bufferView: 4, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    materials: [
      {
        pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
        extensions: {
          EXT_materials_bump: { bumpFactor: 0.4, bumpTexture: { index: 0 } },
        },
      },
    ],
    meshes: [{ primitives: [primitive] }, { primitives: [primitive] }],
    nodes: [
      {
        name: "Door",
        translation: [2, 0, 1],
        extras: {
          controlId: "door",
          hingedDoor: {
            axis: "y",
            closedAngle: 0,
            openAngle: 1.5,
            defaultPosition: 0,
          },
        },
        children: [1],
      },
      { name: "Door leaf", mesh: 0, translation: [0.5, 0, 0] },
      {
        name: "Lamp",
        mesh: 1,
        translation: [1, 2.4, 3],
        scale: [2, 2, 2],
        extras: { controlId: "lamp" },
      },
    ],
    scenes: [{ nodes: [0, 2] }],
  };
  return encode(json, bin);
}
function encode(json, bin) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = text.byteLength + (-text.byteLength & 3);
  const out = new Uint8Array(12 + 8 + jsonLength + 8 + bin.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  view.setUint32(20 + jsonLength, bin.byteLength, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  out.set(bin, 28 + jsonLength);
  return out;
}
function readJSON(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))),
  );
}

test("optimized copies keep room metadata, node transforms, positions and bump maps", async () => {
  const calls = [];
  const source = glb();
  const output = await optimizeScene(source, {
    maxEdge: VARIANT_EDGES.phone,
    encodeTexture: async (image, options) => {
      calls.push(options);
      return { image, mimeType: "image/png" };
    },
  });
  const json = readJSON(output);
  assert.ok(json.extensionsRequired.includes("EXT_meshopt_compression"));
  assert.ok(json.extensionsRequired.includes("KHR_mesh_quantization"));
  assert.deepEqual(
    json.materials[0].extensions.EXT_materials_bump.bumpFactor,
    0.4,
  );
  assert.ok(json.materials[0].extensions.EXT_materials_bump.bumpTexture);
  // One shared texture feeds colour and bump: it is treated as colour (sRGB).
  assert.deepEqual(calls, [
    { maxEdge: 512, linear: false, normal: false, mimeType: "image/png" },
  ]);
  const byName = Object.fromEntries(json.nodes.map((n) => [n.name, n]));
  assert.deepEqual(byName.Door.translation, [2, 0, 1]);
  assert.deepEqual(byName.Door.extras.hingedDoor.openAngle, 1.5);
  assert.deepEqual(byName.Lamp.translation, [1, 2.4, 3]);
  assert.deepEqual(byName.Lamp.scale, [2, 2, 2]);
  assert.equal(byName.Lamp.extras.controlId, "lamp");

  await MeshoptDecoder.ready;
  const io = new WebIO()
    .registerExtensions([...ALL_EXTENSIONS, EXTMaterialsBump])
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const decoded = await io.readBinary(output);
  const lamp = decoded
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === "Lamp");
  const position = lamp.getMesh().listPrimitives()[0].getAttribute("POSITION");
  // Positions are never quantized, so exact values survive.
  assert.equal(position.getComponentType(), 5126);
  assert.deepEqual(
    Array.from(position.getArray())
      .map((v) => Math.round(v * 1e6) / 1e6)
      .sort(),
    [0, 0, 0, 0, 0, 0, 0, 0.123456, 1, 1, 1, 1.987654].sort(),
  );
});

test("unknown extensions are refused instead of being dropped", async () => {
  await assert.rejects(
    optimizeScene(glb({ extensionsUsed: ["VENDOR_magic"] }), {
      maxEdge: 512,
      encodeTexture: async () => null,
    }),
    /VENDOR_magic/,
  );
});

test("textures fit the variant and use multiple-of-four sides for GPU formats", () => {
  assert.deepEqual(textureSize(1600, 800, 512), [512, 256]);
  assert.deepEqual(textureSize(462, 585, 512), [404, 512]);
  assert.deepEqual(textureSize(2, 3, 512), [4, 4]);
  assert.deepEqual(textureSize(36, 65, 2048), [36, 64]);
});

test("phones request the phone copy unless high quality is chosen", () => {
  const phone = {
    devicePixelRatio: 3,
    navigator: {},
    matchMedia: (q) => ({ matches: q === "(pointer: coarse)" }),
  };
  const desktop = {
    devicePixelRatio: 2,
    navigator: {},
    matchMedia: () => ({ matches: false }),
  };
  assert.equal(sceneVariant("auto", phone), "phone");
  assert.equal(sceneVariant("high", phone), "full");
  assert.equal(sceneVariant("auto", desktop), "full");
  assert.equal(sceneVariant("low", desktop), "phone");
  assert.notEqual(
    sceneAssetKey({ id: "a", sceneRevision: "r" }, "phone"),
    sceneAssetKey({ id: "a", sceneRevision: "r" }, "full"),
  );
});

test("variant downloads are cached separately and name the variant", async () => {
  const paths = [];
  const hass = {
    connection: {},
    fetchWithAuth: async (path) => {
      paths.push(path);
      return { ok: true, blob: async () => new Blob([path]) };
    },
  };
  const model = { id: "kitchen", sceneRevision: "abc" };
  await sceneBlob(hass, model, "phone");
  await sceneBlob(hass, model, "full");
  await sceneBlob(hass, model, "phone");
  assert.deepEqual(paths, [
    "/api/three_d_rooms/models/kitchen/scene.glb?v=abc&variant=phone",
    "/api/three_d_rooms/models/kitchen/scene.glb?v=abc&variant=full",
  ]);
});

test("optimized uploads need their source revision and send glTF, not ZIP", async () => {
  const hass = { auth: { expired: false, accessToken: "test-value" } };
  await assert.rejects(
    uploadNativeModel(hass, "/api/three_d_rooms/models/k/optimized/tiny", {
      method: "PUT",
    }),
    /Unknown/,
  );
  await assert.rejects(
    uploadNativeModel(hass, "/api/three_d_rooms/models/k/optimized/phone", {
      method: "PUT",
      headers: {},
    }),
    /name the upload/,
  );
  const xhr = {
    upload: {},
    headers: {},
    open(method, url) {
      Object.assign(this, { method, url });
    },
    setRequestHeader(key, value) {
      this.headers[key] = value;
    },
    send() {},
  };
  const result = uploadNativeModel(
    hass,
    "/api/three_d_rooms/models/k/optimized/phone",
    {
      method: "PUT",
      file: new Blob(["glb"]),
      headers: { "X-Rooms-Source-Revision": "a".repeat(24) },
      createXHR: () => xhr,
    },
  );
  await Promise.resolve();
  assert.equal(xhr.headers["Content-Type"], "model/gltf-binary");
  assert.equal(xhr.headers["X-Rooms-Source-Revision"], "a".repeat(24));
  xhr.status = 200;
  xhr.responseText = '{"variant":"phone"}';
  xhr.onload();
  assert.equal((await result).variant, "phone");
});

test("the settings card explains what is optimized", () => {
  const status = (full, phone) => ({
    original: 20 * 1024 * 1024,
    variants: {
      full: { kind: full, bytes: 5 * 1024 * 1024 },
      phone: { kind: phone, bytes: 2 * 1024 * 1024 },
    },
  });
  assert.match(
    describeOptimization(status("web", "web")).text,
    /Fully optimized.*Upload 20\.0 MB · desktop 5\.0 MB · phone 2\.0 MB/,
  );
  assert.equal(describeOptimization(status("web", "web")).done, true);
  assert.match(
    describeOptimization(status("server", "server")).text,
    /Textures are optimized/,
  );
  assert.match(
    describeOptimization(status("none", "server")).text,
    /preparing/,
  );
});

test("cache budgets count GPU-compressed textures at their compressed size", async () => {
  const THREE = await import("three");
  const { sceneBytes } = await import("../shared/scene-assets.mjs");
  const plain = new THREE.Texture({ width: 1024, height: 1024 });
  const compressed = new THREE.CompressedTexture(
    [{ data: new Uint8Array(524288), width: 1024, height: 1024 }],
    1024,
    1024,
  );
  const scene = (texture) => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(
        undefined,
        new THREE.MeshStandardMaterial({ map: texture }),
      ),
    );
    return group;
  };
  assert.ok(sceneBytes(scene(plain)) > 5_000_000);
  assert.equal(sceneBytes(scene(compressed)), 524288);
});

test("data textures (roughness, normals) are encoded as linear, not sRGB colour", async () => {
  const { Document, WebIO } = await import("@gltf-transform/core");
  const doc = new Document();
  const buffer = doc.createBuffer();
  // Distinct bytes so deduplication keeps three textures.
  const image = (n) => Uint8Array.from([...PNG, n]);
  const rough = doc
    .createTexture("rough")
    .setImage(image(1))
    .setMimeType("image/png");
  const normal = doc
    .createTexture("normal")
    .setImage(image(2))
    .setMimeType("image/png");
  const color = doc
    .createTexture("color")
    .setImage(image(3))
    .setMimeType("image/png");
  const material = doc
    .createMaterial()
    .setMetallicRoughnessTexture(rough)
    .setNormalTexture(normal)
    .setBaseColorTexture(color);
  const position = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const uv = doc
    .createAccessor()
    .setType("VEC2")
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("TEXCOORD_0", uv)
    .setMaterial(material);
  const node = doc
    .createNode("Wall")
    .setMesh(doc.createMesh().addPrimitive(prim));
  doc.createScene().addChild(node);
  const bytes = await new WebIO().writeBinary(doc);
  const calls = [];
  await optimizeScene(bytes, {
    maxEdge: 512,
    encodeTexture: async (data, options) => {
      calls.push([data.at(-1), options.linear, options.normal]);
      return null;
    },
  });
  assert.deepEqual(
    calls.sort((a, b) => a[0] - b[0]),
    [
      [1, true, false],
      [2, true, true],
      [3, false, false],
    ],
  );
});
