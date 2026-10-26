const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
export function validateDevices(devices = [], controls = []) {
  if (!Array.isArray(devices) || devices.length > 100)
    throw new Error("Invalid devices.");
  const ids = new Set(),
    members = new Set();
  for (const device of devices) {
    if (
      !device ||
      typeof device.id !== "string" ||
      !ID.test(device.id) ||
      ["constructor", "prototype"].includes(device.id) ||
      ids.has(device.id) ||
      device.type !== "adjustable_desk" ||
      typeof device.label !== "string" ||
      !device.label.trim() ||
      device.label.length > 160 ||
      !Array.isArray(device.macros) ||
      device.macros.length !== 4
    )
      throw new Error(
        "Adjustable desks need a unique ID, label, height, motion and four macro slots.",
      );
    ids.add(device.id);
    const roles = [
      [device.height, "number"],
      [device.motion, "cover"],
      ...device.macros.map((id) => [id, "button"]),
    ];
    for (const [id, type] of roles) {
      if (
        typeof id !== "string" ||
        !ID.test(id) ||
        members.has(id) ||
        !controls.some((c) => c.id === id && c.type === type)
      )
        throw new Error(
          "Desk roles must reference distinct compatible controls.",
        );
      members.add(id);
    }
    if (controls.find((c) => c.id === device.motion).motion !== "none")
      throw new Error("Desk motion must be a command-only cover.");
  }
  return devices;
}
export function validateDeviceSettings(value = {}, devices = []) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid device settings.");
  const clean = {};
  for (const [id, settings] of Object.entries(value)) {
    const device = devices.find((d) => d.id === id);
    if (
      !device ||
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings) ||
      Object.keys(settings).some((k) => k !== "macroNames") ||
      !settings.macroNames ||
      typeof settings.macroNames !== "object" ||
      Array.isArray(settings.macroNames)
    )
      throw new Error("Invalid desk settings.");
    const names = {};
    for (const [controlId, name] of Object.entries(settings.macroNames)) {
      if (
        !device.macros.includes(controlId) ||
        typeof name !== "string" ||
        name.length > 80
      )
        throw new Error("Macro names must be at most 80 characters.");
      names[controlId] = name.trim();
    }
    clean[id] = { macroNames: names };
  }
  return clean;
}
export const deviceForControl = (model, id) =>
  (model.devices || []).find((d) =>
    [d.height, d.motion, ...d.macros].includes(id),
  );
export const macroName = (model, device, id) =>
  model.deviceSettings?.[device.id]?.macroNames?.[id] || "";
export function deviceEntries(model) {
  const members = new Set(
    (model.devices || []).flatMap((d) => [d.motion, ...d.macros]),
  );
  return model.controls
    .filter((c) => !members.has(c.id))
    .map((c) => {
      const device = (model.devices || []).find((d) => d.height === c.id);
      return device ? { ...c, label: device.label, device } : c;
    });
}
