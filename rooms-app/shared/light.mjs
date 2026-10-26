const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];
export function lightFeatures(entity) {
  const a = entity?.attributes || {},
    modes = a.supported_color_modes || [];
  const isLight = entity?.entity_id?.startsWith("light.");
  const min = Number.isFinite(a.min_color_temp_kelvin)
    ? a.min_color_temp_kelvin
    : 2000;
  const max = Number.isFinite(a.max_color_temp_kelvin)
    ? a.max_color_temp_kelvin
    : 6535;
  return {
    brightness:
      !!isLight &&
      modes.some((m) =>
        ["brightness", "color_temp", "white", ...COLOR_MODES].includes(m),
      ),
    color: !!isLight && modes.some((m) => COLOR_MODES.includes(m)),
    temperature:
      !!isLight && modes.includes("color_temp") && min > 0 && max >= min,
    minKelvin: min,
    maxKelvin: max,
    effects:
      isLight && a.supported_features & 4 && Array.isArray(a.effect_list)
        ? a.effect_list.filter((e) => typeof e === "string")
        : [],
    transition: !!isLight && !!(a.supported_features & 32),
  };
}
export const hexToRgb = (hex) =>
  /^#[0-9a-f]{6}$/i.test(hex)
    ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    : [255, 240, 212];
export const rgbToHex = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function kelvinToRgb(kelvin) {
  // Approximate black-body color for visualization; commands use the actual Kelvin value.
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))));
}
export function entityAppearance(entity, defaultColor = "#fff0d4") {
  const a = entity?.attributes || {};
  const temperature = Number.isFinite(a.color_temp_kelvin)
    ? a.color_temp_kelvin
    : 3000;
  let rgb;
  if (a.color_mode === "color_temp") rgb = kelvinToRgb(temperature);
  else if (Array.isArray(a.rgb_color) && a.rgb_color.length === 3)
    rgb = a.rgb_color;
  else if (Array.isArray(a.rgbw_color)) {
    const [r, g, b, w] = a.rgbw_color;
    rgb = [r + w, g + w, b + w].map((v) => Math.min(255, v));
  } else if (Array.isArray(a.rgbww_color)) {
    const [r, g, b, c, w] = a.rgbww_color;
    const warm = kelvinToRgb(a.min_color_temp_kelvin || 2000),
      cool = kelvinToRgb(a.max_color_temp_kelvin || 6535);
    rgb = [r, g, b].map((v, i) =>
      Math.min(255, v + (warm[i] * w) / 255 + (cool[i] * c) / 255),
    );
  } else rgb = hexToRgb(defaultColor);
  return {
    rgb,
    colorMode: a.color_mode || "rgb",
    colorTempKelvin: temperature,
    effect: a.effect || "",
  };
}
export function commandConfirmed(entity, on, settings = {}) {
  if (entity?.state !== (on ? "on" : "off")) return false;
  const a = entity.attributes || {};
  if (
    settings.brightness !== undefined &&
    Math.abs((a.brightness ?? 0) - settings.brightness) > 4
  )
    return false;
  if (
    settings.color_temp_kelvin !== undefined &&
    (a.color_mode !== "color_temp" ||
      Math.abs((a.color_temp_kelvin ?? 0) - settings.color_temp_kelvin) > 75)
  )
    return false;
  if (settings.rgb_color !== undefined) {
    if (!COLOR_MODES.includes(a.color_mode) || !Array.isArray(a.rgb_color))
      return false;
    // Devices may gamut-map or quantize color. Compare normalized color rather than brightness.
    const normalize = (rgb) => {
      const max = Math.max(...rgb, 1);
      return rgb.map((v) => v / max);
    };
    const actual = normalize(a.rgb_color),
      target = normalize(settings.rgb_color);
    if (actual.some((v, i) => Math.abs(v - target[i]) > 0.15)) return false;
  }
  if (settings.effect !== undefined && a.effect !== settings.effect)
    return false;
  return true;
}
