import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
const files = {};
const include = ["server", "shared", "web", "tools", "test", "examples"];
async function add(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await add(file);
    else if (file !== "web/export-kitchen.html")
      files["three_d_rooms/" + file] = new Uint8Array(await readFile(file));
  }
}
for (const dir of include) await add(dir);
for (const file of [
  "Dockerfile",
  ".dockerignore",
  "config.yaml",
  "package.json",
  "package-lock.json",
  "vite.config.mjs",
  "LICENSE",
  "DOCS.md",
  "CHANGELOG.md",
])
  files["three_d_rooms/" + file] = new Uint8Array(await readFile(file));
files["three_d_rooms/README.md"] = new Uint8Array(
  await readFile("../README.md"),
);
await mkdir("../releases", { recursive: true });
await writeFile(
  "../releases/3d-rooms-0.2.0-source.zip",
  zipSync(files, { level: 6 }),
);
console.log(
  "Prepared ../releases/3d-rooms-0.2.0-source.zip (no household model files or credentials).",
);
