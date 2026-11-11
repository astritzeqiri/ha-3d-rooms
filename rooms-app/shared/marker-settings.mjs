import { isMarkerIcon } from "./marker-icons.mjs";
/** View-local presentation only. Does not change bindings or modeled geometry. */
export function validateMarkers(value) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).filter((id) => !["_defaults", "_rooms"].includes(id))
      .length > 128
  )
    throw new Error(
      "Use a device-marker settings object with at most 128 controls.",
    );
  const clean = {};
  for (const [id, options] of Object.entries(value)) {
    if (id === "_rooms") {
      const rooms = validateRoomButtons(options);
      if (Object.keys(rooms).length) clean._rooms = rooms;
      continue;
    }
    if (
      (id !== "_defaults" && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)) ||
      ["constructor", "prototype"].includes(id) ||
      !options ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) =>
          ![
            "visible",
            "show_label",
            "size",
            "placement",
            "offset",
            "icon",
            "icon_off",
          ].includes(key),
      )
    )
      throw new Error("Invalid device-marker settings.");
    if (id === "_defaults" && options.offset !== undefined)
      throw new Error("View defaults cannot contain a position offset.");
    if (
      id === "_defaults" &&
      (options.icon !== undefined || options.icon_off !== undefined)
    )
      throw new Error("Choose icons per device, not as a view default.");
    for (const key of ["icon", "icon_off"])
      if (options[key] !== undefined && !isMarkerIcon(options[key]))
        throw new Error(
          "Choose a Home Assistant icon such as mdi:door or local:front-door.",
        );
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
export const ROOM_BUTTON_MODES = ["auto", "always", "never"];
/** Height of a room button in pixels: allowed range and the default. */
export const ROOM_BUTTON_SIZES = { min: 20, max: 64, standard: 30 };
/**
 * Room buttons of a house view: `{ [roomId]: { mode?, position? } }`. `mode`
 * is auto (the default, so not stored), always or never; `position` is a
 * point in the view's own metres; `heading` and `tilt` (degrees) frame the
 * room when it is opened on its own; `size` is the button's height in pixels. Empty entries are dropped.
 */
export function validateRoomButtons(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > 64
  )
    throw new Error("Use a room-button settings object with at most 64 rooms.");
  const clean = {};
  for (const [room, options] of Object.entries(value)) {
    if (
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(room) ||
      ["constructor", "prototype"].includes(room) ||
      !options ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) => !["mode", "position", "heading", "tilt", "size"].includes(key),
      )
    )
      throw new Error("Invalid room-button settings.");
    if (options.mode !== undefined && !ROOM_BUTTON_MODES.includes(options.mode))
      throw new Error("Choose when the room button shows.");
    if (
      options.position !== undefined &&
      (!Array.isArray(options.position) ||
        options.position.length !== 3 ||
        options.position.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000))
    )
      throw new Error("A room button position must be three numbers.");
    if (
      options.heading !== undefined &&
      (!Number.isFinite(options.heading) ||
        options.heading < 0 ||
        options.heading >= 360)
    )
      throw new Error("A room view heading must be 0 to under 360 degrees.");
    if (
      options.tilt !== undefined &&
      (!Number.isFinite(options.tilt) || options.tilt < 0 || options.tilt > 180)
    )
      throw new Error("A room view tilt must be 0 to 180 degrees.");
    if (
      options.size !== undefined &&
      (!Number.isInteger(options.size) ||
        options.size < ROOM_BUTTON_SIZES.min ||
        options.size > ROOM_BUTTON_SIZES.max)
    )
      throw new Error(
        `A room button size must be ${ROOM_BUTTON_SIZES.min}–${ROOM_BUTTON_SIZES.max} pixels.`,
      );
    const entry = {
      ...(options.mode && options.mode !== "auto"
        ? { mode: options.mode }
        : {}),
      ...(options.position ? { position: [...options.position] } : {}),
      ...(options.heading !== undefined ? { heading: options.heading } : {}),
      ...(options.tilt !== undefined ? { tilt: options.tilt } : {}),
      ...(options.size !== undefined &&
      options.size !== ROOM_BUTTON_SIZES.standard
        ? { size: options.size }
        : {}),
    };
    if (Object.keys(entry).length) clean[room] = entry;
  }
  return clean;
}
export function markerSettings(markers, id) {
  return {
    visible: true,
    show_label: true,
    size: 32,
    placement: "room",
    ...(markers?._defaults || {}),
    ...(markers?.[id] || {}),
  };
}
export function offsetPoint(position, offset = [0, 0, 0]) {
  return position.map((value, axis) => value + offset[axis]);
}
export function markerLayout(point, settings, width, height) {
  const size = settings.size;
  return {
    left: Math.max(0, Math.min(width - size, point.x - size / 2)),
    top: Math.max(
      0,
      Math.min(
        height - size - (settings.show_label ? 16 : 0),
        point.y - size / 2,
      ),
    ),
  };
}

export function markerTrayHeight(markers, controls) {
  const ids = controls
    ? controls
        .filter((c) => !c.hidden && c.lightGroupPrimary !== false)
        .map((c) => c.id)
    : Object.keys(markers || {}).filter(
        (id) => id !== "_defaults" && id !== "_rooms",
      );
  const count = ids.filter((id) => {
    const options = markerSettings(markers, id);
    return options.visible && options.placement === "tray";
  }).length;
  return count ? count * 76 + 24 : 0;
}
