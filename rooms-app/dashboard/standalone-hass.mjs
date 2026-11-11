import { callService } from "home-assistant-js-websocket";

/**
 * The few `hass` members the card reads, built from a bare websocket
 * connection so the card can run outside the Home Assistant frontend.
 * `onChange` receives a fresh object whenever states or connectivity change,
 * as the frontend does, because the card refreshes in its `hass` setter.
 */
export function createStandaloneHass({
  auth,
  connection,
  user,
  config,
  origin,
  onChange,
  fetcher = (...args) => fetch(...args),
}) {
  let states = {};
  let connected = true;
  const build = () => ({
    states,
    user,
    config,
    auth,
    connection,
    connected,
    callWS: (message) => connection.sendMessagePromise(message),
    callService: (domain, service, data, target) =>
      callService(connection, domain, service, data, target),
    hassUrl: (path = "") => new URL(path, origin).toString(),
    fetchWithAuth: async (path, init = {}) => {
      if (auth.expired) await auth.refreshAccessToken();
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${auth.accessToken}`);
      return fetcher(new URL(path, origin), { ...init, headers });
    },
  });
  const push = () => onChange(build());
  return {
    build,
    setStates(next) {
      states = next;
      push();
    },
    setConnected(value) {
      if (connected === value) return;
      connected = value;
      push();
    },
  };
}

/** The saved login of this Home Assistant, shared with its own frontend. */
export const tokenStore = (storage) => ({
  loadTokens() {
    try {
      return JSON.parse(storage.getItem("hassTokens"));
    } catch {
      return null;
    }
  },
  saveTokens(tokens) {
    try {
      if (tokens) storage.setItem("hassTokens", JSON.stringify(tokens));
      else storage.removeItem("hassTokens");
    } catch {
      /* Private browsing: the login just will not be remembered. */
    }
  },
});
