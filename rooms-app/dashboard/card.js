import { resolveSavedView } from "../shared/saved-view.mjs";
import { deviceForControl, macroName } from "../shared/device.mjs";
import { coverFeatures } from "../shared/cover.mjs";
import { actionState } from "../shared/action.mjs";
import { numberState } from "../shared/number.mjs";
import { markerAppearance } from "../shared/marker.mjs";
import { coverState } from "../shared/cover.mjs";
import { validateCameraSnapshot } from "../shared/camera-view.mjs";
import "./panel.js";
import "./editor.js";
import { SceneView } from "../web/scene.js";
import { entityAppearance, hexToRgb, kelvinToRgb } from "../shared/light.mjs";
import { connectModel } from "./transport.mjs";
export class ThreeDRoomsCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("three-d-rooms-editor");
  }
  static getStubConfig() {
    return { height: 500, view: "front", tilt: 28 };
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{display:block;position:relative;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#101715));border-radius:var(--ha-card-border-radius,12px)}header{padding:16px 20px 0;font:500 18px system-ui;color:var(--primary-text-color,#edf2eb)}.scene{position:relative;width:100%;height:500px}.scene canvas{display:block;width:100%;height:100%}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px;color:var(--primary-text-color,#edf2eb);font:14px/1.5 system-ui;background:var(--card-background-color,#101715)}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--divider-color,#536258);border-radius:8px;background:transparent;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color,#aacaab)}.fixture-access{position:absolute;inset:0;pointer-events:none}.fixture-access button{position:absolute;box-sizing:border-box;width:32px;height:32px;min-height:32px;padding:6px;border-radius:50%;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);pointer-events:auto;touch-action:none;box-shadow:0 2px 8px #0006}.fixture-access button::before{content:"";position:absolute;inset:-6px;border-radius:50%}.fixture-access button[aria-pressed="true"]{color:#ffd66b;border-color:#ffd66b}.fixture-access button[aria-disabled="true"]{opacity:.55}.fixture-access button svg{width:18px;height:18px;fill:currentColor}.fixture-feedback{position:absolute;bottom:12px;left:12px;right:12px;color:var(--primary-text-color,#edf2eb);background:var(--card-background-color,#202923);padding:8px;border-radius:8px;pointer-events:none}.fixture-access ha-state-icon{display:block;width:18px;height:18px;--mdc-icon-size:18px;color:inherit}.fixture-access button[data-active="true"]{color:var(--primary-text-color,#edf2eb);border-color:var(--state-active-color,#ffd66b);background:color-mix(in srgb,var(--state-active-color,#ffd66b) 18%,var(--card-background-color,#202923))}.fixture-access button[data-unavailable="true"]{opacity:.65;color:var(--disabled-text-color,#9aa29e);border-style:dashed}.fixture-state{position:absolute;top:26px;left:50%;transform:translateX(-50%);padding:1px 4px;min-width:20px;white-space:nowrap;border:1px solid var(--divider-color,#536258);border-radius:6px;background:var(--card-background-color,#202923);color:var(--primary-text-color,#edf2eb);font:600 10px/14px system-ui;pointer-events:none}.fixture-access button[data-moving="true"] .fixture-state{color:var(--primary-color,#aacaab)}dialog{box-sizing:border-box;width:min(360px,calc(100vw - 32px));border:1px solid #536258;border-radius:16px;padding:24px;background:#202923;color:#edf2eb;font:14px system-ui}dialog::backdrop{background:#0008}dialog h2{font-size:20px;margin:0 0 8px}dialog p{color:#aebbb2;line-height:1.5}dialog label{display:grid;gap:8px;margin:18px 0}dialog input{width:100%;min-height:32px;box-sizing:border-box}dialog .close{margin-top:12px}.daylight-switch{position:absolute;top:12px;right:12px;z-index:1;box-sizing:border-box;min-height:36px;max-width:calc(100% - 24px);padding:4px 28px 4px 12px;font:500 13px system-ui;color:var(--primary-text-color,#edf2eb);background-color:var(--card-background-color,#202923);border:1px solid var(--divider-color,#536258);border-radius:18px;box-shadow:0 2px 8px #0006;cursor:pointer}.daylight-switch:focus-visible{outline:2px solid var(--primary-color,#aacaab)}[hidden]{display:none!important}</style><ha-card><header hidden></header><select class="daylight-switch" aria-label="Time of day" title="Time of day" hidden><option value="auto">Auto</option><option value="day">Day</option><option value="night">Night</option></select><div class="scene"><div class="message" role="status"><span>Connecting to 3D Rooms…</span><button hidden>Retry</button></div></div></ha-card>`;
    this._container = this.shadowRoot.querySelector(".scene");
    this._message = this.shadowRoot.querySelector(".message");
    this._daylightSwitch = this.shadowRoot.querySelector(".daylight-switch");
    this._daylightSwitch.onchange = () =>
      this._setDaylight(this._daylightSwitch.value);
    this.shadowRoot.querySelector("button").onclick = () => this._load();
    this._generation = 0;
  }
  setConfig(config) {
    if (
      config.saved_view !== undefined &&
      (typeof config.saved_view !== "string" ||
        !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(config.saved_view))
    )
      throw new Error("Choose a valid saved view ID.");
    this._sourceConfig = { ...config };
    if (
      config.model !== undefined &&
      (typeof config.model !== "string" ||
        !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(config.model))
    )
      throw new Error("Choose a model ID, for example kitchen.");
    if (
      config.height !== undefined &&
      (!Number.isFinite(config.height) ||
        config.height < 180 ||
        config.height > 1600)
    )
      throw new Error("Card height must be between 180 and 1600 pixels.");
    if (
      config.zoom !== undefined &&
      (!Number.isFinite(config.zoom) || config.zoom < 0.01 || config.zoom > 100)
    )
      throw new Error("Zoom must be between 0.01 and 100.");
    for (const key of ["tilt", "heading"])
      if (config[key] !== undefined && !Number.isFinite(config[key]))
        throw new Error(`${key} must be a number.`);
    if (config.tilt !== undefined && (config.tilt < 0 || config.tilt > 180))
      throw new Error("Tilt must be between 0 and 180 degrees.");
    if (config.view !== undefined && !["front", "floor"].includes(config.view))
      throw new Error("Choose front or floor view.");
    const camera =
      config.camera === undefined
        ? undefined
        : validateCameraSnapshot(config.camera);
    if (
      camera &&
      ((config.view || "front") === "floor") !==
        (camera.projection === "orthographic")
    )
      throw new Error("Saved camera projection must match the selected view.");
    this._config = {
      height: 500,
      view: "front",
      tilt: camera?.tilt ?? (config.view === "floor" ? 8 : 28),
      heading: camera?.heading ?? 0,
      zoom: camera?.referenceZoom ?? 1,
      interactive: false,
      ...config,
      camera,
    };
    this._container.style.height = this._config.height + "px";
    const title = this.shadowRoot.querySelector("header");
    title.textContent = config.title || "";
    title.hidden = !config.title || config.show_title === false;
    this._reload = true;
    if (this._hass && this.isConnected) this._load();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config || !this.isConnected) return;
    if (this._reload || !this._view) {
      if (!this._loading) this._load();
    } else this._states();
  }
  getCardSize() {
    return Math.ceil((this._config?.height || 500) / 50);
  }
  getGridOptions() {
    return {
      columns: 12,
      rows: Math.ceil((this._config?.height || 500) / 56),
      min_columns: 6,
      min_rows: 4,
    };
  }
  connectedCallback() {
    if (this._hass && this._config) this._load();
  }
  disconnectedCallback() {
    ++this._generation;
    clearInterval(this._keepalive);
    this._unsubModels?.();
    this._unsubModels = null;
    this._dialog?.remove();
    this._view?.dispose();
    this._view = null;
    this._loading = false;
  }
  async _load() {
    if (!this._config || !this._hass) return;
    const generation = ++this._generation;
    this._loading = true;
    this._reload = false;
    clearInterval(this._keepalive);
    this._unsubModels?.();
    this._unsubModels = null;
    this._message.hidden = false;
    this._message.querySelector("span").textContent = "Downloading your room…";
    this._message.querySelector("button").hidden = true;
    try {
      if (this._sourceConfig?.saved_view) {
        const components = await this._hass.callWS({
          type: "three_d_rooms/request",
          operation: "components",
        });
        if (generation !== this._generation) return;
        this._config = resolveSavedView(this._sourceConfig, components);
        this._container.style.height = this._config.height + "px";
        const title = this.shadowRoot.querySelector("header");
        title.textContent = this._config.title || "";
        title.hidden = !this._config.title || this._config.show_title === false;
      }
      if (!this._config.model) {
        this._message.querySelector("span").textContent =
          "Choose a room in the visual editor.";
        return;
      }
      const connection = await connectModel(
        this._hass,
        this._config,
        location.origin,
      );
      if (generation !== this._generation) return;
      if (connection.session)
        document.cookie = `ingress_session=${connection.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === "https:" ? ";Secure" : ""}`;
      const { model, sceneURL, release } = await connection.load();
      if (generation !== this._generation) {
        release?.();
        return;
      }
      this._message.querySelector("span").textContent =
        "Preparing the 3D view…";
      await new Promise(requestAnimationFrame);
      if (generation !== this._generation) {
        release?.();
        return;
      }
      this._view?.dispose();
      this._view = new SceneView(this._container, (id) => this._pick(id), {
        mode: this._config.view,
        markers: false,
        interactive: this._config.interactive,
        tilt: this._config.tilt,
        heading: this._config.heading,
        zoom: this._config.zoom ?? 1,
        camera: this._config.camera,
        onRender: () => this._positionButtons(),
      });
      const view = this._view;
      try {
        await view.load(model, sceneURL);
      } finally {
        release?.();
      }
      if (generation !== this._generation) return;
      this._model = model;
      this._previewStates = new Map();
      this._buildAccess();
      this._preview = connection.preview;
      this._signature = null;
      this._states();
      this._syncDaylightSwitch();
      this._message.hidden = true;
      if (
        !this._preview &&
        !this._config.addon &&
        this._hass.connection?.subscribeEvents
      ) {
        const unsubscribe = await this._hass.connection.subscribeEvents(
          () => this._modelsChanged(),
          "three_d_rooms_updated",
        );
        if (generation !== this._generation) {
          unsubscribe();
          return;
        }
        this._unsubModels = unsubscribe;
      }
      if (connection.session)
        this._keepalive = setInterval(async () => {
          if (document.hidden || !this.isConnected) return;
          try {
            await this._hass.callWS({
              type: "supervisor/api",
              endpoint: "/ingress/validate_session",
              method: "post",
              data: { session: connection.session },
            });
          } catch {
            this._load();
          }
        }, 60000);
    } catch (error) {
      if (generation !== this._generation) return;
      this._message.querySelector("span").textContent =
        error.message || "Could not display this model.";
      this._message.querySelector("button").hidden = false;
      this._message.hidden = false;
    } finally {
      if (generation === this._generation) this._loading = false;
    }
  }
  _syncDaylightSwitch() {
    const daylight = this._model?.daylight;
    this._daylightSwitch.hidden = !daylight || !!this._preview;
    if (daylight) this._daylightSwitch.value = daylight.mode;
  }
  /** Daylight is saved with the room; a failed save restores the old mode. */
  async _setDaylight(mode) {
    const daylight = this._model?.daylight;
    if (!daylight || this._preview) return;
    const previous = daylight.mode;
    const apply = (value) => {
      daylight.mode = value;
      this._daylightSwitch.value = value;
      this._signature = null;
      this._states();
    };
    apply(mode);
    try {
      const result = await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "daylight",
        data: { model: this._model.id, mode, entity: daylight.entity },
      });
      daylight.mode = result.daylight.mode;
    } catch (error) {
      apply(previous);
      this.shadowRoot.querySelector(".fixture-feedback")?.remove();
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent =
        error.message || "Could not save the time of day for this room.";
      this._container.append(message);
      setTimeout(() => message.remove(), 5000);
    }
  }
  /** Reload only when the room itself changed, not for a daylight-only edit. */
  async _modelsChanged() {
    const generation = this._generation;
    try {
      if (this._sourceConfig?.saved_view) {
        const components = await this._hass.callWS({
          type: "three_d_rooms/request",
          operation: "components",
        });
        if (generation !== this._generation) return;
        const resolved = resolveSavedView(this._sourceConfig, components);
        if (JSON.stringify(resolved) !== JSON.stringify(this._config)) {
          this._load();
          return;
        }
      }
      const models = await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "models",
      });
      const next = models.find((m) => m.id === this._config?.model);
      const rest = ({ daylight, ...model }) => JSON.stringify(model);
      if (
        generation === this._generation &&
        next &&
        this._model &&
        rest(next) === rest(this._model) &&
        !!next.daylight === !!this._model.daylight
      ) {
        if (next.daylight) this._model.daylight = next.daylight;
        this._syncDaylightSwitch();
        this._signature = null;
        this._states();
        return;
      }
    } catch {}
    if (generation === this._generation) this._load();
  }
  _buildAccess() {
    this.shadowRoot.querySelector(".fixture-access")?.remove();
    const access = document.createElement("div");
    access.className = "fixture-access";
    for (const control of this._model.controls) {
      const device = deviceForControl(this._model, control.id);
      if (device && device.height !== control.id) continue;
      const button = document.createElement("button");
      const label = device?.label || control.label || control.name || "light";
      button.dataset.control = control.id;
      button.setAttribute(
        "aria-label",
        control.type !== "light"
          ? `Control ${label}`
          : `Toggle ${label}. Hold for more info.`,
      );
      button.title =
        control.type !== "light"
          ? `${label}: value controls`
          : `${label}: click to toggle, hold for more info`;
      // Home Assistant resolves custom icons, device classes and state-specific icons.
      // Light-DOM SVG is a fallback for standalone previews without HA elements.
      const icon = document.createElement("ha-state-icon");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        control.type === "button"
          ? '<svg viewBox="0 0 24 24"><path d="m8 4 12 8-12 8Z"/></svg>'
          : control.type === "number"
            ? '<svg viewBox="0 0 24 24"><path d="M3 7h18v3H3zm2 3h2v11H5zm12 0h2v11h-2z"/></svg>'
            : control.type !== "light"
              ? '<svg viewBox="0 0 24 24"><path d="M3 3h18v2H3zm1 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm7 4h2v3h-2z"/></svg>'
              : '<svg viewBox="0 0 24 24"><path d="M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6a5 5 0 1 1 5.7 0Z"/></svg>';
      const badge = document.createElement("span");
      badge.className = "fixture-state";
      badge.setAttribute("aria-hidden", "true");
      button.append(icon, badge);
      let timer,
        origin,
        held = false;
      const cancel = () => {
        clearTimeout(timer);
        origin = null;
      };
      button.onpointerdown = (event) => {
        if (event.button !== 0) return;
        held = false;
        origin = [event.clientX, event.clientY];
        button.setPointerCapture(event.pointerId);
        timer = setTimeout(() => {
          held = true;
          this._pick(control.id);
        }, 500);
      };
      button.onpointermove = (event) => {
        if (
          origin &&
          Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 8
        ) {
          held = true;
          cancel();
        }
      };
      button.onpointerup = cancel;
      button.onpointercancel = () => {
        held = true;
        cancel();
      };
      button.onlostpointercapture = cancel;
      button.oncontextmenu = (event) => event.preventDefault();
      button.onclick = () => {
        if (!held) this._toggle(control.id);
        held = false;
      };
      button.onkeydown = (event) => {
        if (event.key === "F2" || (event.shiftKey && event.key === "Enter")) {
          event.preventDefault();
          this._pick(control.id);
        }
      };
      access.append(button);
    }
    this._container.append(access);
    this._positionButtons();
  }
  _positionButtons() {
    for (const button of this.shadowRoot.querySelectorAll("[data-control]")) {
      const point = this._view?.fixtureScreenPosition(button.dataset.control);
      button.hidden = !point?.visible;
      if (point) {
        button.style.left = `${Math.max(0, Math.min(this._container.clientWidth - 32, point.x + 24))}px`;
        button.style.top = `${Math.max(0, Math.min(this._container.clientHeight - 48, point.y - 16))}px`;
      }
    }
  }
  async _toggle(id) {
    const control = this._model.controls.find((c) => c.id === id);
    if (!control) return;
    if (control.type === "button") {
      await this._pressPreset(control);
      return;
    }
    if (control.type === "cover" || control.type === "number") {
      this._pick(id);
      return;
    }
    if (this._preview) {
      const state = this._previewStates.get(id) || {
        on: true,
        brightness: 255,
        rgb: hexToRgb(control.color || "#fff0d4"),
      };
      this._previewStates.set(id, { ...state, on: !state.on });
      this._states();
      return;
    }
    const entityId = this._model.bindings[id];
    const entity = this._hass.states?.[entityId];
    if (!entity || ["unavailable", "unknown"].includes(entity.state)) return;
    this._pendingToggles ||= new Set();
    if (this._pendingToggles.has(id)) return;
    this._pendingToggles.add(id);
    const button = [...this.shadowRoot.querySelectorAll("[data-control]")].find(
      (b) => b.dataset.control === id,
    );
    button?.setAttribute("aria-busy", "true");
    this.shadowRoot.querySelector(".fixture-feedback")?.remove();
    try {
      await this._hass.callService("light", "toggle", { entity_id: entityId });
    } catch {
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent = "Could not change the light. Try again.";
      this._container.append(message);
    } finally {
      this._pendingToggles.delete(id);
      button?.removeAttribute("aria-busy");
    }
  }
  async _pressPreset(control) {
    if (this._preview || !this._model.bindings[control.id]) {
      this._pick(control.id);
      return;
    }
    const entity = this._hass.states?.[this._model.bindings[control.id]];
    if (actionState(entity).unavailable) return;
    this._pendingPresets ||= new Set();
    if (this._pendingPresets.has(control.id)) return;
    this._pendingPresets.add(control.id);
    try {
      await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "command",
        data: { model: this._model.id, controlId: control.id, action: "press" },
      });
    } catch {
      const message = document.createElement("div");
      message.className = "fixture-feedback";
      message.setAttribute("role", "alert");
      message.textContent = "Could not run the preset. Try again.";
      this._container.append(message);
    } finally {
      this._pendingPresets.delete(control.id);
    }
  }
  _pick(id) {
    const control = this._model.controls.find((c) => c.id === id);
    if (!control) return;
    const desk = deviceForControl(this._model, id);
    if (desk) {
      this._deskDialog(desk);
      return;
    }
    const entityId = this._model.bindings[id];
    if (!this._preview && entityId) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (control.type === "button") {
      this._dialog?.remove();
      const dialog = document.createElement("dialog");
      this._dialog = dialog;
      dialog.innerHTML =
        '<form method="dialog"><h2></h2><p>Connect this preset to its button, script or scene in 3D Rooms → Devices.</p><button>Close</button></form>';
      dialog.querySelector("h2").textContent = control.label;
      this.shadowRoot.append(dialog);
      dialog.showModal();
      return;
    }
    if (control.type === "number") {
      this._numberPreview(control);
      return;
    }
    if (control.type === "cover") {
      this._coverPreview(control);
      return;
    }
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML = `<form method="dialog"><h2></h2><p></p><div class="preview-controls"><button type="button" role="switch">On</button><label>Brightness<input type="range" min="1" max="255"></label><label>Color<input type="color"></label><label>Temperature<input type="range" min="2000" max="6500" step="100"></label></div><button class="close">Close</button></form>`;
    dialog.querySelector("h2").textContent =
      control.label || control.name || "Room light";
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this light to an entity in 3D Rooms → Model settings.";
    dialog.querySelector(".preview-controls").hidden = !this._preview;
    const state = {
      ...(this._previewStates.get(id) || {
        on: true,
        brightness: 255,
        rgb: hexToRgb(control.color || "#fff0d4"),
      }),
    };
    const toggle = dialog.querySelector('[role="switch"]');
    const brightness = dialog.querySelector('[type="range"]');
    const color = dialog.querySelector('[type="color"]');
    const temperature = dialog.querySelectorAll('[type="range"]')[1];
    const update = () => {
      toggle.textContent = state.on ? "On" : "Off";
      toggle.setAttribute("aria-checked", String(state.on));
      toggle.setAttribute("aria-label", "Light power");
      this._previewStates.set(id, { ...state });
      this._states();
    };
    brightness.value = state.brightness;
    color.value =
      "#" +
      state.rgb
        .map((v) => Math.round(v).toString(16).padStart(2, "0"))
        .join("");
    temperature.value = state.colorTempKelvin || 3000;
    toggle.onclick = () => {
      state.on = !state.on;
      update();
    };
    brightness.oninput = () => {
      state.brightness = Number(brightness.value);
      update();
    };
    color.oninput = () => {
      state.rgb = hexToRgb(color.value);
      update();
    };
    temperature.oninput = () => {
      state.colorTempKelvin = Number(temperature.value);
      state.rgb = kelvinToRgb(state.colorTempKelvin);
      color.value =
        "#" + state.rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
      update();
    };
    if (this._preview) update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _deskDialog(device) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.dataset.desk = device.id;
    dialog.innerHTML =
      '<style>.desk-main{display:grid;gap:16px;margin:20px 0}.desk-directions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.desk-macros{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.desk-macros button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px}.desk-macros ha-state-icon{--mdc-icon-size:24px;width:24px;height:24px}</style><form method="dialog"><h2></h2><div class="desk-main"><label>Height <output></output><input data-desk-height type="range" aria-label="Desk height"></label><div class="desk-directions"><button type="button" data-action="open">↑ Up</button><button type="button" data-action="stop">■ Stop</button><button type="button" data-action="close">↓ Down</button></div></div><div class="desk-macros"></div><p>Set entities and macro names in 3D Rooms → Devices → Desk settings.</p><p data-desk-error role="alert"></p><button>Close</button></form>';
    dialog.querySelector("h2").textContent = device.label;
    for (const [index, id] of device.macros.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.macro = id;
      button.setAttribute("aria-label", "Macro " + (index + 1));
      const icon = document.createElement("ha-state-icon"),
        label = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      button.append(icon, label);
      dialog.querySelector(".desk-macros").append(button);
      button.onclick = () => this._deskCommand(id, "press");
    }
    for (const button of dialog.querySelectorAll("[data-action]"))
      button.onclick = () =>
        this._deskCommand(device.motion, button.dataset.action);
    const input = dialog.querySelector("[data-desk-height]");
    input.oninput = () => {
      dialog.querySelector("output").textContent = input.value + " cm";
    };
    input.onchange = () =>
      this._deskCommand(device.height, "set_value", Number(input.value));
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    this._updateDeskDialog();
    dialog.showModal();
  }
  async _deskCommand(id, action, value) {
    const control = this._model.controls.find((c) => c.id === id);
    if (this._preview) {
      if (control.type === "number") this._previewStates.set(id, { value });
      this._states();
      return;
    }
    const buttons =
      this._dialog?.querySelectorAll('button[type="button"]') || [];
    buttons.forEach((b) => (b.disabled = true));
    try {
      await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "command",
        data: {
          model: this._model.id,
          controlId: id,
          action,
          ...(value === undefined ? {} : { value }),
        },
      });
    } catch (error) {
      const host = this._dialog?.querySelector("[data-desk-error]");
      if (host)
        host.textContent =
          error.message || "Could not change the desk. Try again.";
    } finally {
      this._updateDeskDialog();
    }
  }
  _updateDeskDialog() {
    const dialog = this._dialog;
    if (!dialog?.dataset?.desk) return;
    const device = this._model.devices?.find(
      (d) => d.id === dialog.dataset.desk,
    );
    if (!device) return;
    const height = this._model.controls.find((c) => c.id === device.height),
      entity = this._hass.states?.[this._model.bindings[height.id]],
      reported = this._preview
        ? this._previewStates.get(height.id) || { value: height.defaultValue }
        : numberState(entity, height);
    const input = dialog.querySelector("[data-desk-height]");
    Object.assign(input, {
      min: Math.max(height.min, entity?.attributes?.min ?? height.min),
      max: Math.min(height.max, entity?.attributes?.max ?? height.max),
      step: Math.max(height.step, entity?.attributes?.step || height.step),
      disabled: !!reported.unavailable,
    });
    if (this.shadowRoot.activeElement !== input)
      input.value = reported.value ?? height.defaultValue;
    dialog.querySelector("output").textContent =
      reported.value === undefined
        ? "Unknown"
        : reported.value + " " + height.unit;
    const cover = this._hass.states?.[this._model.bindings[device.motion]],
      features = this._preview
        ? { open: true, close: true, stop: true }
        : coverFeatures(cover),
      unavailable = !this._preview && coverState(cover).unavailable;
    for (const button of dialog.querySelectorAll("[data-action]"))
      button.disabled = unavailable || !features[button.dataset.action];
    for (const button of dialog.querySelectorAll("[data-macro]")) {
      const id = button.dataset.macro,
        e = this._hass.states?.[this._model.bindings[id]],
        name = macroName(this._model, device, id);
      button.querySelector("span").textContent = name || "Name macro";
      button.setAttribute(
        "aria-label",
        name || "Macro " + (device.macros.indexOf(id) + 1),
      );
      const icon = button.querySelector("ha-state-icon");
      icon.hass = this._hass;
      icon.stateObj = e || {
        entity_id: "button.preview",
        state: "unknown",
        attributes: { icon: "mdi:gesture-tap-button" },
      };
      button.disabled = !this._preview && actionState(e).unavailable;
    }
  }
  _numberPreview(control) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><label>Height <output></output><input type="range" aria-label="Desk height"></label><button>Close</button></form>';
    dialog.querySelector("h2").textContent = control.label;
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this height to a number or input number entity in 3D Rooms → Devices.";
    const input = dialog.querySelector("input");
    Object.assign(input, {
      min: control.min,
      max: control.max,
      step: control.step,
      value:
        this._previewStates?.get(control.id)?.value ?? control.defaultValue,
      disabled: !this._preview,
    });
    const update = () => {
      dialog.querySelector("output").textContent =
        input.value + " " + control.unit;
      if (this._preview) {
        this._previewStates.set(control.id, { value: Number(input.value) });
        this._states();
      }
    };
    input.oninput = update;
    update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _coverPreview(control) {
    this._dialog?.remove();
    const dialog = document.createElement("dialog");
    this._dialog = dialog;
    dialog.innerHTML =
      '<form method="dialog"><h2></h2><p></p><label>Opening <output></output><input type="range" min="0" max="100" step="1" aria-label="Shade opening"></label><button>Close</button></form>';
    dialog.querySelector("h2").textContent = control.label;
    dialog.querySelector("p").textContent = this._preview
      ? "Local preview · no real device commands"
      : "Connect this shade to a cover entity in 3D Rooms → Model settings.";
    const input = dialog.querySelector("input");
    input.disabled = !this._preview;
    input.value =
      this._previewStates.get(control.id)?.position ??
      control.defaultPosition ??
      0;
    const update = () => {
      dialog.querySelector("output").textContent = input.value + "% open";
      if (this._preview) {
        this._previewStates.set(control.id, { position: Number(input.value) });
        this._states();
      }
    };
    input.oninput = update;
    update();
    dialog.addEventListener("close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    dialog.showModal();
  }
  _states() {
    if (!this._model || !this._view) return;
    const states = new Map();
    for (const control of this._model.controls) {
      const entity = this._hass.states?.[this._model.bindings[control.id]];
      if (control.type === "button") {
        states.set(
          control.id,
          this._preview ? { unavailable: false } : actionState(entity),
        );
        continue;
      }
      if (control.type === "number") {
        states.set(
          control.id,
          this._preview
            ? this._previewStates?.get(control.id) || {
                value: control.defaultValue,
              }
            : numberState(entity, control),
        );
        continue;
      }
      if (control.type === "cover") {
        states.set(
          control.id,
          this._preview
            ? this._previewStates?.get(control.id) || {
                position: control.defaultPosition ?? 0,
              }
            : coverState(entity),
        );
        continue;
      }
      states.set(
        control.id,
        this._preview
          ? this._previewStates?.get(control.id) || {
              on: true,
              brightness: 255,
              rgb: hexToRgb(control.color || "#fff0d4"),
            }
          : {
              on: entity?.state === "on",
              unavailable:
                !entity || ["unavailable", "unknown"].includes(entity.state),
              brightness: entity?.attributes?.brightness ?? 255,
              ...entityAppearance(entity, control.color),
            },
      );
    }
    this._updateDeskDialog();
    for (const button of this.shadowRoot.querySelectorAll("[data-control]")) {
      const id = button.dataset.control;
      const control = this._model.controls.find((c) => c.id === id);
      const entity = this._hass.states?.[this._model.bindings[id]];
      const appearance = markerAppearance(
        control,
        entity,
        states.get(id),
        this._preview,
      );
      button.dataset.active = String(appearance.active);
      button.dataset.moving = String(appearance.moving);
      button.dataset.unavailable = String(appearance.unavailable);
      const label =
        deviceForControl(this._model, id)?.label ||
        control.label ||
        control.name ||
        "Device";
      button.title = `${label}: ${appearance.description}`;
      button.setAttribute(
        "aria-label",
        `${control.type !== "light" ? "Control" : "Toggle"} ${label}, ${appearance.description}${control.type !== "light" ? "" : ". Hold for more info."}`,
      );
      button.setAttribute("aria-disabled", String(appearance.unavailable));
      if (control.type !== "light") button.removeAttribute("aria-pressed");
      else button.setAttribute("aria-pressed", String(appearance.active));
      const icon = button.querySelector("ha-state-icon");
      icon.hass = this._hass;
      icon.stateObj = appearance.stateObj;
      button.querySelector(".fixture-state").textContent = appearance.badge;
    }
    const sun = this._preview
      ? undefined
      : this._hass.states?.[this._model.daylight?.entity || "sun.sun"];
    const signature = JSON.stringify([
      [...states],
      this._model.daylight?.mode,
      sun?.state,
      sun?.attributes?.elevation,
    ]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._view.setStates(states);
    this._view.setDaylight?.(this._model.daylight?.mode ?? "night", sun);
  }
}
if (!customElements.get("three-d-rooms-card"))
  customElements.define("three-d-rooms-card", ThreeDRoomsCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "three-d-rooms-card"))
  window.customCards.push({
    type: "three-d-rooms-card",
    name: "3D Rooms",
    description:
      "Your room in perspective, with live lighting and controls on the modeled fixtures.",
    preview: true,
  });
