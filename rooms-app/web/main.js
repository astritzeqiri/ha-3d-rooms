import { initLightGroups } from "./light-groups.js";
import { searchableSelect } from "./searchable-select.js";
import {
  viewKind,
  viewScopeLabel,
  scopeOptions,
} from "../shared/view-library.mjs";
import { initHouseActions } from "./house-actions.js";
import { initWorkspace } from "./workspace.js";
import { initImportSummary } from "./import-summary.js";
import {
  roomName,
  deviceGroup,
  connectionState,
} from "../shared/workspace.mjs";
import { climateState } from "../shared/climate.mjs";
import { houseViewSummary } from "../shared/house-presentation.mjs";
import { uploadJSON } from "../shared/upload.mjs";
import { uploadProgress } from "./upload-progress.js";
import { paintEntityIcon } from "../shared/entity-icon.mjs";
import {
  deviceEntries,
  deviceForControl,
  macroName,
} from "../shared/device.mjs";
import { actionState, actionCommand } from "../shared/action.mjs";
import { numberState, numberCommand } from "../shared/number.mjs";
import { coverFeatures, coverState, coverCommand } from "../shared/cover.mjs";
import "./style.css";
import "./workspace.css";
import "./views-workspace.css";
import { mountCameraNavigation } from "./camera-navigation.js";
import { initDashboardEditor } from "./dashboard-editor.js";
import { connectNative } from "./native.js";
import { initEntityPicker, pickerHTML } from "./entity-picker.js";
const native = await connectNative().catch((error) => {
  document.getElementById("connection").textContent = error.message;
  throw error;
});
if (native) document.querySelector(".brand").href = "./index.html?native=1";
import {
  lightFeatures,
  entityAppearance,
  hexToRgb,
  rgbToHex,
  kelvinToRgb,
  commandConfirmed,
} from "../shared/light.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const api = async (path, options = {}) => {
  if (native) return native.api(path, options);
  if (options.onProgress)
    return uploadJSON(new URL("api/" + path, location.href).href, {
      ...options,
      file: options.body,
      headers: { "X-Rooms-Request": "1", ...options.headers },
    });
  const res = await fetch(new URL("api/" + path, location.href), {
    ...options,
    headers: { "X-Rooms-Request": "1", ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
};
let areas = [],
  haFloors = [],
  savedViews,
  areasError = "";
const initialSavedViewId = new URL(location.href).searchParams.get(
  "saved_view",
);
const initialRoomTab =
  new URL(location.href).searchParams.get("tab") || "overview";
let activeRoomTab = "overview",
  homeModelId,
  homeTab = "overview";
let models = [],
  selected = null,
  status = { connected: false, mode: "preview", entities: [] },
  preview = true,
  view,
  pending = new Set(),
  simulated = new Map(),
  selection = 0;
const workspace = initWorkspace({
  getModels: () => models,
  getSelected: () => selected,
  getFloors: () => haFloors,
  choose,
  tab: setRoomTab,
  api,
  scene: () => view,
  toast: (message) => toast(message),
  reload: async (id) => {
    models = await api("models");
    selected = models.find((m) => m.id === id);
    drawModels();
  },
});
const importSummary = initImportSummary({ models: () => models });
const cameraNavigation = mountCameraNavigation($("viewport"), () => view);
cameraNavigation.hidden = true;
const fades = new Map();
let viewMode =
  new URL(location.href).searchParams.get("view") === "floor"
    ? "floor"
    : "front";
const toast = (message) => {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 6000);
};
$("toast").onclick = () => ($("toast").hidden = true);
const lightGroups = initLightGroups({
  model: () => selected,
  entities: () => status.entities,
  save: async (id, groups) => {
    await api(`models/${id}/light-groups`, {
      method: "PUT",
      body: JSON.stringify({ groups }),
    });
    models = await api("models");
    await choose(id, "devices");
    toast("Light groups saved.");
  },
});
$("group-lights").onclick = () => lightGroups.open();
let deviceFilter = "all",
  deviceQuery = "";
const openMore = new Set();
const DEVICE_TOOLS_MIN = 5;
function state(c) {
  if (c.type === "climate") {
    const entity = status.entities.find(
      (e) => e.entity_id === selected.bindings[c.id],
    );
    return {
      ...climateState(entity),
      entity,
      unavailable:
        preview || !status.connected || climateState(entity).unavailable,
    };
  }
  if (c.type === "button") {
    const entity = status.entities.find(
      (e) => e.entity_id === selected.bindings[c.id],
    );
    return preview
      ? { unavailable: false }
      : { ...actionState(entity), entity };
  }
  if (c.type === "number") {
    if (preview)
      return (
        simulated.get(c.id) || { value: c.defaultValue, unavailable: false }
      );
    const entity = status.entities.find(
      (e) => e.entity_id === selected.bindings[c.id],
    );
    const reported = numberState(entity, c);
    return {
      ...reported,
      entity,
      unavailable: !status.connected || reported.unavailable,
    };
  }
  if (c.type === "cover") {
    if (preview)
      return (
        simulated.get(c.id) || {
          position: c.defaultPosition ?? 0,
          unavailable: false,
        }
      );
    const entity = status.entities.find(
      (e) => e.entity_id === selected.bindings[c.id],
    );
    return {
      ...coverState(entity),
      entity,
      unavailable: !status.connected || coverState(entity).unavailable,
    };
  }
  if (preview)
    return (
      simulated.get(c.id) || {
        on: true,
        brightness: 255,
        rgb: hexToRgb(c.color || "#fff0d4"),
        colorMode: "rgb",
        colorTempKelvin: 3000,
      }
    );
  const id = selected.bindings[c.id],
    entity = status.entities.find((e) => e.entity_id === id);
  return {
    on: entity?.state === "on",
    brightness: entity?.attributes?.brightness ?? 255,
    ...entityAppearance(entity, c.color),
    unavailable:
      !status.connected ||
      !entity ||
      ["unavailable", "unknown"].includes(entity.state),
    label: !id
      ? "Not connected"
      : !status.connected
        ? "Home Assistant disconnected"
        : !entity || ["unknown", "unavailable"].includes(entity.state)
          ? "Unavailable"
          : entity.state === "on"
            ? "On"
            : "Off",
    entity,
  };
}
const deviceSettingsButton = (c) =>
  `<button class="device-settings" data-device-settings="${c.id}" aria-label="${c.lightGroup ? "Edit light group" : "Edit entity for"} ${esc(c.label)}" title="${c.lightGroup ? "Edit group" : "Change entity"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
const entityNote = (c) =>
  preview
    ? '<span class="muted small device-entity">Simulation only</span>'
    : selected.bindings[c.id]
      ? `<span class="muted small device-entity">${esc(selected.bindings[c.id])}</span>`
      : `<button type="button" class="connect-entity" data-device-settings="${c.id}">Connect an entity</button>`;
function deskCard(device, states) {
  const height = selected.controls.find((c) => c.id === device.height),
    motion = selected.controls.find((c) => c.id === device.motion);
  const h = states.get(height.id),
    m = states.get(motion.id),
    f = preview
      ? { open: true, close: true, stop: true }
      : coverFeatures(m.entity);
  const attrs = h.entity?.attributes || {},
    min = preview ? height.min : Math.max(height.min, attrs.min ?? height.min),
    max = preview ? height.max : Math.min(height.max, attrs.max ?? height.max),
    step = preview
      ? height.step
      : Math.max(height.step, attrs.step || height.step);
  return `<article class="light-card desk-card" data-device="${device.id}" data-control="${height.id}"><div class="device-heading"><div><div class="light-label">${esc(device.label)}</div><p class="light-state">Adjustable desk · ${height.min}–${height.max} ${esc(height.unit)}</p></div>${deviceSettingsButton({ ...height, label: device.label })}</div><div class="desk-main"><label class="desk-height-label">Height <output>${h.value === undefined ? "Unknown" : h.value + " " + esc(height.unit)}</output><input type="range" data-number="${height.id}" aria-label="${esc(device.label)} height" min="${min}" max="${max}" step="${step}" value="${h.value ?? height.defaultValue}" ${!preview && h.unavailable ? "disabled" : ""}></label><div class="shade-actions desk-directions">${[
    ["open", "Up", "↑"],
    ["stop", "Stop", "■"],
    ["close", "Down", "↓"],
  ]
    .map(
      ([action, label, icon]) =>
        `<button data-cover="${motion.id}" data-action="${action}" aria-label="${esc(device.label)} ${label.toLowerCase()}" ${!preview && (m.unavailable || !f[action]) ? "disabled" : ""}><span aria-hidden="true">${icon}</span><span>${label}</span></button>`,
    )
    .join(
      "",
    )}</div></div><div class="desk-macros" aria-label="Desk macros">${device.macros
    .map((id, i) => {
      const name = macroName(selected, device, id),
        st = states.get(id);
      return `<button data-press="${id}" aria-label="${esc(name || "Macro " + (i + 1))}" ${!preview && st.unavailable ? "disabled" : ""}><span data-entity-icon="${id}" aria-hidden="true"></span><span ${name ? "" : 'class="muted"'}>${esc(name || "Name macro")}</span></button>`;
    })
    .join(
      "",
    )}</div><button class="connect-entity" data-device-settings="${height.id}">Configure desk entities and macros</button></article>`;
}
function drawControls() {
  $("preview-mode-note").textContent = preview
    ? "No device commands"
    : "Actions control real devices";
  $("control-mode").value = preview ? "simulation" : "live";
  $("preview").setAttribute(
    "aria-label",
    "Simulation: device commands are disabled",
  );
  if (!selected) return;
  updateRoomSummary();
  const active = document.activeElement;
  const focusKind = [
    "deviceSettings",
    "deviceVisibility",
    "number",
    "press",
    "cover",
    "position",
    "toggle",
    "brightness",
    "color",
    "temperature",
    "effect",
    "transition",
    "preset",
    "white",
  ].find((k) => active?.dataset?.[k]);
  const focusId = focusKind ? active.dataset[focusKind] : null;
  const focusExtra = active?.dataset?.action
    ? `[data-action="${active.dataset.action}"]`
    : active?.dataset?.hex
      ? `[data-hex="${active.dataset.hex}"]`
      : active?.dataset?.kelvin
        ? `[data-kelvin="${active.dataset.kelvin}"]`
        : "";
  const states = new Map(selected.controls.map((c) => [c.id, state(c)]));
  if (view?.model?.id === selected.id) {
    view.setStates(states);
    view.setDaylight(
      selected.daylight?.mode ?? "night",
      status.connected
        ? status.entities.find((e) => e.entity_id === selected.daylight?.entity)
        : undefined,
    );
  }
  if (selected.houseView) {
    $("controls").replaceChildren();
    $("controls-section").hidden = true;
    return;
  }
  const entries = deviceEntries(selected, { includeHidden: true });
  $("group-lights").hidden =
    !!selected.houseView ||
    selected.controls.filter((c) => c.type === "light").length < 2;
  const tools = entries.length >= DEVICE_TOOLS_MIN;
  $("device-tools").hidden = !tools;
  for (const chip of document.querySelectorAll("[data-chip]"))
    chip.setAttribute(
      "aria-pressed",
      String(chip.dataset.chip === deviceFilter),
    );
  const query = tools ? deviceQuery.trim().toLowerCase() : "";
  const visible = entries.filter((c) => {
    const s = states.get(c.id);
    if (
      query &&
      !`${c.label} ${c.room || ""} ${selected.bindings[c.id] || ""}`
        .toLowerCase()
        .includes(query)
    )
      return false;
    const isOn = c.type === "cover" ? s.position > 0 : !!s.on;
    if (!tools || deviceFilter === "all") return true;
    if (deviceFilter === "on") return isOn;
    if (deviceFilter === "off") return !isOn;
    return !selected.bindings[c.id];
  });
  $("control-count").innerHTML =
    `<span class="pill" data-live="${!preview}">${preview ? "Simulation" : "Live controls"}</span>${visible.length === entries.length ? entries.length : `${visible.length} of ${entries.length}`} ${entries.length === 1 ? "device" : "devices"}`;
  const cardHTML = visible.map((c) => {
    if (c.hidden)
      return `<article class="light-card" data-control="${c.id}"><div class="device-heading"><strong>${esc(c.label)}</strong><span class="pill">Hidden</span></div><p class="muted">Hidden in all 3D Rooms views and dashboards.</p><button type="button" data-device-visibility="${c.id}" data-hidden="false" aria-label="Show ${esc(c.label)}">Show device</button></article>`;
    if (c.device) return deskCard(c.device, states);
    if (c.type === "climate") {
      const s = states.get(c.id);
      return `<article class="light-card" data-control="${c.id}"><div class="device-heading"><span class="light-label">${esc(c.label)}</span>${deviceSettingsButton(c)}</div><p>${esc(s.mode)}${s.currentTemperature === undefined ? "" : ` · Current ${s.currentTemperature}°`}${s.temperature === undefined ? "" : ` · Target ${s.temperature}°`}</p><button data-climate="${c.id}" ${s.unavailable || !native?.moreInfo ? "disabled" : ""}>Open Home Assistant AC controls</button>${entityNote(c)}</article>`;
    }

    if (c.type === "button") {
      const s = states.get(c.id),
        label = esc(c.label);
      return `<article class="light-card" data-control="${c.id}"><div class="device-heading"><span class="light-label">${label}</span>${deviceSettingsButton(c)}</div><button data-press="${c.id}" aria-label="Run ${label}" ${!preview && s.unavailable ? "disabled" : ""}><span data-entity-icon="${c.id}" aria-hidden="true"></span> ${label}</button>${entityNote(c)}</article>`;
    }
    if (c.type === "number") {
      const s = states.get(c.id),
        label = esc(c.label),
        disabled = !preview && s.unavailable ? "disabled" : "";
      const attrs = s.entity?.attributes || {},
        min = preview ? c.min : Math.max(c.min, attrs.min ?? c.min),
        max = preview ? c.max : Math.min(c.max, attrs.max ?? c.max),
        step = preview ? c.step : Math.max(c.step, attrs.step || c.step);
      return `<article class="light-card" data-control="${c.id}"><div class="device-heading"><div class="light-label">${label}</div>${deviceSettingsButton(c)}</div><label>${label} <output>${s.value === undefined ? "Unknown" : s.value + " " + esc(c.unit)}</output><input type="range" min="${min}" max="${max}" step="${step}" value="${s.value ?? c.defaultValue}" data-number="${c.id}" aria-label="${label}" ${disabled}></label>${entityNote(c)}</article>`;
    }
    if (c.type === "cover") {
      const s = states.get(c.id),
        f = preview
          ? { open: true, close: true, position: true, stop: true }
          : coverFeatures(s.entity);
      const disabled = !preview && s.unavailable ? "disabled" : "";
      const label = esc(c.label);
      const actionLabel = (action) =>
        c.motion === "none"
          ? { open: "Up", close: "Down", stop: "Stop" }[action]
          : action[0].toUpperCase() + action.slice(1);
      const statusLabel =
        !preview && !selected.bindings[c.id]
          ? "Not connected"
          : c.motion === "none"
            ? s.unavailable
              ? "Unavailable"
              : s.entity?.state === "opening"
                ? "Moving up"
                : s.entity?.state === "closing"
                  ? "Moving down"
                  : "Stopped"
            : preview
              ? `${Math.round(s.position)}% open · preview`
              : s.label;
      return `<article class="light-card shade-card" data-control="${c.id}"><div class="device-heading"><div><div class="light-label">${label}</div><p class="light-state">${esc(statusLabel)}</p></div>${deviceSettingsButton(c)}</div>
          <div class="shade-actions">${["open", "stop", "close"]
            .filter(
              (action) =>
                f[action] &&
                c.capabilities.includes(
                  action === "stop" ? "stop" : "open_close",
                ),
            )
            .map(
              (action) =>
                `<button data-cover="${c.id}" data-action="${action}" aria-label="${actionLabel(action)} ${label}" ${disabled}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${action === "stop" ? '<rect x="7" y="7" width="10" height="10" rx="1"/>' : `<path d="${action === "open" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}"/>`}</svg><span>${actionLabel(action)}</span></button>`,
            )
            .join("")}</div>
          ${f.position && c.capabilities.includes("position") ? `<div class="shade-position"><label class="shade-position-label" for="shade-position-${c.id}"><span>Opening</span><output>${s.position === undefined ? "Unknown" : Math.round(s.position) + "%"}</output></label><input id="shade-position-${c.id}" style="--shade-fill:${s.position ?? c.defaultPosition ?? 0}%" type="range" min="0" max="100" step="1" value="${s.position ?? c.defaultPosition ?? 0}" data-position="${c.id}" aria-label="${label} opening" aria-valuetext="${s.position === undefined ? "Position unknown" : Math.round(s.position) + " percent open"}" ${disabled}><div class="shade-endpoints"><span>Closed</span><span>Open</span></div></div>` : ""}
          ${entityNote(c)}</article>`;
    }
    const s = states.get(c.id),
      f = preview
        ? {
            brightness: true,
            color: true,
            temperature: true,
            minKelvin: 2000,
            maxKelvin: 6500,
            effects: [],
            transition: false,
          }
        : lightFeatures(s.entity);
    const waiting = pending.has(`${selected.id}/${c.id}`),
      disabled = waiting || (!preview && s.unavailable) ? "disabled" : "";
    const label = esc(c.label),
      id = c.id;
    const slider = (title, kind, min, max, value, extra = "") =>
      `<label class="brightness ${kind === "temperature" ? "temperature-control" : ""}"><span>${title}</span><input aria-label="${label} ${kind === "temperature" ? "white temperature" : kind}" type="range" min="${min}" max="${max}" value="${value}" data-${kind}="${id}" ${disabled} ${extra}></label>`;
    const temperature = Math.round(
      Math.max(f.minKelvin, Math.min(f.maxKelvin, s.colorTempKelvin ?? 3000)),
    );
    const presets = [
      ["Warm", 2700],
      ["Neutral", 4000],
      ["Cool", 6500],
    ].filter(([, k]) => k >= f.minKelvin && k <= f.maxKelvin);
    const extras = `${
      f.color
        ? `<div class="color-controls"><label class="color-picker">Color <input type="color" aria-label="${label} color" data-color="${id}" value="${rgbToHex(s.rgb)}" ${disabled}></label><div class="color-presets" aria-label="Color presets for ${label}">${[
            ["Red", "#ff4242"],
            ["Green", "#46e881"],
            ["Blue", "#557bff"],
            ["Purple", "#c261ff"],
          ]
            .map(
              ([name, color]) =>
                `<button class="color-swatch" data-preset="${id}" data-hex="${color}" aria-label="Set ${label} to ${name.toLowerCase()}" style="--swatch:${color}" ${disabled}></button>`,
            )
            .join("")}</div></div>`
        : ""
    }
    ${f.temperature ? `<div class="white-controls">${slider(`White temperature <output>${temperature} K</output>`, "temperature", f.minKelvin, f.maxKelvin, temperature)}<div class="temperature-labels"><span>Warm · ${f.minKelvin} K</span><span>Cool · ${f.maxKelvin} K</span></div><div class="white-presets">${presets.map(([name, k]) => `<button data-white="${id}" data-kelvin="${k}" aria-label="Set ${label} to ${name.toLowerCase()} white" ${disabled}>${name}</button>`).join("")}</div><span class="muted small">${s.colorMode === "color_temp" ? "White temperature active" : "Select white to switch from color"}</span></div>` : ""}
    ${f.effects.length ? `<label class="light-option">Effect<select data-effect="${id}" aria-label="${label} effect" ${disabled}><option value="">Choose an effect</option>${f.effects.map((effect) => `<option value="${esc(effect)}" ${s.effect === effect ? "selected" : ""}>${esc(effect)}</option>`).join("")}</select></label>` : ""}
    ${f.transition ? `<label class="light-option">Fade on next change<select data-transition="${id}" aria-label="${label} fade" ${disabled}>${[0, 0.5, 1, 2, 5, 10].map((t) => `<option value="${t}" ${t === (fades.get(id) || 0) ? "selected" : ""}>${t ? t + " seconds" : "Instant"}</option>`).join("")}</select></label>` : ""}`;
    const more = [
      f.color && "Color",
      f.temperature && "White",
      f.effects.length && "Effects",
      f.transition && "Fade",
    ].filter(Boolean);
    return `<article class="light-card" data-control="${id}"><div class="light-heading"><div><div class="light-label">${label}</div>${c.lightGroup ? `<span class="muted small">Light group · ${selected.controls.filter((member) => member.lightGroup === c.lightGroup).length} lights</span>` : ""}<div class="light-state">${waiting ? "Waiting for confirmation…" : preview ? (s.on ? "On · preview" : "Off · preview") : esc(s.label)}</div></div><div class="device-card-actions">${deviceSettingsButton(c)}<button role="switch" aria-label="${label}" aria-checked="${s.on}" class="switch" data-toggle="${id}" ${disabled}>${s.on ? "On" : "Off"}</button></div></div>
    ${c.capabilities.includes("brightness") && f.brightness ? slider(`Brightness <output>${Math.round((s.brightness / 255) * 100)}%</output>`, "brightness", 1, 255, s.brightness) : ""}
    ${more.length ? `<details class="more-controls" data-more="${id}" ${openMore.has(id) ? "open" : ""}><summary>${more.join(" · ")}</summary><div class="more-body">${extras}</div></details>` : ""}
    ${entityNote(c)}</article>`;
  });
  const categories = [...new Set(visible.map(deviceGroup))];
  $("controls").innerHTML = categories
    .map(
      (group) =>
        `<section class="device-category"><h3>${esc(group)}</h3><div class="device-category-grid">${visible
          .map((control, index) => {
            if (deviceGroup(control) !== group) return "";
            const connection = connectionState(
              control,
              selected,
              status,
              preview,
            );
            return `<div class="device-with-status"><span class="device-connection" data-kind="${connection.kind}">${esc(connection.label)}</span>${cardHTML[index]}${control.hidden ? "" : `<button type="button" class="hide-device" data-device-visibility="${control.id}" data-hidden="true" aria-label="Hide ${esc(control.label)}">Hide device</button>`}</div>`;
          })
          .join("")}</div></section>`,
    )
    .join("");
  for (const slot of document.querySelectorAll("[data-entity-icon]")) {
    const c = selected.controls.find((c) => c.id === slot.dataset.entityIcon);
    const entity = states.get(c.id)?.entity || {
      entity_id: "button.preview",
      state: "unknown",
      attributes: { icon: "mdi:gesture-tap-button" },
    };
    slot.textContent = "▶";
    if (native?.entityIcon)
      void native
        .entityIcon(entity)
        .then((data) => {
          if (slot.isConnected) paintEntityIcon(slot, data);
        })
        .catch(() => {});
  }

  if (!visible.length)
    $("controls").innerHTML =
      '<div class="no-devices"><p>No devices match.</p><button type="button" data-clear-filters>Clear filters</button></div>';
  if (focusId)
    document
      .querySelector(`[data-${focusKind}="${focusId}"]${focusExtra}`)
      ?.focus({ preventScroll: true });
}
async function command(id, on, settings = {}) {
  const model = selected,
    c = model.controls.find((c) => c.id === id);
  if (preview) {
    const next = { ...state(c), on };
    if (settings.brightness !== undefined)
      next.brightness = settings.brightness;
    if (settings.rgb_color) {
      next.rgb = settings.rgb_color;
      next.colorMode = "rgb";
    }
    if (settings.color_temp_kelvin !== undefined) {
      next.colorTempKelvin = settings.color_temp_kelvin;
      next.rgb = kelvinToRgb(settings.color_temp_kelvin);
      next.colorMode = "color_temp";
    }
    for (const member of model.controls.filter(
      (member) =>
        member.id === id ||
        (c.lightGroup && member.lightGroup === c.lightGroup),
    ))
      simulated.set(member.id, next);
    drawControls();
    return;
  }
  const entityId = model.bindings[id],
    entity = status.entities.find((e) => e.entity_id === entityId);
  if (lightFeatures(entity).transition)
    settings = { ...settings, transition: fades.get(id) || 0 };
  const key = `${model.id}/${id}`;
  pending.add(key);
  drawControls();
  try {
    await api(`models/${model.id}/command`, {
      method: "POST",
      body: JSON.stringify({
        controlId: id,
        action: on ? "on" : "off",
        ...settings,
      }),
    });
    const start = Date.now(),
      timeout = 8000 + (settings.transition || 0) * 1000;
    while (Date.now() - start < timeout) {
      status = await api("status");
      const actual = status.entities.find((e) => e.entity_id === entityId);
      if (commandConfirmed(actual, on, settings)) return;
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(
      "Command sent, but the device has not confirmed its state.",
    );
  } catch (e) {
    toast(e.message);
  } finally {
    pending.delete(key);
    drawControls();
  }
}
async function pressPreset(id) {
  const c = selected.controls.find((c) => c.id === id);
  if (preview) {
    toast("Preset preview: connect its Home Assistant entity to run it.");
    return;
  }
  try {
    actionCommand(state(c).entity, c, "press");
    await api(`models/${selected.id}/command`, {
      method: "POST",
      body: JSON.stringify({ controlId: id, action: "press" }),
    });
    status = await api("status");
    drawControls();
  } catch (error) {
    toast(error.message);
  }
}
async function moveNumber(id, value) {
  const model = selected,
    c = model.controls.find((c) => c.id === id);
  if (preview) {
    simulated.set(id, { value });
    drawControls();
    return;
  }
  try {
    numberCommand(state(c).entity, c, "set_value", value);
    await api(`models/${model.id}/command`, {
      method: "POST",
      body: JSON.stringify({ controlId: id, action: "set_value", value }),
    });
    status = await api("status");
    drawControls();
  } catch (error) {
    toast(error.message);
    drawControls();
  }
}
async function moveCover(id, action, position) {
  const model = selected,
    c = model.controls.find((c) => c.id === id);
  if (preview) {
    simulated.set(id, {
      ...state(c),
      position:
        action === "open"
          ? 100
          : action === "close"
            ? 0
            : action === "position"
              ? position
              : state(c).position,
    });
    drawControls();
    return;
  }
  try {
    coverCommand(state(c).entity, c, action, position);
    await api(`models/${model.id}/command`, {
      method: "POST",
      body: JSON.stringify({
        controlId: id,
        action,
        ...(action === "position" ? { position } : {}),
      }),
    });
    // Render reported state only; travel continues to arrive through HA state events.
    status = await api("status");
    drawControls();
  } catch (error) {
    toast(error.message);
  }
}
$("controls").addEventListener("click", async (e) => {
  const visibility = e.target.closest("[data-device-visibility]");
  if (visibility) {
    const model = selected;
    visibility.disabled = true;
    try {
      await api(`models/${model.id}/device-visibility`, {
        method: "PUT",
        body: JSON.stringify({
          controlId: visibility.dataset.deviceVisibility,
          hidden: visibility.dataset.hidden === "true",
        }),
      });
      await refreshDeviceVisibility();
      toast(
        visibility.dataset.hidden === "true"
          ? "Device hidden in all 3D Rooms views"
          : "Device shown again",
      );
    } catch (error) {
      toast(error.message);
    } finally {
      visibility.disabled = false;
    }
    return;
  }
  const settings = e.target.closest("[data-device-settings]");
  if (settings) {
    openDeviceSettings(settings.dataset.deviceSettings);
    return;
  }
  if (e.target.closest("[data-clear-filters]")) {
    deviceFilter = "all";
    deviceQuery = $("device-search").value = "";
    drawControls();
    return;
  }
  const card = e.target.closest("[data-control]");
  if (card && !e.target.closest("button,input,select,summary,label,a"))
    view?.highlight(card.dataset.control);
  const climate = e.target.closest("[data-climate]");
  if (climate) {
    const c = selected.controls.find((c) => c.id === climate.dataset.climate);
    if (c && !state(c).unavailable) native?.moreInfo?.(selected.bindings[c.id]);
    return;
  }
  const preset = e.target.closest("[data-press]");
  if (preset) pressPreset(preset.dataset.press);
  const cover = e.target.closest("[data-cover]");
  if (cover) moveCover(cover.dataset.cover, cover.dataset.action);
  const toggle = e.target.closest("[data-toggle]"),
    color = e.target.closest("[data-preset]"),
    white = e.target.closest("[data-white]");
  if (toggle) {
    const c = selected.controls.find((c) => c.id === toggle.dataset.toggle);
    view.highlight(c.id);
    command(c.id, !state(c).on);
  }
  if (color)
    command(color.dataset.preset, true, {
      rgb_color: hexToRgb(color.dataset.hex),
    });
  if (white)
    command(white.dataset.white, true, {
      color_temp_kelvin: Number(white.dataset.kelvin),
    });
});
$("controls").addEventListener(
  "toggle",
  (e) => {
    const id = e.target.dataset?.more;
    if (id) e.target.open ? openMore.add(id) : openMore.delete(id);
  },
  true,
);
$("device-tools").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (!chip) return;
  deviceFilter = chip.dataset.chip;
  drawControls();
});
$("device-search").addEventListener("input", (e) => {
  deviceQuery = e.target.value;
  drawControls();
});
$("controls").addEventListener("input", (e) => {
  if (e.target.dataset.number)
    e.target.closest("label").querySelector("output").textContent =
      e.target.value + " cm";
  if (e.target.dataset.position) {
    e.target.closest(".shade-position").querySelector("output").textContent =
      e.target.value + "%";
    e.target.style.setProperty("--shade-fill", e.target.value + "%");
    e.target.setAttribute("aria-valuetext", e.target.value + " percent open");
  }
  if (e.target.dataset.temperature)
    e.target.closest("label").querySelector("output").textContent =
      e.target.value + " K";
  if (e.target.dataset.brightness)
    e.target.closest("label").querySelector("output").textContent =
      Math.round((e.target.value / 255) * 100) + "%";
});
$("controls").addEventListener("change", (e) => {
  const input = e.target,
    d = input.dataset;
  if (d.number) moveNumber(d.number, Number(input.value));
  if (d.position) moveCover(d.position, "position", Number(input.value));
  if (d.brightness)
    command(d.brightness, true, { brightness: Number(input.value) });
  if (d.color) command(d.color, true, { rgb_color: hexToRgb(input.value) });
  if (d.temperature)
    command(d.temperature, true, { color_temp_kelvin: Number(input.value) });
  if (d.effect && input.value) command(d.effect, true, { effect: input.value });
  if (d.transition) fades.set(d.transition, Number(input.value));
});
function drawModels() {
  workspace.draw();
}
function drawDaylight() {
  const config = selected?.daylight;
  $("daylight-controls").hidden = !config;
  if (!config) return;
  $("daylight-mode").value = config.mode;
  const suns = status.entities.filter((e) => e.entity_id.startsWith("sun."));
  $("sun-entity").innerHTML = suns
    .map(
      (e) =>
        `<option value="${esc(e.entity_id)}">${esc(e.attributes?.friendly_name || e.entity_id)}</option>`,
    )
    .join("");
  if (!suns.some((e) => e.entity_id === config.entity))
    $("sun-entity").insertAdjacentHTML(
      "beforeend",
      `<option value="${esc(config.entity)}">${esc(config.entity)} (not available)</option>`,
    );
  $("sun-entity").value = config.entity;
  $("sun-setting").hidden = config.mode !== "auto";
  $("daylight-note").textContent =
    !status.connected && config.mode === "auto"
      ? "Sun unavailable: retaining the last daylight level. Choose Day or Night to preview."
      : "Daylight follows reported shade openings. Indoor lights stay independent.";
}
for (const id of ["daylight-mode", "sun-entity"])
  $(id).onchange = async () => {
    const model = selected;
    const settings = {
      mode: $("daylight-mode").value,
      entity: $("sun-entity").value,
    };
    if (status.mode === "preview") {
      model.daylight = { ...model.daylight, ...settings };
      drawDaylight();
      drawControls();
      return;
    }
    try {
      const result = await api(`models/${model.id}/daylight`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      model.daylight = result.daylight;
      if (selected === model) {
        drawDaylight();
        drawControls();
      }
    } catch (error) {
      toast(error.message);
      drawDaylight();
    }
  };
function roomSettingsDirty() {
  if (selected?.houseView) return workspace.dirty();
  return (
    selected &&
    activeRoomTab === "settings" &&
    ($("room-name").value !== selected.title ||
      $("room-area").value !== (selected.areaId || "") ||
      [...$("room-appearance-choices").querySelectorAll("input")].some(
        (input) =>
          input.checked !==
          selected.appearance?.find((p) => p.id === input.dataset.partId)
            ?.visible,
      ) ||
      (selected.housePlacement &&
        (JSON.stringify(
          [...$("room-floor-choices").querySelectorAll("input:checked")]
            .map((i) => i.value)
            .sort(),
        ) !==
          JSON.stringify(
            selected.housePlacement.floors
              .filter((f) => selected.housePlacement.floorIds.includes(f.id))
              .map((f) => f.haFloorId)
              .filter(Boolean)
              .sort(),
          ) ||
          [...$("room-floor-links").querySelectorAll("select")].some(
            (p) =>
              p.value !==
              (selected.housePlacement.floors.find(
                (f) => f.id === p.dataset.levelId,
              )?.haFloorId || ""),
          ))))
  );
}
function updateRoomSummary() {
  if (!selected) return;
  if (selected.houseView) {
    $("room-summary").textContent = houseViewSummary(selected);
    return;
  }
  const area = areas.find((a) => a.area_id === selected.areaId);
  const entries = deviceEntries(selected),
    total = entries.length;
  const bound = entries.filter((c) =>
    c.device
      ? [c.device.height, c.device.motion, ...c.device.macros].some(
          (id) => selected.bindings[id],
        )
      : selected.bindings[c.id],
  ).length;
  $("room-summary").innerHTML =
    `<div class="status-item"><span>${total} ${total === 1 ? "device" : "devices"}</span><span aria-hidden="true">·</span><span>${bound} connected</span></div>${area ? `<span class="status-area">${esc(area.name)}</span>` : ""}${bound < total ? `<button type="button" data-open-mappings>Set up ${total - bound} ${total - bound === 1 ? "device" : "devices"}<span aria-hidden="true"> →</span></button>` : total ? '<span class="status-ready">All devices connected</span>' : '<span class="status-ready">No devices in this room</span>'}`;
}
$("room-summary").addEventListener("click", (e) => {
  if (e.target.closest("[data-open-mappings]")) openDeviceSettings();
});
function setRoomTab(tab, { keepEditor = false } = {}) {
  if (!["overview", "devices", "views", "settings"].includes(tab))
    tab = "overview";
  if (selected?.houseView && tab === "devices") tab = "overview";
  if (
    tab !== activeRoomTab &&
    roomSettingsDirty() &&
    !confirm("Discard unsaved settings?")
  )
    return false;
  if (!keepEditor && tab !== activeRoomTab && !dashboardEditor.close())
    return false;
  if (activeRoomTab !== "views" && tab === "views") {
    homeModelId = selected?.id;
    homeTab = activeRoomTab;
  }
  activeRoomTab = tab;
  document.body.dataset.workspace = tab === "views" ? "views" : "home";
  $("nav-home").setAttribute("aria-pressed", String(tab !== "views"));
  $("nav-views").setAttribute("aria-pressed", String(tab === "views"));
  workspace.closeLibrary();
  document.body.dataset.roomTab = tab;
  $("dashboard").hidden = true;
  $("preview-label").hidden =
    !selected || !!selected.houseView || tab !== "devices";
  $("floor-view").hidden = $("home-view").hidden =
    !selected || tab === "settings";
  document.querySelector(".room-tabs").hidden = !selected;
  document.querySelector(".view-tools").hidden =
    !selected || tab === "settings";
  for (const b of document.querySelectorAll("[data-room-tab]"))
    b.setAttribute("aria-pressed", String(b.dataset.roomTab === tab));
  $("controls-section").hidden =
    !selected || !!selected.houseView || tab !== "devices";
  $("saved-views-section").hidden = tab !== "views";
  $("room-settings-section").hidden =
    !selected || !!selected.houseView || tab !== "settings";
  $("house-management").hidden = !native;
  $("house-settings-section").hidden =
    !selected?.houseView || tab !== "settings";
  if (tab === "settings" && selected?.houseView) workspace.drawFloors();
  if (tab === "settings" && !selected?.houseView) drawRoomSettings();
  if (tab === "views") savedViews?.refresh();
  const url = new URL(location.href);
  url.searchParams.set("tab", tab);
  history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("rooms-route-change"));
  return true;
}
$("nav-views").onclick = () => {
  if (dashboardEditor.close()) setRoomTab("views");
};
$("nav-home").onclick = async () => {
  if (activeRoomTab !== "views") return;
  if (
    homeModelId &&
    models.some((m) => m.id === homeModelId) &&
    selected?.id !== homeModelId
  )
    await choose(homeModelId, homeTab);
  else setRoomTab(homeTab);
};
for (const b of document.querySelectorAll("[data-room-tab]"))
  b.onclick = () => setRoomTab(b.dataset.roomTab);
function drawRoomSettings() {
  if (!selected) return;
  $("room-appearance-settings").hidden = !selected.appearance?.length;
  $("room-appearance-choices").replaceChildren(
    ...(selected.appearance || []).map((part) => {
      const label = document.createElement("label"),
        input = document.createElement("input");
      label.className = "check";
      input.type = "checkbox";
      input.dataset.partId = part.id;
      input.checked = part.visible;
      label.append(input, document.createTextNode(part.label));
      return label;
    }),
  );
  $("house-floor-settings").hidden = !selected.housePlacement;
  $("room-floor-choices").replaceChildren();
  $("room-floor-links").replaceChildren();
  const definition = selected.housePlacement;
  for (const level of definition?.floors || []) {
    const label = document.createElement("label"),
      picker = document.createElement("select");
    label.textContent = `${level.name} · ${level.minY}–${level.maxY} m`;
    picker.dataset.levelId = level.id;
    picker.setAttribute("aria-label", `Home Assistant floor for ${level.name}`);
    picker.append(
      new Option("Match to an HA floor", ""),
      ...haFloors.map((f) => new Option(f.name, f.floor_id)),
    );
    picker.value = level.haFloorId || "";
    let previous = picker.value;
    picker.onchange = () => {
      if (definition.floorIds.includes(level.id)) {
        for (const checkbox of $("room-floor-choices").querySelectorAll(
          "input",
        )) {
          if (checkbox.value === previous) checkbox.checked = false;
          if (checkbox.value === picker.value) checkbox.checked = true;
        }
      }
      previous = picker.value;
    };
    label.append(picker);
    $("room-floor-links").append(label);
  }
  for (const floor of haFloors) {
    const label = document.createElement("label"),
      checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = floor.floor_id;
    checkbox.checked = !!definition?.floors.some(
      (f) =>
        f.haFloorId === floor.floor_id && definition.floorIds.includes(f.id),
    );
    label.append(checkbox, document.createTextNode(floor.name));
    $("room-floor-choices").append(label);
  }
  $("room-floor-note").textContent = haFloors.length
    ? "Floors come from Home Assistant. Match exported height ranges below, then check every floor this room occupies."
    : "No Home Assistant floors found. Create them under Settings → Areas, labels & zones, then refresh areas and floors.";
  $("room-name").value = selected.title;
  $("room-area").replaceChildren();
  const add = (value, label) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    $("room-area").append(o);
  };
  add("", "Not assigned");
  for (const area of [...areas].sort((a, b) => a.name.localeCompare(b.name)))
    add(area.area_id, area.name);
  if (selected.areaId && !areas.some((a) => a.area_id === selected.areaId))
    add(selected.areaId, "Previously assigned area (unavailable)");
  $("room-area").value = selected.areaId || "";
  $("room-area").disabled = !status.connected;
  $("replace-form").hidden = !native;
  $("replace-error").textContent = "";
  $("room-area-note").textContent =
    areasError ||
    (!status.connected
      ? "Open 3D Rooms inside Home Assistant to assign an area."
      : !areas.length
        ? "No areas found. Create an area in Home Assistant, then refresh this list."
        : "Link this 3D room to its Home Assistant area. Assign device entities separately.");
  $("room-settings-error").textContent = "";
  $("room-save-status").textContent = "";
  updateRoomSummary();
}
async function refreshAreas({ quiet = false } = {}) {
  const editing = roomSettingsDirty()
    ? {
        id: selected.id,
        appearance: [
          ...$("room-appearance-choices").querySelectorAll("input"),
        ].map((i) => [i.dataset.partId, i.checked]),
        title: $("room-name").value,
        areaId: $("room-area").value,
        floorIds: [
          ...$("room-floor-choices").querySelectorAll("input:checked"),
        ].map((i) => i.value),
        floorLinks: Object.fromEntries(
          [...$("room-floor-links").querySelectorAll("select")].map((p) => [
            p.dataset.levelId,
            p.value,
          ]),
        ),
      }
    : null;
  try {
    [areas, haFloors] = await Promise.all([api("areas"), api("floors")]);
    areasError = "";
    drawModels();
    drawRoomSettings();
  } catch (error) {
    areasError =
      "Could not load Home Assistant areas. Use Refresh areas to try again.";
    if (!quiet) toast(error.message);
    drawRoomSettings();
  }
  if (editing && selected?.id === editing.id) {
    for (const input of $("room-appearance-choices").querySelectorAll("input"))
      input.checked =
        editing.appearance.find(([id]) => id === input.dataset.partId)?.[1] ??
        input.checked;
    $("room-name").value = editing.title;
    $("room-area").value = editing.areaId;
    for (const input of $("room-floor-choices").querySelectorAll("input"))
      input.checked = editing.floorIds.includes(input.value);
    for (const picker of $("room-floor-links").querySelectorAll("select"))
      picker.value = editing.floorLinks[picker.dataset.levelId] || "";
  }
}
$("refresh-areas").onclick = () => refreshAreas();
$("room-settings-form").onsubmit = async (event) => {
  event.preventDefault();
  const model = selected;
  const data = {
    title: $("room-name").value.trim(),
    ...(model.appearance?.length
      ? {
          appearance: model.appearance.map((part) => ({
            ...part,
            visible:
              [...$("room-appearance-choices").querySelectorAll("input")].find(
                (i) => i.dataset.partId === part.id,
              )?.checked ?? part.visible,
          })),
        }
      : {}),
    areaId: $("room-area").value,
    ...(model.housePlacement
      ? {
          haFloorIds: [
            ...$("room-floor-choices").querySelectorAll("input:checked"),
          ].map((input) => input.value),
          floorLinks: Object.fromEntries(
            [...$("room-floor-links").querySelectorAll("select")].map(
              (picker) => [picker.dataset.levelId, picker.value],
            ),
          ),
        }
      : {}),
  };
  $("save-room-settings").disabled = true;
  $("room-settings-error").textContent = "";
  try {
    const result = await api(`models/${model.id}/room`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    Object.assign(model, result);
    if (view?.model?.id === model.id) {
      view.model = model;
      view.cutaway();
      view.render();
    }
    models = await api("models");
    selected = models.find((m) => m.id === model.id);
    drawModels();
    if (selected?.id === model.id) {
      $("title").textContent = model.title;
      $("model-type").textContent =
        areas.find((a) => a.area_id === model.areaId)?.name || "3D ROOM";
      drawRoomSettings();
      $("room-save-status").textContent = "Saved";
    }
    toast("Room settings saved.");
  } catch (error) {
    $("room-settings-error").textContent = error.message;
  } finally {
    $("save-room-settings").disabled = false;
  }
};
$("replace-form").onsubmit = async (event) => {
  event.preventDefault();
  const model = selected;
  const file = $("replace-package").files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    $("replace-error").textContent = "Choose a ZIP smaller than 100 MB.";
    return;
  }
  if (
    !confirm(
      `Replace the 3D model for ${model.title}? Its name, area, daylight setting, saved views and matching device mappings are kept.`,
    )
  )
    return;
  $("replace-form").setAttribute("aria-busy", "true");
  $("replace-submit").disabled = true;
  $("replace-submit").textContent = "Uploading model…";
  $("replace-error").textContent = "";
  const progress = uploadProgress("replace");
  try {
    const result = await api(`models/${model.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/zip" },
      body: file,
      file,
      onProgress: progress.onProgress,
      onUploaded: progress.onUploaded,
    });
    progress.preparing();
    $("replace-submit").textContent = "Preparing 3D view…";
    models = await api("models");
    $("replace-form").reset();
    await choose(model.id, "settings");
    const notes = [];
    if (result.removedBindings.length)
      notes.push(
        `${result.removedBindings.length} mapping${result.removedBindings.length === 1 ? "" : "s"} removed because the device changed or no longer exists`,
      );
    if (result.unmappedControls.length)
      notes.push(
        `${result.unmappedControls.length} device${result.unmappedControls.length === 1 ? " needs" : "s need"} an entity`,
      );
    progress.complete();
    toast(["Room model replaced.", ...notes].join(" · "));
  } catch (error) {
    progress.failed();
    $("replace-error").textContent = error.message;
  } finally {
    $("replace-form").setAttribute("aria-busy", "false");
    $("replace-submit").disabled = false;
    $("replace-submit").textContent = "Replace model";
  }
};
$("room-export").onclick = () => $("export-model").click();
$("room-remove").onclick = () => $("delete-model").click();
window.addEventListener("beforeunload", (event) => {
  if (roomSettingsDirty()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function choose(id, tab = "overview", { forceEditorClose = false } = {}) {
  if (!models.some((m) => m.id === id)) return false;
  if (roomSettingsDirty() && !confirm("Discard unsaved settings?")) return;
  if (!dashboardEditor.close({ force: forceEditorClose })) return false;
  if (view) {
    for (const key of ["camera", "heading", "tilt", "zoom"])
      delete view.options[key];
    view.options.mode = viewMode;
  }
  cameraNavigation.hidden = true;
  const current = ++selection;
  selected = models.find((m) => m.id === id);
  if (selected?.houseView && tab === "devices") tab = "overview";
  $("show-room-settings").hidden = false;
  $("show-models").hidden = !!selected?.houseView;
  workspace.closeLibrary();
  $("show-models").textContent = "Devices";
  document.querySelector(".view-tools-title").textContent = selected?.houseView
    ? selected.houseFloor
      ? "Floor overview"
      : "House overview"
    : "Room overview";
  const model = selected;
  const url = new URL(location.href);
  if (url.searchParams.get("model") !== id)
    url.searchParams.delete("saved_view");
  url.searchParams.set("model", id);
  history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("rooms-route-change"));
  simulated.clear();
  pending.clear();
  drawModels();
  $("empty").hidden = true;
  $("controls").replaceChildren();
  drawDaylight();
  drawRoomSettings();
  setRoomTab(tab, { keepEditor: true });
  savedViews?.refresh();
  $("title").textContent = roomName(selected);
  $("model-type").textContent = selected.houseView
    ? selected.houseFloor
      ? "HOUSE FLOOR"
      : "HOUSE"
    : areas.find((a) => a.area_id === selected.areaId)?.name ||
      selected.floor ||
      "3D ROOM";
  $("settings").hidden = !!selected.houseView;
  $("home-view").hidden = activeRoomTab === "settings";
  $("floor-view").hidden = activeRoomTab === "settings";
  $("dashboard").hidden = true;
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  $("preview-label").hidden =
    !!selected.houseView || activeRoomTab !== "devices";
  $("controls-section").hidden =
    !!selected.houseView || activeRoomTab !== "devices";
  $("control-count").textContent = `${selected.controls.length} devices`;
  $("view-hint").textContent = "Drag to rotate · Scroll to zoom";
  $("retry-scene").hidden = true;
  $("scene-status").hidden = false;
  $("scene-status").dataset.state = "loading";
  $("scene-status").textContent = "Loading your model…";
  deviceFilter = "all";
  deviceQuery = $("device-search").value = "";
  try {
    const { SceneView } = await import("./scene");
    if (current !== selection) return;
    view ??= new SceneView(
      $("viewport"),
      (id) => {
        view.highlight(id);
        if (activeRoomTab === "devices") {
          openDeviceSettings(id);
          return;
        }
        document
          .querySelector(
            `[data-climate="${id}"], [data-toggle="${id}"], [data-cover="${id}"], [data-position="${id}"], [data-number="${id}"], [data-press="${id}"]`,
          )
          ?.focus();
      },
      { mode: viewMode, onRoomPick: (id) => workspace.focusRoom(id) },
    );
    $("scene-status").textContent = "Downloading your room…";
    const layers = [],
      urls = [];
    let loaded;
    try {
      if (model.members) {
        for (const [index, member] of model.members.entries()) {
          $("scene-status").textContent =
            `Loading room ${index + 1} of ${model.members.length}…`;
          const source = models.find((m) => m.id === member.model);
          if (!source) throw new Error("A room in this house is missing.");
          const url = native
            ? await native.sceneURL(source)
            : new URL(`api/models/${member.model}/scene.glb`, location.href)
                .href;
          if (native) urls.push(url);
          layers.push({ ...member, url });
        }
        if (current !== selection) return;
        loaded = await view.loadLayers(model, layers);
      } else {
        const url = native
          ? await native.sceneURL(model)
          : new URL(`api/models/${id}/scene.glb`, location.href).href;
        if (native) urls.push(url);
        if (current !== selection) return;
        loaded = await view.load(model, url);
      }
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url));
    }
    if (!loaded || current !== selection) return;
    $("scene-status").hidden = true;
    cameraNavigation.hidden = false;
    drawControls();
    return true;
  } catch (e) {
    if (current !== selection) return;
    $("scene-status").dataset.state = "error";
    $("scene-status").textContent =
      "Could not display this model: " + e.message;
    $("retry-scene").hidden = false;
    toast("The model could not be displayed. Try loading it again.");
    return false;
  }
}
$("retry-scene").onclick = () => choose(selected.id, activeRoomTab);
$("models").addEventListener("click", (e) => {
  const b = e.target.closest("[data-model]");
  if (b) {
    choose(b.dataset.model);
  }
});
window.addEventListener("rooms-view-camera", (event) => {
  viewMode = event.detail.view;
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
});
$("home-view").onclick = () => view?.setCameraPreset("reset");
$("floor-view").onclick = () => {
  viewMode = view?.options.mode === "floor" ? "front" : "floor";
  if (viewMode === "floor") view?.setFloorPlan();
  else {
    view?.setView("front");
    view?.setCameraPreset("reset");
  }
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  const url = new URL(location.href);
  if (viewMode === "floor") url.searchParams.set("view", "floor");
  else url.searchParams.delete("view");
  history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("rooms-route-change"));
};
let scopeChange = null,
  scopeBusy = false;
