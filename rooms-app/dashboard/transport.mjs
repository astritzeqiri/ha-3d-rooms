import { sceneAssetKey } from "../shared/scene-assets.mjs";
import { sceneBlob, sceneOwner } from "../shared/scene-download.mjs";
import { houseLoadPlan } from "../shared/house-floors.mjs";
/**
 * With the floor switcher on, a house card loads the whole house once and
 * reports its views; the card then shows any floor without another load.
 */
export async function connectModel(hass, config, origin, fetcher = fetch) {
  if (!config.preview_url && !config.addon) {
    if (hass.user?.is_admin === false)
      throw new Error("This release requires a Home Assistant administrator.");
    return {
      preview: false,
      async load() {
        const models = await hass.callWS({
          type: "three_d_rooms/request",
          operation: "models",
        });
        const configured = models.find((m) => m.id === config.model);
        if (!configured)
          throw new Error(
            "Model not found. Upload it in the 3D Rooms sidebar first.",
          );
        const { model, floors, views } = houseLoadPlan(
          models,
          configured,
          config.floor_selector !== false,
        );
        if (model.members) {
          const layers = [];
          try {
            for (const member of model.members) {
              const source = models.find((m) => m.id === member.model);
              if (!source) throw new Error("A room in this house is missing.");
              layers.push({
                ...member,
                assetCache: {
                  owner: sceneOwner(hass),
                  key: sceneAssetKey(source),
                },
                url: URL.createObjectURL(await sceneBlob(hass, source)),
              });
            }
            return {
              model,
              configured,
              floors,
              views,
              layers,
              release: () => layers.forEach((l) => URL.revokeObjectURL(l.url)),
            };
          } catch (error) {
            layers.forEach((l) => URL.revokeObjectURL(l.url));
            throw error;
          }
        }
        const sceneURL = URL.createObjectURL(await sceneBlob(hass, model));
        return {
          model,
          configured,
          floors,
          views,
          sceneURL,
          assetCache: { owner: sceneOwner(hass), key: sceneAssetKey(model) },
          release: () => URL.revokeObjectURL(sceneURL),
        };
      },
    };
  }
  let base, session;
  if (config.preview_url) {
    const url = new URL(config.preview_url, origin);
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.origin !== origin
    )
      throw new Error(
        "Preview URLs are only allowed on the same local development server.",
      );
    base = url.href;
    if (!base.endsWith("/")) base += "/";
  } else {
    if (hass.user?.is_admin === false)
      throw new Error(
        "This first version requires a Home Assistant administrator.",
      );
    let addon = config.addon;
    if (!addon) {
      const list = await hass.callWS({
        type: "supervisor/api",
        endpoint: "/addons",
        method: "get",
      });
      const matches = list.addons.filter((a) =>
        a.slug.endsWith("_three_d_rooms"),
      );
      if (matches.length !== 1)
        throw new Error("Set addon to the installed 3D Rooms add-on slug.");
      addon = matches[0].slug;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(addon))
      throw new Error("Invalid add-on slug.");
    const info = await hass.callWS({
      type: "supervisor/api",
      endpoint: `/addons/${addon}/info`,
      method: "get",
    });
    if (info.state !== "started")
      throw new Error("Start the 3D Rooms add-on first.");
    if (!info.ingress_url?.startsWith("/api/hassio_ingress/"))
      throw new Error("This app needs Home Assistant Ingress enabled.");
    const response = await hass.callWS({
      type: "supervisor/api",
      endpoint: "/ingress/session",
      method: "post",
    });
    session = response.session;
    if (typeof session !== "string" || !/^[-_a-zA-Z0-9.]+$/.test(session))
      throw new Error(
        "Home Assistant did not provide a valid Ingress session.",
      );
    base = new URL(info.ingress_url.replace(/\/$/, "") + "/", origin).href;
  }
  return {
    base,
    session,
    preview: !!config.preview_url,
    async load() {
      const response = await fetcher(new URL("api/models", base), {
        credentials: "same-origin",
      });
      if (!response.ok)
        throw new Error(
          "Could not read models. Open the 3D Rooms add-on and try again.",
        );
      const models = await response.json(),
        configured = models.find((m) => m.id === config.model);
      if (!configured)
        throw new Error(
          "Model not found. Upload it in the 3D Rooms add-on first.",
        );
      const { model, floors, views } = houseLoadPlan(
        models,
        configured,
        config.floor_selector !== false,
      );
      if (model.members)
        return {
          model,
          configured,
          floors,
          views,
          layers: model.members.map((member) => ({
            ...member,
            url: new URL(
              `api/models/${encodeURIComponent(member.model)}/scene.glb`,
              base,
            ).href,
          })),
        };
      return {
        model,
        configured,
        floors,
        views,
        sceneURL: new URL(
          `api/models/${encodeURIComponent(model.id)}/scene.glb`,
          base,
        ).href,
      };
    },
  };
}
