/** Fit the entire capture without distorting it, including older squeezed JPEGs. */
export function viewThumbnail(source, aspect = source.width / source.height) {
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error("Invalid thumbnail aspect ratio.");
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  context.fillStyle = "#25231f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const width = Math.min(canvas.width, canvas.height * aspect);
  const height = width / aspect;
  context.drawImage(
    source,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}
