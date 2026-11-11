import { positionGroupMarkers } from "./light-groups.mjs";
const id = (v, max = 80) =>
  typeof v === "string" &&
  v.length <= max &&
  /^[a-z0-9][a-z0-9_-]*$/.test(v) &&
  !["constructor", "prototype"].includes(v);
export function validatePlacement(value) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !id(value.houseId, 48) ||
    !id(value.roomId) ||
    typeof value.houseName !== "string" ||
    !value.houseName.trim() ||
    value.houseName.length > 160
  )
    throw new Error("Invalid house identity.");
  const t = value.transform;
  if (
    !Array.isArray(t) ||
    t.length !== 16 ||
    !t.every(Number.isFinite) ||
    Math.abs(t[3]) + Math.abs(t[7]) + Math.abs(t[11]) > 0.001 ||
    Math.abs(t[15] - 1) > 0.001
  )
    throw new Error("Invalid room placement.");
  const axes = [t.slice(0, 3), t.slice(4, 7), t.slice(8, 11)],
    dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  if (
    axes.some((a) => Math.abs(dot(a, a) - 1) > 0.01) ||
    Math.abs(dot(axes[0], axes[1])) +
      Math.abs(dot(axes[1], axes[2])) +
      Math.abs(dot(axes[0], axes[2])) >
      0.01 ||
    Math.abs(t[4]) + Math.abs(t[6]) + Math.abs(t[5] - 1) > 0.01 ||
    t[0] * t[10] - t[2] * t[8] < 0.99
  )
    throw new Error(
      "Room placements must preserve metres and vertical orientation.",
    );
  if (!Array.isArray(value.floors) || value.floors.length > 30)
    throw new Error("Provide up to 30 floors.");
  const seen = new Set();
  const floors = value.floors.map((f) => {
    if (
      !f ||
      !id(f.id, 20) ||
      seen.has(f.id) ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      f.name.length > 100 ||
      !Number.isFinite(f.minY) ||
      !Number.isFinite(f.maxY) ||
      f.minY >= f.maxY ||
      f.maxY - f.minY > 30 ||
      Math.abs(f.minY) > 1000
    )
      throw new Error("Invalid floor height range.");
    if (
      f.haFloorId !== undefined &&
      (typeof f.haFloorId !== "string" ||
        !f.haFloorId ||
        f.haFloorId.length > 128)
    )
      throw new Error("Invalid Home Assistant floor ID.");
    seen.add(f.id);
    return {
      id: f.id,
      name: f.name.trim(),
      minY: f.minY,
      maxY: f.maxY,
      ...(f.haFloorId ? { haFloorId: f.haFloorId } : {}),
    };
  });
  if (
    !Array.isArray(value.floorIds) ||
    value.floorIds.length > 30 ||
    new Set(value.floorIds).size !== value.floorIds.length ||
    value.floorIds.some((f) => !seen.has(f))
  )
    throw new Error("Choose existing floors for this room.");
  return {
    schemaVersion: 1,
    houseId: value.houseId,
    houseName: value.houseName.trim(),
    roomId: value.roomId,
    transform: [...t],
    floors,
    floorIds: [...value.floorIds],
  };
}
export function houseKey(text) {
  let h = 14695981039346656037n;
  for (const c of new TextEncoder().encode(text))
    h = BigInt.asUintN(64, (h ^ BigInt(c)) * 1099511628211n);
  return h.toString(16).padStart(16, "0");
}
export function placedPoint(p, t) {
  return [0, 1, 2].map(
    (i) => t[i] * p[0] + t[4 + i] * p[1] + t[8 + i] * p[2] + t[12 + i],
  );
}
export function houseModels(models) {
  const groups = new Map();
  for (const m of models)
    if (m.housePlacement && !m.members) {
      const p = validatePlacement(m.housePlacement);
      if (!groups.has(p.houseId)) groups.set(p.houseId, []);
      groups.get(p.houseId).push(m);
    }
  const result = [];
  for (const [houseId, rooms] of groups) {
    const reference = [...rooms].sort((a, b) =>
      (b.importedAt || "").localeCompare(a.importedAt || ""),
    )[0].housePlacement;
    for (const floor of [null, ...reference.floors]) {
      const included = rooms.filter(
        (m) => !floor || m.housePlacement.floorIds.includes(floor.id),
      );
      if (!included.length) continue;
      const model = {
        schemaVersion: 1,
        id: `h-${houseId}${floor ? "--" + floor.id : ""}`,
        title: reference.houseName + (floor ? " · " + floor.name : ""),
        units: "meters",
        up: "Y",
        controls: [],
        devices: [],
        bindings: {},
        ambient: 0.45,
        members: [],
        houseView: true,
        houseId,
        houseFloor: floor,
        deviceSettings: {},
      };
      for (const m of included) {
        const t = m.housePlacement.transform,
          key = (c) => `c-${houseKey(m.id + "/" + c)}`,
          node = (n) => `n-${houseKey(m.id + "/" + n)}`;
        const controls = (m.controls || [])
          .map((c) => ({
            ...c,
            id: key(c.id),
            label: `${m.title} · ${c.label}`,
            position: placedPoint(c.position, t),
            ...(c.markerPosition
              ? { markerPosition: placedPoint(c.markerPosition, t) }
              : {}),
            ...(c.lightGroup
              ? {
                  lightGroup: key(c.lightGroup),
                  lightGroupLabel: `${m.title} · ${c.lightGroupLabel}`,
                }
              : {}),
            nodeIds: (c.nodeIds || []).map(node),
            ...(c.group ? { group: key(c.group) } : {}),
            sourceModel: m.id,
            sourceControl: c.id,
            roomTitle: m.title,
          }))
          .filter(
            (c) =>
              !floor ||
              (c.position[1] >= floor.minY && c.position[1] < floor.maxY),
          );
        positionGroupMarkers(controls);
        model.controls.push(...controls);
        const visible = new Set(controls.map((c) => c.id));
        for (const c of controls)
          if (m.bindings?.[c.sourceControl])
            model.bindings[c.id] = m.bindings[c.sourceControl];
        for (const d of m.devices || [])
          if (visible.has(key(d.height))) {
            const device = {
              ...d,
              id: key(d.id),
              height: key(d.height),
              motion: d.motion ? key(d.motion) : undefined,
              macros: (d.macros || []).map(key),
            };
            model.devices.push(device);
            const settings = m.deviceSettings?.[d.id];
            if (settings)
              model.deviceSettings[device.id] = {
                macroNames: Object.fromEntries(
                  Object.entries(settings.macroNames || {}).map(([k, v]) => [
                    key(k),
                    v,
                  ]),
                ),
              };
          }
        // Room windows join one house-wide daylight rig; mode follows the first daylight room.
        if (m.daylight) {
          model.daylight ??= {
            mode: m.daylight.mode,
            entity: m.daylight.entity,
            windows: [],
          };
          for (const w of m.daylight.windows || []) {
            const position = placedPoint(w.position, t);
            if (
              floor &&
              !(position[1] >= floor.minY && position[1] < floor.maxY)
            )
              continue;
            model.daylight.windows.push({
              ...structuredClone(w),
              id: `w-${houseKey(m.id + "/" + w.id)}`,
              nodeId: node(w.nodeId),
              position,
              inward: [0, 1, 2].map(
                (i) =>
                  t[i] * w.inward[0] +
                  t[4 + i] * w.inward[1] +
                  t[8 + i] * w.inward[2],
              ),
              ...(w.coverId ? { coverId: key(w.coverId) } : {}),
              sourceModel: m.id,
            });
          }
        }
        model.members.push({
          model: m.id,
          ...(m.groupIcons ? { groupIcons: true } : {}),
          appearance: structuredClone(m.appearance || []),
          transform: t,
          sceneRevision: m.sceneRevision,
          controlIds: Object.fromEntries(
            (m.controls || []).map((c) => [c.id, key(c.id)]),
          ),
          nodeIds: Object.fromEntries(
            (m.controls || []).flatMap((c) =>
              (c.nodeIds || []).map((n) => [n, node(n)]),
            ),
          ),
        });
      }
      if (model.daylight && !model.daylight.windows.length)
        delete model.daylight;
      model.sceneRevision = houseKey(
        JSON.stringify(model.members) + JSON.stringify(floor),
      );
      result.push(model);
    }
  }
  return result;
}
