import test from "node:test";
import assert from "node:assert/strict";
import { roomRoute } from "../shared/room-route.mjs";
test("room and view deep links preserve only validated navigation keys", () => {
  const route = roomRoute(
    "?native=1&model=kitchen&tab=views&saved_view=kitchen-close-up&view=floor&token=secret",
  );
  assert.equal(route.get("model"), "kitchen");
  assert.equal(route.get("tab"), "views");
  assert.equal(route.get("saved_view"), "kitchen-close-up");
  assert.equal(route.get("view"), "floor");
  assert.equal(route.has("native"), false);
  assert.equal(route.has("token"), false);
  assert.equal(
    roomRoute(
      "?model=../escape&tab=unknown&saved_view=constructor&view=other",
    ).toString(),
    "",
  );
});

test("manager page URL carries the app version so updates are never served stale", async () => {
  const { managerURL } = await import("../shared/room-route.mjs");
  assert.equal(
    managerURL(
      "http://ha.local/three_d_rooms_static/three-d-rooms-card.js?v=0.33.2",
      new URLSearchParams({ native: "1", model: "kitchen" }),
    ),
    "http://ha.local/three_d_rooms_static/index.html?native=1&model=kitchen&v=0.33.2",
  );
  // No or unsafe version: still a valid manager URL.
  assert.equal(
    managerURL("http://ha.local/static/card.js"),
    "http://ha.local/static/index.html?",
  );
  assert.equal(
    managerURL("http://ha.local/static/card.js?v=%3Cscript%3E"),
    "http://ha.local/static/index.html?",
  );
});
