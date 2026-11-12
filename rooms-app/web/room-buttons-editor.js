// View editor, house views: choose when each room's "show this room on its own"
// button appears on the card, where it sits, and how the room is framed once
// opened. Every room's button is a pill in the 3D view. Drag it to move it (on
// a horizontal plane at its height, also beside the model); click it for round
// sub-buttons, as the device icons have: when it shows, up/down dragging, the
// opening angle, and reset. Positions are in the view's own metres, as the
// card uses them, so a button stays fixed to the model as the camera turns.
import {
  focusableRooms,
  roomButtonShows,
  roomFocusView,
  spreadButtons,
} from "../shared/room-focus.mjs";
import { enableTooltips } from "../shared/tooltip.mjs";
import {
  ROOM_BUTTON_SIZES,
  validateRoomButtons,
} from "../shared/marker-settings.mjs";

const MODES = [
  ["auto", "Automatic", "only while other rooms hide it"],
  ["always", "Always", "shown on the card"],
  ["never", "Never", "hidden on the card"],
];
const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>';
// The first button has a look for each of its three states.
const MODE_ICONS = {
  auto: `${EYE}<text x="12" y="15.4" font-size="9" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">A</text>`,
  always: `${EYE}<circle cx="12" cy="12" r="3.2" fill="currentColor"/>`,
  never: `${EYE}<circle cx="12" cy="12" r="3"/><path d="m3 3 18 18"/>`,
};
const ICONS = {
  size: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  updown: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  angle:
    '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  reset:
    '<path d="M3 10h10a7 7 0 0 1 0 14" transform="translate(0 -4)"/><path d="m7 2-4 4 4 4"/>',
};
const SIZES = [
  [24, "Small"],
  [ROOM_BUTTON_SIZES.standard, "Standard"],
  [40, "Large"],
  [52, "Extra large"],
];
const sizeName = (size) =>
  SIZES.find(([value]) => value === size)?.[1] || `${size} px`;

