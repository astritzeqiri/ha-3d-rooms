// Crowded house views: a room whose device icons overlap on screen shows one
// chip ("Living room · 6") instead. Tapping the chip shows that room's icons
// in their real places. Zooming in far enough to separate the icons ungroups
// the room on its own, because grouping follows the icons' screen positions.

/**
 * `items` are visible room icons: `{ id, room, x, y, size }` with x/y the
 * icon centre in pixels. Rooms in `open` are never grouped.
 * Returns `[{ room, ids, x, y }]`, one per crowded room, at the centre of
 * its icons.
 */
export function groupMarkers(items, { open = new Set(), overlap = 0.9 } = {}) {
  const rooms = new Map();
  for (const item of items) {
    if (!item.room) continue;
    if (!rooms.has(item.room)) rooms.set(item.room, []);
    rooms.get(item.room).push(item);
  }
  const groups = [];
  for (const [room, members] of rooms) {
    if (members.length < 2 || open.has(room)) continue;
    let crowded = false;
    for (let i = 0; i < members.length && !crowded; i++)
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i],
          b = members[j];
        if (
          Math.hypot(a.x - b.x, a.y - b.y) <
          ((a.size + b.size) / 2) * overlap
        ) {
          crowded = true;
          break;
        }
      }
    if (!crowded) continue;
    groups.push({
      room,
      ids: members.map((m) => m.id),
      x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
    });
  }
  return groups;
}

/** True when a room's icons overlap at their real positions. */
export function roomCrowded(items, room, overlap = 0.9) {
  return (
    groupMarkers(
      items.filter((item) => item.room === room),
      { overlap },
    ).length > 0
  );
}
