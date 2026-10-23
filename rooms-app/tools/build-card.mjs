import { mkdir, copyFile } from "node:fs/promises";
await mkdir("../dist", { recursive: true });
await copyFile("dist/card/three-d-rooms-card.js", "../dist/ha-3d-rooms.js");
console.log(
  "Prepared HACS Dashboard bundle: dist/ha-3d-rooms.js at the repository root.",
);
