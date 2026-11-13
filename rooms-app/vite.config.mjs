import { defineConfig } from "vite";
import {
  basisEncoderPath,
  ktx2TranscoderPath,
} from "./tools/ktx2-transcoder-plugin.mjs";
import { resolve } from "node:path";
export default defineConfig({
  root: "web",
  base: "./",
  // Manager chunks live in frontend/assets/, one level below frontend/basis/.
  define: { __THREE_D_ROOMS_BASIS__: JSON.stringify("../basis/") },
  plugins: [ktx2TranscoderPath(), basisEncoderPath()],
  server: {
    proxy: { "/kitchen": "http://127.0.0.1:5188" },
    fs: { allow: [resolve("../..")] },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
