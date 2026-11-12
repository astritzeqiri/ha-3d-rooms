import { lightFeatures, kelvinToRgb } from "../shared/light.mjs";

/** `[r, g, b]` (0–255) to Home Assistant's `[hue 0–360, saturation 0–100]`. */
export function rgbToHs([r, g, b]) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(max ? (d / max) * 100 : 0)];
}

/** `[hue, saturation]` back to an `rgb(...)` string, for painting only. */
export function hsToRgb([h, s], v = 1) {
  const c = v * (s / 100),
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((n) => Math.round((n + m) * 255));
}

/** "just now", "5 minutes ago", "yesterday"; empty for a missing date. */
export function relativeTime(iso, now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((then - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ])
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  return "just now";
}

const HIDDEN_ATTRIBUTES = new Set([
  "friendly_name",
  "icon",
  "entity_picture",
  "supported_features",
  "supported_color_modes",
  "color_mode",
  "effect_list",
  "hvac_modes",
  "fan_modes",
  "preset_modes",
  "swing_modes",
  "swing_horizontal_modes",
  "attribution",
  "editable",
  "restored",
]);
/** Attributes worth listing, as `[label, text]` pairs. */
export function attributeRows(attributes = {}) {
  return Object.entries(attributes)
    .filter(
      ([key, value]) =>
        !HIDDEN_ATTRIBUTES.has(key) && value !== null && value !== "",
    )
    .slice(0, 14)
    .map(([key, value]) => {
      const label = key
        .replace(/_/g, " ")
        .replace(/^./, (c) => c.toUpperCase());
      const text =
        Array.isArray(value) && value.every((v) => typeof v !== "object")
          ? value.join(", ")
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      return [label, text.length > 120 ? text.slice(0, 117) + "…" : text];
    });
}

const num = (v) => (Number.isFinite(v) ? v : undefined);
const UNAVAILABLE = new Set(["unavailable", "unknown"]);

/**
 * What the popup offers for an entity, as plain data. The dialog below draws
 * these; Home Assistant's own more-info dialog does not exist on the
 * standalone page, so this covers the devices a room can hold.
 */
