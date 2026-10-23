/** Fit all eight bounds corners to a slightly tilted orthographic camera. */
export function floorFrame(min, max, aspect, tilt = 8, heading = 0) {
  if (
    ![...min, ...max, aspect, tilt, heading].every(Number.isFinite) ||
    aspect <= 0 ||
    min.some((v, i) => v > max[i])
  )
    throw new Error("Invalid floor camera bounds.");
  const t = (Math.max(0, Math.min(35, tilt)) * Math.PI) / 180,
    h = (heading * Math.PI) / 180;
  const normal = [
    Math.sin(t) * Math.sin(h),
    Math.cos(t),
    Math.sin(t) * Math.cos(h),
  ];
  const right = [Math.cos(h), 0, -Math.sin(h)];
  const up = [
    -Math.cos(t) * Math.sin(h),
    Math.sin(t),
    -Math.cos(t) * Math.cos(h),
  ];
  const target = min.map((v, i) => (v + max[i]) / 2),
    size = min.map((v, i) => max[i] - v);
  const span = (axis) =>
    size.reduce((sum, v, i) => sum + v * Math.abs(axis[i]), 0);
  const halfHeight =
    Math.max(span(up) / 2, span(right) / (2 * aspect), 0.1) * 1.12;
  const diagonal = Math.hypot(...size),
    distance = diagonal * 2 + 10;
  return {
    target,
    position: target.map((v, i) => v + normal[i] * distance),
    up,
    left: -halfHeight * aspect,
    right: halfHeight * aspect,
    top: halfHeight,
    bottom: -halfHeight,
    near: 0.05,
    far: distance + diagonal * 4 + 100,
  };
}

/** Fit every bounds corner inside a front-facing perspective camera. */
export function perspectiveFrame(min, max, aspect, tilt = 28, heading = 0) {
  const frame = floorFrame(min, max, aspect, tilt, heading);
  const t = (Math.max(0, Math.min(35, tilt)) * Math.PI) / 180,
    h = (heading * Math.PI) / 180;
  const normal = [
    Math.sin(t) * Math.sin(h),
    Math.cos(t),
    Math.sin(t) * Math.cos(h),
  ];
  const right = [Math.cos(h), 0, -Math.sin(h)],
    dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const tangent = Math.tan((35 * Math.PI) / 360);
  let distance = 1;
  for (let corner = 0; corner < 8; corner++) {
    const v = min.map(
      (value, i) => ((corner >> i) & 1 ? max[i] : value) - frame.target[i],
    );
    distance = Math.max(
      distance,
      dot(v, normal) +
        1.12 *
          Math.max(
            Math.abs(dot(v, right)) / (tangent * aspect),
            Math.abs(dot(v, frame.up)) / tangent,
          ),
    );
  }
  return {
    ...frame,
    fov: 35,
    aspect,
    position: frame.target.map((v, i) => v + normal[i] * distance),
  };
}
