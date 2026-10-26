import test from "node:test";
import assert from "node:assert/strict";
import { viewThumbnail } from "../web/view-thumbnail.js";

test("thumbnail fits wide and portrait captures and restores legacy camera proportions", () => {
  const previous = globalThis.document;
  let rectangle;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        drawImage: (...args) => {
          rectangle = args.slice(1);
        },
      }),
      toDataURL: () => "data:image/jpeg;base64,preview",
    }),
  };
  try {
    viewThumbnail({ width: 1200, height: 400 });
    assert.deepEqual(rectangle, [0, (400 - 640 / 3) / 2, 640, 640 / 3]);
    viewThumbnail({ width: 400, height: 800 });
    assert.deepEqual(rectangle, [220, 0, 200, 400]);
    viewThumbnail({ width: 320, height: 200 }, 0.5);
    assert.deepEqual(rectangle, [220, 0, 200, 400]);
    assert.throws(() => viewThumbnail({}, 0), /aspect/);
  } finally {
    globalThis.document = previous;
  }
});
