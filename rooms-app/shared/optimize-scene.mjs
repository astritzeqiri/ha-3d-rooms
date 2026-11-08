import { Logger, WebIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  KHRMeshQuantization,
  KHRTextureBasisu,
} from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  reorder,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { EXTMaterialsBump } from "./ext-materials-bump.mjs";

/** Longest texture edge per served variant (matches the server's copies). */
export const VARIANT_EDGES = { full: 2048, phone: 512 };
/** Texture slots holding data rather than colour: linear, and normals encoded as such. */
const LINEAR_SLOTS =
  /^(normal|occlusion|metallicRoughness|bump|clearcoat(Roughness|Normal)?|sheenRoughness|transmission|thickness|specular)Texture$/;

const EXTENSIONS = [...ALL_EXTENSIONS, EXTMaterialsBump];

function io() {
  return new WebIO().registerExtensions(EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
}

/** Node names and extras: what rooms, controls, doors and windows depend on. */
export function nodeMetadata(document) {
  return document
    .getRoot()
    .listNodes()
    .filter((node) => Object.keys(node.getExtras()).length)
    .map((node) => JSON.stringify([node.getName(), sortKeys(node.getExtras())]))
    .sort();
}
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
}
function nodeTransforms(document) {
  return document
    .getRoot()
    .listNodes()
    .filter((node) => Object.keys(node.getExtras()).length)
    .map((node) =>
      JSON.stringify([
        node.getName(),
        node.getTranslation(),
        node.getRotation(),
        node.getScale(),
      ]),
    )
    .sort();
}

/** Extensions this pipeline cannot round-trip; such scenes keep the server copy. */
export function unsupportedExtensions(json) {
  const known = new Set(EXTENSIONS.map((e) => e.EXTENSION_NAME));
  return (json.extensionsUsed || []).filter((name) => !known.has(name));
}

function textureSlots(texture) {
  // The document root also "parents" every texture; only material slots count.
  return texture
    .listParents()
    .filter((parent) => parent.propertyType !== "Root")
    .flatMap((parent) =>
      parent
        .getGraph()
        .listParentEdges(texture)
        .filter((edge) => edge.getParent() === parent)
        .map((edge) => edge.getName()),
    );
}

/**
 * Make a lighter copy of an uploaded scene: shared resources, welded and
 * compressed geometry (EXT_meshopt_compression), and textures capped at
 * `maxEdge` and re-encoded by `encodeTexture` (KTX2 in the browser).
 *
 * Positions are never quantized: quantization moves offsets into node
 * transforms, and room controls animate and identify those very nodes.
 */
export async function optimizeScene(
  bytes,
  { maxEdge, encodeTexture, onProgress = () => {} },
) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const reader = io();
  const json = await reader.binaryToJSON(new Uint8Array(bytes));
  const unknown = unsupportedExtensions(json.json);
  if (unknown.length)
    throw new Error(
      `This room uses ${unknown.join(", ")}, which the optimizer cannot keep. It still loads from the server copy.`,
    );
  const document = await reader.readJSON(json);
  document.setLogger(new Logger(Logger.Verbosity.ERROR));
  const metadata = nodeMetadata(document),
    transforms = nodeTransforms(document);
  await document.transform(
    dedup(),
    prune({
      keepLeaves: true,
      keepAttributes: true,
      keepExtras: true,
      keepIndices: true,
      keepSolidTextures: true,
    }),
    weld(),
    reorder({ encoder: MeshoptEncoder, target: "size" }),
    quantize({
      pattern: /^(NORMAL|TEXCOORD_\d+)$/,
      patternTargets: /^(NORMAL|TEXCOORD_\d+)$/,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
  );
  const textures = document.getRoot().listTextures();
  let encoded = 0;
  for (const [index, texture] of textures.entries()) {
    onProgress(index / textures.length);
    const image = texture.getImage();
    if (!image || texture.getMimeType() === "image/ktx2") continue;
    const slots = textureSlots(texture);
    const result = await encodeTexture(image, {
      maxEdge,
      linear:
        slots.length > 0 && slots.every((slot) => LINEAR_SLOTS.test(slot)),
      normal: slots.some((slot) => /normalTexture$/.test(slot)),
      mimeType: texture.getMimeType(),
    });
    if (!result) continue;
    texture.setImage(result.image).setMimeType(result.mimeType);
    if (result.mimeType === "image/ktx2") encoded++;
  }
  if (encoded) document.createExtension(KHRTextureBasisu).setRequired(true);
  // Normals and UVs above are stored as normalized integers.
  document.createExtension(KHRMeshQuantization).setRequired(true);
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.FILTER,
    });
  if (
    JSON.stringify(nodeMetadata(document)) !== JSON.stringify(metadata) ||
    JSON.stringify(nodeTransforms(document)) !== JSON.stringify(transforms)
  )
    throw new Error("Optimizing would change room or device nodes.");
  onProgress(1);
  return reader.writeBinary(document);
}
