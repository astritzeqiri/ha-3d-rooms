/** HA remains authoritative. Idle/defrost/off are not shown as active airflow. */
export function climateState(entity) {
  const unavailable =
      !entity || ["unknown", "unavailable"].includes(entity.state),
    a = entity?.attributes || {};
  const mode = unavailable ? "unknown" : entity.state;
  const action = typeof a.hvac_action === "string" ? a.hvac_action : undefined;
  return {
    unavailable,
    on: !unavailable && mode !== "off",
    mode,
    action,
    fanMode: typeof a.fan_mode === "string" ? a.fan_mode : undefined,
    swingMode: typeof a.swing_mode === "string" ? a.swing_mode : undefined,
    temperature: Number.isFinite(a.temperature) ? a.temperature : undefined,
    currentTemperature: Number.isFinite(a.current_temperature)
      ? a.current_temperature
      : undefined,
  };
}
export function climateAppearance(state = {}) {
  const names = {
    cool: "Cooling",
    heat: "Heating",
    dry: "Drying",
    fan_only: "Fan only",
    auto: "Auto",
    heat_cool: "Auto",
  };
  if (state.unavailable)
    return {
      color: "#89918e",
      label: "Unavailable",
      flow: false,
      speed: 0,
      open: false,
    };
  if (!state.on || state.mode === "off")
    return {
      color: "#5f6b65",
      label: "Off",
      flow: false,
      speed: 0,
      open: false,
    };
  const action = state.action;
  const selected =
    { heating: "heat", cooling: "cool", drying: "dry", fan: "fan_only" }[
      action
    ] || state.mode;
  const idle = ["idle", "off", "defrosting"].includes(action);
  const known = Object.hasOwn(names, selected);
  const flow =
    known &&
    !idle &&
    (action
      ? ["heating", "cooling", "drying", "fan"].includes(action)
      : !["auto", "heat_cool"].includes(state.mode));
  const colors = {
    cool: "#74caff",
    heat: "#ffa06a",
    dry: "#d7b97d",
    fan_only: "#c0e4da",
    auto: "#99cfc1",
    heat_cool: "#99cfc1",
  };
  const fan = (state.fanMode || "auto").toLowerCase();
  const speed = /high|turbo|powerful|5/.test(fan)
    ? 1.5
    : /low|quiet|silent|1/.test(fan)
      ? 0.65
      : 1;
  return {
    color: colors[selected] || "#99b5ad",
    label: idle
      ? `${names[state.mode] || "On"} · ${action === "defrosting" ? "Defrosting" : "Idle"}`
      : names[selected] || "On",
    flow,
    speed,
    open: flow || idle,
  };
}
