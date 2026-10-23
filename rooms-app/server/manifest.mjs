import { lightFeatures } from "../shared/light.mjs";
export const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export function validateManifest(m) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!m || m.schemaVersion !== 1) fail("This model needs schemaVersion 1.");
  if (
    typeof m.id !== "string" ||
    !ID.test(m.id) ||
    ["constructor", "prototype"].includes(m.id)
  )
    fail(
      "Model ID must use lowercase letters, numbers, underscores or hyphens.",
    );
  if (typeof m.title !== "string" || !m.title.trim() || m.title.length > 160)
    fail("Provide a model title (up to 160 characters).");
  if (m.units !== "meters" || m.up !== "Y")
    fail("Model coordinates must use meters and Y up.");
  if (m.scene !== "scene.glb") fail("The scene must be named scene.glb.");
  if (!Array.isArray(m.controls) || m.controls.length > 200)
    fail("Provide a controls array with up to 200 objects.");
  const ids = new Set();
  const vector = (v) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => Number.isFinite(n) && Math.abs(n) < 10000);
  for (const c of m.controls) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !ID.test(c.id) ||
      ["constructor", "prototype"].includes(c.id) ||
      ids.has(c.id)
    )
      fail("Every control needs a unique stable ID.");
    ids.add(c.id);
    if (c.type !== "light") fail("This release supports light controls only.");
    if (typeof c.label !== "string" || !c.label.trim() || c.label.length > 160)
      fail("Every light needs a label.");
    if (!vector(c.position)) fail("Each light needs a position in meters.");
    if (c.intensity !== undefined && !(c.intensity >= 0 && c.intensity <= 100))
      fail("Light intensity must be between 0 and 100.");
    if (c.color !== undefined && !/^#[0-9a-f]{6}$/i.test(c.color))
      fail("Light color must be a hex color.");
    if (
      c.nodeIds !== undefined &&
      (!Array.isArray(c.nodeIds) ||
        c.nodeIds.some((id) => typeof id !== "string" || !ID.test(id)))
    )
      fail("Light node IDs must be stable IDs.");
    if (
      !Array.isArray(c.capabilities) ||
      !c.capabilities.includes("on_off") ||
      c.capabilities.some(
        (v) => !["on_off", "brightness", "color", "color_temp"].includes(v),
      )
    )
      fail("Unsupported light capabilities.");
  }
  if (m.camera && (!vector(m.camera.position) || !vector(m.camera.target)))
    fail("Camera position and target must be three numbers.");
  if (m.ambient !== undefined && !(m.ambient >= 0.05 && m.ambient <= 1))
    fail("Minimum ambient light must be between 0.05 and 1.");
  return m;
}
export function compatible(control, entity) {
  return (
    entity &&
    control.type === "light" &&
    /^(light|switch)\./.test(entity.entity_id)
  );
}
export function validateBinding(control, entity) {
  if (!compatible(control, entity))
    throw new Error("Choose a light or switch entity.");
  return entity.entity_id;
}
export function commandFor(
  entityId,
  action,
  brightness,
  control,
  settings = {},
  entity,
) {
  if (!["on", "off"].includes(action))
    throw new Error("Only explicit on/off commands are supported.");
  const domain = entityId.split(".")[0];
  if (!["light", "switch"].includes(domain))
    throw new Error("Unsupported entity type.");
  const service_data = {};
  if (brightness !== undefined) {
    if (
      domain !== "light" ||
      !control.capabilities.includes("brightness") ||
      !Number.isFinite(brightness) ||
      brightness < 1 ||
      brightness > 255
    )
      throw new Error("Brightness is not supported or is outside 1–255.");
    if (action === "on") service_data.brightness = Math.round(brightness);
  }
  const features = lightFeatures(entity);
  const { rgb_color, color_temp_kelvin, effect, transition } = settings;
  if (rgb_color !== undefined && color_temp_kelvin !== undefined)
    throw new Error(
      "Choose color or white temperature, not both in one command.",
    );
  if (
    action === "off" &&
    [rgb_color, color_temp_kelvin, effect].some((v) => v !== undefined)
  )
    throw new Error(
      "Color, temperature and effects require a turn-on command.",
    );
  if (brightness !== undefined && entity && !features.brightness)
    throw new Error("This entity does not support brightness.");
  if (rgb_color !== undefined) {
    if (
      !features.color ||
      !Array.isArray(rgb_color) ||
      rgb_color.length !== 3 ||
      rgb_color.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
    )
      throw new Error(
        "This light needs a supported RGB color with three values from 0 to 255.",
      );
    service_data.rgb_color = rgb_color;
  }
  if (color_temp_kelvin !== undefined) {
    if (
      !features.temperature ||
      !Number.isInteger(color_temp_kelvin) ||
      color_temp_kelvin < features.minKelvin ||
      color_temp_kelvin > features.maxKelvin
    )
      throw new Error(
        "White temperature is outside this light's supported Kelvin range.",
      );
    service_data.color_temp_kelvin = color_temp_kelvin;
  }
  if (effect !== undefined) {
    if (typeof effect !== "string" || !features.effects.includes(effect))
      throw new Error("Choose an effect advertised by this light.");
    service_data.effect = effect;
  }
  if (transition !== undefined) {
    if (
      !features.transition ||
      !Number.isFinite(transition) ||
      transition < 0 ||
      transition > 60
    )
      throw new Error(
        "Fade must be supported by this light and between 0 and 60 seconds.",
      );
    service_data.transition = transition;
  }
  return {
    domain,
    service: action === "on" ? "turn_on" : "turn_off",
    target: { entity_id: entityId },
    service_data,
  };
}
