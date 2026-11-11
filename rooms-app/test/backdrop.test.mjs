import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUNDS,
  backdropVars,
  effectiveElevation,
  groundShadowEnabled,
  needsTransparentCanvas,
  safeImageUrl,
  tone,
  validateBackground,
} from "../shared/backdrop.mjs";

test("every preset validates and unknown ones are rejected", () => {
  for (const background of BACKGROUNDS)
    validateBackground({
      background,
      ...(background === "image" ? { background_image: "/local/a.jpg" } : {}),
    });
  assert.throws(() => validateBackground({ background: "neon" }));
  assert.throws(() => validateBackground({ background: "image" }));
  assert.throws(() => validateBackground({ background_shadow: "yes" }));
});

test("background images must be same-site paths or web addresses", () => {
  assert.equal(safeImageUrl("/local/a.jpg"), "/local/a.jpg");
  assert.equal(
    safeImageUrl("https://example.com/a.jpg"),
    "https://example.com/a.jpg",
  );
  for (const bad of [
    "javascript:alert(1)",
    "data:image/png;base64,AA",
    "//evil.test/a.png",
    "",
  ])
    assert.equal(safeImageUrl(bad), "");
  assert.throws(() =>
    validateBackground({
      background: "image",
      background_image: "javascript:alert(1)",
    }),
  );
});

test("a hostile image address cannot break out of the CSS url()", () => {
  const vars = backdropVars("image", "day", '/a.jpg");background:red;/*');
  assert.equal(vars["--bd-image"], 'url("/a.jpg\\");background:red;/*")');
  assert.equal(
    backdropVars("image", "day", "/a b.jpg")["--bd-image"],
    undefined,
  );
});

test("only the classic fill keeps an opaque canvas", () => {
  assert.equal(needsTransparentCanvas("classic"), false);
  for (const id of BACKGROUNDS.filter((id) => id !== "classic"))
    assert.equal(needsTransparentCanvas(id), true);
});

test("the ground shadow is on by default, off for classic and the plan view", () => {
  assert.equal(groundShadowEnabled({}), true);
  assert.equal(groundShadowEnabled({ background_shadow: false }), false);
  assert.equal(groundShadowEnabled({ background: "classic" }), false);
  assert.equal(
    groundShadowEnabled({ background: "classic", background_shadow: true }),
    true,
  );
  assert.equal(groundShadowEnabled({ view: "floor" }), false);
});

test("sky follows the room's Day / Night switch and the real sun", () => {
  assert.equal(tone(effectiveElevation("day")), "day");
  assert.equal(tone(effectiveElevation("night")), "night");
  assert.equal(
    tone(effectiveElevation("auto", { attributes: { elevation: 4 } })),
    "golden",
  );
  assert.equal(
    tone(effectiveElevation("auto", { attributes: { elevation: -4 } })),
    "dusk",
  );
  assert.equal(
    tone(effectiveElevation("auto", { state: "above_horizon" })),
    "day",
  );
  assert.equal(tone(effectiveElevation("auto", undefined)), "night");
});

import { validateComponent } from "../shared/component.mjs";
import { resolveSavedView } from "../shared/saved-view.mjs";
const view = (extra = {}) => ({
  schemaVersion: 1,
  id: "house",
  title: "House",
  height: 500,
  layers: [{ model: "house", view: "front", heading: 0, tilt: 28, zoom: 1 }],
  ...extra,
});

test("a saved view stores its background and omits it when unset", () => {
  assert.equal("background" in validateComponent(view(), ["house"]), false);
  const saved = validateComponent(
    view({
      background: "image",
      background_image: " /local/a.jpg ",
      background_shadow: false,
    }),
    ["house"],
  );
  assert.equal(saved.background, "image");
  assert.equal(saved.background_image, "/local/a.jpg");
  assert.equal(saved.background_shadow, false);
  for (const bad of [
    { background: "neon" },
    { background: "image" },
    { background_image: "javascript:x" },
  ])
    assert.throws(() => validateComponent(view(bad), ["house"]));
});

test("a linked card follows the view's background until it overrides it", () => {
  const components = [view({ background: "sky", background_shadow: false })];
  const linked = resolveSavedView({ saved_view: "house" }, components);
  assert.equal(linked.background, "sky");
  assert.equal(linked.background_shadow, false);
  const own = resolveSavedView(
    { saved_view: "house", background: "grid" },
    components,
  );
  assert.equal(own.background, "grid");
  assert.equal(own.background_shadow, false);
  assert.equal(
    resolveSavedView({ saved_view: "house" }, [view()]).background,
    undefined,
  );
});

import { contentBounds, nextBackgroundState } from "../shared/backdrop.mjs";

test("the picker keeps only choices that differ from the defaults", () => {
  assert.deepEqual(
    nextBackgroundState({ background: "spotlight", shadow: true }),
    {},
  );
  assert.deepEqual(nextBackgroundState({ background: "sky", shadow: true }), {
    background: "sky",
  });
  assert.deepEqual(nextBackgroundState({ background: "grid", shadow: false }), {
    background: "grid",
    background_shadow: false,
  });
  // Classic is flat by default, so a shadow there is the override.
  assert.deepEqual(
    nextBackgroundState({ background: "classic", shadow: false }),
    {
      background: "classic",
    },
  );
  assert.deepEqual(
    nextBackgroundState({ background: "classic", shadow: true }),
    {
      background: "classic",
      background_shadow: true,
    },
  );
  assert.deepEqual(
    nextBackgroundState({
      background: "image",
      image: "  /local/a.jpg ",
      shadow: true,
    }),
    { background: "image", background_image: "/local/a.jpg" },
  );
  // An address only matters for the image background.
  assert.equal(
    "background_image" in
      nextBackgroundState({ background: "sky", image: "/a.jpg", shadow: true }),
    false,
  );
});

test("contentBounds finds the drawn part of a transparent picture", () => {
  const width = 6,
    height = 4,
    data = new Uint8Array(width * height * 4);
  assert.equal(contentBounds(data, width, height), null);
  for (const [x, y] of [
    [2, 1],
    [4, 2],
  ])
    data[(y * width + x) * 4 + 3] = 255;
  assert.deepEqual(contentBounds(data, width, height), {
    left: 2,
    top: 1,
    width: 3,
    height: 2,
  });
});
