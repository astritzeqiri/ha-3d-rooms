// View editor: extra entities. Any Home Assistant entity can be added to a
// view and placed anywhere on the model. In the 3D view each one is an icon
// like the devices' icons, with the same tools: drag it to move it, click it
// for the ring of round actions (undo, edit icon, position, hide, remove).
// Positions are in the view's own metres, as the card uses them.
import {
  CUSTOM_ENTITY_LOOK_KEYS,
  customEntityStateWords,
  CUSTOM_ENTITY_LIMIT,
  CUSTOM_ENTITY_SIZES,
  customEntityDefaultIcon,
  customEntitySettings,
  customEntityState,
  newCustomEntityId,
  validateCustomEntities,
} from "../shared/custom-entities.mjs";
import {
  iconLabel,
  markerIconPath,
  stateIconName,
} from "../shared/marker-icons.mjs";
import { entityIconArt, entityInState } from "../shared/entity-icon.mjs";
import { loadIconCatalog } from "./icon-catalog.js";
import { ICON_PICKER_HTML, wireIconPicker } from "./icon-picker.js";

const STROKE = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ACTIONS = {
  undo: '<path d="M3 10h10a7 7 0 0 1 0 14" transform="translate(0 -4)"/><path d="m7 2-4 4 4 4"/>',
  style: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/>',
  position:
    '<circle cx="12" cy="12" r="5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path data-eye-slash d="m3 3 18 18"/>',
  remove: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const FALLBACK = {
  viewBox: "0 0 24 24",
  html: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-2 5h3v6h1.5v2h-5v-2H11v-4h-1Z"/>',
};
const SIZE_OPTIONS = [
  [24, "Small"],
  [CUSTOM_ENTITY_SIZES.standard, "Standard"],
  [44, "Large"],
  [56, "Extra large"],
];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

/** The house-view room whose footprint holds a point (else the nearest). */
export function roomAt(boxes, point) {
  let best = null,
    distance = Infinity;
  for (const [room, box] of boxes || []) {
    const dx = Math.max(box.min.x - point[0], 0, point[0] - box.max.x),
      dz = Math.max(box.min.z - point[2], 0, point[2] - box.max.z),
      d = dx * dx + dz * dz;
    if (d < distance) {
      distance = d;
      best = room;
    }
  }
  return best;
}

/** Ring angles for `count` actions, turned away from the viewport's edges. */
export function ringAngles(x, y, width, height, count) {
  const [from, to] =
    x < 90
      ? y < 100
        ? [0, 90]
        : y > height - 100
          ? [0, -90]
          : [-90, 90]
      : x > width - 90
        ? y < 100
          ? [90, 180]
          : y > height - 100
            ? [-90, -180]
            : [-90, -270]
        : y < 100
          ? [180, 0]
          : [-180, 0];
  return Array.from(
    { length: count },
    (_, i) => from + (i * (to - from)) / Math.max(1, count - 1),
  );
}

export function initEntityMarkersEditor({
  viewport,
  host,
  scene,
  model,
  entities = () => [],
  resolveIcon,
  onChange,
  // The view's device defaults (`markers._defaults`), which extra entities
  // follow unless they set their own size, visibility or state label.
  defaults = () => ({}),
}) {
  let items = {},
    owner,
    layer,
    inspector,
    tools,
    picker,
    drag,
    selected = null,
    vertical = false,
    shift = false,
    catalogPromise,
    catalog = null,
    active = false,
    suppressClick = false;
  const buttons = new Map();
  const history = new Map();
  const needCatalog = () =>
    (catalogPromise ||= loadIconCatalog()
      .then((loaded) => {
        catalog = loaded;
        return loaded;
      })
      .catch(() => null));
  const stateOf = (entity) => entities().find((e) => e.entity_id === entity);
  const nameOf = (id) => {
    const item = items[id];
    return (
      item?.name ||
      stateOf(item?.entity)?.attributes?.friendly_name ||
      item?.entity ||
      "Entity"
    );
  };
  const houseRooms = () =>
    model()?.houseView && owner?.roomBoxes ? owner.roomBoxes : null;
  const lifting = () => vertical || shift;

  // Icons: a chosen name, else what Home Assistant draws for the entity,
  // else a plain icon for its kind.
  const requested = new Set();
  function iconArtFor(name) {
    if (!name) return undefined;
    const curated = markerIconPath(name);
    if (curated) return { viewBox: "0 0 24 24", html: curated };
    const known = catalog?.art(name);
    if (known || requested.has(name)) return known;
    requested.add(name);
    needCatalog()
      .then((loaded) => loaded?.resolve(name))
      .then((found) => {
        if (!found) return;
        refresh();
        renderList();
        tools?.sync?.();
      });
    return undefined;
  }
  const haArts = new Map();
  function entityArt(entityId, stateObj = stateOf(entityId)) {
    if (!resolveIcon || !stateObj) return undefined;
    const key = JSON.stringify([
      stateObj.entity_id,
      stateObj.state,
      stateObj.attributes?.icon,
      stateObj.attributes?.device_class,
    ]);
    if (haArts.has(key)) return haArts.get(key) || undefined;
    haArts.set(key, null);
    Promise.resolve(resolveIcon(stateObj))
      .then((data) => {
        const art = entityIconArt(data);
        if (!art) return;
        haArts.set(key, art);
        refresh();
        renderList();
      })
      .catch(() => {});
    return undefined;
  }
  const defaultArt = (entityId, stateObj = stateOf(entityId)) =>
    entityArt(entityId, stateObj) ||
    iconArtFor(customEntityDefaultIcon(entityId, stateObj)) ||
    FALLBACK;
  // The icon for the entity's current look: its own on/off icon, else HA's.
  const artFor = (item) =>
    iconArtFor(
      stateIconName(item, {}, customEntityState(stateOf(item.entity)).active),
    ) || defaultArt(item.entity);
  // The icon one slot shows, with Home Assistant's icon for that look.
  const slotArt = (item, slot) => {
    const active = slot === "icon";
    return (
      iconArtFor(stateIconName(item, {}, active)) ||
      defaultArt(item.entity, entityInState(stateOf(item.entity), active))
    );
  };
  const paint = (svg, art) => {
    if (!svg || !art) return;
    if (svg.innerHTML !== art.html) svg.innerHTML = art.html;
    svg.setAttribute("viewBox", art.viewBox || "0 0 24 24");
  };

  // Every change keeps an undo step, as the device icons do.
  function change(id, mutate) {
    if (!items[id]) return;
    const stack = history.get(id) || [];
    stack.push(structuredClone(items[id]));
    if (stack.length > 50) stack.shift();
    history.set(id, stack);
    mutate(items[id]);
    refresh();
    renderList();
    tools?.sync?.();
    onChange();
  }
  // Size, visibility and state label: a value equal to the view's default is
  // not stored, so the entity keeps following the defaults.
  function setLook(id, key, value) {
    const inherited = customEntitySettings({}, defaults())[key];
    change(id, (item) => {
      if (value === inherited) delete item[key];
      else item[key] = value;
    });
  }
  function setOption(id, key, value) {
    change(id, (item) => {
      if (value === undefined || value === "") delete item[key];
      else item[key] = value;
    });
  }
  function undo(id) {
    const stack = history.get(id);
    if (!stack?.length) return;
    items[id] = stack.pop();
    buildTools();
    refresh();
    renderList();
    onChange();
  }

  function buttonFor(id) {
    let button = buttons.get(id);
    if (button) return button;
    button = document.createElement("button");
    button.type = "button";
    button.className = "marker-editor-control entity-marker-control";
    button.dataset.entityMarker = id;
    button.dataset.movable = "true";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML =
      '<span class="marker-editor-icon" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="marker-editor-badge" aria-hidden="true"></span>';
    button.addEventListener("pointerdown", (event) => startDrag(event, id));
    button.addEventListener("pointermove", moveDrag);
    button.addEventListener("pointerup", endDrag);
    button.addEventListener("pointercancel", endDrag);
    button.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      select(selected === id ? null : id);
    });
    layer.append(button);
    buttons.set(id, button);
    return button;
  }

  // Placement on the model, state text, and the ring of tools.
  function refresh() {
    if (!active || !owner || !layer) return;
    const hide = scene() !== owner;
    const rooms = houseRooms();
    for (const [id, button] of buttons)
      if (!items[id]) {
        button.remove();
        buttons.delete(id);
      }
    for (const [id, item] of Object.entries(items)) {
      const button = buttonFor(id),
        settings = customEntitySettings(item, defaults()),
        point = owner.screenPoint(item.position),
        look = customEntityState(stateOf(item.entity));
      button.hidden =
        hide ||
        !point.visible ||
        (!!item.room && !!rooms && !rooms.has(item.room));
      button.style.setProperty("--marker-size", settings.size + "px");
      button.style.left = point.x - settings.size / 2 + "px";
      button.style.top = point.y - settings.size / 2 + "px";
      button.dataset.hidden = String(!settings.visible);
      button.dataset.active = String(look.active && settings.visible);
      button.dataset.lift = String(selected === id && lifting());
      paint(button.querySelector("svg"), artFor(item));
      const badge = button.querySelector(".marker-editor-badge");
      badge.textContent = settings.visible ? look.badge : "Hidden";
      badge.hidden = settings.visible && !settings.show_state;
      button.setAttribute(
        "aria-label",
        `Edit ${nameOf(id)} icon, ${badge.textContent}`,
      );
      button.setAttribute("aria-pressed", String(selected === id));
    }
    placeTools();
  }
  function placeTools() {
    const button = selected && buttons.get(selected);
    inspector.hidden = !tools || !button || button.hidden || !!drag?.moved;
    if (inspector.hidden) return;
    const width = viewport.clientWidth,
      height = viewport.clientHeight,
      size = customEntitySettings(items[selected], defaults()).size,
      x = parseFloat(button.style.left) + size / 2,
      y = parseFloat(button.style.top) + size / 2;
    inspector.style.left = x + "px";
    inspector.style.top = y + "px";
    const actions = [...tools.querySelectorAll(".marker-tool-actions button")],
      angles = ringAngles(x, y, width, height, actions.length),
      corner = (x < 90 || x > width - 90) && (y < 100 || y > height - 100),
      radius = Math.max(corner ? 88 : 54, size / 2 + 28);
    inspector.style.setProperty("--marker-ring", radius * 2 + "px");
    actions.forEach((action, i) => {
      const r = (angles[i] * Math.PI) / 180;
      action.style.left =
        Math.max(24, Math.min(width - 24, x + Math.cos(r) * radius)) - x + "px";
      action.style.top =
        Math.max(24, Math.min(height - 24, y + Math.sin(r) * radius)) -
        y +
        "px";
    });
    for (const panel of tools.querySelectorAll(
      ".marker-appearance, .marker-position",
    )) {
      if (panel.hidden) continue;
      const w = Math.min(272, width - 24),
        h = panel.offsetHeight || 140;
      panel.style.left =
        Math.max(12, Math.min(width - w - 12, x - w / 2)) - x + "px";
      panel.style.top =
        Math.max(12, Math.min(height - h - 12, y + size / 2 + 20)) - y + "px";
    }
  }

  // The tools of the selected icon, built like a device icon's.
  function buildTools() {
    picker = undefined;
    tools = undefined;
    inspector?.replaceChildren();
    const id = selected;
    const item = id && items[id];
    if (!item) return;
    const settings = customEntitySettings(item, defaults());
    tools = document.createElement("details");
    tools.className = "marker-device-settings";
    tools.open = true;
    tools.innerHTML = `<summary></summary>
      <div class="marker-tool-actions">
        <button type="button" data-action="undo" title="Undo last icon edit">${STROKE(ACTIONS.undo)}</button>
        <button type="button" data-action="style" title="Edit icon" aria-expanded="false">${STROKE(ACTIONS.style)}</button>
        <button type="button" data-action="position" title="Position" aria-expanded="false">${STROKE(ACTIONS.position)}</button>
        <button type="button" data-action="eye">${STROKE(ACTIONS.eye)}</button>
        <button type="button" data-action="remove" title="Remove from this view">${STROKE(ACTIONS.remove)}</button>
      </div>
      <div class="marker-appearance" hidden>
        <label class="entity-marker-name-field">Name<input type="text" maxlength="80" data-field="name" autocomplete="off"></label>
        <div class="marker-icon-field" data-icon-slot="icon"><span class="marker-field-label" data-slot-label></span><button type="button" class="marker-icon-current" data-icon-open="icon" aria-expanded="false"><span class="marker-icon-swatch" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="marker-icon-name"></span><span class="marker-icon-change">Change</span></button></div>
        <div class="marker-icon-field" data-icon-slot="icon_off"><span class="marker-field-label" data-slot-label></span><button type="button" class="marker-icon-current" data-icon-open="icon_off" aria-expanded="false"><span class="marker-icon-swatch" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="marker-icon-name"></span><span class="marker-icon-change">Change</span></button></div>
        <p class="muted small" data-inheritance></p><button type="button" data-inherit>Use view defaults</button><div class="marker-tool-checks"><label class="marker-check"><input type="checkbox" data-field="visible">Visible</label><label class="marker-check"><input type="checkbox" data-field="show_state">State label</label></div>
        <label>Size<select data-field="size">${SIZE_OPTIONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
        ${ICON_PICKER_HTML}
      </div>
      <div class="marker-position" hidden>
        <button type="button" data-move aria-pressed="false">Move up and down</button>
        <button type="button" data-centre>Back to the middle</button>
        <p class="marker-tool-hint entity-marker-hint">Drag the icon to move it. Hold Shift while dragging to raise or lower it.</p>
        <details><summary>Precise position</summary><p class="muted small">Position in metres.</p><div class="marker-axes"><label>X<input data-axis="0" type="number" required min="-1000" max="1000" step="any"></label><label>Y · height<input data-axis="1" type="number" required min="-1000" max="1000" step="any"></label><label>Z<input data-axis="2" type="number" required min="-1000" max="1000" step="any"></label></div></details>
      </div>`;
    inspector.append(tools);
    const $ = (sel) => tools.querySelector(sel);
    const appearance = $(".marker-appearance"),
      position = $(".marker-position"),
      style = $('[data-action="style"]'),
      place = $('[data-action="position"]');
    const name = $('[data-field="name"]'),
      visible = $('[data-field="visible"]'),
      state = $('[data-field="show_state"]'),
      size = $('[data-field="size"]');
    name.value = item.name || "";
    name.placeholder =
      stateOf(item.entity)?.attributes?.friendly_name || item.entity;
    if (![...size.options].some((o) => Number(o.value) === settings.size))
      size.add(new Option(`${settings.size} px`, settings.size));
    const words = customEntityStateWords(item.entity, stateOf(item.entity));
    $('[data-icon-slot="icon"] [data-slot-label]').textContent = words
      ? `Icon · ${words[0]}`
      : "Icon";
    $('[data-icon-slot="icon_off"] [data-slot-label]').textContent = words
      ? `Icon · ${words[1]}`
      : "";
    $('[data-icon-slot="icon_off"]').hidden = !words;
    let pickSlot = "icon";
    const sync = () => {
      const now = items[id];
      if (!now) return;
      const look = customEntitySettings(now, defaults());
      const own = CUSTOM_ENTITY_LOOK_KEYS.some((key) => now[key] !== undefined);
      $("[data-inheritance]").textContent = own
        ? "Custom settings for this entity"
        : "Using view defaults";
      $("[data-inherit]").disabled = !own;
      $('[data-action="undo"]').disabled = !history.get(id)?.length;
      const eye = $('[data-action="eye"]');
      eye.title = look.visible ? "Hide icon" : "Show icon";
      eye.setAttribute("aria-pressed", String(!look.visible));
      eye.querySelector("[data-eye-slash]").style.display = look.visible
        ? "none"
        : "";
      for (const b of tools.querySelectorAll(".marker-tool-actions button"))
        b.setAttribute("aria-label", `${nameOf(id)}: ${b.title}`);
      visible.checked = look.visible;
      state.checked = look.show_state;
      size.value = String(look.size);
      // One icon field per look; the second only for entities that have two.
      for (const slot of ["icon", "icon_off"]) {
        const field = $(`[data-icon-slot="${slot}"]`);
        paint(field.querySelector("svg"), slotArt(now, slot));
        field.querySelector(".marker-icon-name").textContent = now[slot]
          ? iconLabel(now[slot])
          : slot === "icon_off" && now.icon
            ? `Same as ${words[0].toLowerCase()}`
            : "Default";
      }
      $("[data-move]").setAttribute("aria-pressed", String(vertical));
      for (const input of tools.querySelectorAll("[data-axis]"))
        if (document.activeElement !== input)
          input.value = now.position[Number(input.dataset.axis)];
    };
    const toggle = (panel, button) => {
      picker?.close();
      const open = panel.hidden;
      appearance.hidden = position.hidden = true;
      style.setAttribute("aria-expanded", "false");
      place.setAttribute("aria-expanded", "false");
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      placeTools();
    };
    style.onclick = () => toggle(appearance, style);
    place.onclick = () => toggle(position, place);
    $('[data-action="undo"]').onclick = () => undo(id);
    $('[data-action="eye"]').onclick = () =>
      setLook(
        id,
        "visible",
        !customEntitySettings(items[id], defaults()).visible,
      );
    $('[data-action="remove"]').onclick = () => remove(id);
    // Typing a name is one undo step per pause, not per letter.
    let typing;
    name.oninput = () => {
      const value = name.value.trim() || undefined;
      if (!typing) setOption(id, "name", value);
      else {
        if (value) items[id].name = value;
        else delete items[id].name;
        refresh();
        renderList();
        onChange();
      }
      clearTimeout(typing);
      typing = setTimeout(() => (typing = undefined), 800);
    };
    name.onkeydown = (event) => {
      if (event.key === "Enter") event.preventDefault();
    };
    visible.onchange = () => setLook(id, "visible", visible.checked);
    state.onchange = () => setLook(id, "show_state", state.checked);
    size.onchange = () => setLook(id, "size", Number(size.value));
    $("[data-inherit]").onclick = () =>
      change(id, (it) => {
        for (const key of CUSTOM_ENTITY_LOOK_KEYS) delete it[key];
      });
    $("[data-move]").onclick = () => {
      vertical = !vertical;
      sync();
      refresh();
    };
    $("[data-centre]").onclick = () =>
      change(id, (it) => {
        it.position = startPoint();
        assignRoom(it);
      });
    for (const input of tools.querySelectorAll("[data-axis]"))
      input.onchange = () => {
        if (input.value === "" || !input.validity.valid) return;
        change(id, (it) => {
          it.position[Number(input.dataset.axis)] = Number(input.value);
          assignRoom(it);
        });
      };
    picker = wireIconPicker({
      root: appearance,
      defaultArt: defaultArt(item.entity),
      iconArtFor,
      needCatalog,
      current: () => items[id]?.[pickSlot] || "",
      onChoose: (value) => setOption(id, pickSlot, value || undefined),
      onToggle: (open) => {
        appearance.classList.toggle("picking-icon", open);
        for (const button of tools.querySelectorAll("[data-icon-open]"))
          button.setAttribute(
            "aria-expanded",
            String(open && button.dataset.iconOpen === pickSlot),
          );
        placeTools();
      },
    });
    for (const button of tools.querySelectorAll("[data-icon-open]"))
      button.onclick = () => {
        pickSlot = button.dataset.iconOpen;
        const off = pickSlot === "icon_off";
        picker.setDefaultLabel(
          off && items[id]?.icon
            ? `Same as ${words[0].toLowerCase()} icon`
            : "Default icon",
        );
        picker.setDefaultArt(
          off && items[id]?.icon
            ? slotArt({ ...items[id], icon_off: undefined }, "icon_off")
            : defaultArt(
                items[id].entity,
                entityInState(stateOf(items[id].entity), !off),
              ),
        );
        picker.open();
      };
    tools.sync = sync;
    sync();
  }

  function select(id) {
    const next = id && items[id] ? id : null;
    if (next === selected) return;
    selected = next;
    vertical = false;
    buildTools();
    for (const row of host?.querySelectorAll("[data-entity-row]") || []) {
      const on = row.dataset.entityRow === selected;
      row.dataset.selected = String(on);
      row
        .querySelector(".entity-card-main")
        ?.setAttribute("aria-pressed", String(on));
    }
    refresh();
  }

  function startDrag(event, id) {
    if (event.button > 0 || !owner) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {
      id,
      pointer: event.pointerId,
      target: event.currentTarget,
      world: [...items[id].position],
      from: [event.clientX, event.clientY],
      before: structuredClone(items[id]),
      moved: false,
      orbit: owner.orbit?.enabled,
    };
    if (owner.orbit) owner.orbit.enabled = false;
    drag.target.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.from[0], event.clientY - drag.from[1]) < 5
    )
      return;
    if (!drag.moved) {
      drag.moved = true;
      select(drag.id);
    }
    if (event.shiftKey || vertical) {
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
    items[drag.id].position = drag.world.map((v) => Number(v.toFixed(3)));
    refresh();
  }
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { id, orbit, moved, before, target } = drag;
    drag = undefined;
    target.releasePointerCapture?.(event.pointerId);
    if (owner?.orbit) owner.orbit.enabled = orbit ?? true;
    if (moved && items[id]) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 250);
      const stack = history.get(id) || [];
      stack.push(before);
      history.set(id, stack);
      assignRoom(items[id]);
      tools?.sync?.();
      onChange();
    }
    refresh();
  }
  // In a house view an entity belongs to the room under it, so it hides with
  // that room on floor and single-room views.
  function assignRoom(item) {
    const rooms = houseRooms(),
      room = rooms && roomAt(rooms, item.position);
    if (room) item.room = room;
    else delete item.room;
  }
  // A new entity starts in the middle of what is shown, a metre above the floor.
  function startPoint() {
    const box = owner?.bounds;
    if (!box || box.isEmpty?.()) return [0, 1, 0];
    const round = (v) => Number(v.toFixed(3));
    return [
      round((box.min.x + box.max.x) / 2),
      round(Math.min(box.max.y, box.min.y + 1)),
      round((box.min.z + box.max.z) / 2),
    ];
  }
  function add(entityId) {
    if (Object.keys(items).length >= CUSTOM_ENTITY_LIMIT) {
      setNote(`A view can have at most ${CUSTOM_ENTITY_LIMIT} extra entities.`);
      return;
    }
    const id = newCustomEntityId(items);
    items[id] = { entity: entityId, position: startPoint() };
    assignRoom(items[id]);
    history.delete(id);
    renderList();
    select(id);
    setNote(`${nameOf(id)} added. Drag its icon on the model to place it.`);
    onChange();
  }
  function remove(id) {
    const title = nameOf(id);
    if (!confirm(`Remove “${title}” from this view?`)) return;
    delete items[id];
    history.delete(id);
    if (selected === id) select(null);
    renderList();
    refresh();
    setNote(`${title} removed from this view.`);
    onChange();
  }
  function setNote(text) {
    const note = host?.querySelector(".entity-note");
    if (note) note.textContent = text;
  }

  // Sidebar: a search to add entities, then one card per entity.
  function renderList() {
    if (!host) return;
    const list = host.querySelector(".entity-cards");
    if (!list) return;
    const rows = Object.entries(items).map(([id, item]) => {
      const settings = customEntitySettings(item, defaults()),
        look = customEntityState(stateOf(item.entity));
      const row = document.createElement("li");
      row.className = "entity-card";
      row.dataset.entityRow = id;
      row.dataset.selected = String(selected === id);
      row.dataset.hidden = String(!settings.visible);
      row.innerHTML = `<button type="button" class="entity-card-main"><span class="entity-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="entity-card-text"><strong></strong><small></small></span><span class="entity-card-state"></span></button><button type="button" class="entity-card-remove" title="Remove from this view">${STROKE(ACTIONS.remove)}</button>`;
      paint(row.querySelector("svg"), artFor(item));
      row.querySelector("strong").textContent = nameOf(id);
      row.querySelector("small").textContent = `${look.badge} · ${item.entity}`;
      row.querySelector("small").title = item.entity;
      const chip = row.querySelector(".entity-card-state");
      chip.textContent = "Hidden";
      chip.hidden = settings.visible;
      const main = row.querySelector(".entity-card-main");
      main.title = "Edit its icon on the model";
      main.setAttribute(
        "aria-label",
        `${nameOf(id)}, ${settings.visible ? look.description : "hidden"}. Edit its icon on the model`,
      );
      main.setAttribute("aria-pressed", String(selected === id));
      main.onclick = () => select(selected === id ? null : id);
      main.onpointerenter = () =>
        buttons.get(id)?.setAttribute("data-highlight", "true");
      main.onpointerleave = () =>
        buttons.get(id)?.removeAttribute("data-highlight");
      const bin = row.querySelector(".entity-card-remove");
      bin.setAttribute("aria-label", `Remove ${nameOf(id)} from this view`);
      bin.onclick = () => remove(id);
      return row;
    });
    list.replaceChildren(...rows);
    host.querySelector(".entity-empty").hidden = rows.length > 0;
    const count = host.closest("details")?.querySelector(".entity-count");
    if (count) {
      count.textContent = rows.length ? String(rows.length) : "";
      count.hidden = !rows.length;
    }
  }
  function search(query) {
    const results = host?.querySelector(".entity-results"),
      input = host?.querySelector(".entity-search input");
    if (!results) return;
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    input.setAttribute("aria-expanded", String(!!terms.length));
    if (!terms.length) {
      results.replaceChildren();
      results.hidden = true;
      return;
    }
    const used = new Set(Object.values(items).map((i) => i.entity));
    const found = entities()
      .map((e) => ({
        id: e.entity_id,
        name: e.attributes?.friendly_name || e.entity_id,
      }))
      .filter((e) =>
        terms.every((t) => `${e.name} ${e.id}`.toLowerCase().includes(t)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
    results.replaceChildren(
      ...found.map((e) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<span class="entity-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="entity-card-text"><strong></strong><small>${esc(e.id)}</small></span><span class="entity-result-add">${used.has(e.id) ? "Add again" : "Add"}</span>`;
        paint(button.querySelector("svg"), defaultArt(e.id));
        button.querySelector("strong").textContent = e.name;
        button.onclick = () => {
          input.value = "";
          search("");
          add(e.id);
          input.focus();
        };
        li.append(button);
        return li;
      }),
    );
    if (!found.length) {
      const li = document.createElement("li");
      li.className = "entity-results-empty";
      li.textContent = entities().length
        ? "No entities match."
        : "Home Assistant entities are not available here.";
      results.append(li);
    }
    results.hidden = false;
  }
  function buildPanel() {
    if (!host) return;
    host.innerHTML = `<p class="entity-intro">Add any Home Assistant entity, then drag its icon on the model to place it.</p>
      <div class="entity-search">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" role="combobox" placeholder="Search entities to add" aria-label="Search entities to add" aria-expanded="false" aria-controls="entity-results" aria-autocomplete="list" autocomplete="off" spellcheck="false">
        <ul class="entity-results" id="entity-results" role="listbox" aria-label="Entities" hidden></ul>
      </div>
      <div class="entity-empty"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span>No extra entities yet. Search above to add one.</span></div>
      <ul class="entity-cards" aria-label="Extra entities in this view"></ul>
      <p class="entity-note muted small" role="status"></p>`;
    const input = host.querySelector(".entity-search input");
    input.oninput = () => search(input.value);
    input.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        host.querySelector(".entity-results button")?.click();
      } else if (event.key === "Escape") {
        event.stopPropagation();
        input.value = "";
        search("");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        host.querySelector(".entity-results button")?.focus();
      }
    };
    host.querySelector(".entity-results").onkeydown = (event) => {
      const all = [...host.querySelectorAll(".entity-results button")],
        at = all.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = at + (event.key === "ArrowDown" ? 1 : -1);
        (next < 0 ? input : all[Math.min(next, all.length - 1)])?.focus();
      } else if (event.key === "Escape") {
        event.stopPropagation();
        input.value = "";
        search("");
        input.focus();
      }
    };
    renderList();
  }

  function follow() {
    if (!owner || owner.options.onRender?.customEntities) return;
    const previous = owner.options.onRender;
    const hook = () => {
      previous?.();
      refresh();
    };
    Object.assign(hook, previous);
    hook.customEntities = true;
    owner.options.onRender = hook;
  }
  const outside = (event) => {
    const path = event.composedPath();
    const box = host?.querySelector(".entity-search");
    if (box && !path.includes(box)) search("");
    if (!selected || drag) return;
    if (
      path.some(
        (el) =>
          el === inspector ||
          el?.dataset?.entityMarker ||
          el?.dataset?.entityRow,
      )
    )
      return;
    select(null);
  };
  const keys = (event) => {
    if (event.key === "Shift" && shift !== (event.type === "keydown")) {
      shift = event.type === "keydown";
      refresh();
    }
    if (event.type !== "keydown" || !selected) return;
    if (event.key === "Escape") {
      if (picker?.isOpen) return;
      select(null);
    } else if (
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      event.key.toLowerCase() === "z" &&
      !event.target?.closest?.("input, textarea, select")
    ) {
      event.preventDefault();
      undo(selected);
    }
  };
  function close() {
    if (drag && owner?.orbit) owner.orbit.enabled = drag.orbit ?? true;
    drag = undefined;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keys);
    document.removeEventListener("keyup", keys);
    shift = false;
    vertical = false;
    selected = null;
    picker = undefined;
    tools = undefined;
    buttons.clear();
    history.clear();
    layer?.remove();
    inspector?.remove();
    layer = inspector = undefined;
    if (host) host.replaceChildren();
    active = false;
  }
  return {
    /** Start editing the view's extra entities (`markers._entities`). */
    open(markers) {
      close();
      owner = scene();
      if (!owner) return;
      active = true;
      items = structuredClone(validateCustomEntities(markers?._entities || {}));
      layer = document.createElement("div");
      layer.className = "marker-editor-overlay entity-marker-overlay";
      inspector = document.createElement("div");
      inspector.className = "marker-floating-tools entity-marker-tools";
      inspector.hidden = true;
      inspector.setAttribute("role", "region");
      inspector.setAttribute("aria-label", "Entity icon tools");
      viewport.append(layer, inspector);
      buildPanel();
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("keydown", keys);
      document.addEventListener("keyup", keys);
      follow();
      refresh();
    },
    close,
    /** Redraw, e.g. after the view's device defaults changed. */
    paint() {
      refresh();
      renderList();
      tools?.sync?.();
    },
    /** The view's `_entities` value, or undefined when there are none. */
    read() {
      const clean = validateCustomEntities(items);
      return Object.keys(clean).length ? clean : undefined;
    },
  };
}
