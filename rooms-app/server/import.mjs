import yauzl from "yauzl";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { validateManifest } from "./manifest.mjs";
export const MAX_UPLOAD = 100 * 1024 * 1024;
const MAX_EXPANDED = 300 * 1024 * 1024;
export async function extractPackage(buffer, dir) {
  await mkdir(dir, { recursive: true });
  try {
    await new Promise((resolve, reject) =>
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
        if (err) return reject(new Error("Upload a valid ZIP model package."));
        let total = 0,
          count = 0;
        const paths = new Set();
        const fail = (e) => {
          zip.close();
          reject(e);
        };
        zip.on("error", fail);
        zip.on("end", resolve);
        zip.on("entry", (entry) => {
          const name = entry.fileName;
          if (
            ++count > 2048 ||
            (total += entry.uncompressedSize) > MAX_EXPANDED
          )
            return fail(
              new Error("Model exceeds the expanded size or file limit."),
            );
          if (
            !/^(manifest\.json|scene\.glb|thumbnail\.(png|jpg|webp)|textures\/[a-zA-Z0-9_./-]+)$/.test(
              name,
            ) ||
            name.includes("..") ||
            name.includes("\\") ||
            paths.has(name) ||
            ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
          )
            return fail(
              new Error("Package contains an unsupported or unsafe path."),
            );
          paths.add(name);
          zip.openReadStream(entry, (err, stream) => {
            if (err) return fail(err);
            const chunks = [];
            let bytes = 0;
            stream.on("data", (chunk) => {
              bytes += chunk.length;
              if (bytes > entry.uncompressedSize || bytes > MAX_EXPANDED) {
                stream.destroy();
                fail(new Error("Expanded file is too large."));
              } else chunks.push(chunk);
            });
            stream.on("error", fail);
            stream.on("end", async () => {
              try {
                await mkdir(join(dir, name, ".."), { recursive: true });
                await writeFile(join(dir, name), Buffer.concat(chunks));
                zip.readEntry();
              } catch (e) {
                fail(e);
              }
            });
          });
        });
        zip.readEntry();
      }),
    );
    const manifest = validateManifest(
      JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")),
    );
    const glb = await readFile(join(dir, "scene.glb"));
    validateGLB(glb, manifest);
    return manifest;
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
}
export function validateGLB(b, manifest) {
  if (
    b.length < 20 ||
    b.toString("ascii", 0, 4) !== "glTF" ||
    b.readUInt32LE(4) !== 2 ||
    b.readUInt32LE(8) !== b.length ||
    b.readUInt32LE(16) !== 0x4e4f534a
  )
    throw new Error("scene.glb must be a valid glTF 2 binary.");
  const end = 20 + b.readUInt32LE(12);
  if (end > b.length) throw new Error("Invalid GLB JSON length.");
  const doc = JSON.parse(b.toString("utf8", 20, end).trim());
  for (const a of [...(doc.buffers || []), ...(doc.images || [])])
    if (a.uri)
      throw new Error(
        "Embed textures and buffers in the GLB. External asset URLs are not supported.",
      );
  const daylightIds = new Set(
    (doc.nodes || []).map((n) => n.extras?.daylightWindowId),
  );
  if (manifest.daylight?.windows.some((w) => !daylightIds.has(w.nodeId)))
    throw new Error("A daylight window references a missing scene node.");
  const ids = new Set(
    (doc.nodes || []).map((n) => n.extras?.controlId).filter(Boolean),
  );
  for (const c of manifest.controls)
    for (const id of c.nodeIds || [])
      if (!ids.has(id))
        throw new Error(
          `Control ${c.label} references a missing scene node: ${id}`,
        );
}