const scopePicker = searchableSelect(
  $("view-scope-model"),
  $("view-scope-label"),
);
const scopeRadios = () => [
  ...document.querySelectorAll('[name="view-scope-kind"]'),
];
function drawScopeOptions(preferred) {
  const kind = scopeRadios().find((input) => input.checked)?.value;
  const options = scopeOptions(models, kind);
  $("view-scope-model").replaceChildren(
    ...options.map((m) => new Option(viewScopeLabel(m, models), m.id)),
  );
  if (options.some((m) => m.id === preferred))
    $("view-scope-model").value = preferred;
  $("view-scope-label").textContent =
    { house: "House", floor: "Floor", room: "Room" }[kind] || "Space";
  scopePicker.refresh();
  drawScopeSummary();
}
function drawScopeSummary() {
  const model = models.find((m) => m.id === $("view-scope-model").value);
  const members = model?.members
    ?.map((member) => models.find((m) => m.id === member.model))
    .filter(Boolean);
  $("view-scope-summary").textContent = members
    ? `${members.length} rooms: ${members.map(roomName).join(", ")}`
    : model
      ? "A focused view with its own camera and device presentation."
      : "Import a space in My home to get started.";
  $("view-scope-continue").disabled = !model;
}
function requestViewScope({ change = false } = {}) {
  if (!models.length) return;
  try {
    scopeChange = change ? dashboardEditor.snapshot() : null;
  } catch (error) {
    toast(error.message);
    return;
  }
  const preferred = change
    ? selected
    : models.find((m) => m.houseView && !m.houseFloor) || models[0];
  for (const input of scopeRadios()) {
    input.disabled = !scopeOptions(models, input.value).length;
    input.checked = input.value === viewKind(preferred);
  }
  drawScopeOptions(preferred.id);
  $("view-scope-error").textContent = "";
  $("view-scope-reset").hidden = !change;
  $("view-scope-title").textContent = change
    ? "Change the space in this view"
    : "What would you like to show?";
  $("view-scope-continue").textContent = change
    ? "Use this space"
    : "Continue to editor";
  $("view-scope-dialog").showModal();
}
for (const input of scopeRadios()) input.onchange = () => drawScopeOptions();
$("view-scope-model").onchange = drawScopeSummary;
$("view-scope-cancel").onclick = () => {
  if (!scopeBusy) $("view-scope-dialog").close();
};
$("view-scope-dialog").addEventListener("cancel", (event) => {
  if (scopeBusy) event.preventDefault();
});
$("change-view-content").onclick = () => requestViewScope({ change: true });
$("view-scope-form").onsubmit = async (event) => {
  event.preventDefault();
  if (scopeBusy) return;
  const id = $("view-scope-model").value;
  if (!models.some((m) => m.id === id)) return;
  if (scopeChange && id === selected?.id) {
    $("view-scope-dialog").close();
    return;
  }
  scopeBusy = true;
  const controls = [
    ...$("view-scope-form").querySelectorAll("input,select,button"),
  ];
  const disabled = controls.map((el) => el.disabled);
  controls.forEach((el) => (el.disabled = true));
  $("view-scope-continue").textContent = "Loading space…";
  try {
    const previous = scopeChange;
    if (
      selected?.id !== id ||
      view?.model?.id !== id ||
      !$("scene-status").hidden
    ) {
      const loaded = await choose(id, "views", {
        forceEditorClose: !!previous,
      });
      if (!loaded)
        throw new Error("This space could not be loaded. Please try again.");
    }
    if (selected?.id !== id || view?.model?.id !== id)
      throw new Error("This space could not be loaded. Please try again.");
    let component;
    if (previous) {
      const { markers, thumbnail, layers, ...rest } = previous.component;
      component = {
        ...rest,
        layers: [{ model: id, view: "front", heading: 0, tilt: 28, zoom: 1 }],
      };
    }
    $("view-scope-dialog").close();
    dashboardEditor.open(component, {
      draft: previous ? !previous.saved : false,
      reframe: !!previous,
      baselineSnapshot: previous?.baseline,
      savedSnapshot: previous?.savedSnapshot,
    });
  } catch (error) {
    // Restore the original draft after a failed scope load, including unsaved edits.
    if (scopeChange && $("dashboard-panel").hidden) {
      const previousId = scopeChange.component.layers[0].model;
      if (await choose(previousId, "views", { forceEditorClose: true })) {
        dashboardEditor.open(scopeChange.component, {
          draft: !scopeChange.saved,
          baselineSnapshot: scopeChange.baseline,
          savedSnapshot: scopeChange.savedSnapshot,
        });
      }
    }
    $("view-scope-error").textContent = error.message;
  } finally {
    scopeBusy = false;
    controls.forEach((el, index) => (el.disabled = disabled[index]));
    $("view-scope-continue").textContent = scopeChange
      ? "Use this space"
      : "Continue to editor";
  }
};
initHouseActions({
  api,
  selected: () => selected,
  changed: async (result) => {
    models = await api("models");
    const next =
      models.find((m) => m.id === result.viewId) ||
      models.find((m) => m.houseView && !m.houseFloor) ||
      models[0];
    if (next) await choose(next.id, "overview");
    else {
      location.reload();
    }
    toast(
      result.viewId
        ? "House replaced."
        : "House deleted. Home Assistant devices are unchanged.",
    );
  },
});
const dashboardEditor = initDashboardEditor({
  api,
  preview: native?.preview,
  model: () => selected,
  scene: () => view,
  toast,
  onClose: () => {
    if (activeRoomTab === "views") {
      savedViews?.refresh();
      $("create-library-view").focus({ preventScroll: true });
    } else $("nav-views").focus({ preventScroll: true });
  },
  onOpen: () => {
    setRoomTab("views", { keepEditor: true });
    $("view-content-name").textContent = viewScopeLabel(selected, models);
    $("view-content-note").textContent =
      "Choose visible device controls below. Connections follow the rooms configured in My home.";
    viewMode = view.options.mode;
    $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  },
});
$("control-mode").onchange = () => {
  $("preview").checked = $("control-mode").value === "simulation";
  preview = $("preview").checked;
  drawControls();
};
for (const id of ["add-model", "empty-add"])
  $(id).onclick = () => {
    workspace.closeLibrary();
    $("import-error").textContent = "";
    importSummary.reset();
    $("import-progress").hidden = true;
    $("import-dialog").showModal();
  };
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog || (dialog.id === "view-scope-dialog" && scopeBusy))
      return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  });
