// Extra entities of a saved view: any Home Assistant entity, shown as an icon
// on the card at a spot the view chose, like the room buttons. Stored in the
// view's markers as `_entities: { [id]: { entity, position, ... } }`. They are
// presentation only: they never change the room's devices or connections.
import { isMarkerIcon } from "./marker-icons.mjs";

export const CUSTOM_ENTITY_LIMIT = 48;
export const CUSTOM_ENTITY_SIZES = { min: 24, max: 64, standard: 32 };
export const ENTITY_ID_PATTERN = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * `{ [id]: { entity, position, room?, name?, icon?, size?, show_state? } }`.
 * `position` is a point in the view's own metres; `room` is the house-view
 * room it belongs to, so it hides with that room; `show_state: false` hides
 * the state under the icon. Defaults are not stored.
 */
export function validateCustomEntities(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > CUSTOM_ENTITY_LIMIT
  )
    throw new Error(
      `Use at most ${CUSTOM_ENTITY_LIMIT} extra entities in one view.`,
    );
  const clean = {};
  for (const [id, options] of Object.entries(value)) {
    if (
      !ID_PATTERN.test(id) ||
      ["constructor", "prototype"].includes(id) ||
      !options ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) =>
          ![
            "entity",
            "position",
            "room",
            "name",
            "icon",
            "icon_off",
            "size",
            "show_state",
            "visible",
          ].includes(key),
      )
    )
      throw new Error("Invalid extra entity settings.");
    if (
      typeof options.entity !== "string" ||
      options.entity.length > 255 ||
      !ENTITY_ID_PATTERN.test(options.entity)
    )
      throw new Error("Choose a Home Assistant entity such as sensor.hallway.");
    if (
      !Array.isArray(options.position) ||
      options.position.length !== 3 ||
      options.position.some((v) => !Number.isFinite(v) || Math.abs(v) > 1000)
    )
      throw new Error("An extra entity position must be three numbers.");
    if (options.room !== undefined && !ID_PATTERN.test(options.room))
      throw new Error("Invalid room for an extra entity.");
    if (
      options.name !== undefined &&
      (typeof options.name !== "string" || options.name.length > 80)
    )
      throw new Error("An extra entity name must be at most 80 characters.");
    if (options.icon_off !== undefined && !isMarkerIcon(options.icon_off))
      throw new Error(
        "Choose a Home Assistant icon such as mdi:thermometer or local:front-door.",
      );
    if (options.icon !== undefined && !isMarkerIcon(options.icon))
      throw new Error(
        "Choose a Home Assistant icon such as mdi:thermometer or local:front-door.",
      );
    if (
      options.size !== undefined &&
      (!Number.isInteger(options.size) ||
        options.size < CUSTOM_ENTITY_SIZES.min ||
        options.size > CUSTOM_ENTITY_SIZES.max)
    )
      throw new Error(
        `An extra entity size must be ${CUSTOM_ENTITY_SIZES.min}–${CUSTOM_ENTITY_SIZES.max} pixels.`,
      );
    if (
      options.show_state !== undefined &&
      typeof options.show_state !== "boolean"
    )
      throw new Error("Showing the state must be true or false.");
    if (options.visible !== undefined && typeof options.visible !== "boolean")
      throw new Error("Visibility must be true or false.");
    const name = options.name?.trim();
    clean[id] = {
      entity: options.entity,
      position: [...options.position],
      ...(options.room ? { room: options.room } : {}),
      ...(name ? { name } : {}),
      ...(options.icon ? { icon: options.icon } : {}),
      ...(options.icon_off ? { icon_off: options.icon_off } : {}),
      ...(options.size !== undefined &&
      options.size !== CUSTOM_ENTITY_SIZES.standard
        ? { size: options.size }
        : {}),
      ...(options.show_state === false ? { show_state: false } : {}),
      ...(options.visible === false ? { visible: false } : {}),
    };
  }
  return clean;
}

/** Settings of one extra entity with the defaults filled in. */
export function customEntitySettings(options = {}) {
  return {
    size: CUSTOM_ENTITY_SIZES.standard,
    show_state: true,
    visible: true,
    ...options,
  };
}

/** A short new id that is not used yet. */
export function newCustomEntityId(existing = {}) {
  for (let n = 1; ; n++) if (!(`e${n}` in existing)) return `e${n}`;
}

const TOGGLES = new Set([
  "light",
  "switch",
  "input_boolean",
  "fan",
  "automation",
  "script",
  "siren",
  "humidifier",
]);
const PRESSES = { button: "press", input_button: "press", scene: "turn_on" };

/**
 * What a tap does for an entity: `{ domain, service }` to call, or null to
 * open Home Assistant's more-info dialog (sensors, climate, locks, covers…,
 * whose controls need more than one tap or should be confirmed).
 */
export function customEntityTap(entityId) {
  const domain = String(entityId || "").split(".")[0];
  if (TOGGLES.has(domain))
    return { domain, service: domain === "script" ? "turn_on" : "toggle" };
  if (PRESSES[domain]) return { domain, service: PRESSES[domain] };
  return null;
}

const ACTIVE = new Set([
  "on",
  "open",
  "opening",
  "closing",
  "home",
  "playing",
  "heat",
  "cool",
  "heat_cool",
  "auto",
  "dry",
  "fan_only",
  "cleaning",
  "detected",
]);

