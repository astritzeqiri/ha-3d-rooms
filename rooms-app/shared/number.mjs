export function numberState(entity, control) {
  const value =
    typeof entity?.state === "string" && entity.state.trim()
      ? Number(entity.state)
      : NaN;
  const unavailable =
    !entity ||
    !/^(number|input_number)\./.test(entity.entity_id) ||
    !Number.isFinite(value) ||
    value < control.min ||
    value > control.max ||
    (entity.attributes?.unit_of_measurement &&
      entity.attributes.unit_of_measurement !== control.unit);
  return {
    value: unavailable ? undefined : value,
    unavailable,
    label: unavailable ? "Unavailable" : `${value} ${control.unit}`,
  };
}
export function numberCommand(entity, control, action, value) {
  if (
    action !== "set_value" ||
    !control.capabilities.includes("set_value") ||
    numberState(entity, control).unavailable
  )
    throw new Error("Choose an available number with matching units.");
  const attrs = entity.attributes || {};
  if (
    !Number.isFinite(value) ||
    value < control.min ||
    value > control.max ||
    !Number.isFinite(attrs.min) ||
    !Number.isFinite(attrs.max) ||
    value < attrs.min ||
    value > attrs.max
  )
    throw new Error("Value is outside the desk or entity range.");
  for (const [min, step] of [
    [control.min, control.step],
    [attrs.min, attrs.step],
  ]) {
    if (
      !Number.isFinite(step) ||
      step <= 0 ||
      Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-6
    )
      throw new Error("Value must follow the allowed step.");
  }
  return {
    domain: entity.entity_id.split(".")[0],
    service: "set_value",
    target: { entity_id: entity.entity_id },
    service_data: { value },
  };
}
export { setNumberValue } from "./number-motion.mjs";