for (const button of document.querySelectorAll(".close"))
  button.onclick = () => button.closest("dialog").close();
$("import-form").onsubmit = async (e) => {
  e.preventDefault();
  const file = $("package").files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    $("import-error").textContent = "Choose a ZIP smaller than 100 MB.";
    return;
  }
  if (!(await importSummary.ready())) return;
  $("import-form").setAttribute("aria-busy", "true");
  $("import-submit").disabled = true;
  $("import-submit").textContent = "Uploading model…";
  $("import-error").textContent = "";
  const progress = uploadProgress("import");
  try {
    const result = await api("models", {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: file,
      file,
      onProgress: progress.onProgress,
      onUploaded: progress.onUploaded,
    });
    progress.preparing();
    $("import-submit").textContent = "Preparing 3D view…";
    models = await api("models");
    await choose(result.viewId || result.id);
    progress.complete();
    $("import-dialog").close();
    $("import-form").reset();
    toast(
      result.roomCount
        ? `House imported: ${result.roomCount} rooms. Connect their devices, then save a dashboard view.`
        : "Room imported. Connect its devices, then save a dashboard view.",
    );
  } catch (e) {
    progress.failed();
    $("import-error").textContent = e.message;
  } finally {
    $("import-form").setAttribute("aria-busy", "false");
    $("import-submit").disabled = false;
    $("import-submit").textContent = "Import ZIP";
  }
};
const lightDomains = /^(light|switch)\./,
  coverDomains = /^cover\./;
