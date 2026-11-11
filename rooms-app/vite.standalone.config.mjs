import { defineConfig } from "vite";
// Small page script: Home Assistant login and websocket. The 3D card itself is
// the separate bundle the page loads first, so Three.js is not shipped twice.
export default defineConfig({
  build: {
    outDir: "dist/standalone",
    emptyOutDir: true,
    lib: {
      entry: "dashboard/standalone.js",
      formats: ["es"],
      fileName: () => "three-d-rooms-standalone.js",
    },
    // The full Material Design set loads only for icons the curated set lacks.
    rollupOptions: { output: { chunkFileNames: "[name]-[hash].js" } },
  },
});
