/** Connect the same-origin manager to its HA panel, using HA's current session. */
export async function connectNative() {
  if (new URL(location.href).searchParams.get("native") !== "1") return null;
  if (window.parent === window)
    throw new Error("Open 3D Rooms from the Home Assistant sidebar.");
  const bridge = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("three-d-rooms-connected", ready);
      reject(
        new Error(
          "Could not connect to Home Assistant. Reload the 3D Rooms sidebar.",
        ),
      );
    }, 15000);
    function ready() {
      clearTimeout(timer);
      window.removeEventListener("three-d-rooms-connected", ready);
      resolve(window.threeDRoomsBridge);
    }
    window.addEventListener("three-d-rooms-connected", ready);
    window.parent.postMessage({ type: "three-d-rooms-ready" }, location.origin);
  });
  window.addEventListener("rooms-route-change", () =>
    bridge.navigate?.(location.search),
  );
  const response = async (path, options) => {
    const res = await bridge.asset(path, options);
    if (!res.ok) {
      let message = "Home Assistant could not complete this request.";
      try {
        message = (await res.json()).error || message;
      } catch {}
      throw new Error(message);
    }
    return res;
  };
  return {
    async api(path, options = {}) {
      if (path === "models" && options.method === "POST")
        return (await response("/api/three_d_rooms/models", options)).json();
      if (path === "components")
        return bridge.request(
          options.method === "PUT" ? "save_component" : "components",
          JSON.parse(options.body || "{}"),
        );
      if (path.startsWith("components/") && options.method === "DELETE")
        return bridge.request("delete_component", { id: path.split("/")[1] });
      if (path === "models" || path === "status" || path === "areas")
        return bridge.request(path);
      const match = path.match(
        /^models\/([a-z0-9_-]+)(?:\/(bindings|command|daylight|room))?$/,
      );
      if (!match) throw new Error("Unknown room request.");
      return bridge.request(match[2] || "delete", {
        ...JSON.parse(options.body || "{}"),
        model: match[1],
      });
    },
    async sceneURL(model) {
      return URL.createObjectURL(await bridge.scene(model));
    },
    async exportURL(id) {
      return URL.createObjectURL(
        await (
          await response(
            `/api/three_d_rooms/models/${encodeURIComponent(id)}/export.zip`,
          )
        ).blob(),
      );
    },
    subscribe: bridge.subscribe,
  };
}
