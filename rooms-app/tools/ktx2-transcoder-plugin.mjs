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

/**
 * ktx2-encoder (and its Emscripten module) point at the uncompressed Basis
 * encoder by default, which would ship a 3.3 MB copy. The optimizer always
 * passes the gzip-compressed copy from tools/basis-encoder.mjs as `wasmUrl`,
 * and the module then receives the binary itself, so drop both defaults.
 */
const ENCODER_DEFAULTS = [
  [
    "/ktx2-encoder/dist/web/BrowserBasisEncoder.js",
    /new URL\(\s*"\.\.\/basis\/basis_encoder\.wasm",\s*import\.meta\.url\s*\)\.href/,
  ],
  [
    "/ktx2-encoder/dist/basis/basis_encoder.js",
    /new URL\("basis_encoder\.wasm",import\.meta\.url\)\.href/,
  ],
];
export function basisEncoderPath() {
  return {
    name: "three-d-rooms-basis-encoder-path",
    transform(code, id) {
      const path = id.replace(/\\/g, "/");
      const match = ENCODER_DEFAULTS.find(([file]) => path.endsWith(file));
      if (!match) return null;
      const next = code.replace(match[1], '""');
      if (next === code)
        throw new Error(
          "ktx2-encoder changed: review the Basis encoder path plugin.",
        );
      return { code: next, map: null };
    },
  };
}
