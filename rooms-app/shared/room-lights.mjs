// Room-by-room device lists for the card's Lights and Shades panels. Grouped
// devices appear once (their group's primary control); hidden devices never
// appear. A house view lists each placed room separately, in the order the
// rooms were added.
//
// "On" means a light is on or a shade is (partly) open. Bulk switches follow
// Home Assistant's area/group toggles: anything on turns everything off,
// otherwise everything turns on.
import { shortRoomTitle } from "./workspace.mjs";
export const PANEL_KINDS = {
  light: {
    entity: /^(light|switch)\.[a-z0-9_]+$/,
    isOn: (state) => !!state.on,
    services: { on: "turn_on", off: "turn_off" },
  },
  // Contact sensors are read-only, so only cover entities can be switched.
  shade: {
    entity: /^cover\.[a-z0-9_]+$/,
    isOn: (state) => (state.position ?? state.motionPosition ?? 0) > 0,
    services: { on: "open_cover", off: "close_cover" },
  },
};

/**
 * Lights (or shades) of the shown room, house or floor, grouped by room.
 * Bulk switches never touch hidden devices: an entity also connected to a
 * hidden device stays out of `entities` (its own row can still switch it).
 * Shades are covers the scene animates as roller shades (`isShade`), not
 * doors, windows or desks.
 */
export function roomDevices(model, kind = "light", isShade = () => false) {
  const { entity: pattern } = PANEL_KINDS[kind],
    matches = (c) =>
      kind === "light"
        ? c.type === "light"
        : c.type === "cover" && c.motion !== "none" && isShade(c),
    rooms = new Map(),
    hiddenEntities = new Set(
      (model?.controls || [])
        .filter((c) => c.hidden && matches(c))
        .map((c) => model.bindings?.[c.id])
        .filter(Boolean),
    );
  for (const control of model?.controls || []) {
    if (
      !matches(control) ||
      control.hidden ||
      control.lightGroupPrimary === false
    )
      continue;
    const roomId = control.sourceModel || model.id,
      title = shortRoomTitle(control.roomTitle || model.title || "Room");
    if (!rooms.has(roomId))
      rooms.set(roomId, { id: roomId, kind, title, lights: [], entities: [] });
    const room = rooms.get(roomId),
      prefix = control.roomTitle ? `${control.roomTitle} · ` : "";
    let label =
      (control.lightGroup ? control.lightGroupLabel : control.label) ||
      control.name ||
      (kind === "light" ? "Light" : "Shade");
    if (prefix && label.startsWith(prefix)) label = label.slice(prefix.length);
    const entityId = model.bindings?.[control.id],
      usable = pattern.test(entityId || "");
    room.lights.push({
      id: control.id,
      label,
      entityId: usable ? entityId : undefined,
      group: !!control.lightGroup,
    });
    if (
      usable &&
      !hiddenEntities.has(entityId) &&
      !room.entities.includes(entityId)
    )
      room.entities.push(entityId);
  }
  return [...rooms.values()];
}
export const roomLights = (model) => roomDevices(model, "light");

/**
 * How many of a room's devices are on/open, keyed by control state (the
 * card's live or preview state map). Unavailable or unmapped devices cannot
 * be switched and are counted separately.
 */
export function roomLightSummary(room, states) {
  const { isOn } = PANEL_KINDS[room.kind || "light"];
  let on = 0,
    available = 0;
  for (const light of room.lights) {
    const state = states.get(light.id);
    if (!state || state.unavailable) continue;
    available++;
    if (isOn(state)) on++;
  }
  return { on, available, total: room.lights.length };
}

/**
 * The service calls for a room's (or the panel's) switch. Switch-backed
 * lights use the switch domain; unavailable entities are skipped.
 */
export function roomLightCommands(room, states, entityStates = {}) {
  const { services } = PANEL_KINDS[room.kind || "light"],
    turnOn = roomLightSummary(room, states).on === 0,
    service = turnOn ? services.on : services.off,
    byDomain = new Map();
  for (const entityId of room.entities) {
    const entity = entityStates[entityId];
    if (!entity || ["unavailable", "unknown"].includes(entity.state)) continue;
    const domain = entityId.split(".")[0];
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(entityId);
  }
  return {
    turnOn,
    calls: [...byDomain].map(([domain, entity_id]) => [
      domain,
      service,
      { entity_id },
    ]),
  };
}

/** Every listed device as one pseudo-room, for the panel's All switch. */
export function allLights(rooms) {
  return {
    id: "",
    kind: rooms[0]?.kind || "light",
    title: "All",
    lights: rooms.flatMap((r) => r.lights),
    entities: [...new Set(rooms.flatMap((r) => r.entities))],
  };
}
