/** Presentation only: keep model identities and authored names unchanged. */
export function roomName(model) {
  if (model?.houseView) return model.houseFloor?.name || model.title;
  const title = String(model?.title || "Untitled room");
  return shortRoomTitle(title);
}
/** "Office · your scan", "Corridor · November scan · edited" → the room's name. */
export function shortRoomTitle(title) {
  const text = String(title ?? "");
  return (
    text
      .replace(
        /\s*·\s*(?:(?:[\p{L}\p{N}]+\s+)?scan|edited)(?=\s*(?:·|$))/giu,
        "",
      )
      .trim() || text
  );
}
/**
 * A house view prefixes each device with its room's stored title. Show the
 * room's short name instead; ids and stored names stay as they are.
 */
export function deviceLabel(control, fallback = "Device") {
  const label = control?.label || control?.name || fallback,
    prefix = control?.roomTitle ? `${control.roomTitle} · ` : "";
  return prefix && label.startsWith(prefix)
    ? `${shortRoomTitle(control.roomTitle)} · ${label.slice(prefix.length)}`
    : label;
}
export function houseId(model) {
  return model?.houseId || model?.housePlacement?.houseId;
}
export function libraryGroups(models, query = "") {
  const matches = (m) =>
    `${roomName(m)} ${m.title} ${m.id}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const houses = models
    .filter((m) => m.houseView && !m.houseFloor)
    .map((house) => {
      const all = models.filter(
        (m) => !m.houseView && houseId(m) === house.houseId,
      );
      const rooms = matches(house) ? all : all.filter(matches);
      const floors = (all[0]?.housePlacement?.floors || []).map((floor) => ({
        ...floor,
        model: models.find(
          (m) =>
            m.houseView &&
            m.houseId === house.houseId &&
            m.houseFloor?.id === floor.id,
        ),
        rooms: rooms.filter((m) =>
          m.housePlacement.floorIds.includes(floor.id),
        ),
      }));
      return {
        house,
        rooms,
        floors,
        unassigned: rooms.filter((m) => !m.housePlacement.floorIds.length),
      };
    })
    .filter((group) => group.rooms.length || matches(group.house));
  return {
    houses,
    other: models.filter((m) => !m.houseView && !houseId(m) && matches(m)),
  };
}
export function deviceGroup(control) {
  if (control.device || control.type === "number") return "Furniture";
  return (
    {
      cover: "Shades & doors",
      climate: "Climate",
      button: "Actions",
      lock: "Locks",
    }[control.type] || "Lights"
  );
}
export function connectionState(control, model, status, simulation = false) {
  if (simulation) return { label: "Simulation", kind: "simulation" };
  const ids = control.device
    ? [control.device.height, control.device.motion, ...control.device.macros]
    : [control.id];
  const mapped = ids.filter((id) => model.bindings?.[id]);
  if (!mapped.length) return { label: "Not connected", kind: "unmapped" };
  if (!status.connected)
    return { label: "Home Assistant offline", kind: "unavailable" };
  if (
    mapped.some((id) => {
      const entity = status.entities.find(
        (e) => e.entity_id === model.bindings[id],
      );
      return !entity || ["unknown", "unavailable"].includes(entity.state);
    })
  )
    return { label: "Unavailable", kind: "unavailable" };
  if (mapped.length < ids.length)
    return { label: "Setup incomplete", kind: "unmapped" };
  return { label: "Ready", kind: "ready" };
}

/** A floor filter lists each room once, including rooms spanning several floors. */
export function sidebarRooms(models, scope, floor = "all", query = "") {
  const needle = query.trim().toLowerCase();
  return models
    .filter(
      (model) =>
        !model.houseView &&
        (scope === "other" ? !houseId(model) : houseId(model) === scope),
    )
    .filter(
      (model) =>
        floor === "all" ||
        (floor === "unassigned"
          ? !model.housePlacement?.floorIds.length
          : model.housePlacement?.floorIds.includes(floor)),
    )
    .filter((model) =>
      `${roomName(model)} ${model.title} ${model.id}`
        .toLowerCase()
        .includes(needle),
    );
}
export function sidebarLabel(model, rooms) {
  const short = (m) =>
    roomName(m)
      .split("·")[0]
      .trim()
      .replace(/\s*[–—-]\s*copy$/i, "")
      .trim();
  const label = short(model);
  return rooms.filter((m) => short(m) === label).length > 1
    ? roomName(model)
    : label;
}

/** Devices of a room and how many have at least one entity connected. */
export function roomSetupProgress(room) {
  const entries = (room?.controls || []).filter(
    (c) =>
      !c.hidden &&
      c.lightGroupPrimary !== false &&
      !(room.devices || []).some(
        (d) => d.height !== c.id && [d.motion, ...d.macros].includes(c.id),
      ),
  );
  const connected = entries.filter((c) => {
    const device = (room.devices || []).find((d) => d.height === c.id);
    const ids = device
      ? [device.height, device.motion, ...device.macros]
      : [c.id];
    return ids.some((id) => room.bindings?.[id]);
  }).length;
  return { total: entries.length, connected };
}

/**
 * Getting started with a room or house: connect devices, check the icons,
 * create a dashboard view. `rooms` are the room models the space shows,
 * `views` the saved dashboard views, `spaceIds` the ids a view may show
 * (the room, or the house and its floors and rooms).
 */
export function setupChecklist({ rooms, views = [], spaceIds = [] }) {
  const progress = rooms.map(roomSetupProgress),
    total = progress.reduce((sum, p) => sum + p.total, 0),
    connected = progress.reduce((sum, p) => sum + p.connected, 0),
    // The room with the most devices still to connect is where to go next.
    next = rooms
      .map((room, index) => ({
        room,
        missing: progress[index].total - progress[index].connected,
      }))
      .sort((a, b) => b.missing - a.missing)[0],
    icons = rooms.some((room) =>
      (room.controls || []).some((c) => c.markerAnchor || c.icon || c.iconOff),
    ),
    viewed = views.some((v) =>
      (v.layers || []).some((layer) => spaceIds.includes(layer.model)),
    );
  const steps = [
    {
      id: "connect",
      title: "Connect devices",
      detail: total
        ? `${connected} of ${total} connected`
        : "No devices in this space",
      done: connected >= total,
      room: next?.missing ? next.room.id : undefined,
    },
    {
      id: "icons",
      title: "Place the icons",
      detail: icons
        ? "Icons placed"
        : "Drag icons onto their devices on the Devices tab",
      done: icons,
      room: rooms[0]?.id,
    },
    {
      id: "view",
      title: "Create a dashboard view",
      detail: viewed ? "View saved" : "Frame the space for your dashboard",
      done: viewed,
    },
  ];
  return { steps, done: steps.filter((s) => s.done).length };
}
