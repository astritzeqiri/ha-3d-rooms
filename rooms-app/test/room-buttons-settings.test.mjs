import test from "node:test";
import assert from "node:assert/strict";
import {
  markerTrayHeight,
  validateMarkers,
  validateRoomButtons,
} from "../shared/marker-settings.mjs";

test("a view's room buttons keep a mode other than auto and a position", () => {
  assert.deepEqual(
    validateRoomButtons({
      office: { mode: "always", position: [1, 2.5, -3] },
      hall: { mode: "auto" },
      den: {},
      attic: { mode: "never" },
    }),
    {
      office: { mode: "always", position: [1, 2.5, -3] },
      attic: { mode: "never" },
    },
  );
});

test("room buttons are bounded and strict", () => {
  for (const bad of [
    null,
    [],
    { "Bad Id": {} },
    { office: { mode: "sometimes" } },
    { office: { position: [1, 2] } },
    { office: { position: [1, 2, Infinity] } },
    { office: { position: [1, 2, 5000] } },
    { office: { extra: 1 } },
    { office: [] },
    Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`r${i}`, {}])),
  ])
    assert.throws(() => validateRoomButtons(bad));
});

test("markers carry room buttons beside device settings", () => {
  const markers = validateMarkers({
    lamp: { size: 44 },
    _rooms: { office: { mode: "always" }, hall: {} },
  });
  assert.deepEqual(markers._rooms, { office: { mode: "always" } });
  assert.equal(markers.lamp.size, 44);
  assert.equal("_rooms" in validateMarkers({ _rooms: { hall: {} } }), false);
  assert.throws(() => validateMarkers({ _rooms: { office: { mode: "x" } } }));
  // The tray only counts devices.
  assert.equal(markerTrayHeight({ _rooms: { office: { mode: "always" } } }), 0);
});

test("a room may choose its own opening angle", () => {
  assert.deepEqual(
    validateRoomButtons({
      office: { heading: 90, tilt: 55.5 },
      hall: { tilt: 0 },
    }),
    { office: { heading: 90, tilt: 55.5 }, hall: { tilt: 0 } },
  );
  for (const bad of [
    { heading: 360 },
    { heading: -1 },
    { heading: "90" },
    { tilt: 181 },
    { tilt: NaN },
  ])
    assert.throws(() => validateRoomButtons({ office: bad }));
});

test("a room button can have its own size, and the standard size is not stored", () => {
  assert.deepEqual(
    validateRoomButtons({
      office: { size: 40 },
      hall: { size: 30 },
      den: { size: 24, mode: "always" },
    }),
    { office: { size: 40 }, den: { size: 24, mode: "always" } },
  );
  for (const bad of [19, 65, 30.5, "40", NaN, null])
    assert.throws(() => validateRoomButtons({ office: { size: bad } }));
});

test("saved views accept an automatic height or 180 to 1600 pixels", async () => {
  const { validateComponent } = await import("../shared/component.mjs");
  const view = (height) => ({
    schemaVersion: 1,
    id: "house-view",
    title: "House",
    height,
    layers: [{ model: "house", view: "front", heading: 0, tilt: 28, zoom: 1 }],
  });
  assert.equal(validateComponent(view("auto"), ["house"]).height, "auto");
  assert.equal(validateComponent(view(640), ["house"]).height, 640);
  for (const bad of [179, 1601, 400.5, "400", "Auto", null])
    assert.throws(() => validateComponent(view(bad), ["house"]));
});
