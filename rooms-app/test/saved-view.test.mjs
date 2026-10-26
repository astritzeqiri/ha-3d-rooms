import test from "node:test";
import assert from "node:assert/strict";
import { resolveSavedView } from "../shared/saved-view.mjs";
const saved = () => ({
  id: "office",
  title: "Office",
  height: 500,
  layers: [
    {
      model: "office",
      view: "front",
      heading: 80,
      tilt: 40,
      zoom: 2,
      camera: { target: [1, 2, 3] },
    },
  ],
});
test("linked cards follow edits while preserving explicit overrides, including false and empty values", () => {
  const view = saved();
  const config = {
    saved_view: "office",
    zoom: 3,
    interactive: false,
    title: "",
  };
  let result = resolveSavedView(config, [view]);
  assert.equal(result.zoom, 3);
  assert.equal(result.title, "");
  assert.equal(result.interactive, false);
  result.camera.target[0] = 99;
  assert.equal(view.layers[0].camera.target[0], 1);
  view.height = 700;
  view.layers[0].heading = 100;
  result = resolveSavedView(config, [view]);
  assert.equal(result.height, 700);
  assert.equal(result.heading, 100);
  assert.equal(result.zoom, 3);
  assert.equal(config.height, undefined);
});
test("room or projection overrides discard incompatible geometry; numeric overrides retain it", () => {
  for (const override of [{ model: "kitchen" }, { view: "floor" }])
    assert.equal(
      resolveSavedView({ saved_view: "office", ...override }, [saved()]).camera,
      undefined,
    );
  assert.ok(
    resolveSavedView({ saved_view: "office", zoom: 4 }, [saved()]).camera,
  );
});
test("missing saved views produce an actionable error and standalone cards retain values", () => {
  assert.throws(
    () => resolveSavedView({ saved_view: "missing" }, []),
    /Saved view not found/,
  );
  assert.deepEqual(resolveSavedView({ model: "office", zoom: 2 }), {
    model: "office",
    zoom: 2,
  });
});

test("title visibility follows the saved view and allows a per-card override", () => {
  const view = saved();
  assert.equal(
    resolveSavedView({ saved_view: view.id }, [view]).show_title,
    true,
  );
  view.show_title = false;
  assert.equal(
    resolveSavedView({ saved_view: view.id }, [view]).show_title,
    false,
  );
  assert.equal(
    resolveSavedView({ saved_view: view.id, show_title: true }, [view])
      .show_title,
    true,
  );
});
