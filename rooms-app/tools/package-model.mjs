import { readFile, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { validateManifest } from "../server/manifest.mjs";
import { validateGLB } from "../server/import.mjs";
const [manifestPath, scenePath, output] = process.argv.slice(2);
if (!output) {
  console.error(
    "Usage: node tools/package-model.mjs manifest.json scene.glb output.zip",
  );
  process.exit(1);
}
const manifest = validateManifest(
    JSON.parse(await readFile(manifestPath, "utf8")),
  ),
  scene = await readFile(scenePath);
validateGLB(scene, manifest);
await writeFile(
  output,
  zipSync(
    {
      "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
      "scene.glb": scene,
    },
    { level: 6 },
  ),
);
console.log("Model package written to " + output);
