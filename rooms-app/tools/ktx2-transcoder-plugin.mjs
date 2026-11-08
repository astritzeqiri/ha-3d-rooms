/**
 * three's KTX2Loader points at its own transcoder via `new URL(..., import.meta.url)`,
 * which library mode inlines as base64 (~700 kB in the card). Rooms always set the
 * transcoder path to the copy in frontend/basis/, so drop those default URLs.
 */
export function ktx2TranscoderPath() {
  return {
    name: "three-d-rooms-ktx2-transcoder-path",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("/loaders/KTX2Loader.js"))
        return null;
      const next = code.replace(
        /new URL\(\s*'\.\.\/libs\/basis\/basis_transcoder\.(wasm|js)',\s*import\.meta\.url\s*\)\.toString\(\)/g,
        "''",
      );
      if (next === code)
        throw new Error(
          "KTX2Loader changed: review the transcoder path plugin.",
        );
      return { code: next, map: null };
    },
  };
}
