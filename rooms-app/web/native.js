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
    moreInfo: bridge.moreInfo,
    preview: (component) => bridge.preview(component),
    async api(path, options = {}) {
      if (path === "models" && options.method === "POST")
        return bridge.upload("/api/three_d_rooms/models", options);
      const house = path.match(/^houses\/([a-z0-9_-]+)$/);
      if (house) {
        if (["POST", "PUT"].includes(options.method))
          return bridge.upload(
            `/api/three_d_rooms/houses/${house[1]}`,
            options,
          );
        return bridge.request(
          options.method === "DELETE" ? "delete_house" : "house_summary",
          {
            ...JSON.parse(options.body || "{}"),
            house: house[1],
          },
        );
      }
      const replacement = path.match(/^models\/([a-z0-9_-]+)$/);
      if (replacement && options.method === "PUT")
        return bridge.upload(
          `/api/three_d_rooms/models/${replacement[1]}`,
          options,
        );
      if (path === "components")
        return bridge.request(
          options.method === "PUT" ? "save_component" : "components",
          options.method === "PUT"
            ? JSON.parse(options.body || "{}")
            : { include_thumbnails: true },
        );
      if (path.startsWith("components/") && options.method === "DELETE")
        return bridge.request("delete_component", { id: path.split("/")[1] });
      if (
        path === "models" ||
        path === "status" ||
        path === "areas" ||
        path === "floors"
      )
        return bridge.request(path);
      const match = path.match(
        /^models\/([a-z0-9_-]+)(?:\/(bindings|command|daylight|room|device-settings|device-visibility|device-marker|light-groups))?$/,
      );
      if (!match) throw new Error("Unknown room request.");
      return bridge.request(match[2] || "delete", {
        ...JSON.parse(options.body || "{}"),
        model: match[1],
      });
    },
    async sceneURL(model) {
      return URL.createObjectURL(await bridge.scene(model, "full"));
    },
    /** Primitives for the browser optimizer (web/room-optimizer.js). */
    optimizer: {
      optimization: (id) => bridge.request("optimization", { model: id }),
      async originalScene(id) {
        const res = await response(
          `/api/three_d_rooms/models/${encodeURIComponent(id)}/scene.glb?variant=original`,
        );
        return new Uint8Array(await res.arrayBuffer());
      },
      uploadOptimized: (id, variant, bytes, sourceRevision) =>
        bridge.upload(`/api/three_d_rooms/models/${id}/optimized/${variant}`, {
          method: "PUT",
          file: new Blob([bytes], { type: "model/gltf-binary" }),
          headers: { "X-Rooms-Source-Revision": sourceRevision },
        }),
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
    entityIcon: (state) => bridge.entityIcon?.(state) ?? Promise.resolve(null),
    subscribe: bridge.subscribe,
    subscribeModels: bridge.subscribeModels,
  };
}
