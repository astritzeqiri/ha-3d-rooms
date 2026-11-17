/** Robot vacuums: Home Assistant `vacuum.*` state and the commands 3D Rooms sends. */
const LABELS = {
  cleaning: "Cleaning",
  docked: "Docked",
  idle: "Idle",
  paused: "Paused",
  returning: "Returning",
  error: "Error",
};
/**
 * `VacuumEntityFeature` bits a command needs. The capability is what the room
 * model allows; the feature is what the real vacuum says it supports.
 */
export const VACUUM_ACTIONS = {
  start: { service: "start", feature: 8192, capability: "start" },
  pause: { service: "pause", feature: 4, capability: "pause" },
  stop: { service: "stop", feature: 8, capability: "stop" },
  return_to_base: {
    service: "return_to_base",
    feature: 16,
    capability: "return_home",
  },
  locate: { service: "locate", feature: 512, capability: "locate" },
};
export const VACUUM_CAPABILITIES = Object.values(VACUUM_ACTIONS).map(
  (a) => a.capability,
);
export function vacuumState(entity) {
  const state = entity?.state;
  const unavailable =
    !entity || !/^vacuum\./.test(entity.entity_id || "") || !(state in LABELS);
  const battery = entity?.attributes?.battery_level;
  return {
    state: unavailable ? undefined : state,
    label: unavailable ? "Unavailable" : LABELS[state],
    cleaning: state === "cleaning",
    returning: state === "returning",
    docked: state === "docked",
    paused: state === "paused",
    error: state === "error",
    // Away from the dock and doing something (shown as the active state).
    active: state === "cleaning" || state === "returning",
    battery: Number.isFinite(battery) ? battery : undefined,
    features: Number.isFinite(entity?.attributes?.supported_features)
      ? entity.attributes.supported_features
      : 0,
    unavailable,
  };
}
/** Actions this vacuum supports, in button order. */
export function vacuumActions(entity, control) {
  const s = vacuumState(entity);
  return Object.entries(VACUUM_ACTIONS)
    .filter(
      ([, a]) =>
        control.capabilities.includes(a.capability) && s.features & a.feature,
    )
    .map(([name]) => name);
}
export function vacuumCommand(entity, control, action) {
  const spec = VACUUM_ACTIONS[action];
  if (!spec || vacuumState(entity).unavailable)
    throw new Error("Choose an available vacuum and a supported action.");
  if (!vacuumActions(entity, control).includes(action))
    throw new Error("This vacuum does not support that action.");
  return {
    domain: "vacuum",
    service: spec.service,
    target: { entity_id: entity.entity_id },
    service_data: {},
  };
}
/** Horizontal unit vector the dock faces (where the robot drives out). */
export function dockFacing(control) {
  const [x = 0, , z = 1] = control?.facing || [];
  const length = Math.hypot(x, z);
  return length > 1e-6 ? [x / length, 0, z / length] : [0, 0, 1];
}
/**
 * The 3D rooms of the chosen Home Assistant areas, in the order chosen: a
 * house view's member rooms carry their area, a single room its own.
 */
export function vacuumRooms(model, areaIds = []) {
  const rooms = model?.members?.length
    ? model.members.map((m) => [m.model, m.areaId])
    : [[model?.id, model?.areaId]];
  const out = [];
  for (const area of areaIds)
    for (const [room, roomArea] of rooms)
      if (area && roomArea === area && room && !out.includes(room))
        out.push(room);
  return out;
}
