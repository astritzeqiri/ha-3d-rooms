import { deviceForControl } from "../shared/device.mjs";
import {
  markerSettings,
  markerLayout,
  validateMarkers,
} from "../shared/marker-settings.mjs";

/** The editor's controls select settings and place anchors; they never send commands. */
export function initMarkerEditor({ model, scene, onChange }) {
  const host = document.getElementById("dashboard-marker-settings");
  const viewport = document.getElementById("viewport");
  const feedback = document.getElementById("dashboard-marker-message");
  let settings = {},
    owner,
    layer,
    tray,
    inspector,
    picker,
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
  const controls = () =>
    (model()?.controls || []).filter((c) => {
      const device = deviceForControl(model(), c.id);
      return !device || device.height === c.id;
    });
  const label = (c) =>
    deviceForControl(model(), c.id)?.label || c.label || c.name || c.id;
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
  function commit(id, key, value) {
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
  }
  function deselect() {
    const entry = entries.get(selected);
    stopPlacement();
    selected = undefined;
    if (picker) picker.value = "";
    if (inspector) inspector.hidden = true;
    for (const row of entries.values()) {
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
    for (const control of controls()) {
      const entry = entries.get(control.id);
      if (!entry) continue;
      const option = markerSettings(settings, control.id);
      if (drag?.id === control.id && drag.offset) option.offset = drag.offset;
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
      if (![...entry.size.options].some((o) => o.value === String(option.size)))
        entry.size.add(new Option(`${option.size} px`, option.size));
      entry.size.value = option.size;
      entry.placement.value = option.placement;
      entry.details.querySelector(".marker-tool-hint").hidden = true;
      entry.more.hidden = option.placement !== "room";
      entry.undo.disabled = !history.get(control.id)?.length;
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
      const state = owner.lastStates?.get(control.id) || {};
      entry.badge.textContent = state.unavailable
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
        control.type === "light" && !!state.on,
      );
      entry.button.setAttribute(
        "aria-label",
        `Edit ${label(control)} marker, ${entry.badge.textContent}`,
      );
      for (let axis = 0; axis < 3; axis++) {
        if (document.activeElement !== entry.axes[axis])
          entry.axes[axis].value = option.offset?.[axis] ?? 0;
      }
      entry.reset.disabled = !option.offset;
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
    host.replaceChildren();
    picker = document.createElement("select");
    picker.setAttribute("aria-label", "Choose device icon to edit");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a device…";
    picker.append(placeholder);
    picker.onchange = () => select(picker.value);
    host.append(picker);
    inspector = document.createElement("div");
    inspector.className = "marker-floating-tools";
    inspector.hidden = true;
    inspector.setAttribute("role", "region");
    inspector.setAttribute("aria-label", "Device icon tools");
    viewport.append(inspector);
    say(
      "Drag a room icon to move it, or click for tools. Undo restores its last edit.",
    );
    for (const control of controls()) {
      const details = document.createElement("details");
      details.className = "marker-device-settings";
      details.name = "marker-device-tools";
      details.hidden = true;
      details.innerHTML = `<summary><span class="marker-device-name"></span><span class="marker-device-summary"></span></summary><div class="marker-tool-heading"><strong></strong><button type="button" data-close aria-label="Close icon tools">×</button></div><div class="marker-tool-actions"><button type="button" data-undo disabled>Undo</button><button type="button" data-style aria-expanded="false">Edit icon</button><button type="button" data-more aria-expanded="false">Position</button><button type="button" data-eye aria-pressed="false">Hide icon</button></div><p class="marker-tool-hint" hidden>Drag the highlighted icon onto a room surface. Escape cancels.</p><div class="marker-appearance" hidden><div class="marker-tool-checks"><label class="marker-check"><input type="checkbox" data-setting="visible">Visible</label><label class="marker-check"><input type="checkbox" data-setting="show_label">State label</label></div><label>Size<select data-setting="size"><option value="24">Small</option><option value="32">Standard</option><option value="44">Large</option><option value="56">Extra large</option></select></label><label>Display<select data-setting="placement"><option value="room">On room</option><option value="tray">Below room</option></select></label></div><div class="marker-position" hidden><button type="button" data-place>Place icon</button><button type="button" data-reset>Reset</button><details><summary>Precise position</summary><p class="muted small">Offset in metres.</p><div class="marker-axes"><label>X<input data-axis="0" type="number" required min="-1000" max="1000" step="any"></label><label>Y · height<input data-axis="1" type="number" required min="-1000" max="1000" step="any"></label><label>Z<input data-axis="2" type="number" required min="-1000" max="1000" step="any"></label></div></details></div>`;
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
        control.type === "number"
          ? '<path d="M3 7h18v3H3zm2 3h2v11H5zm12 0h2v11h-2z"/>'
          : control.type === "cover"
            ? '<path d="M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"/>'
            : control.type === "button"
              ? '<path d="m8 4 12 8-12 8Z"/>'
              : '<path d="M12 2a7 7 0 0 0-4 12.74V18h8v-3.26A7 7 0 0 0 12 2ZM9 20h6v2H9Z"/>';
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
        badge: button.querySelector(".marker-editor-badge"),
      };
      entries.set(control.id, entry);
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
        if (!settings[control.id]?.offset) return;
        remember(control.id);
        delete settings[control.id].offset;
        say(`${label(control)} returned to its default anchor.`);
        refresh();
        onChange();
      };
      entry.undo.onclick = () => {
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
      for (const fixture of owner.fixtures.values())
        fixture.marker.visible =
          !fixture.companion &&
          previousMarkers &&
          owner.options.mode !== "floor";
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
  return { open, close, read: () => structuredClone(settings) };
}
