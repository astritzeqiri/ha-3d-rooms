import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { zipSync, strToU8 } from "fflate";
const [id, output] = process.argv.slice(2);
if (!output) {
  console.error("Usage: node tools/export-model.mjs model-id output.zip");
  process.exit(1);
}
const data = process.env.DATA_DIR || ".data",
  catalog = JSON.parse(await readFile(join(data, "catalog.json"), "utf8"));
const model = catalog.models.find((m) => m.id === id);
if (!model) throw new Error("Model not found");
const dir = join(data, "models", model.folder);
const manifest = await readFile(join(dir, "manifest.json"));
const scene = await readFile(join(dir, "scene.glb"));
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  zipSync(
    { "manifest.json": strToU8(manifest.toString()), "scene.glb": scene },
    { level: 6 },
  ),
);
console.log("Private package saved to " + output);
