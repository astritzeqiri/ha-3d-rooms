/** Presentation only: actual entity state remains the source of truth. */
export function markerAppearance(control, entity, state, preview = false) {
  const cover = control.type === "cover";
  const connected = preview || !!entity;
  const unavailable = !preview && connected && state.unavailable;
  const raw = preview
    ? cover
      ? state.position === 0
        ? "closed"
        : "open"
      : state.on
        ? "on"
        : "off"
    : entity?.state;
  const moving = cover && ["opening", "closing"].includes(raw);
  const position = Number.isFinite(state.position)
    ? Math.round(state.position)
    : undefined;
  const active =
    !unavailable &&
    connected &&
    (cover
      ? position !== undefined
        ? position > 0
        : raw === "open" || moving
      : !!state.on);
  const badge = !connected
    ? "—"
    : unavailable
      ? "!"
      : cover
        ? `${moving ? (raw === "opening" ? "↑ " : "↓ ") : ""}${position === undefined ? (raw === "closed" ? "0%" : raw === "open" ? "Open" : "?") : position + "%"}`
        : state.on
          ? "On"
          : "Off";
  const description = !connected
    ? "Not connected"
    : unavailable
      ? "Unavailable"
      : cover
        ? `${moving ? raw + ", " : ""}${position === undefined ? raw || "Position unknown" : position + "% open"}`
        : state.on
          ? `On${Number.isFinite(state.brightness) ? ", " + Math.round((state.brightness / 255) * 100) + "% brightness" : ""}`
          : "Off";
  const stateObj =
    !preview && entity
      ? entity
      : {
          entity_id: `${cover ? "cover" : "light"}.three_d_rooms_preview`,
          state: raw || "unavailable",
          attributes: cover
            ? {
                device_class: "shade",
                ...(position === undefined
                  ? {}
                  : { current_position: position }),
              }
            : { brightness: state.brightness },
        };
  return {
    badge,
    description,
    active,
    moving,
    unavailable: !connected || unavailable,
    stateObj,
  };
}
