import test from "node:test";
import assert from "node:assert/strict";
import { floorFrame } from "../shared/floor-view.mjs";
import { connectModel } from "../dashboard/transport.mjs";
test("floor framing contains every corner on portrait, landscape and rotated models", () => {
  for (const aspect of [0.45, 1, 2.4])
    for (const heading of [0, 45, 90, 180])
      for (const tilt of [0, 8, 35]) {
        const min = [-5, 0, -8],
          max = [5, 3, 8],
          f = floorFrame(min, max, aspect, tilt, heading);
        const normal = f.position.map((v, i) => v - f.target[i]),
          length = Math.hypot(...normal),
          n = normal.map((v) => v / length);
        const right = [
          f.up[1] * n[2] - f.up[2] * n[1],
          f.up[2] * n[0] - f.up[0] * n[2],
          f.up[0] * n[1] - f.up[1] * n[0],
        ];
        for (const x of [min[0], max[0]])
          for (const y of [min[1], max[1]])
            for (const z of [min[2], max[2]]) {
              const v = [x, y, z].map((c, i) => c - f.target[i]);
              assert.ok(
                Math.abs(v.reduce((sum, c, i) => sum + c * right[i], 0)) <=
                  f.right,
              );
              assert.ok(
                Math.abs(v.reduce((sum, c, i) => sum + c * f.up[i], 0)) <=
                  f.top,
              );
            }
      }
  assert.throws(() => floorFrame([0, 0, 0], [1, 1, 1], 0));
});
test("dashboard uses an authenticated Ingress session and model-specific scene URL", async () => {
  const calls = [],
    hass = {
      user: { is_admin: true },
      async callWS(message) {
        calls.push(message);
        if (message.endpoint === "/addons")
          return { addons: [{ slug: "local_three_d_rooms" }] };
        if (message.endpoint.endsWith("/info"))
          return {
            state: "started",
            ingress_url: "/api/hassio_ingress/app-route",
          };
        return { session: "example-session" };
      },
    };
  const connection = await connectModel(
    hass,
    { model: "kitchen", addon: "local_three_d_rooms" },
    "https://home.example",
    async (url, options) => {
      assert.equal(
        url.href,
        "https://home.example/api/hassio_ingress/app-route/api/models",
      );
      assert.equal(options.credentials, "same-origin");
      return {
        ok: true,
        json: async () => [{ id: "kitchen", controls: [], bindings: {} }],
      };
    },
  );
  assert.equal(connection.session, "example-session");
  assert.equal(
    (await connection.load()).sceneURL,
    "https://home.example/api/hassio_ingress/app-route/api/models/kitchen/scene.glb",
  );
  assert.equal(calls.at(-1).endpoint, "/ingress/session");
});
test("dashboard refuses cross-origin preview URLs, non-admin access and missing models", async () => {
  await assert.rejects(
    connectModel(
      {},
      { model: "kitchen", preview_url: "https://other.example" },
      "https://home.example",
    ),
    /Preview/,
  );
  await assert.rejects(
    connectModel(
      { user: { is_admin: false } },
      { model: "kitchen" },
      "https://home.example",
    ),
    /administrator/,
  );
  const c = await connectModel(
    {},
    { model: "missing", preview_url: "http://127.0.0.1:5190/" },
    "http://127.0.0.1:5190",
    async () => ({ ok: true, json: async () => [] }),
  );
  await assert.rejects(c.load(), /Model not found/);
});

test("front perspective keeps all bounds inside the viewport across screen shapes and headings", async () => {
  const { perspectiveFrame } = await import("../shared/floor-view.mjs");
  for (const aspect of [0.45, 1, 2.4])
    for (const heading of [0, 45, 90, 180])
      for (const tilt of [0, 28, 35]) {
        const min = [-5, 0, -8],
          max = [5, 3, 8],
          f = perspectiveFrame(min, max, aspect, tilt, heading);
        const offset = f.position.map((v, i) => v - f.target[i]),
          distance = Math.hypot(...offset),
          normal = offset.map((v) => v / distance);
        const right = [
          f.up[1] * normal[2] - f.up[2] * normal[1],
          f.up[2] * normal[0] - f.up[0] * normal[2],
          f.up[0] * normal[1] - f.up[1] * normal[0],
        ];
        const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
          tangent = Math.tan((f.fov * Math.PI) / 360);
        for (let corner = 0; corner < 8; corner++) {
          const v = min.map(
              (value, i) => ((corner >> i) & 1 ? max[i] : value) - f.target[i],
            ),
            depth = distance - dot(v, normal);
          assert.ok(depth > f.near);
          assert.ok(Math.abs(dot(v, right)) / (depth * tangent * aspect) < 1);
          assert.ok(Math.abs(dot(v, f.up)) / (depth * tangent) < 1);
        }
      }
});

test("native integration transport uses HA session authentication and releases private scene URLs", async () => {
  const calls = [];
  const hass = {
    user: { is_admin: true },
    callWS: async (msg) => {
      calls.push(msg);
      return [{ id: "kitchen", controls: [], bindings: {} }];
    },
    fetchWithAuth: async (path) => {
      calls.push(path);
      return new Response(new Blob(["scene"]));
    },
  };
  const connection = await connectModel(
    hass,
    { model: "kitchen" },
    "https://home.example",
  );
  const { model, sceneURL, release } = await connection.load();
  assert.equal(model.id, "kitchen");
  assert.deepEqual(calls, [
    { type: "three_d_rooms/request", operation: "models" },
    "/api/three_d_rooms/models/kitchen/scene.glb?v=legacy",
  ]);
  assert.ok(sceneURL.startsWith("blob:"));
  release();
  await assert.rejects(fetch(sceneURL));
  await assert.rejects(
    (
      await connectModel(hass, { model: "missing" }, "https://home.example")
    ).load(),
    /Model not found/,
  );
});
