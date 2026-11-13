import { MARKER_ICONS } from "../shared/marker-icons.mjs";
import { haMdi } from "../shared/ha-mdi.mjs";
import { iconArt, MDI_VIEWBOX } from "../shared/icon-art.mjs";

/**
 * Draws Home Assistant icon names (`mdi:…`, or a set from `window.customIcons`
 * such as `local:…`) on the standalone page, where HA's own `ha-state-icon`
 * does not exist. Custom sets live in the user's own frontend modules, which
 * are loaded the first time a name needs one.
 */
export function createIconResolver({
  customIcons = () => globalThis.window?.customIcons || {},
  loadModules = async () => {},
  mdiPath = (name) => haMdi.path(name),
} = {}) {
  const cache = new Map();
  let modules;
  const lookup = async (name) => {
    const split = name.indexOf(":");
    const prefix = name.slice(0, split);
    if (prefix === "mdi") {
      const curated = MARKER_ICONS.get(name);
      if (curated)
        return { viewBox: MDI_VIEWBOX, html: `<path d="${curated.path}"/>` };
      // Home Assistant's own copy of the set (see shared/ha-mdi.mjs).
      const path = await mdiPath(name);
      return path ? iconArt({ path }) : undefined;
    }
    if (!customIcons()[prefix]) {
      modules ||= Promise.resolve(loadModules()).catch(() => {});
      await modules;
    }
    const set = customIcons()[prefix];
    if (typeof set?.getIcon !== "function") return undefined;
    return iconArt(await set.getIcon(name.slice(split + 1)));
  };
  return {
    /** Icon art `{ viewBox, html }`, or undefined when the name cannot be drawn. */
    resolve(name) {
      if (typeof name !== "string" || !name.includes(":"))
        return Promise.resolve(undefined);
      if (!cache.has(name))
        cache.set(
          name,
          lookup(name).catch(() => undefined),
        );
      return cache.get(name);
    },
  };
}

/** Icons chosen in the entity registry, which entity states do not carry. */
export function registryIcons(list) {
  const icons = new Map();
  for (const entity of list?.entities || [])
    if (entity.ei && typeof entity.ic === "string")
      icons.set(entity.ei, entity.ic);
  return (entityId) => icons.get(entityId);
}

/**
 * `ha-state-icon` for the card: its own light-DOM glyph stays the fallback
 * (slotted); a resolved icon is drawn over it.
 */
export function defineStateIcon({ resolver, registryIcon = () => undefined }) {
  if (customElements.get("ha-state-icon")) return;
  class StateIcon extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" }).innerHTML =
        "<style>:host{display:inline-flex}svg{display:block;width:100%;height:100%;fill:currentColor}svg[hidden],slot[hidden]{display:none}</style><slot></slot><svg hidden></svg>";
      this._svg = this.shadowRoot.querySelector("svg");
      this._slot = this.shadowRoot.querySelector("slot");
      this._token = 0;
    }
    get icon() {
      return this._icon;
    }
    set icon(value) {
      this._icon = value;
      this._sync();
    }
    get stateObj() {
      return this._stateObj;
    }
    set stateObj(value) {
      this._stateObj = value;
      this._sync();
    }
    set hass(value) {
      this._hass = value;
    }
    _sync() {
      const name =
        this._icon ||
        this._stateObj?.attributes?.icon ||
        registryIcon(this._stateObj?.entity_id) ||
        // Extra entities of a view name a plain icon for their kind.
        this.dataset.defaultIcon;
      if (name === this._name) return;
      this._name = name;
      const token = ++this._token;
      if (!name) return this._show(undefined);
      resolver.resolve(name).then((art) => {
        if (token === this._token) this._show(art);
      });
    }
    _show(art) {
      // SVG elements have no `hidden` property: toggle the attribute.
      this._svg.toggleAttribute("hidden", !art);
      this._slot.hidden = !!art;
      if (art) {
        this._svg.setAttribute("viewBox", art.viewBox);
        this._svg.innerHTML = art.html;
      }
    }
  }
  customElements.define("ha-state-icon", StateIcon);
}
