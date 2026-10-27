import test from "node:test";
import assert from "node:assert/strict";
import { validateThumbnail, THUMBNAIL_LIMIT } from "../shared/thumbnail.mjs";
import { validateComponent } from "../shared/component.mjs";
import { Store } from "../server/store.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const jpeg =
  "data:image/jpeg;base64," +
  Buffer.from("ffd8ffc0000b080190028001011100ffd9", "hex").toString("base64");
const view = {
  schemaVersion: 1,
  id: "preview",
  title: "Shared preview",
  height: 500,
  layers: [{ model: "room", view: "front", heading: 0, tilt: 28, zoom: 1 }],
};
test("shared thumbnails survive validation and a fresh store/browser read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rooms-thumbnails-"));
  try {
    const store = await new Store(directory).open();
    store.state.models = [{ id: "room" }];
    await store.putComponent({ ...view, thumbnail: jpeg });
    assert.equal(
      (await new Store(directory).open()).state.components[0].thumbnail,
      jpeg,
    );
    assert.equal(validateComponent(view, ["room"]).thumbnail, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("thumbnail imports reject external, executable, malformed, oversized and wrong-size images", () => {
  assert.equal(validateThumbnail(jpeg), jpeg);
  for (const thumbnail of [
    "https://example.com/image.jpg",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/jpeg;base64,AA==",
    jpeg.replace("/9j/", "ABCD"),
    "x".repeat(THUMBNAIL_LIMIT + 1),
    "data:image/jpeg;base64," +
      Buffer.from("ffd8ffc0000b080001000101011100ffd9", "hex").toString(
        "base64",
      ),
  ])
    assert.throws(() => validateComponent({ ...view, thumbnail }, ["room"]));
});
