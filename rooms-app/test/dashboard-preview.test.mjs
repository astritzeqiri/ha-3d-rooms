import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { BACKGROUND_FIELDS } from "../shared/backdrop.mjs";

const source = (
  await readFile(new URL("../dashboard/preview.js", import.meta.url), "utf8")
)
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export function", "function");

function preview(component) {
  const configs = [];
  const element = () => ({
    dataset: {},
    append() {},
    setAttribute() {},
    addEventListener() {},
    showModal() {},
    remove() {},
    querySelector: () => element(),
    querySelectorAll: () => [],
  });
  const context = {
    BACKGROUND_FIELDS,
    structuredClone,
    Promise,
    document: {
      createElement: (tag) =>
        tag === "three-d-rooms-card"
          ? { setConfig: (config) => configs.push(config) }
          : element(),
    },
  };
  vm.runInNewContext(
    `${source}\nglobalThis.open = openDashboardPreview;`,
    context,
  );
  context.open({ append() {} }, component, {});
  return configs[0];
}

const view = (extra = {}) => ({
  title: "House",
  height: 500,
  layers: [{ model: "house", view: "front", heading: 0, tilt: 28, zoom: 1 }],
  ...extra,
});

test("the dashboard preview shows the view's unsaved background", () => {
  const config = preview(view({ background: "sky", background_shadow: false }));
  assert.equal(config.background, "sky");
  assert.equal(config.background_shadow, false);
  assert.equal(Object.hasOwn(config, "background_image"), false);
  const image = preview(
    view({ background: "image", background_image: "/local/a.jpg" }),
  );
  assert.equal(image.background_image, "/local/a.jpg");
});

test("a view with no background leaves the card on its default", () => {
  const config = preview(view());
  for (const key of BACKGROUND_FIELDS)
    assert.equal(Object.hasOwn(config, key), false);
});
