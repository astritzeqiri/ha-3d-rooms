// Room focus: from a house or floor card, show one room on its own (like the
// room's own card) and go back to the house. The focused view is derived from
// the loaded house view, so nothing is downloaded and nothing is saved.
import { shortRoomTitle } from "./workspace.mjs";

/** Title of a member room: the house view's room titles, else its devices. */
export function roomTitleOf(view, roomId) {
  return (
    view?.roomTitles?.[roomId] ||
    view?.controls?.find((c) => c.sourceModel === roomId)?.roomTitle ||
    "Room"
  );
}

/**
 * Rooms a house or floor view can focus on: `[{ room, title }]`. Empty for
 * single rooms, an already focused view, or a view with only one room.
 */
export function focusableRooms(view) {
  if (!view?.houseView || view.focusRoom || (view.members?.length || 0) < 2)
    return [];
  return view.members.map((member) => ({
    room: member.model,
    title: shortRoomTitle(roomTitleOf(view, member.model)),
  }));
}

/**
 * The view of one member room. It keeps the house view's id, so every
 * backend call (and the update check) still addresses the loaded view, and
 * it drops floor clipping so the whole room shows. Null when not possible.
 */
export function roomFocusView(view, roomId) {
  const member = view?.members?.find((m) => m.model === roomId);
  if (!member || !focusableRooms(view).length) return null;
  return {
    ...view,
    title: roomTitleOf(view, roomId),
    members: [member],
    controls: view.controls.filter((c) => c.sourceModel === roomId),
    houseFloor: null,
    focusRoom: roomId,
  };
}

/**
 * Where a room's button goes: the middle of the floor edge that is lowest on
 * screen, i.e. in front of the room as seen from the camera. `points` are
 * screen points `{ x, y, visible }`.
 */
export function frontPoint(points) {
  let best = null;
  for (const point of points) if (!best || point.y > best.y) best = point;
  return best;
}

/** Exposure below which a room counts as hidden from the house view. */
export const HIDDEN_BELOW = 0.6;
const REVEAL_ABOVE = 0.7;

/**
 * Whether a room's button shows. "always" and "never" are the room's own
 * setting; "auto" (the default) shows it while another room covers most of
 * this one. A shown button stays until the room is clearly visible, so it
 * does not flicker while the camera moves.
 */
export function roomButtonShows(mode, exposure, wasShown = false) {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return exposure < (wasShown ? REVEAL_ABOVE : HIDDEN_BELOW);
}

/**
 * Keep automatically placed buttons from covering each other (or a fixed one):
 * a button that overlaps an earlier one moves down. `items` are
 * `{ x, y, w, h, fixed }` (x centre, y top); returns the new y of each.
 */
export function spreadButtons(items, gap = 4) {
  const placed = [],
    ys = items.map((item) => item.y);
  const order = items
    .map((item, index) => index)
    .sort(
      (a, b) =>
        Number(!!items[b].fixed) - Number(!!items[a].fixed) ||
        items[a].y - items[b].y,
    );
  for (const index of order) {
    const item = items[index];
    let y = item.y;
    if (!item.fixed)
      for (let tries = 0; tries < 12; tries++) {
        const clash = placed.find(
          (p) =>
            Math.abs(p.x - item.x) < (p.w + item.w) / 2 + gap &&
            y < p.y + p.h + gap &&
            p.y < y + item.h + gap,
        );
        if (!clash) break;
        y = clash.y + clash.h + gap;
      }
    ys[index] = y;
    placed.push({ x: item.x, y, w: item.w, h: item.h });
  }
  return ys;
}
