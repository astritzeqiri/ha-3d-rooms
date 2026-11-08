import { defineConfig } from "vite";
import { ktx2TranscoderPath } from "./tools/ktx2-transcoder-plugin.mjs";
export default defineConfig({
  // The card module sits beside frontend/basis/ (KTX2 transcoder).
  define: { __THREE_D_ROOMS_BASIS__: JSON.stringify("./basis/") },
  plugins: [ktx2TranscoderPath()],
  build: {
    outDir: "dist/card",
    emptyOutDir: true,
    lib: {
      entry: "dashboard/card.js",
      formats: ["es"],
      fileName: () => "three-d-rooms-card.js",
    },
  },
});
