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
