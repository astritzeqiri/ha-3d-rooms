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

/**
 * Confident entity matches for devices that are not connected yet, so a room
 * can be connected in one step. A match needs at least two shared words, or
 * one shared word that no other entity shares. Each entity is offered once
 * and entities already connected in this room are left alone.
 *
 * `devices` is `[{ id, label, pattern }]`; `context` adds words every device
 * shares (the room name). Returns `[{ controlId, entityId, name, strong }]`;
 * `strong` matches share two of the device's own words, or all of them.
 */
export function suggestBindings(
  devices,
  entities,
  { bindings = {}, context = "" } = {},
) {
  const taken = new Set(Object.values(bindings).filter(Boolean));
  const candidates = [];
  for (const device of devices) {
    if (bindings[device.id]) continue;
    const rows = rankEntities(entities, {
      label: `${context} ${device.label}`,
      pattern: device.pattern,
    }).filter((row) => !taken.has(row.entity.entity_id));
    // The device's own words must match, not only the room's.
    const own = words(device.label),
      [best, next] = rows;
    if (
      !best ||
      !own.some((word) => best.haystack.includes(word)) ||
      best.score === (next?.score ?? 0) ||
      (best.score < 2 && (next?.score ?? 0) > 0)
    )
      continue;
    const shared = own.filter((word) => best.haystack.includes(word)).length;
    // A one-word overlap with a long device name ("Sliding-door row · kitchen
    // end" → "Kitchen Lights") is a guess, not a match.
    if (shared * 2 < own.length) continue;
    candidates.push({
      controlId: device.id,
      entityId: best.entity.entity_id,
      name: best.name,
      strong: shared >= 2 || shared === own.length,
      score: best.score,
    });
  }
  // Two devices wanting one entity: the stronger match keeps it.
  const used = new Set();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((match) => !used.has(match.entityId) && used.add(match.entityId))
    .map(({ score, ...match }) => match)
    .sort(
      (a, b) =>
        devices.findIndex((d) => d.id === a.controlId) -
        devices.findIndex((d) => d.id === b.controlId),
    );
}
