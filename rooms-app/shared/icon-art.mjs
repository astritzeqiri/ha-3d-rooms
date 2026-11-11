/** Icon art from a Home Assistant icon set, accepted only as plain SVG path data. */
const SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const SAFE_VIEWBOX = /^-?[\d.]+(?:[\s,]+-?[\d.]+){3}$/;
export const MDI_VIEWBOX = "0 0 24 24";

/** Icon art as `{ viewBox, html }`, or undefined if a set returned anything but plain path data. */
export function iconArt({ path, secondaryPath, viewBox } = {}) {
  if (typeof path !== "string" || !SAFE_PATH.test(path)) return undefined;
  const box =
    typeof viewBox === "string" && SAFE_VIEWBOX.test(viewBox.trim())
      ? viewBox.trim()
      : MDI_VIEWBOX;
  const second =
    typeof secondaryPath === "string" && SAFE_PATH.test(secondaryPath)
      ? `<path d="${secondaryPath}" opacity="0.5"/>`
      : "";
  return { viewBox: box, html: `${second}<path d="${path}"/>` };
}
