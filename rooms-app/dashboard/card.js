import { SceneView } from "../web/scene.js";
import { entityAppearance, hexToRgb } from "../shared/light.mjs";
import { connectModel } from "./transport.mjs";
export class ThreeDRoomsCard extends HTMLElement {
  static getStubConfig() {
    return { model: "kitchen", height: 500, tilt: 8 };
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{display:block;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#101715));border-radius:var(--ha-card-border-radius,12px)}header{padding:16px 20px 0;font:500 18px system-ui;color:var(--primary-text-color,#edf2eb)}.scene{position:relative;width:100%;height:500px}.scene canvas{display:block;width:100%;height:100%}.message{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px;color:var(--primary-text-color,#edf2eb);font:14px/1.5 system-ui;background:var(--card-background-color,#101715)}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--divider-color,#536258);border-radius:8px;background:transparent;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color,#aacaab)}[hidden]{display:none!important}</style><ha-card><header hidden></header><div class="scene"><div class="message" role="status"><span>Connecting to 3D Rooms…</span><button hidden>Retry</button></div></div></ha-card>`;
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
    this._config = {
      height: 500,
      tilt: 8,
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
    this._message.hidden = false;
    this._message.querySelector("span").textContent = "Loading your floor…";
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
      const { model, sceneURL } = await connection.load();
      if (generation !== this._generation) return;
      this._view?.dispose();
      this._view = new SceneView(this._container, () => {}, {
        mode: "floor",
        markers: false,
        interactive: this._config.interactive,
        tilt: this._config.tilt,
        heading: this._config.heading,
      });
      const view = this._view;
      await view.load(model, sceneURL);
      if (generation !== this._generation) return;
      this._model = model;
      this._preview = connection.preview;
      this._signature = null;
      this._states();
      this._message.hidden = true;
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
  _states() {
    if (!this._model || !this._view) return;
    const states = new Map();
    for (const control of this._model.controls) {
      const entity = this._hass.states?.[this._model.bindings[control.id]];
      states.set(
        control.id,
        this._preview
          ? {
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
      "A clean overhead view of your private floor model, with live lighting and no entity icons.",
    preview: true,
  });
