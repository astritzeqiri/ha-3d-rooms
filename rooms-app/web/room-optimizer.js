/**
 * Browser step of room optimization (loaded only when the manager optimizes):
 * compressed geometry plus KTX2 textures that stay compressed on the GPU.
 * The upload is never changed; the server keeps serving it for export.
 */
import { encodeToKTX2 } from "ktx2-encoder";
import { optimizeScene, VARIANT_EDGES } from "../shared/optimize-scene.mjs";

/** Fit within maxEdge; compressed GPU formats need sides in multiples of four. */
export function textureSize(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const side = (value) => Math.max(4, Math.round((value * scale) / 4) * 4);
  return [side(width), side(height)];
}

async function pixels(image, mimeType, maxEdge) {
  const bitmap = await createImageBitmap(
    new Blob([image], { type: mimeType }),
    {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    },
  );
  try {
    const [width, height] = textureSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return { data: new Uint8Array(data.buffer), width, height };
  } finally {
    bitmap.close();
  }
}

/** KTX2: ETC1S for most textures, UASTC for normal maps (ETC1S blurs them). */
export async function encodeTexture(
  image,
  { maxEdge, linear, normal, mimeType },
) {
  const raster = await pixels(image, mimeType, maxEdge);
  const encoded = await encodeToKTX2(image, {
    imageDecoder: async () => raster,
    isUASTC: normal,
    isNormalMap: normal,
    needSupercompression: normal,
    isPerceptual: !linear,
    isSetKTX2SRGBTransferFunc: !linear,
    generateMipmap: true,
    qualityLevel: 160,
    compressionLevel: 2,
  });
  return { image: new Uint8Array(encoded), mimeType: "image/ktx2" };
}

/**
 * Optimize one room for both variants and upload the results.
 * `api` is the manager's native bridge (scene download and authenticated upload).
 */
export async function optimizeRoom(api, model, { onProgress = () => {} } = {}) {
  const status = await api.optimization(model.id);
  const source = await api.originalScene(model.id);
  const variants = Object.entries(VARIANT_EDGES);
  const results = {};
  for (const [index, [variant, maxEdge]] of variants.entries()) {
    const bytes = await optimizeScene(source, {
      maxEdge,
      encodeTexture,
      onProgress: (part) =>
        onProgress({
          variant,
          fraction: (index + part * 0.9) / variants.length,
        }),
    });
    onProgress({
      variant,
      fraction: (index + 0.9) / variants.length,
      uploading: true,
    });
    results[variant] = await api.uploadOptimized(
      model.id,
      variant,
      bytes,
      status.sourceRevision,
    );
  }
  onProgress({ fraction: 1 });
  return { original: status.original, results };
}
