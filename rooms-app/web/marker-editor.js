import {
  markerAppearance,
  applyMarkerTone,
  AC_ICON_PATH,
  LOCK_ICON_PATH,
} from "../shared/marker.mjs";
import { deviceForControl } from "../shared/device.mjs";
import { deviceLabel } from "../shared/workspace.mjs";
import {
  markerSettings,
  markerLayout,
  validateMarkers,
} from "../shared/marker-settings.mjs";
import {
  MARKER_ICON_GROUPS,
  iconLabel,
  markerIconPath,
  markerStateWords,
  stateIconName,
} from "../shared/marker-icons.mjs";
import { entityIconArt, entityInState } from "../shared/entity-icon.mjs";
import { loadIconCatalog } from "./icon-catalog.js";
import { isMarkerIcon } from "../shared/marker-icons.mjs";

/**
 * The editor's controls select settings and place anchors; they never send commands.
 *
 * `mode: "view"` edits one dashboard view's icons (offsets, icons, size, …).
 * `mode: "room"` edits a room's own icons, which every view starts from: a
 * move or icon choice is saved at once through `onRoomChange(id, changes)`
 * (`{ position }` in room metres or `{ icon }`; null resets).
 */
export function initMarkerEditor({
  model,
  scene,
  onChange,
  mode = "view",
  feedbackId = "dashboard-marker-message",
  onSelect,
  onRoomChange,
  entityFor,
  resolveIcon,
}) {
  const room = mode === "room";
  // The full icon set loads only when needed (picker search, or a saved
  // icon outside the suggestions); suggestions are bundled.
  let catalog = null;
  const needCatalog = () =>
    loadIconCatalog()
      .then((loaded) => {
        if (!catalog) {
          catalog = loaded;
          refresh();
        }
        return loaded;
      })
      .catch(() => null);
  // Icon art is { viewBox, html }: bundled suggestions, any MDI icon, or a
  // custom HA icon set's icon (fetched once, then cached by the catalog).
  const requested = new Set();
  const iconArtFor = (icon) => {
    if (!icon) return undefined;
    const curated = markerIconPath(icon);
    if (curated) return { viewBox: "0 0 24 24", html: curated };
    const known = catalog?.art(icon);
    if (known || requested.has(icon)) return known;
    requested.add(icon);
    needCatalog()
      .then((loaded) => loaded?.resolve(icon))
      .then((found) => found && refresh());
    return undefined;
  };
  const paint = (svg, art) => {
    if (!svg || !art) return;
    if (svg.innerHTML !== art.html) svg.innerHTML = art.html;
    svg.setAttribute("viewBox", art.viewBox);
  };
  // What Home Assistant itself draws for a device's entity, so the editor
  // shows the same default icon as the dashboard card.
  const entityArts = new Map();
  const entityArtFor = (stateObj) => {
    if (!resolveIcon || !stateObj) return undefined;
    const key = JSON.stringify([
      stateObj.entity_id,
      stateObj.state,
      stateObj.attributes?.icon,
      stateObj.attributes?.device_class,
    ]);
    if (entityArts.has(key)) return entityArts.get(key) || undefined;
    entityArts.set(key, null);
    Promise.resolve(resolveIcon(stateObj))
      .then((data) => {
        const art = entityIconArt(data);
        if (!art) return;
        entityArts.set(key, art);
        refresh();
      })
      .catch(() => {});
    return undefined;
  };
  const host = room
    ? null
    : document.getElementById("dashboard-marker-settings");
  const viewport = document.getElementById("viewport");
  const feedback = document.getElementById(feedbackId);
  let settings = {},
    owner,
    layer,
    tray,
    inspector,
    picker,
    defaultsBox,
    previousRender,
    previousMarkers,
    placing,
    orbitEnabled,
    pointer,
    selected,
    drag,
    suppressClickUntil = 0;
  const entries = new Map();
  const history = new Map();
  const controls = (includeHidden = false) =>
    (model()?.controls || []).filter((c) => {
      const device = deviceForControl(model(), c.id);
      return (
        (includeHidden || !c.hidden) &&
        c.lightGroupPrimary !== false &&
        (!device || device.height === c.id)
      );
    });
  const label = (c) =>
    deviceForControl(model(), c.id)?.label || deviceLabel(c, c.id);
  const say = (text) => {
    feedback.textContent = text;
  };
  function stopPlacement() {
    if (placing && owner?.orbit) owner.orbit.enabled = orbitEnabled;
    if (drag && owner?.orbit) owner.orbit.enabled = drag.orbitEnabled;
    if (drag && viewport.hasPointerCapture?.(drag.pointerId))
      viewport.releasePointerCapture(drag.pointerId);
    drag = undefined;
    placing = undefined;
    pointer = undefined;
    viewport.classList.remove("placing-marker");
    for (const row of entries.values()) {
      row.place.textContent = "Place icon";
    }
    viewport.classList.remove("moving-marker");
  }
  function remember(id) {
    const stack = history.get(id) || [];
    stack.push(structuredClone(settings[id]));
    if (stack.length > 50) stack.shift();
    history.set(id, stack);
  }
  // Room mode keeps its own undo: what each save replaced, newest last.
  const roomHistory = new Map();
  const roomValue = (id) => {
    const control = model()?.controls.find((c) => c.id === id);
    return {
      position: control?.markerAnchor ? [...control.markerPosition] : null,
      icon: control?.icon ?? null,
      icon_off: control?.iconOff ?? null,
    };
  };
  async function roomUndo(id) {
    const stack = roomHistory.get(id);
    if (!stack?.length) return;
    stopPlacement();
    const previous = stack.pop();
    try {
      await onRoomChange?.(id, { ...previous, undo: true });
    } catch (error) {
      stack.push(previous);
      say(error.message || "Could not undo this icon change.");
      refresh();
      return;
    }
    const restored = {
      ...(previous.icon ? { icon: previous.icon } : {}),
      ...(previous.icon_off ? { icon_off: previous.icon_off } : {}),
    };
    if (Object.keys(restored).length) settings[id] = restored;
    else delete settings[id];
    refresh();
    say(
      `Undid the last icon change for ${label(model()?.controls.find((c) => c.id === id) || { id })}.`,
    );
  }
  /** Room mode: save a move or icon now; the scene then holds the new anchor. */
  async function roomCommit(id, key, value) {
    const before = roomValue(id);
    const previous = settings[id] ? structuredClone(settings[id]) : undefined;
    const base = owner.fixturePosition(id);
    if (key === "offset" && !base) return;
    const iconKey = key === "icon" || key === "icon_off";
    if (iconKey && value !== null && !isMarkerIcon(value)) return;
    settings = { ...settings, [id]: { ...settings[id] } };
    if (value === null) delete settings[id][key];
    else settings[id][key] = value;
    refresh();
    const changes = iconKey
      ? { [key]: value }
      : {
          position:
            value === null
              ? null
              : base.map((v, axis) => Number((v + value[axis]).toFixed(4))),
        };
    try {
      await onRoomChange?.(id, changes);
    } catch (error) {
      if (previous) settings[id] = previous;
      else delete settings[id];
      say(error.message || "Could not save this icon.");
      refresh();
      return;
    }
    const history = roomHistory.get(id) || [];
    history.push(before);
    if (history.length > 50) history.shift();
    roomHistory.set(id, history);
    delete settings[id]?.offset;
    if (settings[id] && !Object.keys(settings[id]).length) delete settings[id];
    refresh();
  }
  function commit(id, key, value) {
    if (room && (key === "offset" || key === "icon" || key === "icon_off")) {
      roomCommit(id, key, value);
      return;
    }
    const next = validateMarkers({
      ...settings,
      [id]: { ...settings[id], [key]: value },
    });
    if (JSON.stringify(next[id]) === JSON.stringify(settings[id])) return;
    remember(id);
    settings = next;
    refresh();
    onChange();
  }
  function select(id) {
    const entry = entries.get(id);
    if (!entry) return;

    if (selected !== id) stopPlacement();
    selected = id;
    for (const [key, row] of entries) {
      row.details.open = key === id;
      row.details.hidden = key !== id;
      row.button.setAttribute("aria-pressed", String(key === id));
    }
    picker.value = id;
    inspector.hidden = false;
    refresh();
    onSelect?.(id);
  }
  function deselect() {
    const entry = entries.get(selected);
    stopPlacement();
    selected = undefined;
    if (picker) picker.value = "";
    if (inspector) inspector.hidden = true;
    for (const row of entries.values()) {
      row.closeIconPicker?.();
      row.details.hidden = true;
      row.details.open = false;
      row.button.setAttribute("aria-pressed", "false");
    }
    const active = document.activeElement;
    if (
      active &&
      entry &&
      (active === entry.button || entry.details.contains(active))
    )
      active.blur();
  }
  function refresh() {
    if (!owner) return;
    if (placing) owner.orbit.enabled = false;
    const defaults = markerSettings(settings, "_defaults");
    for (const input of defaultsBox?.querySelectorAll("[data-setting]") || []) {
      if (input.type === "checkbox")
        input.checked = defaults[input.dataset.setting];
      else input.value = defaults[input.dataset.setting];
    }
    for (const [id, entry] of entries) {
      const hidden = !!model()?.controls.find((c) => c.id === id)?.hidden;
      const option = [...(picker?.options || [])].find((o) => o.value === id);
      if (option) {
        option.hidden = hidden;
        option.disabled = hidden;
      }
      if (!hidden) continue;
      entry.button.hidden = true;
      entry.details.hidden = true;

      if (selected === id) deselect();
    }
    for (const control of controls()) {
      const entry = entries.get(control.id);
      if (!entry) continue;
      const option = markerSettings(settings, control.id);
      if (drag?.id === control.id && drag.offset) option.offset = drag.offset;
      const customized = ["visible", "show_label", "size", "placement"].some(
        (key) => settings[control.id]?.[key] !== undefined,
      );
      entry.details.querySelector("[data-inheritance]").textContent = customized
        ? "Custom settings for this device"
        : "Using view defaults";
      entry.details.querySelector("[data-inherit]").disabled = !customized;
      entry.visible.checked = option.visible;
      const eyeLabel = `${label(control)}: ${option.visible ? "Hide icon" : "Show icon"}`;
      entry.eye.setAttribute("aria-label", eyeLabel);
      entry.eye.setAttribute(
        "title",
        option.visible ? "Hide icon" : "Show icon",
      );
      entry.eye.setAttribute("aria-pressed", String(!option.visible));
      entry.eye.querySelector("[data-eye-slash]").style.display = option.visible
        ? "none"
        : "";
      entry.labels.checked = option.show_label;
      const state = owner.lastStates?.get(control.id) || {};
      const climate =
        control.type === "climate" || control.type === "lock"
          ? markerAppearance(control, state.entity, state)
          : null;
      const current =
        climate ||
        markerAppearance(control, undefined, state, !state.unavailable);
      // The marker shows what the dashboard card shows: the device's own icon
      // for its state, unless the view or room chose one.
      const entityState = entityFor?.(control.id) || current.stateObj;
      const on = !!current.active && !current.unavailable;
      const fallback = {
        viewBox: "0 0 24 24",
        html: entry.defaultPath,
      };
      // A view without its own icon shows the room's icon.
      const roomLayer = room ? {} : control;
      const shown = stateIconName(option, roomLayer, on);
      // Like the card: an AC with no chosen icon keeps the viewer's AC glyph
      // rather than Home Assistant's thermostat icon.
      const keepAcGlyph =
        control.type === "climate" &&
        !stateIconName(option, roomLayer, true) &&
        !stateIconName(option, roomLayer, false);
      const haArt = (stateObj) =>
        keepAcGlyph ? undefined : entityArtFor(stateObj);
      paint(entry.glyph, iconArtFor(shown) || haArt(entityState) || fallback);
      // Each slot: its own icon, else what is inherited, else HA's icon in
      // that state.
      for (const [slot, active] of [
        ["icon", true],
        ["icon_off", false],
      ]) {
        const item = entry.slots[slot];
        const chosen = option[slot];
        const slotName = stateIconName(option, roomLayer, active);
        const roomOwn = slot === "icon" ? roomLayer.icon : roomLayer.iconOff;
        const art =
          iconArtFor(slotName) ||
          haArt(entityInState(entityState, active)) ||
          fallback;
        paint(item.swatch, art);
        item.name.textContent = chosen
          ? iconLabel(chosen)
          : roomOwn
            ? `${iconLabel(roomOwn)} · room icon`
            : slot === "icon_off" && slotName
              ? `Same as ${(markerStateWords(control)?.[0] || "on").toLowerCase()}`
              : "Default";
        if (entry.pickedSlot() === slot)
          paint(entry.defaultTile.querySelector("svg"), art);
      }
      for (const choice of entry.iconChoices())
        choice.setAttribute(
          "aria-pressed",
          String(choice.dataset.icon === (option[entry.pickedSlot()] || "")),
        );
      if (![...entry.size.options].some((o) => o.value === String(option.size)))
        entry.size.add(new Option(`${option.size} px`, option.size));
      entry.size.value = option.size;
      entry.placement.value = option.placement;
      entry.details.querySelector(".marker-tool-hint").hidden = true;
      entry.more.hidden = option.placement !== "room";
      entry.undo.disabled = room
        ? !roomHistory.get(control.id)?.length
        : !history.get(control.id)?.length;
      if (option.placement !== "room") entry.position.hidden = true;
      entry.button.dataset.movable = String(option.placement === "room");
      entry.summary.textContent = !option.visible
        ? "Hidden"
        : option.placement === "tray"
          ? "Below room"
          : "On room";
      entry.button.style.setProperty("--marker-size", option.size + "px");
      entry.badge.hidden = option.visible && !option.show_label;
      entry.button.dataset.hidden = String(!option.visible);
      // Not connected yet reads as a dash, as on dashboard cards.
      const connected = !model()?.bindings || !!model().bindings[control.id];
      entry.badge.textContent = climate
        ? climate.badge
        : !connected
          ? "—"
          : state.unavailable
            ? "Unavailable"
            : control.type === "number"
              ? state.value === undefined
                ? "—"
                : `${state.value} ${control.unit || ""}`
              : control.type === "cover"
                ? state.position === undefined
                  ? "—"
                  : `${Math.round(state.position)}%`
                : control.type === "button"
                  ? "Run"
                  : state.on
                    ? "On"
                    : "Off";
      if (!option.visible) entry.badge.textContent = "Hidden";
      entry.button.dataset.active = String(
        (control.type === "light" || control.type === "climate") &&
          !!state.on &&
          !state.unavailable,
      );
      // State colour as on the dashboard card. Scene states carry no entity
      // for lights and covers, so they are read as given.
      applyMarkerTone(
        entry.button,
        option.visible
          ? climate ||
              markerAppearance(control, undefined, state, !state.unavailable)
          : null,
      );
      entry.button.setAttribute(
        "aria-label",
        `Edit ${label(control)} marker, ${entry.badge.textContent}`,
      );
      for (let axis = 0; axis < 3; axis++) {
        if (document.activeElement !== entry.axes[axis])
          entry.axes[axis].value = option.offset?.[axis] ?? 0;
      }
      entry.reset.disabled = room ? !control.markerAnchor : !option.offset;
      if (option.placement === "tray") {
        if (entry.button.parentElement !== tray) tray.append(entry.button);
        entry.button.hidden = false;
        entry.name.hidden = false;
        entry.button.style.left = entry.button.style.top = "";
      } else {
        if (entry.button.parentElement !== layer) layer.append(entry.button);
        entry.name.hidden = true;
        const point = owner.fixtureScreenPosition(control.id, option.offset);
        entry.button.hidden = !point?.visible;
        if (point) {
          const layout = markerLayout(
            point,
            { ...option, show_label: option.show_label || !option.visible },
            viewport.clientWidth,
            viewport.clientHeight,
          );
          entry.button.style.left = layout.left + "px";
          entry.button.style.top = layout.top + "px";
        }
      }
    }
    tray.hidden = ![...tray.children].some((button) => !button.hidden);
    const entry = entries.get(selected);
    if (entry) {
      inspector.hidden = !!(placing || drag);
      const option = markerSettings(settings, selected);
      const point = owner.fixtureScreenPosition(selected, option.offset);
      const pointVisible = option.placement === "room" && point?.visible;
      const layout = pointVisible
        ? markerLayout(
            point,
            { ...option, show_label: option.show_label || !option.visible },
            viewport.clientWidth,
            viewport.clientHeight,
          )
        : null;
      const x = layout
        ? layout.left + option.size / 2
        : viewport.clientWidth / 2;
      const y = layout
        ? layout.top + option.size / 2
        : viewport.clientHeight / 2;
      inspector.style.left = x + "px";
      inspector.style.top = y + "px";
      const angles =
        x < 90
          ? y < 100
            ? [0, 30, 60, 90]
            : y > viewport.clientHeight - 100
              ? [0, -30, -60, -90]
              : [-90, -30, 30, 90]
          : x > viewport.clientWidth - 90
            ? y < 100
              ? [90, 120, 150, 180]
              : y > viewport.clientHeight - 100
                ? [-90, -120, -150, -180]
                : [-90, -150, -210, -270]
            : y < 100
              ? [180, 120, 60, 0]
              : [-180, -120, -60, 0];
      const actions = [
        entry.undo,
        entry.details.querySelector("[data-style]"),
        entry.more,
        entry.eye,
      ];
      actions.forEach((action, index) => {
        const radians = (angles[index] * Math.PI) / 180;
        const corner =
          (x < 90 || x > viewport.clientWidth - 90) &&
          (y < 100 || y > viewport.clientHeight - 100);
        const radius = Math.max(corner ? 88 : 46, option.size / 2 + 26);
        inspector.style.setProperty("--marker-ring", radius * 2 + "px");
        action.style.left =
          Math.max(
            24,
            Math.min(viewport.clientWidth - 24, x + Math.cos(radians) * radius),
          ) -
          x +
          "px";
        action.style.top =
          Math.max(
            24,
            Math.min(
              viewport.clientHeight - 24,
              y + Math.sin(radians) * radius,
            ),
          ) -
          y +
          "px";
      });
      for (const panel of [
        entry.details.querySelector(".marker-appearance"),
        entry.position,
      ]) {
        const width = Math.min(210, viewport.clientWidth - 24);
        const height = panel.offsetHeight || 120;
        panel.style.left =
          Math.max(
            12,
            Math.min(viewport.clientWidth - width - 12, x - width / 2),
          ) -
          x +
          "px";
        panel.style.top =
          Math.max(
            12,
            Math.min(
              viewport.clientHeight - height - 12,
              y + option.size / 2 + 20,
            ),
          ) -
          y +
          "px";
      }
    }
  }
  function open(value) {
    close();
    settings = validateMarkers(value) || {};
    history.clear();
    owner = scene();
    if (!owner) return;
    previousMarkers = owner.options.markers;
    owner.options.markers = false;
    for (const fixture of owner.fixtures.values())
      fixture.marker.visible = false;
    layer = document.createElement("div");
    layer.className = "marker-editor-overlay";
    viewport.append(layer);
    tray = document.createElement("div");
    tray.className = "marker-editor-tray";
    viewport.after(tray);
    host?.replaceChildren();
    defaultsBox = document.createElement("section");
    defaultsBox.className = "marker-view-defaults";
    defaultsBox.setAttribute("aria-label", "Device defaults for this view");
    defaultsBox.innerHTML = `<h3>Defaults for this view</h3><p class="muted small">Apply to all devices unless you customize them individually.</p><label class="marker-check"><input type="checkbox" data-setting="visible">Visible</label><label class="marker-check"><input type="checkbox" data-setting="show_label">State label</label><label>Size<select data-setting="size"><option value="24">Small</option><option value="32">Standard</option><option value="44">Large</option><option value="56">Extra large</option></select></label><label>Display<select data-setting="placement"><option value="room">On room</option><option value="tray">Below room</option></select></label>`;
    for (const input of defaultsBox.querySelectorAll("[data-setting]")) {
      input.onchange = () => {
        stopPlacement();
        commit(
          "_defaults",
          input.dataset.setting,
          input.type === "checkbox"
            ? input.checked
            : input.dataset.setting === "size"
              ? Number(input.value)
              : input.value,
        );
      };
    }
    host?.append(defaultsBox);
    picker = document.createElement("select");
    picker.setAttribute("aria-label", "Choose device icon to edit");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a device…";
    picker.append(placeholder);
    picker.onchange = () => select(picker.value);
    host?.append(picker);
    inspector = document.createElement("div");
    inspector.className = room
      ? "marker-floating-tools room-mode"
      : "marker-floating-tools";
    inspector.hidden = true;
    inspector.setAttribute("role", "region");
    inspector.setAttribute("aria-label", "Device icon tools");
    viewport.append(inspector);
    say(
      room
        ? "Drag an icon to move it, or click it to change it. Dashboard views start from these icons."
        : "Drag a room icon to move it, or click for tools. Undo restores its last edit.",
    );
    for (const control of controls(true)) {
      const details = document.createElement("details");
      details.className = "marker-device-settings";
      details.name = "marker-device-tools";
      details.hidden = true;
      details.innerHTML = `<summary><span class="marker-device-name"></span><span class="marker-device-summary"></span></summary><div class="marker-tool-heading"><strong></strong><button type="button" data-close aria-label="Close icon tools">×</button></div><div class="marker-tool-actions"><button type="button" data-undo disabled>Undo</button><button type="button" data-style aria-expanded="false">Edit icon</button><button type="button" data-more aria-expanded="false">Position</button><button type="button" data-eye aria-pressed="false">Hide icon</button></div><p class="marker-tool-hint" hidden>Drag the highlighted icon onto a room surface. Escape cancels.</p><div class="marker-appearance" hidden><div class="marker-icon-field" data-icon-slot="icon"><span class="marker-field-label" data-slot-label></span><button type="button" class="marker-icon-current" data-icon-open="icon" aria-expanded="false"><span class="marker-icon-swatch" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="marker-icon-name"></span><span class="marker-icon-change">Change</span></button></div><div class="marker-icon-field" data-icon-slot="icon_off"><span class="marker-field-label" data-slot-label></span><button type="button" class="marker-icon-current" data-icon-open="icon_off" aria-expanded="false"><span class="marker-icon-swatch" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span><span class="marker-icon-name"></span><span class="marker-icon-change">Change</span></button></div><p class="muted small" data-inheritance></p><button type="button" data-inherit>Use view defaults</button><div class="marker-tool-checks"><label class="marker-check"><input type="checkbox" data-setting="visible">Visible</label><label class="marker-check"><input type="checkbox" data-setting="show_label">State label</label></div><label>Size<select data-setting="size"><option value="24">Small</option><option value="32">Standard</option><option value="44">Large</option><option value="56">Extra large</option></select></label><label>Display<select data-setting="placement"><option value="room">On room</option><option value="tray">Below room</option></select></label><div class="marker-icon-picker" hidden><div class="marker-icon-picker-head"><button type="button" class="marker-icon-back" data-icon-back aria-label="Back to icon settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button><strong>Choose icon</strong></div><input type="search" class="marker-icon-search" data-icon-search placeholder="Search icons" aria-label="Search icons" autocomplete="off"><p class="marker-icon-status muted small" aria-live="polite"></p><div class="marker-icon-list"></div><div class="marker-icon-results" hidden><div class="marker-icon-grid" role="group" aria-label="Search results"></div><p class="marker-icon-more muted small" hidden></p></div><p class="marker-icon-empty muted small" hidden>No icons match.</p></div></div><div class="marker-position" hidden><button type="button" data-place>Place icon</button><button type="button" data-reset>Reset</button><details><summary>Precise position</summary><p class="muted small">Offset in metres.</p><div class="marker-axes"><label>X<input data-axis="0" type="number" required min="-1000" max="1000" step="any"></label><label>Y · height<input data-axis="1" type="number" required min="-1000" max="1000" step="any"></label><label>Z<input data-axis="2" type="number" required min="-1000" max="1000" step="any"></label></div></details></div>`;
      details.querySelector(".marker-device-name").textContent = label(control);
      // Include the device name in every field's accessible name.
      for (const input of details.querySelectorAll("input,select,button")) {
        const name =
          input.dataset.axis !== undefined
            ? ["X offset", "Y height offset", "Z offset"][
                Number(input.dataset.axis)
              ]
            : {
                visible: "Show control",
                show_label: "Show state label",
                placement: "Display",
                size: "Icon size",
              }[input.dataset.setting] ||
              (input.hasAttribute("data-close")
                ? "Close icon tools"
                : input.textContent);
        input.setAttribute("aria-label", `${label(control)}: ${name.trim()}`);
      }
      const actionPaths = {
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path data-eye-slash d="m3 3 18 18"/>',
        undo: '<path d="M3 10h10a7 7 0 0 1 0 14" transform="translate(0 -4)"/><path d="m7 2-4 4 4 4"/>',
        style:
          '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/>',
        more: '<circle cx="12" cy="12" r="5"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
      };
      for (const [action, path] of Object.entries(actionPaths)) {
        const tool = details.querySelector(`[data-${action}]`);
        tool.setAttribute(
          "title",
          action === "undo"
            ? "Undo last icon edit"
            : action === "style"
              ? "Edit icon"
              : "Position",
        );
        tool.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
      }
      details.querySelector(".marker-tool-heading strong").textContent =
        label(control);
      const item = document.createElement("option");
      item.value = control.id;
      item.textContent = label(control);
      picker.append(item);
      inspector.append(details);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "marker-editor-control";
      const path =
        control.type === "lock"
          ? LOCK_ICON_PATH
          : control.type === "climate"
            ? AC_ICON_PATH
            : control.type === "number"
              ? '<path d="M3 7h18v3H3zm2 3h2v11H5zm12 0h2v11h-2z"/>'
              : control.type === "cover"
                ? '<path d="M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"/>'
                : control.type === "button"
                  ? '<path d="m8 4 12 8-12 8Z"/>'
                  : '<path d="M12 2a7 7 0 0 0-4 12.74V18h8v-3.26A7 7 0 0 0 12 2ZM9 20h6v2H9Z"/>';
      // Icon: a compact current-icon row opens a searchable, grouped picker
      // that temporarily replaces the other appearance settings.
      const iconPicker = details.querySelector(".marker-icon-picker");
      const iconList = details.querySelector(".marker-icon-list");
      const iconSearch = details.querySelector("[data-icon-search]");
      // Two icon slots: shown when active (on, open, locked) and when not.
      const words = markerStateWords(control);
      const slots = {};
      for (const slot of ["icon", "icon_off"]) {
        const field = details.querySelector(`[data-icon-slot="${slot}"]`);
        slots[slot] = {
          field,
          open: field.querySelector("[data-icon-open]"),
          swatch: field.querySelector(".marker-icon-swatch svg"),
          name: field.querySelector(".marker-icon-name"),
        };
      }
      slots.icon.field.querySelector("[data-slot-label]").textContent = words
        ? `Icon · ${words[0]}`
        : "Icon";
      slots.icon_off.field.querySelector("[data-slot-label]").textContent =
        words ? `Icon · ${words[1]}` : "";
      slots.icon_off.field.hidden = !words;
      let pickSlot = "icon";
      const showIconPicker = (open, restoreFocus = true, slot) => {
        if (slot) pickSlot = slot;
        iconPicker.hidden = !open;
        details
          .querySelector(".marker-appearance")
          .classList[open ? "add" : "remove"]("picking-icon");
        for (const [key, item] of Object.entries(slots))
          item.open.setAttribute(
            "aria-expanded",
            String(open && key === pickSlot),
          );
        if (open) {
          const defaultLabel =
            pickSlot === "icon_off"
              ? `Same as ${words?.[0]?.toLowerCase() ?? "on"} icon`
              : !room && control.icon
                ? "Room icon"
                : "Default icon";
          const defaultTile = iconTiles[0];
          defaultTile.title = defaultLabel;
          defaultTile.setAttribute("aria-label", `Icon: ${defaultLabel}`);
          defaultTile.dataset.name = defaultLabel.toLowerCase();
          const text = defaultTile.querySelector("span");
          if (text) text.textContent = defaultLabel;
          needCatalog().then(showCustomSets);
          iconSearch.value = "";
          filterIcons();
          iconSearch.focus?.();
        } else if (restoreFocus) slots[pickSlot].open.focus?.();
      };
      const choose = (value) => {
        stopPlacement();
        showIconPicker(false);
        if (value) {
          commit(control.id, pickSlot, value);
          return;
        }
        if (settings[control.id]?.[pickSlot] === undefined) return;
        if (room) {
          roomCommit(control.id, pickSlot, null);
          return;
        }
        remember(control.id);
        delete settings[control.id][pickSlot];
        if (!Object.keys(settings[control.id]).length)
          delete settings[control.id];
        refresh();
        onChange();
      };
      const tile = (value, title, art, wide = false) => {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = wide ? "marker-icon-default" : "marker-icon-tile";
        choice.dataset.icon = value;
        choice.dataset.name = title.toLowerCase();
        choice.title = title;
        choice.setAttribute("aria-label", `Icon: ${title}`);
        choice.setAttribute("aria-pressed", "false");
        choice.innerHTML = `<svg viewBox="${art?.viewBox || "0 0 24 24"}" aria-hidden="true">${art?.html || ""}</svg>${wide ? `<span>${title}</span>` : ""}`;
        // Custom-set icons arrive asynchronously from their set.
        if (!art && value)
          needCatalog()
            .then((loaded) => loaded?.resolve(value))
            .then((found) => paint(choice.querySelector?.("svg"), found));
        choice.onclick = () => choose(value);
        return choice;
      };
      const iconTiles = [
        !room && control.icon
          ? tile(
              "",
              "Room icon",
              iconArtFor(control.icon) || { viewBox: "0 0 24 24", html: path },
              true,
            )
          : tile(
              "",
              "Default icon",
              { viewBox: "0 0 24 24", html: path },
              true,
            ),
      ];
      iconList.append(iconTiles[0]);
      const iconGroups = [];
      for (const [group, icons] of MARKER_ICON_GROUPS) {
        const heading = document.createElement("p");
        heading.className = "marker-icon-group";
        heading.textContent = group;
        const groupGrid = document.createElement("div");
        groupGrid.className = "marker-icon-grid";
        groupGrid.setAttribute("role", "group");
        groupGrid.setAttribute("aria-label", group);
        const tiles = icons.map(([id, text]) => tile(id, text, iconArtFor(id)));
        tiles.forEach((t) => groupGrid.append(t));
        iconTiles.push(...tiles);
        iconGroups.push({ heading, groupGrid, tiles });
        iconList.append(heading);
        iconList.append(groupGrid);
      }
      // Your Home Assistant icon sets (local:, …) follow the suggestions.
      let customShown = false;
      const showCustomSets = (loaded) => {
        if (!loaded || customShown) return;
        customShown = true;
        const nodes = [];
        for (const { prefix, count } of loaded.sets) {
          const heading = document.createElement("p");
          heading.className = "marker-icon-group";
          heading.textContent = `${prefix}: icons`;
          const groupGrid = document.createElement("div");
          groupGrid.className = "marker-icon-grid";
          groupGrid.setAttribute("role", "group");
          groupGrid.setAttribute("aria-label", `${prefix} icons`);
          const tiles = loaded
            .list(prefix)
            .map((entry) =>
              tile(entry.icon, iconLabel(entry.icon), iconArtFor(entry.icon)),
            );
          tiles.forEach((t) => groupGrid.append(t));
          iconTiles.push(...tiles);
          nodes.push(heading, groupGrid);
          if (count > tiles.length) {
            const hint = document.createElement("p");
            hint.className = "marker-icon-more muted small";
            hint.textContent = `Search “${prefix}:” to see all ${count}.`;
            nodes.push(hint);
          }
        }
        // Your own sets come first, right after "Default icon".
        iconTiles[0].after(...nodes);
        refresh();
        if (!iconSearch.value.trim()) filterIcons();
      };
      const results = details.querySelector(".marker-icon-results");
      const resultGrid = results.querySelector(".marker-icon-grid");
      const more = details.querySelector(".marker-icon-more");
      const status = details.querySelector(".marker-icon-status");
      let resultTiles = [],
        searchRun = 0;
      function filterIcons() {
        const needle = iconSearch.value.trim().toLowerCase();
        const run = ++searchRun;
        const empty = details.querySelector(".marker-icon-empty");
        iconList.hidden = !!needle;
        if (!needle) {
          results.hidden = true;
          empty.hidden = true;
          status.textContent = catalog
            ? `Suggestions · search all ${catalog.count.toLocaleString()} icons${catalog.sets.length ? ` (incl. ${catalog.sets.map((set) => set.prefix + ":").join(", ")})` : ""}`
            : "Suggestions · search to browse every icon";
          return;
        }
        status.textContent = "Loading icons…";
        needCatalog().then((loaded) => {
          if (run !== searchRun) return;
          const current = markerSettings(settings, control.id)[pickSlot] || "";
          const found = loaded
            ? loaded.search(needle)
            : {
                total: 0,
                results: iconGroups
                  .flatMap((g) => g.tiles)
                  .filter((t) => t.dataset.name.includes(needle))
                  .map((t) => ({ icon: t.dataset.icon })),
              };
          resultTiles = found.results.map((entry) => {
            const t = tile(
              entry.icon,
              iconLabel(entry.icon),
              iconArtFor(entry.icon),
            );
            t.title = `${iconLabel(entry.icon)} (${entry.icon})`;
            t.setAttribute("aria-pressed", String(entry.icon === current));
            return t;
          });
          resultGrid.replaceChildren(...resultTiles);
          const total = loaded ? found.total : resultTiles.length;
          results.hidden = !resultTiles.length;
          empty.hidden = !!resultTiles.length;
          status.textContent = loaded
            ? `${total.toLocaleString()} ${total === 1 ? "icon" : "icons"}${found.partial ? " matching some words" : ""}`
            : "Showing suggestions only (icon set unavailable)";
          more.hidden = total <= resultTiles.length;
          more.textContent = `Showing ${resultTiles.length} — keep typing to narrow.`;
        });
      }
      let searchTimer;
      iconSearch.oninput = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(filterIcons, 120);
      };
      iconSearch.onkeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          showIconPicker(false);
        }
      };
      for (const [key, item] of Object.entries(slots))
        item.open.onclick = () => showIconPicker(true, true, key);
      details.querySelector("[data-icon-back]").onclick = () =>
        showIconPicker(false);
      button.innerHTML = `<span class="marker-editor-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span><span class="marker-editor-name"></span><span class="marker-editor-badge" aria-hidden="true"></span>`;
      button.querySelector(".marker-editor-name").textContent = label(control);
      button.dataset.markerId = control.id;
      button.setAttribute("aria-pressed", "false");
      button.onclick = () => {
        if (Date.now() < suppressClickUntil) {
          suppressClickUntil = 0;
          return;
        }
        if (selected === control.id)
          details.querySelector("[data-close]").onclick();
        else select(control.id);
      };
      details.querySelector("summary").onclick = (event) => {
        event.preventDefault();
        if (details.open) {
          stopPlacement();
          details.open = false;
          selected = undefined;
          button.setAttribute("aria-pressed", "false");
        } else select(control.id);
      };
      const entry = {
        details,
        button,
        visible: details.querySelector('[data-setting="visible"]'),
        labels: details.querySelector('[data-setting="show_label"]'),
        placement: details.querySelector('[data-setting="placement"]'),
        size: details.querySelector('[data-setting="size"]'),
        position: details.querySelector(".marker-position"),
        summary: details.querySelector(".marker-device-summary"),
        place: details.querySelector("[data-place]"),
        undo: details.querySelector("[data-undo]"),
        more: details.querySelector("[data-more]"),
        eye: details.querySelector("[data-eye]"),
        reset: details.querySelector("[data-reset]"),
        axes: [...details.querySelectorAll("[data-axis]")],
        name: button.querySelector(".marker-editor-name"),
        defaultPath: path,
        glyph: button.querySelector(".marker-editor-icon svg"),
        iconChoices: () => [...iconTiles, ...resultTiles],
        slots,
        pickedSlot: () => pickSlot,
        defaultTile: iconTiles[0],
        closeIconPicker: (restoreFocus = false) => {
          if (iconPicker.hidden === false) showIconPicker(false, restoreFocus);
        },
        badge: button.querySelector(".marker-editor-badge"),
      };
      entries.set(control.id, entry);
      details.querySelector("[data-inherit]").onclick = () => {
        stopPlacement();
        remember(control.id);
        for (const key of ["visible", "show_label", "size", "placement"])
          delete settings[control.id]?.[key];
        if (settings[control.id] && !Object.keys(settings[control.id]).length)
          delete settings[control.id];
        refresh();
        onChange();
        say(`${label(control)} now uses view defaults.`);
      };
      entry.eye.onclick = () => {
        stopPlacement();
        commit(
          control.id,
          "visible",
          !markerSettings(settings, control.id).visible,
        );
      };
      const appearance = details.querySelector(".marker-appearance");
      appearance.hidden = true;
      entry.position.hidden = true;
      const style = details.querySelector("[data-style]");
      style.onclick = () => {
        stopPlacement();
        entry.closeIconPicker();
        appearance.hidden = !appearance.hidden;
        entry.position.hidden = true;
        entry.more.setAttribute("aria-expanded", "false");
        style.setAttribute("aria-expanded", String(!appearance.hidden));
        refresh();
      };
      entry.more.onclick = () => {
        stopPlacement();
        entry.position.hidden = !entry.position.hidden;
        appearance.hidden = true;
        style.setAttribute("aria-expanded", "false");
        entry.more.setAttribute(
          "aria-expanded",
          String(!entry.position.hidden),
        );
        refresh();
      };
      details.querySelector("[data-close]").onclick = deselect;
      for (const input of details.querySelectorAll("[data-setting]"))
        input.onchange = () => {
          stopPlacement();
          commit(
            control.id,
            input.dataset.setting,
            input.type === "checkbox"
              ? input.checked
              : input.dataset.setting === "size"
                ? Number(input.value)
                : input.value,
          );
        };
      for (const input of entry.axes)
        input.oninput = () => {
          if (input.value === "" || !input.validity.valid) return;
          const offset = [...(settings[control.id]?.offset || [0, 0, 0])];
          offset[Number(input.dataset.axis)] = Number(input.value);
          commit(control.id, "offset", offset);
        };
      entry.reset.onclick = () => {
        stopPlacement();
        if (room) {
          if (model()?.controls.find((c) => c.id === control.id)?.markerAnchor)
            roomCommit(control.id, "offset", null);
          return;
        }
        if (!settings[control.id]?.offset) return;
        remember(control.id);
        delete settings[control.id].offset;
        say(`${label(control)} returned to its default anchor.`);
        refresh();
        onChange();
      };
      entry.undo.onclick = () => {
        if (room) {
          roomUndo(control.id);
          return;
        }
        const stack = history.get(control.id);
        if (!stack?.length) return;
        stopPlacement();
        const previous = stack.pop();
        if (previous === undefined) delete settings[control.id];
        else settings[control.id] = previous;
        refresh();
        onChange();
        say(`Undid the last icon edit for ${label(control)}.`);
      };
      entry.place.onclick = () => {
        const cancel = placing === control.id;
        stopPlacement();
        if (cancel) {
          say("Placement cancelled.");
          return;
        }
        placing = control.id;
        orbitEnabled = owner.orbit.enabled;
        owner.orbit.enabled = false;
        viewport.classList.add("placing-marker");
        entry.place.textContent = "Cancel placement";
        say(
          `Click a visible room surface to place ${label(control)}. Escape cancels; precise X/Y/Z values are available below.`,
        );
        viewport.scrollIntoView({ block: "nearest", behavior: "auto" });
      };
    }
    previousRender = owner.options.onRender;
    owner.options.onRender = () => {
      previousRender?.();
      refresh();
    };
    refresh();
    owner.render();
  }
  function close() {
    stopPlacement();
    if (owner) {
      owner.options.onRender = previousRender;
      owner.options.markers = previousMarkers;
      for (const [id, fixture] of owner.fixtures)
        fixture.marker.visible =
          !model()?.controls.find((c) => c.id === id)?.hidden &&
          !fixture.companion &&
          !fixture.outOfScope &&
          previousMarkers &&
          (owner.options.mode !== "floor" || !!owner.options.floorMarkers);
      owner.render();
    }
    owner = undefined;
    layer?.remove();
    tray?.remove();
    inspector?.remove();
    entries.clear();
    selected = undefined;
  }
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      const marker = event.target.closest("[data-marker-id]");
      const id = marker?.dataset.markerId;
      if (
        owner &&
        !placing &&
        entries.has(id) &&
        markerSettings(settings, id).placement === "room" &&
        event.button === 0
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClickUntil = 0;
        drag = {
          id,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          orbitEnabled: owner.orbit.enabled,
        };
        owner.orbit.enabled = false;
        viewport.setPointerCapture(event.pointerId);
        return;
      }
      if (
        !placing ||
        event.target.closest(".camera-navigation") ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pointer = [event.clientX, event.clientY];
    },
    true,
  );
  viewport.addEventListener(
    "pointerup",
    (event) => {
      if (drag) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const { id, offset, travelled } = drag;
        const point = owner.pickMarkerPosition(event.clientX, event.clientY);
        const base = owner.fixturePosition(id);
        stopPlacement();
        suppressClickUntil = Date.now() + 250;
        if (!travelled) {
          if (selected === id)
            entries.get(id).details.querySelector("[data-close]").onclick();
          else select(id);
          return;
        }
        select(id);
        if (travelled && offset && point && base) {
          commit(
            id,
            "offset",
            point.map((value, axis) => Number((value - base[axis]).toFixed(4))),
          );
          say("Icon moved. Rotate the room to inspect its 3D position.");
        } else {
          refresh();
          say(
            travelled
              ? "Drop onto a visible room surface. Position unchanged."
              : "Position unchanged. Drag the icon to move it.",
          );
        }
        return;
      }
      if (!placing || !pointer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (
        Math.hypot(event.clientX - pointer[0], event.clientY - pointer[1]) > 8
      ) {
        pointer = undefined;
        return;
      }
      const point = owner.pickMarkerPosition(event.clientX, event.clientY);
      if (!point) {
        say("Choose a visible room surface, or enter precise offsets.");
        pointer = undefined;
        return;
      }
      const id = placing;
      const base = owner.fixturePosition(id);
      if (!base) {
        stopPlacement();
        return;
      }
      stopPlacement();
      try {
        commit(
          id,
          "offset",
          point.map((value, axis) => Number((value - base[axis]).toFixed(4))),
        );
      } catch (error) {
        say(error.message);
        return;
      }
      say("Marker placed. Rotate the camera to inspect its 3D anchor.");
    },
    true,
  );
  viewport.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drag.travelled ||=
        Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5;
      if (!drag.travelled) return;
      const point = owner.pickMarkerPosition(event.clientX, event.clientY);
      const base = owner.fixturePosition(drag.id);
      drag.offset =
        point && base
          ? point.map((value, axis) => Number((value - base[axis]).toFixed(4)))
          : undefined;
      refresh();
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!selected || placing || drag) return;
      if (event.target.closest?.(".marker-floating-tools, [data-marker-id]"))
        return;
      deselect();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      const pickerEntry = selected && entries.get(selected);
      if (
        event.key === "Escape" &&
        !placing &&
        !drag &&
        pickerEntry &&
        pickerEntry.details.querySelector(".marker-icon-picker").hidden ===
          false
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pickerEntry.closeIconPicker(true);
        return;
      }
      // Ctrl/⌘+Z undoes the selected room icon's last change.
      if (
        room &&
        owner &&
        selected &&
        !placing &&
        !drag &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z" &&
        !event.target?.closest?.("input, textarea, select")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        roomUndo(selected);
        return;
      }
      if (event.key === "Escape" && (placing || drag || selected)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const wasMoving = placing || drag;
        stopPlacement();
        if (!wasMoving && selected)
          entries
            .get(selected)
            ?.details.querySelector("[data-close]")
            .onclick();
        refresh();
        say(wasMoving ? "Placement cancelled." : "Icon tools closed.");
      }
    },
    true,
  );
  viewport.addEventListener(
    "pointercancel",
    () => {
      if (placing || drag) {
        stopPlacement();
        refresh();
        say("Placement cancelled.");
      }
    },
    true,
  );
  /** Point out one device's icon (a list row is hovered), or none. */
  function highlight(id) {
    for (const [key, entry] of entries)
      entry.button.dataset.highlight = String(key === id);
  }
  return {
    open,
    close,
    highlight,
    get isOpen() {
      return !!owner;
    },
    read: () => structuredClone(settings),
  };
}
