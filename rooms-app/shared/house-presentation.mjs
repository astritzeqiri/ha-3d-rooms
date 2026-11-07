/** Houses/floors compose room visuals; entity setup belongs to source rooms. */
export function houseViewSummary(model) {
  const count = model?.members?.length || 0;
  const scope = model?.houseFloor?.name || "Whole house";
  return `${count} room${count === 1 ? "" : "s"} · ${scope}`;
}