export function initRoomButtonsEditor({ viewport, scene, model, onChange }) {
  let rooms = {},
    ghosts = new Map(),
    owner,
    drag,
    selected = null,
    previewing = null,
    vertical = new Set(),
    tools,
    status,
    bar,
    guide,
    stopTips,
    shift = false,
    active = false;
  const entry = (room) => rooms[room] || (rooms[room] = {});
  const tidy = (room) => {
    const item = rooms[room];
    if (item && !Object.keys(item).length) delete rooms[room];
  };
  const titleOf = (room) =>
    focusableRooms(model()).find((r) => r.room === room)?.title || "Room";
  const modeOf = (room) => rooms[room]?.mode || "auto";
  const sizeOf = (room) => rooms[room]?.size ?? ROOM_BUTTON_SIZES.standard;
  const hasAngle = (room) =>
    rooms[room]?.heading !== undefined || rooms[room]?.tilt !== undefined;

  // Raising and lowering: the up/down sub-button, or Shift while dragging.
  const lifting = (room) => vertical.has(room) || shift;
  const heightOf = (room) => {
    const world = JSON.parse(ghosts.get(room)?.dataset.world || "null");
    return world ? world[1] : null;
  };
  function describe(room) {
    const [, label, note] = MODES.find(([value]) => value === modeOf(room));
    if (lifting(room) && heightOf(room) !== null)
      return `${titleOf(room)} · drag it up or down (side to side does nothing) · height ${heightOf(room).toFixed(2)} m`;
    return `${titleOf(room)} · button: ${label} (${note}) · size: ${sizeName(sizeOf(room)).toLowerCase()} · angle: ${
      hasAngle(room)
        ? `turned ${Math.round(rooms[room].heading ?? 0)}°, tilted ${Math.round(rooms[room].tilt ?? 0)}°`
        : "automatic"
    }`;
  }
  function syncTools() {
    const room = selected;
    const ghost = room && ghosts.get(room);
    const show = !!ghost && !ghost.hidden && !previewing && !drag;
    tools.hidden = !show;
    for (const [key, other] of ghosts)
      other.dataset.lift = String(key === room && lifting(room));
    syncGuide(room, ghost);
    status.hidden = !room || !!previewing;
    if (!room) return;
    status.textContent = describe(room);
    const [mode, size, updown, angle, reset] = tools.children;
    mode.title = `Button: ${MODES.find(([v]) => v === modeOf(room))[1]} — click to change`;
    mode.setAttribute("aria-label", mode.title);
    mode.dataset.mode = modeOf(room);
    mode.querySelector("svg").innerHTML = MODE_ICONS[modeOf(room)];
    size.title = `Size: ${sizeName(sizeOf(room))} — click for the next size`;
    size.setAttribute("aria-label", size.title);
    size.dataset.size = String(sizeOf(room));
    updown.setAttribute("aria-pressed", String(vertical.has(room)));
    updown.title = vertical.has(room)
      ? "Dragging moves it up and down — click for sideways"
      : "Drag it up and down instead of sideways (or hold Shift)";
    angle.setAttribute("aria-pressed", String(hasAngle(room)));
    reset.hidden = !rooms[room]?.position;
    if (!show) return;
    // Round sub-buttons around the button, away from the card's edges.
    const box = viewport.getBoundingClientRect(),
      at = ghost.getBoundingClientRect(),
      x = at.left + at.width / 2 - box.left,
      y = at.top + at.height / 2 - box.top,
      w = viewport.clientWidth,
      h = viewport.clientHeight;
    tools.style.left = x + "px";
    tools.style.top = y + "px";
    // Where the arc of sub-buttons starts and ends, turned away from the edges.
    const [from, to] =
      x < 90
        ? y < 100
          ? [0, 90]
          : y > h - 100
            ? [0, -90]
            : [-90, 90]
        : x > w - 90
          ? y < 100
            ? [90, 180]
            : y > h - 100
              ? [-90, -180]
              : [-90, -270]
          : y < 100
            ? [180, 0]
            : [-180, 0];
    const visible = [...tools.children].filter((b) => !b.hidden),
      angles = visible.map(
        (_, i) => from + (i * (to - from)) / Math.max(1, visible.length - 1),
      );
    const radius = Math.max(58, at.width / 2 + 24);
    visible.forEach((button, i) => {
      const radians = (angles[i] * Math.PI) / 180;
      button.style.left =
        Math.max(24, Math.min(w - 24, x + Math.cos(radians) * radius)) -
        x +
        "px";
      button.style.top =
        Math.max(24, Math.min(h - 24, y + Math.sin(radians) * radius)) -
        y +
        "px";
    });
  }
  // While raising or lowering, a dashed line runs from the button down to the
  // floor under it, so it is clear which way it moves.
  function syncGuide(room, ghost) {
    const on =
      !!room && !!ghost && !ghost.hidden && !previewing && lifting(room);
    guide.hidden = !on;
    if (!on) return;
    const world = JSON.parse(ghost.dataset.world || "null"),
      box = owner.roomBoxes?.get(room);
    if (!world) {
      guide.hidden = true;
      return;
    }
    const floor = owner.screenPoint([world[0], box ? box.min.y : 0, world[2]]),
      at = ghost.getBoundingClientRect(),
      view = viewport.getBoundingClientRect(),
      x = at.left + at.width / 2 - view.left,
      y = at.top + at.height / 2 - view.top;
    guide.style.left = x + "px";
    guide.style.top = Math.min(y, floor.y) + "px";
    guide.style.height = Math.abs(floor.y - y) + "px";
    guide.dataset.floor = floor.y >= y ? "below" : "above";
  }
  function select(room) {
    selected = room;
    for (const [key, ghost] of ghosts)
      ghost.dataset.selected = String(key === room);
    syncTools();
  }
  function paint() {
    if (!active || !owner || scene() !== owner || previewing) {
      for (const ghost of ghosts.values()) ghost.hidden = true;
      if (tools) syncTools();
      return;
    }
    const positions = Object.fromEntries(
      Object.entries(rooms)
        .filter(([, item]) => item.position)
        .map(([room, item]) => [room, item.position]),
    );
    const items = [];
    for (const point of owner.roomFrontPoints(positions)) {
      const ghost = ghosts.get(point.room);
      if (!ghost) continue;
      ghost.hidden = !point.visible;
      ghost.dataset.world = JSON.stringify(point.world);
      ghost.dataset.manual = String(point.manual);
      // Dimmed: the card would not show this button for the room.
      ghost.dataset.dim = String(
        !roomButtonShows(modeOf(point.room), point.exposure),
      );
      // As on the card: placed buttons are centred on their spot, others hang
      // below the room's edge, and buttons that would overlap move apart.
      const size = sizeOf(point.room),
        offset = point.manual ? -size / 2 : 6;
      ghost.style.setProperty("--room-tag-size", size + "px");
      ghost.style.left = point.x + "px";
      ghost.style.top = point.y + "px";
      if (
        !ghost.hidden &&
        ghost.dataset.dim === "false" &&
        !drag?.ghost?.isSameNode(ghost)
      )
        items.push({
          ghost,
          offset,
          x: point.x,
          y: point.y + offset,
          w: ghost.offsetWidth || 80,
          h: size,
          fixed: point.manual,
        });
    }
    const ys = spreadButtons(items);
    items.forEach((item, i) => {
      item.ghost.style.top = ys[i] - item.offset + "px";
    });
    syncTools();
  }
  // The scene calls this after every draw so the buttons follow the camera.
  function follow() {
    if (!owner || owner.options.onRender?.roomButtons) return;
    const previous = owner.options.onRender;
    const hook = () => {
      previous?.();
      paint();
    };
    Object.assign(hook, previous);
    hook.roomButtons = true;
    owner.options.onRender = hook;
  }
  function startDrag(event, room, ghost) {
    if (event.button > 0 || !owner) return;
    event.preventDefault();
    const world = JSON.parse(ghost.dataset.world || "null");
    if (!world) return;
    drag = {
      room,
      ghost,
      id: event.pointerId,
      world,
      from: [event.clientX, event.clientY],
      moved: false,
      orbit: owner.orbit?.enabled,
    };
    // The camera stays still while a button is dragged.
    if (owner.orbit) owner.orbit.enabled = false;
    ghost.setPointerCapture?.(event.pointerId);
    ghost.dataset.dragging = "true";
    select(room);
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.from[0], event.clientY - drag.from[1]) < 5
    )
      return;
    drag.moved = true;
    // Shift (or the up/down sub-button) raises and lowers the button;
    // otherwise it slides on the plane at its current height.
    if (event.shiftKey || vertical.has(drag.room)) {
      const y = owner.verticalPoint(event.clientX, event.clientY, drag.world);
      if (y === null) return;
      drag.world = [drag.world[0], y, drag.world[2]];
    } else {
      const point = owner.groundPoint(
        event.clientX,
        event.clientY,
        drag.world[1],
      );
      if (!point) return;
      drag.world = point;
    }
    entry(drag.room).position = drag.world.map((v) => Number(v.toFixed(3)));
    paint();
  }
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const { ghost, room, orbit, moved } = drag;
    drag = undefined;
    delete ghost.dataset.dragging;
    ghost.releasePointerCapture?.(event.pointerId);
    if (owner?.orbit) owner.orbit.enabled = orbit ?? true;
    if (moved) onChange();
    // A click (not a drag) shows or hides the sub-buttons.
    else if (
      event.type === "pointerup" &&
      selected === room &&
      ghost.dataset.wasSelected === "true"
    )
      select(null);
    delete ghost.dataset.wasSelected;
    paint();
  }
  // Framing: show one room on its own, let the user turn it, keep the angle.
  function startAngle(room) {
    if (previewing || !owner) return;
    const target = roomFocusView(model(), room);
    if (!target) return;
    const saved = rooms[room];
    if (saved?.heading !== undefined || saved?.tilt !== undefined)
      target.focusFrame = { heading: saved.heading, tilt: saved.tilt };
    // Set first: switching the scene reports camera changes the view's own
    // camera must not pick up.
    previewing = room;
    if (!owner.setHouseView(target)) {
      previewing = null;
      return;
    }
    viewport.classList.add("room-angle-preview");
    bar.querySelector("span").textContent =
      `Turn the model to the angle you want for ${titleOf(room)}.`;
    bar.querySelector("[data-auto]").hidden = !hasAngle(room);
    bar.hidden = false;
    paint();
  }
  function leaveAngle(how) {
    if (!previewing) return;
    const room = previewing;
    if (how === "keep" && owner) {
      const view = owner.captureView?.();
      if (view) {
        const round = (v) => Math.round(v * 10) / 10;
        entry(room).heading = round(view.heading) % 360;
        entry(room).tilt = round(view.tilt);
      }
    } else if (how === "auto") {
      delete entry(room).heading;
      delete entry(room).tilt;
      tidy(room);
    }
    viewport.classList.remove("room-angle-preview");
    bar.hidden = true;
    // Back to the house, framed as the view had it (still ignoring camera
    // reports until it is done).
    owner?.setHouseView(model());
    previewing = null;
    paint();
    if (how !== "cancel") onChange();
  }
  function build(list) {
    const svg = (name) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? MODE_ICONS.auto}</svg>`;
    tools = document.createElement("div");
    tools.className = "room-button-tools";
    tools.hidden = true;
    tools.setAttribute("role", "toolbar");
    tools.setAttribute("aria-label", "Room button tools");
    const action = (name, title, onclick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tool = name;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = svg(name);
      button.onclick = onclick;
      tools.append(button);
    };
    action("mode", "Button", () => {
      const next =
        MODES[(MODES.findIndex(([v]) => v === modeOf(selected)) + 1) % 3][0];
      if (next === "auto") delete entry(selected).mode;
      else entry(selected).mode = next;
      tidy(selected);
      paint();
      onChange();
    });
    action("size", "Size", () => {
      const at = SIZES.findIndex(([value]) => value >= sizeOf(selected) + 1),
        next = SIZES[at === -1 ? 0 : at][0];
      if (next === ROOM_BUTTON_SIZES.standard) delete entry(selected).size;
      else entry(selected).size = next;
      tidy(selected);
      paint();
      onChange();
    });
    action("updown", "Up and down", () => {
      if (vertical.has(selected)) vertical.delete(selected);
      else vertical.add(selected);
      syncTools();
    });
    action("angle", "Opening angle", () => startAngle(selected));
    action("reset", "Put the button back in front of the room", () => {
      delete entry(selected).position;
      tidy(selected);
      paint();
      onChange();
    });
    status = document.createElement("div");
    status.className = "room-button-status";
    status.hidden = true;
    status.setAttribute("role", "status");
    bar = document.createElement("div");
    bar.className = "room-angle-bar";
    bar.hidden = true;
    bar.append(document.createElement("span"));
    for (const [label, how, extra] of [
      ["Use this angle", "keep", "primary"],
      ["Automatic angle", "auto", ""],
      ["Cancel", "cancel", ""],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (extra) button.className = extra;
      if (how === "auto") button.dataset.auto = "";
      button.onclick = () => leaveAngle(how);
      bar.append(button);
    }
    guide = document.createElement("div");
    guide.className = "room-button-guide";
    guide.hidden = true;
    viewport.append(tools, status, bar, guide);
    stopTips = enableTooltips(viewport, viewport);
    for (const { room, title } of list) {
      const ghost = document.createElement("div");
      ghost.className = "room-button-ghost has-tip";
      ghost.hidden = true;
      ghost.dataset.room = room;
      ghost.title = `${title}: drag to move, click for options`;
      ghost.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span></span>';
      ghost.querySelector("span").textContent = title;
      ghost.addEventListener("pointerdown", (e) => {
        ghost.dataset.wasSelected = String(selected === room);
        startDrag(e, room, ghost);
      });
      ghost.addEventListener("pointermove", moveDrag);
      ghost.addEventListener("pointerup", endDrag);
      ghost.addEventListener("pointercancel", endDrag);
      viewport.append(ghost);
      ghosts.set(room, ghost);
    }
  }
  // Clicking anywhere else puts the sub-buttons away.
  const outside = (event) => {
    if (!selected || previewing) return;
    const path = event.composedPath();
    if (
      path.some(
        (el) => el === tools || el?.classList?.contains("room-button-ghost"),
      )
    )
      return;
    select(null);
  };
  const shiftKey = (event) => {
    if (event.key !== "Shift" || shift === (event.type === "keydown")) return;
    shift = event.type === "keydown";
    syncTools();
  };
  const escape = (event) => {
    if (event.key !== "Escape") return;
    if (previewing) leaveAngle("cancel");
    else if (selected) select(null);
  };
  function close() {
    if (drag && owner?.orbit) owner.orbit.enabled = drag.orbit ?? true;
    drag = undefined;
    if (previewing) leaveAngle("cancel");
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", escape);
    document.removeEventListener("keydown", shiftKey);
    document.removeEventListener("keyup", shiftKey);
    shift = false;
    vertical = new Set();
    selected = null;
    for (const ghost of ghosts.values()) ghost.remove();
    ghosts = new Map();
    tools?.remove();
    status?.remove();
    guide?.remove();
    stopTips?.();
    stopTips = undefined;
    bar?.remove();
    active = false;
  }
  return {
    /** Start editing the view's room buttons (`markers._rooms`). */
    open(markers) {
      close();
      owner = scene();
      const list = focusableRooms(model());
      if (!list.length || !owner) return;
      active = true;
      rooms = structuredClone(validateRoomButtons(markers?._rooms || {}));
      build(list);
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("keydown", escape);
      document.addEventListener("keydown", shiftKey);
      document.addEventListener("keyup", shiftKey);
      follow();
      paint();
    },
    close,
    paint,
    /** True while a room is shown alone to choose its angle. */
    previewing: () => !!previewing,
    /** The view's `_rooms` value, or undefined when every room is automatic. */
    read() {
      const clean = validateRoomButtons(rooms);
      return Object.keys(clean).length ? clean : undefined;
    },
  };
}
