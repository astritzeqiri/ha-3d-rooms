/** Houses/floors compose room visuals; entity setup belongs to source rooms. */
export function houseViewSummary(model) {
  // The floor switch beside the title already names the scope.
  const count = model?.members?.length || 0;
  return `${count} room${count === 1 ? "" : "s"}`;
}