const deviceIcon = (c) =>
  c.type === "climate"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/></svg>'
    : c.type === "button"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 5 10 7-10 7Z"/></svg>'
      : c.type === "number"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h18M5 8v12M19 8v12M9 3h6"/></svg>'
        : c.type === "cover"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 4h16M6 4v10M18 4v10M6 8h12M6 11h12"/><path d="M12 14v5"/><circle cx="12" cy="20" r="1"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/></svg>';
const capabilityText = (c) =>
  c.type === "climate"
    ? "Air conditioner · Home Assistant controls"
    : c.type === "button"
      ? "Preset · press"
      : c.type === "number"
        ? `Height · ${c.min}–${c.max} ${c.unit}`
        : c.type === "cover"
          ? c.motion === "none"
            ? "Desk direction · up, stop, down"
            : "Shade · open, close, position"
          : c.capabilities.includes("brightness")
            ? "Light · dimming, color, white"
            : "Light · on/off";
const pickerContext = (controlId) => {
  const control = selected.controls.find((c) => c.id === controlId);
  return {
    control,
    entities: status.entities,
    selectedId: selected.bindings[controlId] || "",
    pattern:
      control.type === "climate"
        ? /^climate\./
        : control.type === "button"
          ? /^(button|input_button|script|scene)\./
          : control.type === "number"
            ? /^(number|input_number)\./
            : control.type === "cover"
              ? coverDomains
              : lightDomains,
  };
};
const pickerFor = (c) =>
  pickerHTML({ ...pickerContext(c.id), enabled: status.connected });
