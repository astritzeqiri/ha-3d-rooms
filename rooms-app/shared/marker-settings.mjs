/** View-local presentation only. Does not change bindings or modeled geometry. */
export function validateMarkers(value) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 128
  )
    throw new Error(
      "Use a device-marker settings object with at most 128 controls.",
    );
  const clean = {};
  for (const [id, options] of Object.entries(value)) {
    if (
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id) ||
      ["constructor", "prototype"].includes(id) ||
      !options ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) =>
          !["visible", "show_label", "size", "placement", "offset"].includes(
            key,
          ),
      )
    )
      throw new Error("Invalid device-marker settings.");
    for (const key of ["visible", "show_label"])
      if (options[key] !== undefined && typeof options[key] !== "boolean")
        throw new Error("Marker visibility and labels must be true or false.");
    if (
      options.size !== undefined &&
      (!Number.isInteger(options.size) ||
        options.size < 24 ||
        options.size > 64)
    )
      throw new Error("Marker size must be 24–64 pixels.");
    if (
      options.placement !== undefined &&
      !["room", "tray"].includes(options.placement)
    )
      throw new Error("Choose room or tray for a device control.");
    if (
      options.offset !== undefined &&
      (!Array.isArray(options.offset) ||
        options.offset.length !== 3 ||
        options.offset.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000))
    )
      throw new Error(
        "Marker offsets must be three finite values within 1000 metres.",
      );
    clean[id] = structuredClone(options);
  }
  return clean;
}
export function markerSettings(markers, id) {
  return {
    visible: true,
    show_label: true,
    size: 32,
    placement: "room",
    ...(markers?.[id] || {}),
  };
}
export function offsetPoint(position, offset = [0, 0, 0]) {
  return position.map((value, axis) => value + offset[axis]);
}
export function markerLayout(point, settings, width, height) {
  const size = settings.size;
  return {
    left: Math.max(
      0,
      Math.min(width - size, point.x + (settings.offset ? -size / 2 : 24)),
    ),
    top: Math.max(
      0,
      Math.min(
        height - size - (settings.show_label ? 16 : 0),
        point.y - size / 2,
      ),
    ),
  };
}

export function markerTrayHeight(markers) {
  const count = Object.values(markers || {}).filter(
    (o) => o.visible !== false && o.placement === "tray",
  ).length;
  return count ? count * 76 + 24 : 0;
}
