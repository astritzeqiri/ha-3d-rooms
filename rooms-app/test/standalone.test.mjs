import test from "node:test";
import assert from "node:assert/strict";
import { standaloneViewURL } from "../shared/component.mjs";
import {
  createStandaloneHass,
  tokenStore,
} from "../dashboard/standalone-hass.mjs";

test("standalone page address is on the Home Assistant origin", () => {
  assert.equal(
    standaloneViewURL("my-house_1", "https://ha.example.com:8123/anything"),
    "https://ha.example.com:8123/three_d_rooms_view/my-house_1",
  );
});

test("hass shim forwards websocket calls and pushes fresh objects", async () => {
  const sent = [];
  const connection = {
    sendMessagePromise: async (message) => (sent.push(message), "ok"),
  };
  const seen = [];
  const shim = createStandaloneHass({
    auth: {},
    connection,
    user: { is_admin: true },
    origin: "https://ha.example.com",
    onChange: (hass) => seen.push(hass),
  });
  assert.equal(await shim.build().callWS({ type: "x" }), "ok");
  assert.deepEqual(sent, [{ type: "x" }]);
  shim.setStates({ "light.a": { state: "on" } });
  shim.setConnected(false);
  shim.setConnected(false);
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0], seen[1]);
  assert.equal(seen[0].states["light.a"].state, "on");
  assert.equal(seen[1].connected, false);
  assert.equal(
    shim.build().hassUrl("/three_d_rooms?model=a"),
    "https://ha.example.com/three_d_rooms?model=a",
  );
});

test("fetchWithAuth refreshes an expired token and sends the bearer", async () => {
  const calls = [];
  const auth = {
    expired: true,
    accessToken: "old",
    async refreshAccessToken() {
      this.expired = false;
      this.accessToken = "new";
    },
  };
  const shim = createStandaloneHass({
    auth,
    connection: {},
    user: {},
    origin: "https://ha.example.com",
    onChange() {},
    fetcher: async (url, init) => (calls.push([String(url), init]), "r"),
  });
  const hass = shim.build();
  assert.equal(await hass.fetchWithAuth("/api/three_d_rooms/x"), "r");
  const [url, init] = calls[0];
  assert.equal(url, "https://ha.example.com/api/three_d_rooms/x");
  assert.equal(init.headers.get("Authorization"), "Bearer new");
});

test("token store shares Home Assistant's saved login and survives bad storage", () => {
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  const store = tokenStore(storage);
  assert.equal(store.loadTokens(), null);
  store.saveTokens({ access_token: "a" });
  assert.equal(store.loadTokens().access_token, "a");
  data.set("hassTokens", "{broken");
  assert.equal(store.loadTokens(), null);
  store.saveTokens(null);
  assert.equal(data.has("hassTokens"), false);
  assert.doesNotThrow(() =>
    tokenStore({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {},
    }).saveTokens({}),
  );
});

import { validateThumbnailArt } from "../shared/thumbnail.mjs";
test("transparent preview art must be a well-formed bounded WebP", () => {
  const riff = (extra = 4) => {
    const size = extra + 8; // payload after "RIFF"+size is "WEBP"+data
    const body = "WEBP" + "x".repeat(size - 4);
    const len = body.length;
    return (
      "RIFF" + String.fromCharCode(len & 255, (len >> 8) & 255, 0, 0) + body
    );
  };
  const url = (bytes) => "data:image/webp;base64," + btoa(bytes);
  assert.equal(validateThumbnailArt(url(riff())), url(riff()));
  assert.throws(() => validateThumbnailArt(url("not a webp file at all!!")));
  assert.throws(() => validateThumbnailArt("data:image/png;base64,AAAA"));
  assert.throws(() => validateThumbnailArt(url(riff().slice(0, -1))));
  assert.throws(() =>
    validateThumbnailArt("data:image/webp;base64," + "A".repeat(140001)),
  );
});
