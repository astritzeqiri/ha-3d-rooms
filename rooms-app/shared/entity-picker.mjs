const STOP = new Set(["the", "light", "lights", "lamp", "switch", "cover"]);
const words = (text) =>
  String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));

/**
 * Entities a device can be connected to, best first: the current choice, then
 * entities whose name shares words with the device label, then by name.
 * With a search query only matching entities are returned (every term must match).
 */
export function rankEntities(
  entities,
  { label = "", pattern, query = "", selectedId = "" },
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const labelWords = words(label);
  return entities
    .filter((entity) => pattern.test(entity.entity_id))
    .map((entity) => {
      const name = entity.attributes?.friendly_name || entity.entity_id;
      const haystack = `${name} ${entity.entity_id}`.toLowerCase();
      const score = terms.length
        ? 0
        : labelWords.filter((word) => haystack.includes(word)).length;
      return {
        entity,
        name,
        haystack,
        selected: entity.entity_id === selectedId,
        suggested: score > 0 && entity.entity_id !== selectedId,
        score,
      };
    })
    .filter((row) => terms.every((term) => row.haystack.includes(term)))
    .sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        b.score - a.score ||
        a.name.localeCompare(b.name),
    );
}
