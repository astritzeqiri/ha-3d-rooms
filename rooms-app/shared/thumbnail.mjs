/** Bounded JPEG-only previews. Never accept HTML, SVG or external URLs. */
export const THUMBNAIL_LIMIT = 140000;
export function validateThumbnail(value) {
  if (
    typeof value !== "string" ||
    value.length > THUMBNAIL_LIMIT ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw new Error("Choose a JPEG preview under 100 KB.");
  let bytes;
  try {
    bytes = atob(value.slice(23));
  } catch {
    throw new Error("Invalid JPEG preview.");
  }
  const byte = (i) => bytes.charCodeAt(i);
  const word = (i) => byte(i) * 256 + byte(i + 1);
  if (word(0) !== 0xffd8 || word(bytes.length - 2) !== 0xffd9)
    throw new Error("Invalid JPEG preview.");
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (byte(offset) !== 255) break;
    const marker = byte(offset + 1),
      size = word(offset + 2);
    if (size < 2 || offset + 2 + size > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (word(offset + 5) === 400 && word(offset + 7) === 640) return value;
      break;
    }
    if (marker === 0xda) break;
    offset += 2 + size;
  }
  throw new Error("Preview must be a 640 by 400 JPEG.");
}