/** State words without Home Assistant's formatter (full-screen page, tests). */
function plainState(stateObj) {
  const { state, attributes = {} } = stateObj;
  if (attributes.device_class === "timestamp") {
    const at = new Date(state);
    if (!Number.isNaN(at.getTime())) {
      const sameDay = at.toDateString() === new Date().toDateString();
      return at.toLocaleString(undefined, {
        ...(sameDay ? {} : { weekday: "short" }),
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  const unit = attributes.unit_of_measurement;
  return unit ? `${state} ${unit}` : String(state).replace(/_/g, " ");
}

/**
 * How an extra entity looks: `{ active, unavailable, badge, description }`.
 * `format(stateObj)` is Home Assistant's own state formatter when available.
 */
export function customEntityState(stateObj, format) {
  if (!stateObj)
    return {
      active: false,
      unavailable: true,
      badge: "?",
      description: "not found",
    };
  const unavailable = ["unavailable", "unknown"].includes(stateObj.state);
  let text;
  try {
    text = format?.(stateObj);
  } catch {
    text = undefined;
  }
  if (!text) text = plainState(stateObj);
  const domain = stateObj.entity_id.split(".")[0];
  return {
    active:
      !unavailable &&
      (domain === "lock"
        ? stateObj.state === "locked"
        : ACTIVE.has(stateObj.state) && domain !== "sensor"),
    unavailable,
    badge: text.length > 14 ? text.slice(0, 13) + "…" : text,
    description: text,
  };
}

/**
 * Whether an extra entity shows in the loaded view: one tied to a room shows
 * only while that room is shown (a floor or a single room can hide it).
 */
export function customEntityShown(options, shownRooms) {
  if (options.visible === false) return false;
  if (!options.room || !shownRooms) return true;
  return shownRooms.has(options.room);
}

const DEVICE_CLASS_ICONS = {
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
  timestamp: "mdi:clock-outline",
  power: "mdi:flash",
  energy: "mdi:lightning-bolt",
  battery: "mdi:battery",
  illuminance: "mdi:brightness-5",
  pressure: "mdi:gauge",
  carbon_dioxide: "mdi:molecule-co2",
  door: "mdi:door",
  garage_door: "mdi:garage",
  garage: "mdi:garage",
  window: "mdi:window-closed",
  motion: "mdi:motion-sensor",
  occupancy: "mdi:home-account",
  moisture: "mdi:water",
  smoke: "mdi:smoke-detector",
};
const DOMAIN_ICONS = {
  sensor: "mdi:eye",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  switch: "mdi:toggle-switch-variant",
  input_boolean: "mdi:toggle-switch-variant",
  light: "mdi:lightbulb",
  cover: "mdi:window-shutter",
  lock: "mdi:lock",
  climate: "mdi:thermostat",
  fan: "mdi:fan",
  media_player: "mdi:cast",
  scene: "mdi:palette",
  script: "mdi:script-text",
  automation: "mdi:robot",
  button: "mdi:gesture-tap-button",
  input_button: "mdi:gesture-tap-button",
  person: "mdi:account",
  device_tracker: "mdi:account",
  camera: "mdi:video",
  vacuum: "mdi:robot-vacuum",
  weather: "mdi:weather-partly-cloudy",
  sun: "mdi:white-balance-sunny",
  number: "mdi:ray-vertex",
  input_number: "mdi:ray-vertex",
  select: "mdi:format-list-bulleted",
  input_select: "mdi:format-list-bulleted",
  alarm_control_panel: "mdi:shield-home",
  water_heater: "mdi:water-boiler",
  humidifier: "mdi:air-humidifier",
  siren: "mdi:bullhorn",
  update: "mdi:package-up",
};

/**
 * A plain icon name for an entity, used only where Home Assistant cannot draw
 * its own (the full-screen page): by device class, else by domain.
 */
export function customEntityDefaultIcon(entityId, stateObj) {
  const domain = String(entityId || "").split(".")[0];
  return (
    DEVICE_CLASS_ICONS[stateObj?.attributes?.device_class] ||
    DOMAIN_ICONS[domain] ||
    "mdi:information-outline"
  );
}

/**
 * Words for an entity's two looks (its icon can differ in each), or null when
 * it has only one (sensors, buttons, scenes…). Active comes first.
 */
export function customEntityStateWords(entityId, stateObj) {
  const domain = String(entityId || "").split(".")[0];
  if (
    [
      "sensor",
      "button",
      "input_button",
      "scene",
      "script",
      "number",
      "input_number",
      "select",
      "input_select",
      "weather",
      "sun",
      "update",
      "camera",
      "input_text",
      "input_datetime",
      "event",
    ].includes(domain)
  )
    return null;
  if (domain === "lock") return ["Locked", "Unlocked"];
  if (["cover", "valve"].includes(domain)) return ["Open", "Closed"];
  if (["person", "device_tracker"].includes(domain)) return ["Home", "Away"];
  if (domain === "media_player") return ["Playing", "Off"];
  if (
    domain === "binary_sensor" &&
    ["door", "window", "garage_door", "opening"].includes(
      stateObj?.attributes?.device_class,
    )
  )
    return ["Open", "Closed"];
  return ["On", "Off"];
}
