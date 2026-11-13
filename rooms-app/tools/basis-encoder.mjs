// Writes web/vendor/basis_encoder.wasmz: ktx2-encoder's 3.3 MB Basis encoder,
// gzip-compressed (about 1.2 MB). The manager unpacks it in the browser only
// when a room is optimized (web/room-optimizer.js). The ".wasmz" extension
// keeps web servers from labelling it gzip and decoding it on the way.
// Run from rooms-app/ (npm run build does it first).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const source = new URL(
  "../node_modules/ktx2-encoder/dist/basis/basis_encoder.wasm",
  import.meta.url,
);
const target = new URL("../web/vendor/basis_encoder.wasmz", import.meta.url);
const wasm = await readFile(source);
const packed = gzipSync(wasm, { level: 9, mtime: 0 });
await mkdir(new URL(".", target), { recursive: true });
await writeFile(target, packed);
console.log(
  `Basis encoder: ${(wasm.length / 1e6).toFixed(1)} MB → ${(packed.length / 1e6).toFixed(1)} MB`,
);
