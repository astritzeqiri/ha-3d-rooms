import * as THREE from "three";
import { writeFile, mkdir } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
// Node provides Blob, but Three.js's exporter also needs FileReader.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = `data:${blob.type};base64,${Buffer.from(v).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const scene = new THREE.Scene();
const box = (name, size, position, color) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.name = name;
  mesh.position.fromArray(position);
  scene.add(mesh);
  return mesh;
};
box("Floor", [7, 0.12, 4], [0, -0.06, 0], "#c9b28e");
box("Back wall", [7, 2.7, 0.12], [0, 1.35, -2], "#d9d4c8");
box("Left wall", [0.12, 2.7, 4], [-3.5, 1.35, 0], "#d9d4c8");
box("Divider", [0.1, 2.7, 2], [0, 1.35, -1], "#d9d4c8");
box("Kitchen counter", [2, 0.9, 0.65], [-2, 0.45, -1.5], "#8f9c87");
box("Kitchen worktop", [2.1, 0.06, 0.75], [-2, 0.93, -1.5], "#e4d9c5");
box("Dining table", [1.3, 0.08, 0.9], [-1.6, 0.76, 0.55], "#a27752");
box("Sofa", [1.8, 0.6, 0.8], [2, 0.3, -0.9], "#82908b");
box("Coffee table", [1, 0.4, 0.65], [2, 0.2, 0.3], "#b48d65");
const controls = [
  {
    id: "kitchen-ceiling",
    label: "Kitchen ceiling light",
    type: "light",
    room: "Kitchen",
    position: [-1.8, 2.35, 0],
    intensity: 20,
    color: "#fff0d4",
    capabilities: ["on_off", "brightness", "color", "color_temp"],
    nodeIds: ["kitchen-fixture"],
  },
  {
    id: "living-ceiling",
    label: "Living room light",
    type: "light",
    room: "Living room",
    position: [1.8, 2.35, 0],
    intensity: 20,
    color: "#fff0d4",
    capabilities: ["on_off", "brightness", "color", "color_temp"],
    nodeIds: ["living-fixture"],
  },
];
for (const c of controls) {
  const mesh = box(c.id, [0.32, 0.07, 0.32], c.position, "#fff4cf");
  mesh.userData.controlId = c.nodeIds[0];
  mesh.material.emissive.set("#fff4cf");
  mesh.material.emissiveIntensity = 1;
}
const buffer = await new GLTFExporter().parseAsync(scene, { binary: true });
const manifest = {
  schemaVersion: 1,
  id: "sample-floor",
  revision: "1",
  title: "Example floor",
  floor: "Ground floor · sample",
  units: "meters",
  up: "Y",
  scene: "scene.glb",
  ambient: 0.22,
  camera: { position: [7, 7, 9], target: [0, 0.6, 0] },
  controls,
};
await mkdir("examples", { recursive: true });
await writeFile(
  "examples/sample-floor.zip",
  zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "scene.glb": new Uint8Array(buffer),
  }),
);
await writeFile("examples/manifest.json", JSON.stringify(manifest, null, 2));
console.log("Created examples/sample-floor.zip with two independent lights.");
