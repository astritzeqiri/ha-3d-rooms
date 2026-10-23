import { mkdir, copyFile, cp, rm } from "node:fs/promises";
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
await copyFile(
  "dist/card/three-d-rooms-card.js",
  `${destination}/three-d-rooms-card.js`,
);
console.log(
  "Bundled model manager and dashboard card inside the HACS integration.",
);
