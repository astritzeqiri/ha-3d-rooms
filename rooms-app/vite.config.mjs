import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: "web",
  base: "./",
  server: {
    proxy: { "/kitchen": "http://127.0.0.1:5188" },
    fs: { allow: [resolve("../..")] },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