export function describeEntity(entity) {
  const id = entity?.entity_id || "";
  const domain = id.split(".")[0];
  const a = entity?.attributes || {};
  const out = {
    id,
    domain,
    name: a.friendly_name || id,
    state: entity?.state,
    unavailable: !entity || UNAVAILABLE.has(entity.state),
    changed: relativeTime(entity?.last_changed),
    attributes: attributeRows(a),
    controls: [],
  };
  if (out.unavailable) return out;
  if (domain === "light") {
    const f = lightFeatures(entity);
    out.controls.push({ kind: "toggle", on: entity.state === "on" });
    if (f.brightness)
      out.controls.push({
        kind: "slider",
        key: "brightness",
        label: "Brightness",
        // 0 turns the light off, as Home Assistant's own slider does.
        min: 0,
        max: 255,
        step: 1,
        value: entity.state === "on" ? (num(a.brightness) ?? 0) : 0,
        format: (v) =>
          v > 0 ? `${Math.max(1, Math.round((v / 255) * 100))}%` : "Off",
      });
    if (f.temperature)
      out.controls.push({
        kind: "slider",
        key: "color_temp_kelvin",
        label: "Colour temperature",
        min: f.minKelvin,
        max: f.maxKelvin,
        step: 50,
        value: num(a.color_temp_kelvin) ?? f.minKelvin,
        format: (v) => `${Math.round(v)} K`,
      });
    if (f.color)
      out.controls.push({
        kind: "color",
        key: "hs_color",
        label: "Colour",
        value: Array.isArray(a.hs_color)
          ? [a.hs_color[0], a.hs_color[1]]
          : rgbToHs(
              Array.isArray(a.rgb_color)
                ? a.rgb_color
                : kelvinToRgb(num(a.color_temp_kelvin) ?? 3000),
            ),
      });
    if (f.effects.length)
      out.controls.push({
        kind: "select",
        key: "effect",
        label: "Effect",
        options: f.effects,
        value: a.effect ?? "",
      });
  } else if (domain === "cover") {
    const features = a.supported_features || 0;
    const buttons = [
      [1, "open_cover", "Open"],
      [8, "stop_cover", "Stop"],
      [2, "close_cover", "Close"],
    ].filter(([bit]) => features & bit);
    if (buttons.length)
      out.controls.push({
        kind: "buttons",
        buttons: buttons.map(([, service, label]) => ({ service, label })),
      });
    if (features & 4)
      out.controls.push({
        kind: "slider",
        key: "position",
        service: "set_cover_position",
        label: "Position",
        min: 0,
        max: 100,
        step: 1,
        value: num(a.current_position) ?? 0,
        format: (v) => `${Math.round(v)}%`,
      });
  } else if (domain === "lock") {
    out.controls.push({
      kind: "buttons",
      buttons: [
        { service: "lock", label: "Lock" },
        { service: "unlock", label: "Unlock" },
      ],
    });
  } else if (domain === "climate") {
    if (num(a.temperature) !== undefined)
      out.controls.push({
        kind: "stepper",
        key: "temperature",
        service: "set_temperature",
        label: "Target temperature",
        min: num(a.min_temp) ?? 7,
        max: num(a.max_temp) ?? 35,
        step: num(a.target_temp_step) ?? 0.5,
        value: a.temperature,
        unit: "°",
      });
    if (Array.isArray(a.hvac_modes) && a.hvac_modes.length)
      out.controls.push({
        kind: "select",
        key: "hvac_mode",
        service: "set_hvac_mode",
        label: "Mode",
        options: a.hvac_modes,
        value: entity.state,
        required: true,
      });
    for (const [list, key, service, label] of [
      ["fan_modes", "fan_mode", "set_fan_mode", "Fan mode"],
      ["swing_modes", "swing_mode", "set_swing_mode", "Swing mode"],
      [
        "swing_horizontal_modes",
        "swing_horizontal_mode",
        "set_swing_horizontal_mode",
        "Horizontal swing",
      ],
      ["preset_modes", "preset_mode", "set_preset_mode", "Preset"],
    ])
      if (Array.isArray(a[list]) && a[list].length)
        out.controls.push({
          kind: "select",
          key,
          service,
          label,
          options: a[list],
          value: a[key] ?? "",
          required: true,
        });
  } else if (
    ["switch", "input_boolean", "fan", "automation"].includes(domain)
  ) {
    out.controls.push({ kind: "toggle", on: entity.state === "on" });
    if (domain === "fan" && (a.supported_features || 0) & 1)
      out.controls.push({
        kind: "slider",
        key: "percentage",
        service: "set_percentage",
        label: "Speed",
        min: 0,
        max: 100,
        step: num(a.percentage_step) ?? 1,
        value: num(a.percentage) ?? 0,
        format: (v) => `${Math.round(v)}%`,
      });
  } else if (["button", "input_button"].includes(domain)) {
    out.controls.push({
      kind: "buttons",
      buttons: [{ service: "press", label: "Press" }],
    });
  } else if (domain === "scene" || domain === "script") {
    out.controls.push({
      kind: "buttons",
      buttons: [
        { service: "turn_on", label: domain === "scene" ? "Activate" : "Run" },
      ],
    });
  }
  return out;
}

/** The service call a control change means, for `callService(domain, service, data)`. */
export function controlCall(description, control, value) {
  const { domain, id } = description;
  if (control.kind === "toggle")
    return [
      domain === "light" || domain === "switch" ? domain : "homeassistant",
      value ? "turn_on" : "turn_off",
      { entity_id: id },
    ];
  if (control.kind === "buttons") return [domain, value, { entity_id: id }];
  if (
    control.kind === "slider" ||
    control.kind === "stepper" ||
    control.kind === "select"
  ) {
    if (domain === "light") {
      if (control.key === "brightness" && !(value > 0))
        return ["light", "turn_off", { entity_id: id }];
      if (control.key === "effect" && !value)
        return ["light", "turn_on", { entity_id: id, effect: "None" }];
      return ["light", "turn_on", { entity_id: id, [control.key]: value }];
    }
    return [domain, control.service, { entity_id: id, [control.key]: value }];
  }
  if (control.kind === "color")
    return ["light", "turn_on", { entity_id: id, hs_color: value }];
  throw new Error("Unknown control");
}
