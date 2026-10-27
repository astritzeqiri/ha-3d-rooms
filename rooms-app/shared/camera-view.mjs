import { floorFrame, perspectiveFrame } from "./floor-view.mjs";
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const displayed = (n) => Number(n.toFixed(2));
const degrees = (radians) => (radians * 180) / Math.PI;

export function validateCameraSnapshot(s) {
  const vector = (v) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => Number.isFinite(n) && Math.abs(n) < 10000);
  const positive = (n) => Number.isFinite(n) && n > 0 && n <= 10000;
  if (
    !s ||
    !vector(s.position) ||
    !vector(s.target) ||
    !vector(s.up) ||
    Math.hypot(...s.up) < 1e-8 ||
    distance(s.position, s.target) < 1e-8 ||
    !positive(s.aspect) ||
    !positive(s.zoom) ||
    !positive(s.referenceZoom) ||
    !Number.isFinite(s.heading) ||
    s.heading < 0 ||
    s.heading >= 360 ||
    !Number.isFinite(s.tilt) ||
    s.tilt < 0 ||
    s.tilt > 180 ||
    !["perspective", "orthographic"].includes(s.projection)
  )
    throw new Error("Invalid saved camera view.");
  if (
    s.projection === "perspective" &&
    (!Number.isFinite(s.fov) || s.fov < 1 || s.fov > 179)
  )
    throw new Error("Invalid saved camera field of view.");
  if (s.projection === "orthographic" && !positive(s.halfHeight))
    throw new Error("Invalid saved floor view.");
  return {
    projection: s.projection,
    position: [...s.position],
    target: [...s.target],
    up: [...s.up],
    aspect: s.aspect,
    zoom: s.zoom,
    referenceZoom: s.referenceZoom,
    heading: s.heading,
    tilt: s.tilt,
    ...(s.projection === "perspective"
      ? { fov: s.fov }
      : { halfHeight: s.halfHeight }),
  };
}

/** Capture orbit, dolly, pan and projection without switching the live camera. */
export function captureCameraView({
  position,
  target,
  up,
  aspect,
  zoom = 1,
  fov,
  halfHeight,
  min,
  max,
}) {
  const delta = position.map((v, i) => v - target[i]),
    radius = Math.hypot(...delta);
  // At the poles, tiny floating-point offsets cannot define a stable heading.
  const atPole =
    Math.hypot(delta[0], delta[2]) / radius < 1e-8 &&
    Math.hypot(up[0], up[2]) > 1e-8;
  const direction = delta[1] >= 0 ? -1 : 1;
  const heading =
    displayed(
      (degrees(
        atPole
          ? Math.atan2(direction * up[0], direction * up[2])
          : Math.atan2(delta[0], delta[2]),
      ) +
        360) %
        360,
    ) % 360;
  const tilt = displayed(
    degrees(Math.acos(Math.max(-1, Math.min(1, delta[1] / radius)))),
  );
  const view = halfHeight !== undefined ? "floor" : "front";
  const fitted = (view === "floor" ? floorFrame : perspectiveFrame)(
    min,
    max,
    aspect,
    tilt,
    heading,
  );
  let relativeZoom;
  if (view === "floor") relativeZoom = (zoom * fitted.top) / halfHeight;
  else
    relativeZoom =
      (((zoom * distance(fitted.position, fitted.target)) / radius) *
        Math.tan((fitted.fov * Math.PI) / 360)) /
      Math.tan((fov * Math.PI) / 360);
  const referenceZoom = Number(
    Math.max(0.01, Math.min(100, relativeZoom)).toFixed(4),
  );
  const camera = validateCameraSnapshot({
    projection: view === "floor" ? "orthographic" : "perspective",
    position: [...position],
    target: [...target],
    up: [...up],
    aspect,
    zoom,
    referenceZoom,
    heading,
    tilt,
    ...(view === "floor" ? { halfHeight } : { fov }),
  });
  return { view, heading, tilt, zoom: referenceZoom, camera };
}

/** Scale to the room's projected bounds instead of blindly scaling by aspect.
 * A tall room often already fits a phone; wide empty canvas must not shrink it.
 */
function framingScale(s, position, up, aspect, min, max) {
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error("Invalid camera aspect ratio.");
  const fallback = Math.min(1, aspect / s.aspect);
  if (!min || !max) return fallback;
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (v) => {
    const length = Math.hypot(...v);
    return v.map((n) => n / length);
  };
  const forward = unit(s.target.map((n, i) => n - position[i]));
  const right = unit(cross(forward, up));
  const vertical = unit(cross(right, forward));
  let halfWidth = 0,
    halfHeight = 0;
  for (let corner = 0; corner < 8; corner++) {
    const point = min.map(
      (value, i) => ((corner >> i) & 1 ? max[i] : value) - position[i],
    );
    const depth = s.projection === "perspective" ? dot(point, forward) : 1;
    if (depth <= 0) return fallback;
    halfWidth = Math.max(halfWidth, Math.abs(dot(point, right) / depth));
    halfHeight = Math.max(halfHeight, Math.abs(dot(point, vertical) / depth));
  }
  const before = Math.max(halfHeight, halfWidth / s.aspect);
  const after = Math.max(halfHeight, halfWidth / aspect);
  return after > 0 ? before / after : fallback;
}

/** Preserve authored pan/orbit/zoom while adapting to the visible room bounds. */

export function restoreCameraView(
  snapshot,
  {
    aspect,
    min,
    max,
    heading = snapshot.heading,
    tilt = snapshot.tilt,
    zoom = snapshot.referenceZoom,
  },
) {
  const s = validateCameraSnapshot(snapshot);
  let position = [...s.position],
    up = [...s.up];
  if (Math.abs(heading - s.heading) > 1e-6 || Math.abs(tilt - s.tilt) > 1e-6) {
    const h = (heading * Math.PI) / 180,
      t = (tilt * Math.PI) / 180,
      r = distance(s.position, s.target);
    const normal = [
      Math.sin(t) * Math.sin(h),
      Math.cos(t),
      Math.sin(t) * Math.cos(h),
    ];
    position = s.target.map((v, i) => v + normal[i] * r);
    up = [-Math.cos(t) * Math.sin(h), Math.sin(t), -Math.cos(t) * Math.cos(h)];
  }
  return {
    position,
    target: [...s.target],
    up,
    aspect,
    zoom:
      ((s.zoom * zoom) / s.referenceZoom) *
      framingScale(s, position, up, aspect, min, max),
    ...(s.projection === "perspective"
      ? { fov: s.fov }
      : {
          left: -s.halfHeight * aspect,
          right: s.halfHeight * aspect,
          top: s.halfHeight,
          bottom: -s.halfHeight,
        }),
    near: 0.05,
    far: distance(position, s.target) + 1000,
  };
}
