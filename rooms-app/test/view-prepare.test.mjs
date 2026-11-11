import test from "node:test";
import assert from "node:assert/strict";
import { SceneView } from "../web/scene.js";

const house = {
  id: "h",
  houseId: "h",
  houseView: true,
  members: [{ model: "a" }, { model: "b" }],
};
const room = (id) => ({
  ...house,
  members: [{ model: id }],
  focusRoom: id,
});

function sceneView() {
  const calls = [];
  const view = Object.create(SceneView.prototype);
  Object.assign(view, {
    asset: {
      children: [
        { userData: { pickRoom: "a" } },
        { userData: { pickRoom: "b" } },
      ],
    },
    model: house,
    scene: {},
    camera: {},
    shadowsCurrent: true,
    preparedViews: new Map([["a|b", true]]),
    renderer: {
      compileAsync: () => {
        calls.push(["compile", view.model.focusRoom || "house"]);
        return Promise.resolve();
      },
    },
    applyHouseScope() {
      calls.push(["scope", this.model.focusRoom || "house"]);
    },
    refreshVisibility() {
      calls.push(["visibility"]);
    },
  });
  return { view, calls };
}

test("floors and houses that show the same rooms share their shaders", () => {
  const { view } = sceneView();
  const floor = { ...house, members: [{ model: "b" }, { model: "a" }] };
  assert.equal(view.isHouseViewPrepared(floor), true, "same rooms, any order");
  assert.equal(view.isHouseViewPrepared(room("a")), false);
  assert.equal(view.isHouseViewPrepared({ id: "plain" }), true, "not a house");
});

test("preparing a room compiles its shaders without changing what is shown", async () => {
  const { view, calls } = sceneView();
  assert.equal(view.isHouseViewPrepared(house), true, "already drawn");
  assert.equal(view.isHouseViewPrepared(room("a")), false);
  assert.equal(await view.prepareHouseView(room("a")), true);
  assert.deepEqual(calls, [
    ["scope", "a"],
    ["compile", "a"],
    ["scope", "house"],
    ["visibility"],
  ]);
  assert.equal(view.model, house, "the shown view is restored");
  assert.equal(view.renderSuspended, false);
  assert.equal(view.shadowsCurrent, true, "no shadow refresh is forced");
  assert.equal(view.isHouseViewPrepared(room("a")), true);
  // Prepared once; later switches and repeats do no work.
  calls.length = 0;
  assert.equal(await view.prepareHouseView(room("a")), true);
  assert.deepEqual(calls, []);
});

test("two requests for the same view share one compile", async () => {
  const { view, calls } = sceneView();
  const first = view.prepareHouseView(room("b")),
    second = view.prepareHouseView(room("b"));
  assert.equal(first, second);
  await first;
  assert.equal(calls.filter(([name]) => name === "compile").length, 1);
});

test("a view the loaded house cannot show is not prepared", async () => {
  const { view, calls } = sceneView();
  assert.equal(await view.prepareHouseView(room("missing")), false);
  assert.equal(
    await view.prepareHouseView({ ...room("a"), houseId: "other" }),
    false,
  );
  assert.deepEqual(calls, []);
});

test("a failed compile still restores the shown view and lets the switch go on", async () => {
  const { view, calls } = sceneView();
  view.renderer.compileAsync = () => {
    throw new Error("no context");
  };
  assert.equal(await view.prepareHouseView(room("a")), true);
  assert.equal(view.model, house);
  assert.equal(view.renderSuspended, false);
  assert.deepEqual(calls.at(-1), ["visibility"]);
});

test("shaders prepared for a replaced scene do not count for the new one", async () => {
  const { view } = sceneView();
  let finish;
  view.renderer.compileAsync = () =>
    new Promise((done) => {
      finish = done;
    });
  const pending = view.prepareHouseView(room("a"));
  view.preparedViews = new Map();
  finish();
  assert.equal(await pending, false);
  assert.equal(view.isHouseViewPrepared(room("a")), false);
});
