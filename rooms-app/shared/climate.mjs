/** Climate commands stay in HA's native, capability-aware more-info dialog. */
export function climateState(entity) {
  const unavailable =
    !entity || ["unknown", "unavailable"].includes(entity.state);
  const a = entity?.attributes || {};
  return {
    unavailable,
    on: !unavailable && entity.state !== "off",
    mode: unavailable ? "Unknown" : entity.state,
    temperature: Number.isFinite(a.temperature) ? a.temperature : undefined,
    currentTemperature: Number.isFinite(a.current_temperature)
      ? a.current_temperature
      : undefined,
  };
}
