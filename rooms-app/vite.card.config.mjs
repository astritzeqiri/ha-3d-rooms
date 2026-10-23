import { defineConfig } from "vite";
export default defineConfig({
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
