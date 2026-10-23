import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
const files = {};
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const include = [
  "server",
  "shared",
  "web",
  "dashboard",
  "tools",
  "test",
  "examples",
];
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
  "vite.card.config.mjs",
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
  `../releases/3d-rooms-${version}-source.zip`,
  zipSync(files, { level: 6 }),
);
await writeFile(
  `../releases/three-d-rooms-card-${version}.js`,
  await readFile("dist/card/three-d-rooms-card.js"),
);
console.log(
  `Prepared 3d-rooms-${version}-source.zip and three-d-rooms-card-${version}.js in releases/.`,
);

const integrationFiles = {};
async function addIntegration(
  path,
  prefix = "custom_components/three_d_rooms",
) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === "__pycache__" || entry.name.endsWith(".pyc")) continue;
    const file = join(path, entry.name),
      key = prefix + "/" + entry.name;
    if (entry.isDirectory()) await addIntegration(file, key);
    else integrationFiles[key] = new Uint8Array(await readFile(file));
  }
}
await addIntegration("../custom_components/three_d_rooms");
await writeFile(
  `../releases/3d-rooms-${version}-integration.zip`,
  zipSync(integrationFiles, { level: 6 }),
);
console.log(
  "Prepared single-install integration ZIP with its bundled frontend.",
);
