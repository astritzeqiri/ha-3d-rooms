export function validateLightGroups(groups = [], controls) {
  if (!Array.isArray(groups) || groups.length > 100)
    throw Error("Provide up to 100 light groups.");
  const lights = new Set(
      controls.filter((c) => c.type === "light").map((c) => c.id),
    ),
    ids = new Set(),
    members = new Set();
  for (const g of groups) {
    if (
      !g ||
      typeof g !== "object" ||
      Object.keys(g).sort().join() !== "controls,entityId,id,label" ||
      typeof g.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(g.id) ||
      ["constructor", "prototype"].includes(g.id) ||
      ids.has(g.id) ||
      typeof g.label !== "string" ||
      !g.label.trim() ||
      g.label.length > 160 ||
      !Array.isArray(g.controls) ||
      g.controls.length < 2 ||
      g.controls.length > 200 ||
      new Set(g.controls).size !== g.controls.length ||
      g.controls.some((id) => !lights.has(id) || members.has(id)) ||
      typeof g.entityId !== "string" ||
      (g.entityId && !/^(light|switch)\.[a-z0-9_]+$/.test(g.entityId))
    )
      throw Error(
        "Choose a name, two or more distinct room lights and a compatible entity. Each light can belong to one group.",
      );
    ids.add(g.id);
    g.controls.forEach((id) => members.add(id));
  }
  return structuredClone(groups);
}
export function positionGroupMarkers(controls) {
  const groups = new Map();
  for (const c of controls)
    if (c.lightGroup) {
      if (!groups.has(c.lightGroup)) groups.set(c.lightGroup, []);
      groups.get(c.lightGroup).push(c);
    }
  for (const members of groups.values()) {
    const anchor = [0, 1, 2].map(
      (i) => members.reduce((s, c) => s + c.position[i], 0) / members.length,
    );
    members.forEach((c, i) => {
      c.lightGroupPrimary = i === 0;
      c.markerPosition = anchor;
      if (i === 0) c.label = c.lightGroupLabel;
    });
  }
  return controls;
}
export function applyLightGroups(source) {
  const model = structuredClone(source);
  for (const g of model.lightGroups || []) {
    const hidden = model.controls.some(
      (c) => g.controls.includes(c.id) && c.hidden,
    );
    for (const c of model.controls)
      if (g.controls.includes(c.id)) {
        if (hidden) c.hidden = true;
        c.sourceLabel = c.label;
        c.lightGroup = g.id;
        c.lightGroupLabel = g.label;
        if (g.entityId) model.bindings[c.id] = g.entityId;
        else delete model.bindings[c.id];
      }
  }
  positionGroupMarkers(model.controls || []);
  return model;
}
