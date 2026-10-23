import { coverFeatures, coverState, coverCommand } from "../shared/cover.mjs";
import "./style.css";
import { initDashboardEditor } from "./dashboard-editor.js";
import { connectNative } from "./native.js";
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
  const res = await fetch(new URL("api/" + path, location.href), {
    ...options,
    headers: { "X-Rooms-Request": "1", ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
};
let models = [],
  selected = null,
  status = { connected: false, mode: "preview", entities: [] },
  preview = true,
  view,
  pending = new Set(),
  simulated = new Map(),
  selection = 0;
const fades = new Map();
let viewMode =
  new URL(location.href).searchParams.get("view") === "floor"
    ? "floor"
    : "dollhouse";
const toast = (message) => {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 5000);
};
function state(c) {
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
  `<button class="device-settings" data-device-settings="${c.id}" aria-label="Edit entity for ${esc(c.label)}" title="Change entity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
function drawControls() {
  if (!selected) return;
  const active = document.activeElement;
  const focusKind = [
    "deviceSettings",
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
  $("controls").innerHTML = selected.controls
    .map((c) => {
      if (c.type === "cover") {
        const s = states.get(c.id),
          f = preview
            ? { open: true, close: true, position: true, stop: true }
            : coverFeatures(s.entity);
        const disabled = !preview && s.unavailable ? "disabled" : "";
        const label = esc(c.label);
        return `<article class="light-card shade-card"><div class="device-heading"><div><div class="light-label">${label}</div><p class="light-state">${preview ? `${Math.round(s.position)}% open · preview` : esc(s.label)}</p></div>${deviceSettingsButton(c)}</div>
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
                `<button data-cover="${c.id}" data-action="${action}" aria-label="${action} ${label}" ${disabled}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${action === "stop" ? '<rect x="7" y="7" width="10" height="10" rx="1"/>' : `<path d="${action === "open" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}"/>`}</svg><span>${action[0].toUpperCase() + action.slice(1)}</span></button>`,
            )
            .join("")}</div>
          ${f.position && c.capabilities.includes("position") ? `<div class="shade-position"><label class="shade-position-label" for="shade-position-${c.id}"><span>Opening</span><output>${s.position === undefined ? "Unknown" : Math.round(s.position) + "%"}</output></label><input id="shade-position-${c.id}" style="--shade-fill:${s.position ?? c.defaultPosition ?? 0}%" type="range" min="0" max="100" step="1" value="${s.position ?? c.defaultPosition ?? 0}" data-position="${c.id}" aria-label="${label} opening" aria-valuetext="${s.position === undefined ? "Position unknown" : Math.round(s.position) + " percent open"}" ${disabled}><div class="shade-endpoints"><span>Closed</span><span>Open</span></div></div>` : ""}
          <span class="muted small device-entity">${preview ? "Simulation only" : esc(selected.bindings[c.id] || "Map this shade in Model settings")}</span></article>`;
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
      return `<article class="light-card"><div class="light-heading"><div><div class="light-label">${label}</div><div class="light-state">${waiting ? "Waiting for confirmation…" : preview ? (s.on ? "On · preview" : "Off · preview") : esc(s.label)}</div></div><div class="device-card-actions">${deviceSettingsButton(c)}<button role="switch" aria-label="${label}" aria-checked="${s.on}" class="switch" data-toggle="${id}" ${disabled}>${s.on ? "On" : "Off"}</button></div></div>
    ${c.capabilities.includes("brightness") && f.brightness ? slider("Brightness", "brightness", 1, 255, s.brightness) : ""}
    ${
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
    ${f.transition ? `<label class="light-option">Fade on next change<select data-transition="${id}" aria-label="${label} fade" ${disabled}>${[0, 0.5, 1, 2, 5, 10].map((t) => `<option value="${t}" ${t === (fades.get(id) || 0) ? "selected" : ""}>${t ? t + " seconds" : "Instant"}</option>`).join("")}</select></label>` : ""}
    <span class="muted small device-entity">${preview ? "Simulation only" : esc(selected.bindings[id] || "Map this light in Model settings")}</span></article>`;
    })
    .join("");
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
    simulated.set(id, next);
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
$("controls").addEventListener("click", (e) => {
  const settings = e.target.closest("[data-device-settings]");
  if (settings) {
    openDeviceSettings(settings.dataset.deviceSettings);
    return;
  }
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
$("controls").addEventListener("input", (e) => {
  if (e.target.dataset.position) {
    e.target.closest(".shade-position").querySelector("output").textContent =
      e.target.value + "%";
    e.target.style.setProperty("--shade-fill", e.target.value + "%");
    e.target.setAttribute("aria-valuetext", e.target.value + " percent open");
  }
  if (e.target.dataset.temperature)
    e.target.closest("label").querySelector("output").textContent =
      e.target.value + " K";
});
$("controls").addEventListener("change", (e) => {
  const input = e.target,
    d = input.dataset;
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
  $("model-count").textContent = models.length;
  $("models").innerHTML = models
    .map(
      (m) =>
        `<button data-model="${m.id}" class="${selected?.id === m.id ? "active" : ""}" ${selected?.id === m.id ? 'aria-current="true"' : ""}><span>${esc(m.title)}</span><small>${m.controls.length} ${m.controls.length === 1 ? "device" : "devices"} · ${esc(m.floor || "Room")}</small></button>`,
    )
    .join("");
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
async function choose(id) {
  dashboardEditor.close();
  if (view) {
    for (const key of ["camera", "heading", "tilt", "zoom"])
      delete view.options[key];
    view.options.mode = viewMode;
  }
  const current = ++selection;
  selected = models.find((m) => m.id === id);
  const model = selected;
  const url = new URL(location.href);
  url.searchParams.set("model", id);
  history.replaceState(null, "", url);
  simulated.clear();
  pending.clear();
  drawModels();
  $("empty").hidden = true;
  $("controls").replaceChildren();
  drawDaylight();
  $("title").textContent = selected.title;
  $("model-type").textContent = selected.floor || "YOUR MODEL";
  $("settings").hidden = false;
  $("home-view").hidden = false;
  $("floor-view").hidden = false;
  $("dashboard").hidden = false;
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  $("preview-label").hidden = false;
  $("controls-section").hidden = false;
  $("control-count").textContent = `${selected.controls.length} declared`;
  $("view-hint").textContent =
    "Drag to orbit · Scroll to zoom · Select a device to highlight";
  $("scene-status").hidden = false;
  $("scene-status").textContent = "Loading your model…";
  try {
    const { SceneView } = await import("./scene");
    if (current !== selection) return;
    view ??= new SceneView(
      $("viewport"),
      (id) => {
        view.highlight(id);
        document
          .querySelector(
            `[data-toggle="${id}"], [data-cover="${id}"], [data-position="${id}"]`,
          )
          ?.focus();
      },
      { mode: viewMode },
    );
    $("scene-status").textContent = "Downloading your room…";
    const sceneURL = native
      ? await native.sceneURL(model)
      : new URL(`api/models/${id}/scene.glb`, location.href).href;
    if (current !== selection) {
      if (native) URL.revokeObjectURL(sceneURL);
      return;
    }
    $("scene-status").textContent = "Preparing the 3D view…";
    await new Promise(requestAnimationFrame);
    let loaded;
    try {
      if (current !== selection) return;
      loaded = await view.load(model, sceneURL);
    } finally {
      if (native) URL.revokeObjectURL(sceneURL);
    }
    if (!loaded || current !== selection) return;
    $("scene-status").hidden = true;
    drawControls();
  } catch (e) {
    if (current !== selection) return;
    $("scene-status").textContent =
      "Could not display this model: " + e.message;
    toast("The model could not be displayed.");
  }
}
$("models").addEventListener("click", (e) => {
  const b = e.target.closest("[data-model]");
  if (b) {
    $("show-models").click();
    choose(b.dataset.model);
  }
});
$("home-view").onclick = () => view?.setCameraPreset("reset");
$("floor-view").onclick = () => {
  viewMode = viewMode === "floor" ? "dollhouse" : "floor";
  view?.setView(viewMode);
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  const url = new URL(location.href);
  if (viewMode === "floor") url.searchParams.set("view", "floor");
  else url.searchParams.delete("view");
  history.replaceState(null, "", url);
};
const dashboardEditor = initDashboardEditor({
  api,
  model: () => selected,
  scene: () => view,
  toast,
});
$("preview").onchange = () => {
  preview = $("preview").checked;
  drawControls();
};
for (const id of ["add-model", "empty-add"])
  $(id).onclick = () => {
    $("import-error").textContent = "";
    $("import-dialog").showModal();
  };
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
  $("import-submit").disabled = true;
  $("import-submit").textContent = "Importing…";
  $("import-error").textContent = "";
  try {
    const result = await api("models", {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: file,
    });
    models = await api("models");
    $("import-dialog").close();
    $("import-form").reset();
    await choose(result.id);
    toast("Model imported. Its devices are ready to connect.");
  } catch (e) {
    $("import-error").textContent = e.message;
  } finally {
    $("import-submit").disabled = false;
    $("import-submit").textContent = "Import model";
  }
};
function drawMappings(controlId) {
  $("settings-title").textContent = controlId
    ? selected.controls.find((c) => c.id === controlId).label + " · Entity"
    : selected.title + " · Devices";
  $("export-model").hidden = $("delete-model").hidden = !!controlId;
  $("mapping-note").textContent = status.connected
    ? "Choose an entity for each light or shade. Preview mode never sends real commands."
    : "Home Assistant is not connected. You can preview the model now; entity mapping becomes available inside the installed add-on.";
  $("mappings").innerHTML = selected.controls
    .filter((c) => !controlId || c.id === controlId)
    .map(
      (c) =>
        `<div class="mapping"><div class="mapping-head"><label for="map-${c.id}">${esc(c.label)}</label><button data-highlight="${c.id}">Highlight</button></div><input type="search" aria-label="Find entity for ${esc(c.label)}" placeholder="${c.type === "cover" ? "Find a cover…" : "Find a light or switch…"}" data-filter="${c.id}" ${status.connected ? "" : "disabled"}><select id="map-${c.id}" data-map="${c.id}" ${status.connected ? "" : "disabled"}>${options(c, "")}</select><p class="muted">${esc(c.room || "This model")} · ${c.type === "cover" ? "Opening height, open/close and stop when supported" : c.capabilities.includes("brightness") ? "On/off, brightness, color and white temperature when supported" : "On/off"}</p></div>`,
    )
    .join("");
}
function options(c, filter) {
  const saved = selected.bindings[c.id],
    entities = status.entities
      .filter((e) =>
        (c.type === "cover" ? /^cover\./ : /^(light|switch)\./).test(
          e.entity_id,
        ),
      )
      .filter(
        (e) =>
          `${e.attributes?.friendly_name} ${e.entity_id}`
            .toLowerCase()
            .includes(filter.toLowerCase()) || e.entity_id === saved,
      );
  return (
    `<option value="">Not connected</option>` +
    (saved && !entities.some((e) => e.entity_id === saved)
      ? `<option selected value="${esc(saved)}">${esc(saved)} (missing)</option>`
      : "") +
    entities
      .map(
        (e) =>
          `<option value="${esc(e.entity_id)}" ${saved === e.entity_id ? "selected" : ""}>${esc(e.attributes?.friendly_name || e.entity_id)} — ${esc(e.entity_id)}</option>`,
      )
      .join("")
  );
}
let mappingControlId;
function openDeviceSettings(controlId) {
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
$("mappings").addEventListener("click", (e) => {
  const b = e.target.closest("[data-highlight]");
  if (b) {
    view?.highlight(b.dataset.highlight);
    $("settings-dialog").close();
  }
});
$("mappings").addEventListener("input", (e) => {
  if (e.target.dataset.filter) {
    const c = selected.controls.find((c) => c.id === e.target.dataset.filter);
    $("map-" + c.id).innerHTML = options(c, e.target.value);
  }
});
$("mappings").addEventListener("change", async (e) => {
  if (!e.target.dataset.map) return;
  const el = e.target;
  el.disabled = true;
  $("mapping-error").textContent = "";
  try {
    const result = await api(`models/${selected.id}/bindings`, {
      method: "PUT",
      body: JSON.stringify({ controlId: el.dataset.map, entityId: el.value }),
    });
    selected.bindings = result.bindings;
    toast("Entity mapping saved.");
    drawControls();
  } catch (e) {
    $("mapping-error").textContent = e.message;
    el.value = selected.bindings[el.dataset.map] || "";
  } finally {
    el.disabled = false;
  }
});
$("delete-model").onclick = () => $("delete-dialog").showModal();
$("confirm-delete").onclick = async () => {
  try {
    await api(`models/${selected.id}`, { method: "DELETE" });
    $("delete-dialog").close();
    $("settings-dialog").close();
    models = await api("models");
    selected = null;
    view?.clear();
    if (models.length) await choose(models[0].id);
    else {
      drawModels();
      $("empty").hidden = false;
      $("controls-section").hidden = true;
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
function updateStatus(s) {
  status = s;
  $("connection").textContent =
    s.mode === "simulation"
      ? "Simulated Home Assistant · no real devices"
      : s.connected
        ? "Connected to Home Assistant"
        : s.mode === "preview"
          ? "Local preview · no real devices"
          : "Home Assistant disconnected";
  drawControls();
}
try {
  models = await api("models");
  updateStatus(await api("status"));
  preview = status.mode === "preview";
  $("preview").checked = preview;
  drawModels();
  if (models.length)
    await choose(
      models.find(
        (m) => m.id === new URL(location.href).searchParams.get("model"),
      )?.id || models[0].id,
    );
  if (native) {
    const unsubscribe = native.subscribe(updateStatus);
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
initComponents({ api, models: () => models, native, toast });
