import { climateState, climateAppearance } from "./climate.mjs";
import { lockState } from "./lock.mjs";
/** Presentation only: actual entity state remains the source of truth. */
export function markerAppearance(control, entity, state, preview = false) {
  if (control.type === "climate") {
    const s = entity
        ? climateState(entity)
        : state?.mode
          ? state
          : climateState(undefined),
      visual = climateAppearance(s);
    return {
      active: s.on,
      unavailable: s.unavailable,
      moving: false,
      badge: s.unavailable
        ? "Unavailable"
        : s.temperature === undefined
          ? visual.label
          : `${visual.label} · ${s.temperature}°`,
      description: s.unavailable
        ? "Unavailable"
        : `${visual.label}, Home Assistant climate controls`,
      stateObj: entity || {
        entity_id: "climate.three_d_rooms_preview",
        state: s.mode || "unavailable",
        attributes: { icon: "mdi:air-conditioner" },
      },
    };
  }
  if (control.type === "lock") {
    const s = preview ? state || {} : entity ? lockState(entity) : state || {},
      connected = preview || !!entity,
      unavailable = !connected || !!s.unavailable;
    return {
      badge: !connected ? "—" : unavailable ? "!" : s.label,
      description: !connected
        ? "Not connected"
        : unavailable
          ? "Unavailable"
          : `${s.label}, Home Assistant lock controls`,
      active: !unavailable && s.locked === true,
      moving: !!s.moving,
      unavailable,
      stateObj: entity || {
        entity_id: "lock.three_d_rooms_preview",
        state: s.locked === false ? "unlocked" : "locked",
        attributes: {},
      },
    };
  }
  if (control.type === "button") {
    const connected = preview || !!entity,
      unavailable = !connected || !!state.unavailable;
    return {
      badge: unavailable ? "—" : "Run",
      description: unavailable ? "Not connected" : "Run preset",
      active: false,
      moving: false,
      unavailable,
      stateObj: entity || {
        entity_id: "button.preview",
        state: "unknown",
        attributes: { icon: "mdi:gesture-tap-button" },
      },
    };
  }
  if (control.type === "number") {
    const connected = preview || !!entity,
      unavailable = !connected || !!state.unavailable;
    const label = Number.isFinite(state.value)
      ? `${state.value} ${control.unit}`
      : "Unknown";
    return {
      badge: !connected ? "—" : unavailable ? "!" : label,
      description: !connected
        ? "Not connected"
        : unavailable
          ? "Unavailable"
          : label,
      active: !unavailable,
      moving: false,
      unavailable,
      stateObj: entity || {
        entity_id: "number.three_d_rooms_preview",
        state: String(state.value ?? control.defaultValue),
        attributes: { unit_of_measurement: control.unit, icon: "mdi:desk" },
      },
    };
  }
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

/** Padlock glyph shared by the viewer and dashboard. */
export const LOCK_ICON_PATH =
  '<path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3Zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14Z"/>';
/** Shared wall-mounted AC glyph for the viewer and dashboard. */
export const AC_ICON_PATH =
  '<path fill-rule="evenodd" d="M4 3h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v5h16V5H4Z"/><path d="M5 7h14v2H5zm2 7h2v3a2 2 0 0 1-2 2H5v-2h2zm4 0h2v7h-2zm4 0h2v3h2v2h-2a2 2 0 0 1-2-2z"/>';
