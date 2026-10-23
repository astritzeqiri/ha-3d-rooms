import "./panel.js";
import { SceneView } from "../web/scene.js";
import { entityAppearance, hexToRgb, kelvinToRgb } from "../shared/light.mjs";
import { connectModel } from "./transport.mjs";
export class ThreeDRoomsCard extends HTMLElement {
  static getStubConfig() {
    return { model: "kitchen", height: 500, view: "front", tilt: 28 };
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{display:block;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#101715));border-radius:var(--ha-card-border-radius,12px)}header{padding:16px 20px 0;font:500 18px system-ui;color:var(--primary-text-color,#edf2eb)}.scene{position:relative;width:100%;height:500px}.scene canvas{display:block;width:100%;height:100%}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px;color:var(--primary-text-color,#edf2eb);font:14px/1.5 system-ui;background:var(--card-background-color,#101715)}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--divider-color,#536258);border-radius:8px;background:transparent;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color,#aacaab)}.fixture-access{position:absolute;left:12px;bottom:12px}.fixture-access button{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);padding:0;white-space:nowrap}.fixture-access button:focus-visible{position:relative;width:auto;height:auto;clip-path:none;padding:10px 18px;background:#28352b}dialog{box-sizing:border-box;width:min(360px,calc(100vw - 32px));border:1px solid #536258;border-radius:16px;padding:24px;background:#202923;color:#edf2eb;font:14px system-ui}dialog::backdrop{background:#0008}dialog h2{font-size:20px;margin:0 0 8px}dialog p{color:#aebbb2;line-height:1.5}dialog label{display:grid;gap:8px;margin:18px 0}dialog input{width:100%;min-height:32px;box-sizing:border-box}dialog .close{margin-top:12px}[hidden]{display:none!important}</style><ha-card><header hidden></header><div class="scene"><div class="message" role="status"><span>Connecting to 3D Rooms…</span><button hidden>Retry</button></div></div></ha-card>`;
    this._container = this.shadowRoot.querySelector(".scene");
    this._message = this.shadowRoot.querySelector(".message");
    this.shadowRoot.querySelector("button").onclick = () => this._load();
    this._generation = 0;
  }
  setConfig(config) {
    if (
      typeof config.model !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(config.model)
    )
      throw new Error("Choose a model ID, for example kitchen.");
    if (
      config.height !== undefined &&
      (!Number.isFinite(config.height) ||
        config.height < 180 ||
        config.height > 1600)
    )
      throw new Error("Card height must be between 180 and 1600 pixels.");
    for (const key of ["tilt", "heading"])
      if (config[key] !== undefined && !Number.isFinite(config[key]))
        throw new Error(`${key} must be a number.`);
    if (config.tilt !== undefined && (config.tilt < 0 || config.tilt > 35))
      throw new Error("Tilt must be between 0 and 35 degrees.");
    if (config.view !== undefined && !["front", "floor"].includes(config.view))
      throw new Error("Choose front or floor view.");
    this._config = {
      height: 500,
      view: "front",
      tilt: config.view === "floor" ? 8 : 28,
      heading: 0,
      interactive: false,
      ...config,
    };
    this._container.style.height = this._config.height + "px";
    const title = this.shadowRoot.querySelector("header");
    title.textContent = config.title || "";
    title.hidden = !config.title;
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
      this._message.hidden = true;
      if (
        !this._preview &&
        !this._config.addon &&
        this._hass.connection?.subscribeEvents
      ) {
        const unsubscribe = await this._hass.connection.subscribeEvents(
          () => this._load(),
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
  _buildAccess() {
    this.shadowRoot.querySelector(".fixture-access")?.remove();
    const access = document.createElement("div");
    access.className = "fixture-access";
    for (const control of this._model.controls) {
      const button = document.createElement("button");
      button.textContent = `Control ${control.label || control.name || "light"}`;
      button.onclick = () => this._pick(control.id);
      access.append(button);
    }
    this._container.append(access);
  }
  _pick(id) {
    const control = this._model.controls.find((c) => c.id === id);
    if (!control) return;
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
  _states() {
    if (!this._model || !this._view) return;
    const states = new Map();
    for (const control of this._model.controls) {
      const entity = this._hass.states?.[this._model.bindings[control.id]];
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
    const signature = JSON.stringify([...states]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._view.setStates(states);
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
