const DEFAULTS = { height: 500, view: "front", heading: 0, tilt: 28, zoom: 1 };

export class ThreeDRoomsEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}
      label{display:grid;gap:6px;margin:16px 0}input,select,button{box-sizing:border-box;min-height:44px;width:100%;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:10px}
      input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.check{display:flex;align-items:center}.check input{width:22px;margin-right:8px}
      p{color:var(--secondary-text-color)}[role=alert]{color:var(--error-color)}[hidden]{display:none!important}
      @media(max-width:360px){.grid{grid-template-columns:1fr}}
    </style>
    <p>Choose a room or start from a saved view. Changes appear in Home Assistant’s preview.</p>
    <p id="status" role="status">Loading rooms…</p><button id="retry" hidden>Retry loading rooms</button>
    <label>Saved view<select id="component"><option value="">Choose a saved view (optional)</option></select></label>
    <label>Room<select id="model"><option value="">Choose a room</option></select></label>
    <label>Title<input id="title" type="text" maxlength="160"></label>
    <label>View<select id="view"><option value="front">Perspective</option><option value="floor">Floor</option></select></label>
    <div class="grid">
      <label>Rotation (°)<input id="heading" type="number" min="0" max="359.99" step="0.01"></label>
      <label>Tilt (°)<input id="tilt" type="number" min="0" max="180" step="0.01"></label>
      <label>Zoom<input id="zoom" type="number" min="0.01" max="100" step="0.01"></label>
      <label>Height (px)<input id="height" type="number" min="180" max="1600" step="1"></label>
    </div>
    <label class="check"><input id="interactive" type="checkbox">Allow camera movement on the dashboard</label>
    <button id="reset">Reset camera framing</button>
    <p id="error" role="alert" hidden></p>
    <p>Upload rooms and manage device mappings in the 3D Rooms sidebar. Save this card with Home Assistant’s Save button.</p>`;
    this._field = (id) => this.shadowRoot.getElementById(id);
    for (const key of [
      "model",
      "title",
      "view",
      "heading",
      "tilt",
      "zoom",
      "height",
      "interactive",
    ])
      this._field(key).addEventListener("change", () => this._change(key));
    this._field("component").onchange = () => this._component();
    this._field("retry").onclick = () => this._load();
    this._field("reset").onclick = () => {
      const config = {
        ...this._config,
        view: "front",
        heading: 0,
        tilt: 28,
        zoom: 1,
      };
      delete config.camera;
      this._emit(config);
    };
  }
  setConfig(config) {
    this._config = { ...config };
    this._sync();
  }
  set hass(hass) {
    if (this._hass?.connection !== hass.connection) this._attempted = false;
    this._hass = hass;
    if (!this._attempted && !this._loading) this._load();
  }
  _sync() {
    if (!this._config) return;
    for (const key of Object.keys(DEFAULTS).concat([
      "model",
      "title",
      "interactive",
    ])) {
      const input = this._field(key);
      const camera = this._config.camera;
      const cameraDefault =
        key === "zoom" ? camera?.referenceZoom : camera?.[key];
      const value =
        this._config[key] ??
        cameraDefault ??
        (key === "tilt" && this._config.view === "floor" ? 8 : DEFAULTS[key]) ??
        "";
      if (key === "interactive") input.checked = !!value;
      else input.value = value;
    }
    const model = this._config.model;
    const select = this._field("model");
    if (
      model &&
      ![...select.options].some((option) => option.value === model)
    ) {
      select.add(new Option(`${model} (not in room library)`, model));
      select.value = model;
    }
  }
  async _load() {
    if (!this._hass) return;
    this._loading = true;
    this._attempted = true;
    const hass = this._hass;
    this._field("status").textContent = "Loading rooms…";
    this._field("retry").hidden = true;
    try {
      const [models, components] = await Promise.all([
        hass.callWS({ type: "three_d_rooms/request", operation: "models" }),
        hass.callWS({ type: "three_d_rooms/request", operation: "components" }),
      ]);
      if (hass.connection !== this._hass.connection) return;
      this._components = components;
      const modelSelect = this._field("model");
      modelSelect.replaceChildren(new Option("Choose a room", ""));
      for (const model of models)
        modelSelect.add(
          new Option(model.title || model.name || model.id, model.id),
        );
      const componentSelect = this._field("component");
      componentSelect.replaceChildren(
        new Option("Choose a saved view (optional)", ""),
      );
      for (const component of components)
        componentSelect.add(
          new Option(
            `${models.find((m) => m.id === component.layers[0].model)?.title || "Room unavailable"} · ${component.title}`,
            component.id,
          ),
        );
      this._loaded = true;
      this._field("status").textContent = models.length
        ? ""
        : "No rooms yet. Upload a model in the 3D Rooms sidebar first.";
      this._sync();
    } catch (error) {
      this._field("status").textContent =
        error.message ||
        "Could not load rooms. Check that 3D Rooms is installed and you are an administrator.";
      this._field("retry").hidden = false;
    } finally {
      this._loading = false;
    }
  }
  _component() {
    const component = this._components?.find(
      (item) => item.id === this._field("component").value,
    );
    if (!component || component.layers?.length !== 1) return;
    const config = { ...this._config };
    for (const key of ["model", "view", "heading", "tilt", "zoom", "camera"])
      delete config[key];
    this._emit({
      ...config,
      ...structuredClone(component.layers[0]),
      title: component.title,
      height: component.height,
    });
  }
  _change(key) {
    const input = this._field(key);
    if (!input.checkValidity()) {
      this._field("error").hidden = false;
      this._field("error").textContent = input.validationMessage;
      return;
    }
    const value =
      input.type === "checkbox"
        ? input.checked
        : input.type === "number"
          ? Number(input.value)
          : input.value;
    if (
      (input.type === "number" && input.value === "") ||
      (key === "model" && !value)
    )
      return;
    const config = { ...this._config, [key]: value };
    if (key === "model" || key === "view") {
      delete config.camera;
      Object.assign(config, {
        heading: 0,
        tilt: config.view === "floor" ? 8 : 28,
        zoom: 1,
      });
    }
    this._field("component").value = "";
    this._emit(config);
  }
  _emit(config) {
    this._field("error").hidden = true;
    this._config = { ...config, type: "custom:three-d-rooms-card" };
    this._sync();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
if (!customElements.get("three-d-rooms-editor"))
  customElements.define("three-d-rooms-editor", ThreeDRoomsEditor);