const mappingRow = (c) =>
  `<div class="mapping" data-mapping="${c.id}"><div class="mapping-head"><span class="mapping-icon">${deviceIcon(c)}</span><div class="mapping-title"><div class="mapping-name">${esc(c.label)}</div><div class="mapping-sub">${esc(c.room ? c.room + " · " : "")}${capabilityText(c)}</div></div><button type="button" class="locate-btn" data-highlight="${c.id}" title="Close this window and highlight the device in the 3D room"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>Show in room</button></div>${pickerFor(c)}</div>`;
function drawMappings(controlId) {
  const device = controlId ? deviceForControl(selected, controlId) : null;
  const members = device
    ? [device.height, device.motion, ...device.macros]
    : null;
  $("settings-eyebrow").textContent = selected.title;
  $("settings-title").textContent = device
    ? device.label
    : controlId
      ? "Connect " + selected.controls.find((c) => c.id === controlId).label
      : "Connect devices";
  $("settings-sub").textContent = device
    ? "Set the height and direction entities, then choose and name up to four macros. Changes save automatically."
    : "Choose the Home Assistant entities. Changes save automatically.";
  $("export-model").hidden = $("delete-model").hidden = !!controlId;
  $("mapping-note").hidden = status.connected;
  $("mapping-note").textContent =
    "Open 3D Rooms from Home Assistant to choose entities.";
  const groups = device ? [device] : controlId ? [] : selected.devices || [];
  const memberIds = new Set(
    groups.flatMap((d) => [d.height, d.motion, ...d.macros]),
  );
  const deviceRows = groups
    .map(
      (d) =>
        `<section class="desk-mapping"><h3>${esc(d.label)}</h3>${[
          d.height,
          d.motion,
          ...d.macros,
        ]
          .map((id, index) => {
            const c = selected.controls.find((c) => c.id === id);
            const name = index >= 2 ? macroName(selected, d, id) : "";
            return `${index >= 2 ? `<label class="macro-name">Macro ${index - 1} name<input data-macro-name="${id}" data-device="${d.id}" maxlength="80" value="${esc(name)}" placeholder="Name your macro" aria-label="Macro ${index - 1} name"></label>` : ""}${mappingRow({ ...c, label: index === 0 ? "Height entity" : index === 1 ? "Up / Stop / Down entity" : name || "Macro " + (index - 1) + " entity" })}`;
          })
          .join("")}</section>`,
    )
    .join("");
  const other = selected.controls
    .filter(
      (c) =>
        c.lightGroupPrimary !== false &&
        !memberIds.has(c.id) &&
        (!controlId || c.id === controlId),
    )
    .map(mappingRow)
    .join("");
  $("mappings").innerHTML = deviceRows + other;
}

