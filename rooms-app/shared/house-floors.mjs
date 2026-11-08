/**
 * Whole-house and per-floor views of one house, in catalog order (whole house
 * first). Returns an empty list for rooms or houses with a single view, so
 * callers only offer a floor switcher when there is something to switch to.
 */
export function houseFloorOptions(models, model) {
  if (!model?.houseView || !Array.isArray(models)) return [];
  const views = models.filter(
    (m) => m?.houseView && m.houseId === model.houseId,
  );
  if (views.length < 2) return [];
  return views
    .map((m) => ({
      id: m.id,
      floorId: m.houseFloor?.id ?? null,
      label: m.houseFloor?.name || "Whole house",
    }))
    .sort((a, b) => (a.floorId === null ? -1 : b.floorId === null ? 1 : 0));
}

/** The chosen floor of the configured house, or the configured model itself. */
export function selectHouseView(models, configured, selected) {
  if (!selected || selected === configured?.id) return configured;
  return (
    (houseFloorOptions(models, configured).some((o) => o.id === selected) &&
      models.find((m) => m.id === selected)) ||
    configured
  );
}

/**
 * What a card downloads: with a floor switcher, the whole house once (so every
 * floor can be shown in place); otherwise just the configured room or view.
 */
export function houseLoadPlan(models, configured, switcher = true) {
  const floors = switcher ? houseFloorOptions(models, configured) : [];
  if (!floors.length) return { model: configured, floors: [], views: [] };
  const views = floors.map((floor) => models.find((m) => m.id === floor.id));
  return {
    model: views.find((m) => !m.houseFloor) || configured,
    floors,
    views,
  };
}
