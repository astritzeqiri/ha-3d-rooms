import { VIEW_FIELDS, resolveSavedView } from "../shared/saved-view.mjs";
import { houseFloorOptions } from "../shared/house-floors.mjs";
const FIELD_NAMES = {
  model: "Room",
  title: "Title",
  show_title: "Show title",
  view: "View",
  heading: "Rotation",
  tilt: "Tilt",
  zoom: "Zoom",
  height: "Height",
  interactive: "Camera movement",
};
const DEFAULTS = {
  show_title: true,
  height: 500,
  view: "front",
  heading: 0,
  tilt: 28,
  zoom: 1,
};

export class ThreeDRoomsEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;container-type:inline-size;color:var(--primary-text-color);font:14px/1.5 var(--paper-font-body1_-_font-family,system-ui)}
      label{display:grid;gap:6px;margin:16px 0}input,select,button{box-sizing:border-box;min-height:44px;width:100%;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:10px}
      input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .field-setting{position:relative;min-width:0;margin:16px 0}.field-setting>label{margin:0;gap:10px}.field-setting:not(.boolean)>label{padding-top:4px}.field-setting.boolean{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}.field-setting.boolean>label{flex:1;min-width:0}.field-setting.boolean>label input{flex-shrink:0}
      .override-controls{position:absolute;top:0;right:0;display:flex;align-items:center;gap:2px;min-height:28px;color:var(--secondary-text-color);font-size:12px}.boolean .override-controls{position:static;flex-shrink:0}.override-controls .reset-field{display:inline-flex;align-items:center;gap:4px;width:auto;min-height:28px;padding:3px 5px;border:0;background:transparent;color:var(--secondary-text-color);font-size:12px;cursor:pointer}.reset-field svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6}.override-controls .reset-field:hover{color:var(--primary-color);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}
      input:disabled,select:disabled{opacity:.65}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.check{display:flex;align-items:center}.check input{width:22px;margin-right:8px}
      p{color:var(--secondary-text-color)}[role=alert]{color:var(--error-color)}[hidden]{display:none!important}
      @container(max-width:420px){.grid{grid-template-columns:1fr}}
    </style>
    <p>Choose a room or link a saved view. Linked fields follow changes saved in 3D Rooms. Edit any field for this card. Reset a changed field to follow the saved view again.</p>
    <p id="status" role="status">Loading rooms…</p><button id="retry" hidden>Retry loading rooms</button>
    <label>Saved view<select id="component"><option value="">Choose a saved view (optional)</option></select></label>
    <label>Room<select id="model"><option value="">Choose a room</option></select></label>
    <label>Title<input id="title" type="text" maxlength="160"></label>
    <label class="check"><input id="show_title" type="checkbox">Show title on card</label>
    <label>View<select id="view"><option value="front">Perspective</option><option value="floor">Floor</option></select></label>
    <div class="grid">
      <label>Rotation (°)<input id="heading" type="number" min="0" max="359.99" step="0.01"></label>
      <label>Tilt (°)<input id="tilt" type="number" min="0" max="180" step="0.01"></label>
      <label>Zoom<input id="zoom" type="number" min="0.01" max="100" step="0.01"></label>
      <label>Height<select id="height-mode" aria-label="Height mode"><option value="fixed">Fixed height</option><option value="auto">Auto · fill available screen</option></select><input id="height" type="number" min="180" max="1600" step="1" aria-label="Height in pixels" aria-describedby="height-note"></label>
      <p id="height-note">Auto fills the space below the dashboard header. Best used in a single-card Panel view.</p>
    </div>
    <label class="check"><input id="interactive" type="checkbox">Allow camera movement by default</label>
    <label class="check"><input id="camera_controls" type="checkbox">Show camera buttons on the card (move camera and reset view)</label>
    <label class="check"><input id="light_panel" type="checkbox">Show the Lights button (each room's lights, with one switch per room)</label>
    <label class="check"><input id="shade_panel" type="checkbox">Show the Shades button (each room's shades, with one switch per room)</label>
    <label class="check" id="room-focus-setting" hidden><input id="room_focus" type="checkbox">Show a button in front of each room to view that room on its own</label>
    <label class="check" id="floor-selector-setting" hidden><input id="floor_selector" type="checkbox">Show floor switcher (whole house or one floor)</label>
    <label>Rendering quality<select id="quality">
      <option value="auto">Automatic · lighter on phones and tablets</option>
      <option value="high">High · full shadows and sharpness</option>
      <option value="low">Low · faster and uses less battery</option>
    </select></label>
    <label id="daylight-setting" hidden>Time of day<select id="daylight">
      <option value="auto">Automatic · follow the Home Assistant sun</option>
      <option value="day">Always day</option>
      <option value="night">Always night</option>
    </select></label>
    <p id="daylight-note" hidden>Saved with this room, so every dashboard and the 3D Rooms manager use the same setting.</p>
    <button id="reset">Reset camera framing</button>
    <p id="error" role="alert" hidden></p>
    <p>Upload rooms and manage device mappings in the 3D Rooms sidebar. Save this card with Home Assistant’s Save button.</p>`;
    this._field = (id) => this.shadowRoot.getElementById(id);
    for (const key of [
      "model",
      "title",
      "show_title",
      "view",
      "heading",
      "tilt",
      "zoom",
      "height",
      "interactive",
    ])
      this._field(key).addEventListener("change", () => this._change(key));
    for (const key of VIEW_FIELDS) {
      const input = this._field(key);
      const fieldLabel = input.closest("label");
      const wrapper = document.createElement("div");
      wrapper.className =
        input.type === "checkbox" ? "field-setting boolean" : "field-setting";
      fieldLabel.after(wrapper);
      const controls = document.createElement("div");
      controls.className = "override-controls";
      controls.id = `override-controls-${key}`;
      controls.hidden = true;
      const reset = document.createElement("button");
      reset.type = "button";
      reset.id = `reset-field-${key}`;
      reset.className = "reset-field";
      reset.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg><span>Reset</span>';
      reset.title = "Use saved view value";
      reset.hidden = true;
      reset.setAttribute(
        "aria-label",
        `Reset ${FIELD_NAMES[key]} to saved view`,
      );
      reset.addEventListener("click", () => this._resetField(key));
      controls.append(reset);
      wrapper.append(fieldLabel, controls);
    }
    this._field("height-mode").onchange = () => {
      if (this._field("height-mode").disabled) return;
      this._emit({
        ...this._config,
        height: this._field("height-mode").value === "auto" ? "auto" : 500,
      });
    };
    this._field("component").onchange = () => this._component();
    this._field("camera_controls").onchange = () => {
      const config = { ...this._config };
      if (this._field("camera_controls").checked) delete config.camera_controls;
      else config.camera_controls = false;
      this._emit(config);
    };
    this._field("shade_panel").onchange = () => {
      const config = { ...this._config };
      if (this._field("shade_panel").checked) delete config.shade_panel;
      else config.shade_panel = false;
      this._emit(config);
    };
    this._field("light_panel").onchange = () => {
      const config = { ...this._config };
      if (this._field("light_panel").checked) delete config.light_panel;
      else config.light_panel = false;
      this._emit(config);
    };
    this._field("room_focus").onchange = () => {
      const config = { ...this._config };
      if (this._field("room_focus").checked) delete config.room_focus;
      else config.room_focus = false;
      this._emit(config);
    };
    this._field("floor_selector").onchange = () => {
      const config = { ...this._config };
      if (this._field("floor_selector").checked) delete config.floor_selector;
      else config.floor_selector = false;
      this._emit(config);
    };
    this._field("quality").onchange = () => {
      const config = { ...this._config };
      const quality = this._field("quality").value;
      if (quality === "auto") delete config.quality;
      else config.quality = quality;
      this._emit(config);
    };
    this._field("daylight").addEventListener("change", () => this._daylight());
    this._field("retry").onclick = () => this._load();
    this._field("reset").onclick = () => {
      if (this._config.saved_view) {
        const config = { ...this._config };
        for (const key of ["view", "heading", "tilt", "zoom", "camera"])
          delete config[key];
        this._emit(config);
        return;
      }
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
    if (this._hass?.connection !== hass.connection) {
      this._unsub?.();
      this._unsub = null;
    }
    this._hass = hass;
    this._subscribe();
    if (!this._attempted && !this._loading) this._load();
  }
  connectedCallback() {
    this._subscribe();
  }
  disconnectedCallback() {
    this._unsub?.();
    this._unsub = null;
  }
  async _subscribe() {
    if (
      !this.isConnected ||
      this._unsub ||
      this._subscribing ||
      !this._hass?.connection?.subscribeEvents
    )
      return;
    this._subscribing = true;
    const connection = this._hass.connection;
    try {
      const unsub = await connection.subscribeEvents(
        () => this._load(),
        "three_d_rooms_updated",
      );
      if (!this.isConnected || connection !== this._hass.connection) unsub();
      else this._unsub = unsub;
    } catch {
      // Library loading still provides an explicit retry when disconnected.
    } finally {
      this._subscribing = false;
    }
  }
  _sync() {
    if (!this._config) return;
    let resolved = this._config;
    try {
      resolved = resolveSavedView(this._config, this._components);
    } catch (error) {
      if (this._loaded) {
        this._field("error").hidden = false;
        this._field("error").textContent = error.message;
      }
    }
    const savedSelect = this._field("component");
    if (
      this._config.saved_view &&
      this._loaded &&
      ![...savedSelect.options].some(
        (option) => option.value === this._config.saved_view,
      )
    )
      savedSelect.add(
        new Option(
          `${this._config.saved_view} (unavailable)`,
          this._config.saved_view,
        ),
      );
    savedSelect.value = this._config.saved_view || "";
    this._field("reset").textContent = this._config.saved_view
      ? "Use saved camera framing"
      : "Reset camera framing";
    let inherited;
    if (this._config.saved_view) {
      try {
        inherited = resolveSavedView(
          { saved_view: this._config.saved_view },
          this._components,
        );
      } catch {
        /* A missing view is reported above. */
      }
    }
    for (const key of VIEW_FIELDS) {
      const linked = !!this._config.saved_view;
      const overridden = Object.hasOwn(this._config, key);
      this._field(`reset-field-${key}`).hidden =
        !linked ||
        !overridden ||
        !inherited ||
        this._config[key] === inherited[key];
      this._field(`override-controls-${key}`).hidden = this._field(
        `reset-field-${key}`,
      ).hidden;
      this._field(key).disabled = false;
    }
    for (const key of Object.keys(DEFAULTS).concat([
      "model",
      "title",
      "interactive",
    ])) {
      const input = this._field(key);
      const camera = resolved.camera;
      const cameraDefault =
        key === "zoom" ? camera?.referenceZoom : camera?.[key];
      const value =
        resolved[key] ??
        cameraDefault ??
        (key === "tilt" && resolved.view === "floor" ? 0 : DEFAULTS[key]) ??
        "";
      if (key === "interactive" || key === "show_title")
        input.checked = !!value;
      else input.value = value;
    }
    this._field("height-mode").value =
      resolved.height === "auto" ? "auto" : "fixed";
    this._field("height-mode").disabled = this._field("height").disabled;
    this._field("height").hidden = resolved.height === "auto";
    const model = resolved.model;
    const select = this._field("model");
    if (
      model &&
      ![...select.options].some((option) => option.value === model)
    ) {
      select.add(new Option(`${model} (not in room library)`, model));
      select.value = model;
    }
    const house = this._models?.find((m) => m.id === model);
    this._field("floor-selector-setting").hidden = !houseFloorOptions(
      this._models,
      house,
    ).length;
    this._field("room-focus-setting").hidden = !house?.houseView;
    this._field("room_focus").checked = this._config.room_focus !== false;
    this._field("floor_selector").checked =
      this._config.floor_selector !== false;
    this._field("camera_controls").checked =
      this._config.camera_controls !== false;
    this._field("light_panel").checked = this._config.light_panel !== false;
    this._field("shade_panel").checked = this._config.shade_panel !== false;
    this._field("quality").value = this._config.quality || "auto";
    const daylight = this._models?.find((m) => m.id === model)?.daylight;
    this._field("daylight-setting").hidden = !daylight;
    this._field("daylight-note").hidden = !daylight;
    if (daylight) this._field("daylight").value = daylight.mode;
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
      this._models = models;
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
    if (!this._field("component").value) {
      let config;
      try {
        config = resolveSavedView(this._config, this._components);
      } catch {
        config = { ...this._config };
      }
      delete config.saved_view;
      this._emit(config);
      return;
    }
    if (!component || component.layers?.length !== 1) return;
    const config = { ...this._config, saved_view: component.id };
    for (const key of [...VIEW_FIELDS, "camera", "markers"]) delete config[key];
    this._emit(config);
  }
  _resetField(key) {
    const config = { ...this._config };
    delete config[key];
    this._emit(config);
  }
  _change(key) {
    const input = this._field(key);
    if (input.disabled) return;
    if (!input.checkValidity()) {
      this._field("error").hidden = false;
      this._field("error").textContent = input.validationMessage;
      return;
    }
    const value =
      key === "height"
        ? input.value.trim().toLowerCase() === "auto"
          ? "auto"
          : Number(input.value)
        : input.type === "checkbox"
          ? input.checked
          : input.type === "number"
            ? Number(input.value)
            : input.value;
    if (
      (input.type === "number" && input.value === "") ||
      (key === "model" && !value)
    )
      return;
    if (
      key === "height" &&
      value !== "auto" &&
      (!Number.isInteger(value) || value < 180 || value > 1600)
    ) {
      this._field("error").hidden = false;
      this._field("error").textContent =
        "Enter auto or a height between 180 and 1600 pixels.";
      return;
    }
    this._field("error").hidden = true;
    const config = { ...this._config, [key]: value };
    if (!config.saved_view && (key === "model" || key === "view")) {
      delete config.camera;
      Object.assign(config, {
        heading: 0,
        tilt: config.view === "floor" ? 0 : 28,
        zoom: 1,
      });
    }
    this._emit(config);
  }
  async _daylight() {
    const model = this._models?.find(
      (m) => m.id === resolveSavedView(this._config, this._components).model,
    );
    const select = this._field("daylight");
    if (!model?.daylight || !this._hass) return;
    const previous = model.daylight.mode;
    this._field("error").hidden = true;
    try {
      const result = await this._hass.callWS({
        type: "three_d_rooms/request",
        operation: "daylight",
        data: {
          model: model.id,
          mode: select.value,
          entity: model.daylight.entity,
        },
      });
      model.daylight = { ...model.daylight, ...result.daylight };
    } catch (error) {
      select.value = previous;
      this._field("error").hidden = false;
      this._field("error").textContent =
        error.message || "Could not save the time of day for this room.";
    }
  }
  _emit(config) {
    this._field("error").hidden = true;
    if (config.saved_view) {
      try {
        const inherited = resolveSavedView(
          { saved_view: config.saved_view },
          this._components,
        );
        config = { ...config };
        for (const key of VIEW_FIELDS)
          if (Object.hasOwn(config, key) && config[key] === inherited[key])
            delete config[key];
      } catch {
        // Preserve editable configuration while a linked view is unavailable.
      }
    }
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
