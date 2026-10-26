import { CUBE_DIRECTIONS } from "./view-cube.mjs";
/** Six faces, twelve edges and eight corners on the room's fixed world axes. */
export const CAMERA_PRESETS = Object.freeze(
  Object.fromEntries(
    CUBE_DIRECTIONS.map(({ name, vector: [x, y, z] }) => [
      name,
      {
        heading: ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360,
        tilt: (Math.acos(y / Math.hypot(x, y, z)) * 180) / Math.PI,
      },
    ]),
  ),
);
export function cameraPreset(name, mode = "front") {
  const view = mode === "floor" ? "floor" : "front";
  if (name === "reset")
    return {
      view,
      heading: 0,
      tilt: view === "floor" ? 8 : 28,
      zoom: 1,
      camera: undefined,
    };
  if (!Object.hasOwn(CAMERA_PRESETS, name))
    throw new Error("Unknown camera view.");
  return { view, ...CAMERA_PRESETS[name], zoom: 1, camera: undefined };
}
