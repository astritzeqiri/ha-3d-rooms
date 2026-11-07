import { houseId, roomName } from "./workspace.mjs";

export function viewKind(model) {
  return model?.houseView ? (model.houseFloor ? "floor" : "house") : "room";
}
export function viewScopeLabel(model, models) {
  if (!model) return "Missing space";
  const house = models.find(
    (m) => m.houseView && !m.houseFloor && m.houseId === houseId(model),
  );
  if (viewKind(model) === "house") return `${roomName(model)} · Whole house`;
  return [house && roomName(house), roomName(model)]
    .filter(Boolean)
    .join(" · ");
}
export function scopeOptions(models, kind) {
  return models.filter((model) => viewKind(model) === kind);
}
export function filterViews(views, models, { query = "", kind = "all" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return views.filter((view) => {
    const model = models.find((m) => m.id === view.layers[0].model);
    return (
      (kind === "all" || (model && viewKind(model) === kind)) &&
      `${view.title} ${viewScopeLabel(model, models)}`
        .toLocaleLowerCase()
        .includes(needle)
    );
  });
}
