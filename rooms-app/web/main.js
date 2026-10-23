import "./style.css";
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
function drawControls() {
  if (!selected) return;
  const active = document.activeElement;
  const focusKind = [
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
  const focusExtra = active?.dataset?.hex
    ? `[data-hex="${active.dataset.hex}"]`
    : active?.dataset?.kelvin
      ? `[data-kelvin="${active.dataset.kelvin}"]`
      : "";
  const states = new Map(selected.controls.map((c) => [c.id, state(c)]));
  if (view?.model?.id === selected.id) view.setStates(states);
  $("controls").innerHTML = selected.controls
    .map((c) => {
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
      return `<article class="light-card"><div class="light-heading"><div><div class="light-label">${label}</div><div class="light-state">${waiting ? "Waiting for confirmation…" : preview ? (s.on ? "On · preview" : "Off · preview") : esc(s.label)}</div></div><button role="switch" aria-label="${label}" aria-checked="${s.on}" class="switch" data-toggle="${id}" ${disabled}>${s.on ? "On" : "Off"}</button></div>
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
    <span class="muted small">${preview ? "Simulation only" : esc(selected.bindings[id] || "Map this light in Model settings")}</span></article>`;
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
$("controls").addEventListener("click", (e) => {
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
  if (e.target.dataset.temperature)
    e.target.closest("label").querySelector("output").textContent =
      e.target.value + " K";
});
$("controls").addEventListener("change", (e) => {
  const input = e.target,
    d = input.dataset;
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
        `<button data-model="${m.id}" class="${selected?.id === m.id ? "active" : ""}" ${selected?.id === m.id ? 'aria-current="true"' : ""}><span>${esc(m.title)}</span><small>${m.controls.length} ${m.controls.length === 1 ? "light" : "lights"} · ${esc(m.floor || "Room")}</small></button>`,
    )
    .join("");
}
async function choose(id) {
  const current = ++selection;
  selected = models.find((m) => m.id === id);
  const url = new URL(location.href);
  url.searchParams.set("model", id);
  history.replaceState(null, "", url);
  simulated.clear();
  pending.clear();
  drawModels();
  $("empty").hidden = true;
  $("controls").replaceChildren();
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
    "Drag to orbit · Scroll to zoom · Select a light to highlight";
  $("scene-status").hidden = false;
  $("scene-status").textContent = "Loading your model…";
  try {
    const { SceneView } = await import("./scene");
    view ??= new SceneView(
      $("viewport"),
      (id) => {
        view.highlight(id);
        document.querySelector(`[data-toggle="${id}"]`)?.focus();
      },
      { mode: viewMode },
    );
    const loaded = await view.load(
      selected,
      new URL(`api/models/${id}/scene.glb`, location.href).href,
    );
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
  if (b) choose(b.dataset.model);
});
$("home-view").onclick = () => view?.reset();
$("floor-view").onclick = () => {
  viewMode = viewMode === "floor" ? "dollhouse" : "floor";
  view?.setView(viewMode);
  $("floor-view").setAttribute("aria-pressed", String(viewMode === "floor"));
  const url = new URL(location.href);
  if (viewMode === "floor") url.searchParams.set("view", "floor");
  else url.searchParams.delete("view");
  history.replaceState(null, "", url);
};
$("dashboard").onclick = () => {
  $("dashboard-yaml").value =
    `type: custom:three-d-rooms-card\nmodel: ${selected.id}\nheight: 500\ntilt: 8\nheading: 0`;
  $("dashboard-dialog").showModal();
};
$("copy-dashboard").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("dashboard-yaml").value);
    toast("Dashboard configuration copied.");
  } catch {
    $("dashboard-yaml").select();
    toast("Select and copy the configuration above.");
  }
};
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
    toast("Model imported. Its lights are ready to connect.");
  } catch (e) {
    $("import-error").textContent = e.message;
  } finally {
    $("import-submit").disabled = false;
    $("import-submit").textContent = "Import model";
  }
};
function drawMappings() {
  $("settings-title").textContent = selected.title + " · Devices";
  $("mapping-note").textContent = status.connected
    ? "Choose an entity for each light. Preview mode never sends real commands."
    : "Home Assistant is not connected. You can preview the model now; entity mapping becomes available inside the installed add-on.";
  $("mappings").innerHTML = selected.controls
    .map(
      (c) =>
        `<div class="mapping"><div class="mapping-head"><label for="map-${c.id}">${esc(c.label)}</label><button data-highlight="${c.id}">Highlight</button></div><input type="search" aria-label="Find entity for ${esc(c.label)}" placeholder="Find a light or switch…" data-filter="${c.id}" ${status.connected ? "" : "disabled"}><select id="map-${c.id}" data-map="${c.id}" ${status.connected ? "" : "disabled"}>${options(c, "")}</select><p class="muted">${esc(c.room || "This model")} · ${c.capabilities.includes("brightness") ? "On/off, brightness, color and white temperature when supported" : "On/off"}</p></div>`,
    )
    .join("");
}
function options(c, filter) {
  const saved = selected.bindings[c.id],
    entities = status.entities.filter(
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
$("settings").onclick = () => {
  $("mapping-error").textContent = "";
  drawMappings();
  $("settings-dialog").showModal();
};
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
  const events = new EventSource(new URL("api/events", location.href));
  events.onmessage = (e) => updateStatus(JSON.parse(e.data));
  events.onerror = () => updateStatus({ ...status, connected: false });
} catch (e) {
  toast(e.message);
  $("connection").textContent = "Could not connect to server";
}
