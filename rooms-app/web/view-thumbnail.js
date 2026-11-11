import { THUMBNAIL_LIMIT } from "../shared/thumbnail.mjs";
/** Fit the entire capture without distorting it, including older squeezed JPEGs. */
export function viewThumbnail(
  source,
  aspect = source.width / source.height,
  fill,
) {
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error("Invalid thumbnail aspect ratio.");
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  context.fillStyle = "#25231f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (fill) {
    const gradient =
      fill.shape === "linear"
        ? context.createLinearGradient(0, 0, 0, canvas.height)
        : context.createRadialGradient(
            canvas.width / 2,
            canvas.height * 0.46,
            0,
            canvas.width / 2,
            canvas.height * 0.46,
            canvas.width * 0.6,
          );
    gradient.addColorStop(0, fill.from);
    gradient.addColorStop(1, fill.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const width = Math.min(canvas.width, canvas.height * aspect);
  const height = width / aspect;
  context.drawImage(
    source,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  for (const quality of [0.75, 0.6, 0.45]) {
    const image = canvas.toDataURL("image/jpeg", quality);
    if (image.length <= THUMBNAIL_LIMIT) return image;
  }
  throw new Error("Preview image is too large.");
}

/**
 * The room alone on a transparent 640 by 400 WebP, so the gallery can draw the
 * view's current background behind it. Undefined if the browser cannot encode
 * WebP with transparency (it then returns PNG) or the picture is too large.
 */
export function viewThumbnailArt(
  source,
  aspect = source.width / source.height,
) {
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error("Invalid thumbnail aspect ratio.");
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const width = Math.min(canvas.width, canvas.height * aspect);
  const height = width / aspect;
  canvas
    .getContext("2d")
    .drawImage(
      source,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    );
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const image = canvas.toDataURL("image/webp", quality);
    if (!image.startsWith("data:image/webp;base64,")) return undefined;
    if (image.length <= THUMBNAIL_LIMIT) return image;
  }
  return undefined;
}