let mappingControlId;
function openDeviceSettings(controlId) {
  if (selected?.houseView) return;
  const group = selected?.controls.find((c) => c.id === controlId)?.lightGroup;
  if (group) {
    lightGroups.open(group);
    return;
  }

  mappingControlId = controlId;
  $("mapping-error").textContent = "";
  drawMappings(controlId);
  $("settings-dialog").showModal();
  if (controlId) $("map-" + controlId)?.focus();
}
$("settings").onclick = () => openDeviceSettings();
$("settings-dialog").addEventListener("close", () => {
  if (mappingControlId)
    document
      .querySelector(`[data-device-settings="${mappingControlId}"]`)
      ?.focus({ preventScroll: true });
});
$("mappings").addEventListener("change", async (e) => {
  const input = e.target;
  if (!input.dataset.macroName) return;
  const deviceId = input.dataset.device,
    id = input.dataset.macroName;
  const names = {
    ...selected.deviceSettings?.[deviceId]?.macroNames,
    [id]: input.value,
  };
  try {
    const result = await api(`models/${selected.id}/device-settings`, {
      method: "PUT",
      body: JSON.stringify({ deviceId, macroNames: names }),
    });
    selected.deviceSettings = result.deviceSettings;
    const device = selected.devices.find((d) => d.id === deviceId),
      index = device.macros.indexOf(id);
    const title = $("mappings").querySelector(
      `[data-mapping="${CSS.escape(id)}"] .mapping-name`,
    );
    if (title)
      title.textContent = input.value.trim() || `Macro ${index + 1} entity`;
    drawControls();
    $("mapping-error").textContent = "";
  } catch (error) {
    $("mapping-error").textContent = error.message;
  }
});
$("mappings").addEventListener("click", (e) => {
  const b = e.target.closest("[data-highlight]");
  if (b) {
    view?.highlight(b.dataset.highlight);
    $("settings-dialog").close();
  }
});
async function saveBinding(controlId, entityId) {
  $("mapping-error").textContent = "";
  try {
    const result = await api(`models/${selected.id}/bindings`, {
      method: "PUT",
      body: JSON.stringify({ controlId, entityId }),
    });
    selected.bindings = result.bindings;
    for (const group of selected.lightGroups || [])
      if (group.controls.includes(controlId)) group.entityId = entityId;
    toast(entityId ? "Entity connected." : "Entity disconnected.");
    drawControls();
  } catch (e) {
    $("mapping-error").textContent = e.message;
  }
  const row = $("mappings").querySelector(
    `[data-mapping="${CSS.escape(controlId)}"] .entity-picker`,
  );
  const control = selected.controls.find((c) => c.id === controlId);
  if (row && control) row.outerHTML = pickerFor(control);
}
const entityPicker = initEntityPicker({
  root: $("mappings"),
  context: pickerContext,
  onSelect: saveBinding,
});
$("settings-dialog").addEventListener("cancel", (e) => {
  if (entityPicker.closeOpen()) e.preventDefault();
});
$("delete-model").onclick = () => $("delete-dialog").showModal();
$("confirm-delete").onclick = async () => {
  try {
    await api(`models/${selected.id}`, { method: "DELETE" });
    $("delete-dialog").close();
    $("settings-dialog").close();
    models = await api("models");
    selected = null;
    cameraNavigation.hidden = true;
    view?.clear();
    if (models.length) await choose(models[0].id);
    else {
      drawModels();
      $("empty").hidden = false;
      $("controls-section").hidden = true;
      $("saved-views-section").hidden = true;
      $("room-settings-section").hidden = true;
      document.querySelector(".room-tabs").hidden = true;
      $("room-summary").textContent = "";
      $("daylight-controls").hidden = true;
      $("settings").hidden = true;
      $("home-view").hidden = true;
      $("floor-view").hidden = true;
      $("dashboard").hidden = true;
      $("preview-label").hidden = true;
      $("title").textContent = "Bring your home into view";
      $("scene-status").hidden = true;
    }
    toast("Model removed.");
  } catch (e) {
    toast(e.message);
  }
};
async function refreshDeviceVisibility() {
  const latest = await api("models");
  // Keep active room/editor references and unsaved camera edits intact.
  for (const model of models) {
    const next = latest.find((m) => m.id === model.id);
    if (!next) continue;
    for (const control of model.controls) {
      const updated = next.controls.find((c) => c.id === control.id);
      if (updated?.hidden) control.hidden = true;
      else delete control.hidden;
    }
  }
  view?.refreshVisibility();
  drawControls();
}
function updateStatus(s) {
  status = s;
  $("connection").textContent =
    s.mode === "simulation"
      ? "Simulated Home Assistant · no real devices"
      : s.connected
        ? "Home Assistant connected"
        : s.mode === "preview"
          ? "Local preview · no real devices"
          : "Home Assistant disconnected";
  $("connection").dataset.state = s.connected
    ? "connected"
    : s.mode === "preview" || s.mode === "simulation"
      ? "preview"
      : "offline";
  drawControls();
}
try {
  models = await api("models");
  await refreshAreas({ quiet: true });
  updateStatus(await api("status"));
  preview = status.mode === "preview";
  $("preview").checked = preview;
  drawModels();
  if (models.length)
    await choose(
      models.find(
        (m) => m.id === new URL(location.href).searchParams.get("model"),
      )?.id ||
        models.find((m) => m.houseView && !m.houseFloor)?.id ||
        models[0].id,
      initialRoomTab,
    );
  else setRoomTab(initialRoomTab);
  if (native) {
    const unsubscribe = native.subscribe(updateStatus);
    const unsubscribeModels = await native.subscribeModels?.(() =>
      refreshDeviceVisibility().catch((error) => toast(error.message)),
    );
    window.addEventListener("pagehide", () => unsubscribeModels?.(), {
      once: true,
    });
    window.addEventListener("pagehide", unsubscribe, { once: true });
  } else {
    const events = new EventSource(new URL("api/events", location.href));
    events.onmessage = (e) => updateStatus(JSON.parse(e.data));
    events.onerror = () => updateStatus({ ...status, connected: false });
    window.addEventListener("pagehide", () => events.close(), { once: true });
  }
} catch (e) {
  toast(e.message);
  $("connection").textContent = "Could not connect to server";
}

$("export-model").onclick = async () => {
  try {
    const url = native
      ? await native.exportURL(selected.id)
      : new URL(`api/models/${selected.id}/export.zip`, location.href).href;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.id}.zip`;
    link.click();
    if (native) setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    toast(error.message);
  }
};

const { initComponents } = await import("./components.js");
savedViews = initComponents({
  api,
  preview: native?.preview,
  selectModel: async (id) => {
    const loaded = await choose(id, "views");
    return !!loaded && selected?.id === id && view?.model?.id === id;
  },
  initialViewId: initialSavedViewId,
  getModels: () => models,
  createView: () => requestViewScope(),
  room: () => selected,
  editor: dashboardEditor,
  toast,
});
