/** Presentation only: keep model identities and authored names unchanged. */
export function roomName(model) {
  if (model?.houseView) return model.houseFloor?.name || model.title;
  const title = String(model?.title || "Untitled room");
  return title.replace(/\s*·\s*(?:your scan|edited)\b/gi, "").trim() || title;
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
    { cover: "Shades & doors", climate: "Climate", button: "Actions" }[
      control.type
    ] || "Lights"
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
