/**
 * Keep device icons on screen from sitting on top of each other while they
 * stay at their real spot: icons that would touch are pushed apart (never
 * further than `maxShift`), and the card draws a dot at the true spot with a
 * line to the moved icon. Icons that do not touch never move.
 *
 * `items`: `{ x, y, r }` (centre and radius in px). Returns one `{ dx, dy }`
 * per item, in order. Deterministic: the same input always gives the same
 * answer, so icons do not jitter while the camera moves.
 */
export function spreadIcons(
  items,
  { gap = 6, maxShift = 40, iterations = 80 } = {},
) {
  const n = items.length;
  const x = items.map((i) => i.x),
    y = items.map((i) => i.y);
  // Only icons that touch someone at their true spot take part.
  const touching = new Array(n).fill(false);
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      if (Math.hypot(x[a] - x[b], y[a] - y[b]) < items[a].r + items[b].r + gap)
        touching[a] = touching[b] = true;
  if (!touching.some(Boolean)) return items.map(() => ({ dx: 0, dy: 0 }));
  for (let step = 0; step < iterations; step++) {
    let moved = false;
    for (let a = 0; a < n; a++) {
      if (!touching[a]) continue;
      for (let b = 0; b < n; b++) {
        if (a === b) continue;
        let dx = x[a] - x[b],
          dy = y[a] - y[b];
        let d = Math.hypot(dx, dy);
        const need = items[a].r + items[b].r + gap;
        if (d >= need) continue;
        if (d < 0.01) {
          // Exactly on top of each other: split along a fixed direction
          // chosen by order, so the result does not depend on chance.
          const angle = ((a - b) * 2.399963) % (2 * Math.PI);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        // An icon that touches nobody else stays put: the other one moves
        // the whole way.
        const share = touching[b] ? 0.5 : 1;
        const push = (need - d) * share * 0.5;
        x[a] += (dx / d) * push;
        y[a] += (dy / d) * push;
        moved = true;
      }
      const ox = x[a] - items[a].x,
        oy = y[a] - items[a].y,
        shift = Math.hypot(ox, oy);
      if (shift > maxShift) {
        x[a] = items[a].x + (ox / shift) * maxShift;
        y[a] = items[a].y + (oy / shift) * maxShift;
      }
    }
    if (!moved) break;
  }
  return items.map((item, i) => ({
    dx: Math.round((x[i] - item.x) * 10) / 10,
    dy: Math.round((y[i] - item.y) * 10) / 10,
  }));
}
