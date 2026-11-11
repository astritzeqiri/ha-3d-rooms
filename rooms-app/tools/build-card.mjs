import { mkdir, copyFile, cp, rm, readdir } from "node:fs/promises";
await mkdir("../dist", { recursive: true });
await copyFile("dist/card/three-d-rooms-card.js", "../dist/ha-3d-rooms.js");
console.log(
  "Prepared HACS Dashboard bundle: dist/ha-3d-rooms.js at the repository root.",
);

const destination = "../custom_components/three_d_rooms/frontend";
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp("dist/assets", `${destination}/assets`, { recursive: true });
await copyFile("dist/index.html", `${destination}/index.html`);
// HACS installs only this folder, so the bundled-library notices travel with it.
await copyFile(
  "../THIRD_PARTY_NOTICES.md",
  `${destination}/THIRD_PARTY_NOTICES.md`,
);
// KTX2 transcoder for GPU-compressed room textures; loaded only when a room uses them.
await mkdir(`${destination}/basis`, { recursive: true });
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"])
  await copyFile(
    `node_modules/three/examples/jsm/libs/basis/${file}`,
    `${destination}/basis/${file}`,
  );
await copyFile(
  "dist/card/three-d-rooms-card.js",
  `${destination}/three-d-rooms-card.js`,
);
// The page script plus the lazily loaded icon chunk beside it.
for (const file of await readdir("dist/standalone"))
  await copyFile(`dist/standalone/${file}`, `${destination}/${file}`);
console.log(
  "Bundled model manager, dashboard card and standalone page script inside the HACS integration.",
);
