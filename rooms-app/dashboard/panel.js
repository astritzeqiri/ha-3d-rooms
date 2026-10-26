import { roomRoute } from "../shared/room-route.mjs";
import { sceneBlob } from "../shared/scene-download.mjs";
/** Native HA sidebar wrapper for the existing room manager. No token copying. */
class ThreeDRoomsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>:host{display:block;height:100%;min-height:100vh}iframe{display:block;width:100%;height:100vh;border:0}</style><iframe title="3D Rooms model library"></iframe>`;
    this._frame = this.shadowRoot.querySelector("iframe");
    this._ready = (event) => {
      if (
        event.source !== this._frame.contentWindow ||
        event.origin !== location.origin ||
        event.data?.type !== "three-d-rooms-ready"
      )
        return;
      const bridge = {
        navigate: (search) => {
          if (
            roomRoute(search).toString() ===
            roomRoute(location.search).toString()
          )
            return;
          const url = new URL(location.href);
          for (const key of ["model", "tab", "saved_view", "view"])
            url.searchParams.delete(key);
          for (const [key, value] of roomRoute(search))
            url.searchParams.set(key, value);
          history.replaceState(history.state, "", url);
        },
        request: (operation, data = {}) =>
          this._hass.callWS({ type: "three_d_rooms/request", operation, data }),
        asset: (path, options) => this._hass.fetchWithAuth(path, options),
        scene: (model) => sceneBlob(this._hass, model),
        subscribe: (listener) => {
          this._listener = listener;
          this._publish();
          return () => {
            if (this._listener === listener) this._listener = null;
          };
        },
      };
      this._frame.contentWindow.threeDRoomsBridge = bridge;
      this._frame.contentWindow.dispatchEvent(
        new Event("three-d-rooms-connected"),
      );
    };
  }
  set hass(value) {
    this._hass = value;
    this._publish();
  }
  _publish() {
    if (!this._hass) return;
    this._listener?.({
      connected: this._hass.connected !== false,
      mode: "homeassistant",
      entities: Object.values(this._hass.states).filter((e) =>
        /^(light|switch|cover|sun|number|input_number|button|input_button|script|scene)\./.test(
          e.entity_id,
        ),
      ),
    });
  }
  connectedCallback() {
    window.addEventListener("message", this._ready);
    const query = roomRoute(location.search);
    query.set("native", "1");
    this._frame.src =
      new URL(/* @vite-ignore */ ".", import.meta.url).href +
      "index.html?" +
      query;
  }
  disconnectedCallback() {
    window.removeEventListener("message", this._ready);
    this._listener = null;
  }
}
if (!customElements.get("three-d-rooms-panel"))
  customElements.define("three-d-rooms-panel", ThreeDRoomsPanel);
