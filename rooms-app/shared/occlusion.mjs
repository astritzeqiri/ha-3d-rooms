// Device icons are drawn over the 3D view, so an icon whose device lies under
// another room (a light in the office, below the bedroom's floor) would show
// through that room. The scene draws each room's surfaces into a small buffer
// whose pixels hold the room number and the depth; these helpers read it.

/** Depth in window units (0 near, 1 far) from the three depth bytes (0-255). */
export function unpackDepth(g, b, a) {
  // The shader stores z as p = fract(z * (1, 255, 65025)) minus the carried parts.
  return g / 255 + b / 255 / 255 + a / 255 / 65025;
}

/**
 * Distance along the view from the camera for a normalised device depth
 * (-1 near, 1 far), for perspective and orthographic cameras.
 */
export function viewDistance(ndcZ, near, far, orthographic = false) {
  return orthographic
    ? (ndcZ * (far - near) + (far + near)) / 2
    : (2 * near * far) / (far + near - ndcZ * (far - near));
}

/**
 * Whether an icon is covered by another room. `samples` are the buffer pixels
 * around the icon: `{ room, distance }` with room 0 for empty pixels.
 * `own` is the icon's room number and `distance` its own view distance.
 * Covered when most pixels show a different room's surface nearer than the
 * icon, by more than `tolerance` metres (icons sit on or inside surfaces).
 */
export function coveredByOtherRoom(
  samples,
  own,
  distance,
  { tolerance = 0.1, share = 0.55 } = {},
) {
  if (!samples.length) return false;
  const covered = samples.filter(
    (s) => s.room !== 0 && s.room !== own && s.distance < distance - tolerance,
  ).length;
  return covered / samples.length >= share;
}
