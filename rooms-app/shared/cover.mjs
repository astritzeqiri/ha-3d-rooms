// Home Assistant cover positions: 0 = closed, 100 = fully open.
export function coverFeatures(entity) {
  const bits = entity?.entity_id?.startsWith("cover.")
    ? entity.attributes?.supported_features || 0
    : 0;
  return {
    open: !!(bits & 1),
    close: !!(bits & 2),
    position: !!(bits & 4),
    stop: !!(bits & 8),
  };
}
export function coverState(entity) {
  const unavailable =
    !entity || ["unknown", "unavailable"].includes(entity.state);
  const value = entity?.attributes?.current_position;
  const position = unavailable
    ? undefined
    : Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : entity.state === "closed"
        ? 0
        : undefined;
  return {
    position,
    unavailable,
    label: unavailable
      ? "Unavailable"
      : position !== undefined
        ? `${Math.round(position)}% open`
        : entity.state,
  };
}
export function coverCommand(entity, control, action, position) {
  const f = coverFeatures(entity);
  const services = {
    open: "open_cover",
    close: "close_cover",
    stop: "stop_cover",
    position: "set_cover_position",
  };
  const capability = ["open", "close"].includes(action) ? "open_close" : action;
  if (
    !services[action] ||
    !f[action] ||
    !control.capabilities.includes(capability)
  )
    throw new Error("This cover does not support that action.");
  if (
    action === "position" &&
    (!Number.isInteger(position) || position < 0 || position > 100)
  )
    throw new Error("Cover position must be an integer from 0 to 100.");
  return {
    domain: "cover",
    service: services[action],
    target: { entity_id: entity.entity_id },
    service_data: action === "position" ? { position } : {},
  };
}
// All rest transforms are in node-local coordinates, including after GLB import.
export function setShadePosition(root, position) {
  const shade = root.userData.rollerShade;
  if (
    !shade ||
    !Number.isFinite(position) ||
    !Number.isFinite(shade.top) ||
    !Number.isFinite(shade.height) ||
    shade.height <= 0
  )
    return;
  const bottom = shade.top - shade.height,
    lift = (shade.height * Math.max(0, Math.min(100, position))) / 100;
  root.traverse((part) => {
    const d = part.userData.rollerShadePart;
    if (
      !d ||
      !Number.isFinite(d.center) ||
      !Number.isFinite(d.height) ||
      d.height <= 0
    )
      return;
    const center = d.center + lift;
    if (d.rail) {
      part.position.y = Math.min(shade.top - d.height / 2, center);
      return;
    }
    const lo = Math.max(bottom, center - d.height / 2),
      hi = Math.min(shade.top, center + d.height / 2);
    part.visible = hi - lo > 1e-7;
    part.position.y = (lo + hi) / 2;
    part.scale.y = Math.max(0, hi - lo) / d.height;
  });
}
