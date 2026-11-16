import { defineConfig } from "vite";
import { ktx2TranscoderPath } from "./tools/ktx2-transcoder-plugin.mjs";
// Default: the card module plus a lazily loaded 3D engine chunk beside it, for
// the HACS integration. `--mode single` writes one self-contained file for the
// manual/compatibility card resource.
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    // The card module sits beside frontend/basis/ (KTX2 transcoder).
    define: { __THREE_D_ROOMS_BASIS__: JSON.stringify("./basis/") },
    plugins: [ktx2TranscoderPath()],
    build: {
      outDir: single ? "dist/card-single" : "dist/card",
      emptyOutDir: true,
      lib: {
        entry: "dashboard/card.js",
        formats: ["es"],
        fileName: () => "three-d-rooms-card.js",
      },
      rollupOptions: {
        output: single
          ? { inlineDynamicImports: true }
          : { chunkFileNames: "three-d-rooms-[name]-[hash].js" },
      },
    },
  };
});
