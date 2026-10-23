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

/** Preserve the captured composition; fit it inside narrower dashboard cards. */
export function restoreCameraView(
  snapshot,
  {
    aspect,
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
    zoom: ((s.zoom * zoom) / s.referenceZoom) * Math.min(1, aspect / s.aspect),
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
