import {
  createConnection,
  getAuth,
  getConfig,
  subscribeEntities,
} from "home-assistant-js-websocket";
import { createStandaloneHass, tokenStore } from "./standalone-hass.mjs";
import {
  createIconResolver,
  defineStateIcon,
  registryIcons,
} from "./standalone-icons.mjs";
import { openMoreInfo } from "./more-info.mjs";
import { fitPage } from "./standalone-fit.mjs";
/**
 * Full-screen page for one saved dashboard view, with no Home Assistant
 * chrome. The card bundle is loaded by the page beside this script.
 */
// Size the page before anything is drawn (iOS home-screen apps misreport it).
fitPage();
const status = document.getElementById("status");
const say = (text) => {
  status.hidden = false;
  status.textContent = text;
};
async function start() {
  const view = document.body.dataset.view;
  await customElements.whenDefined("three-d-rooms-card");
  const auth = await getAuth({
    hassUrl: location.origin,
    ...tokenStore(localStorage),
  });
  // Back from the Home Assistant login: leave the one-time code out of the URL.
  const clean = new URL(location.href);
  for (const key of ["auth_callback", "code", "state"])
    clean.searchParams.delete(key);
  history.replaceState(null, "", clean);
  const connection = await createConnection({ auth });
  const user = await connection.sendMessagePromise({
    type: "auth/current_user",
  });
  if (!user.is_admin) {
    say("3D Rooms views are only available to Home Assistant administrators.");
    return;
  }
  // Home Assistant draws marker icons with its own elements, which this page
  // lacks. Custom icon sets live in the user's frontend modules: loaded on need.
  const loadModules = async () => {
    const urls = new Set(JSON.parse(document.body.dataset.modules || "[]"));
    try {
      const resources = await connection.sendMessagePromise({
        type: "lovelace/resources",
      });
      for (const r of resources) if (r.type === "module") urls.add(r.url);
    } catch {
      /* Resources are optional. */
    }
    await Promise.allSettled(
      [...urls]
        .filter((url) => !url.includes("/three_d_rooms_static/"))
        .map(
          (url) =>
            import(/* @vite-ignore */ new URL(url, location.origin).href),
        ),
    );
  };
  const registry = await connection
    .sendMessagePromise({ type: "config/entity_registry/list_for_display" })
    .catch(() => null);
  defineStateIcon({
    resolver: createIconResolver({ loadModules }),
    registryIcon: registryIcons(registry),
  });
  const config = await getConfig(connection).catch(() => ({}));
  const card = document.createElement("three-d-rooms-card");
  // `height: auto` fills the screen. Home Assistant's more-info dialog is part
  // of its own frontend, so the Edit shortcut to the manager is left out.
  card.setConfig({ saved_view: view, height: "auto", edit_button: false });
  // Sized by the page and kept clear of the iPhone status bar and notch.
  card.setAttribute("fill-page", "");
  const standalone = createStandaloneHass({
    auth,
    connection,
    user,
    config,
    origin: location.origin,
    onChange: (hass) => {
      card.hass = hass;
      info?.update();
    },
  });
  // Hold (or a non-toggle tap) asks for the entity's pop-up, which Home
  // Assistant's frontend would show; this page has its own compact one.
  let info;
  card.addEventListener("hass-more-info", (event) => {
    info?.close();
    info = openMoreInfo({
      host: document.body,
      getHass: () => standalone.build(),
      entityId: event.detail.entityId,
      onError: (error) => console.error(error),
    });
  });
  connection.addEventListener("ready", () => standalone.setConnected(true));
  connection.addEventListener("disconnected", () =>
    standalone.setConnected(false),
  );
  // Show the room only once states exist, so devices never flash as unavailable.
  await new Promise((resolve) =>
    subscribeEntities(connection, (states) => {
      standalone.setStates(states);
      resolve();
    }),
  );
  card.hass = standalone.build();
  status.hidden = true;
  document.body.append(card);
}
start().catch((error) => {
  console.error(error);
  say(
    error?.message ||
      "Could not connect to Home Assistant. Reload to try again.",
  );
});
