import test from "node:test";
import assert from "node:assert/strict";
import { uploadProgress } from "../web/upload-progress.js";
test("upload UI shows real percentage, distinct processing stages, and retry state", () => {
  const bar = {
      value: null,
      removeAttribute() {
        this.value = null;
      },
    },
    label = {},
    detail = {};
  const box = {
    hidden: true,
    querySelector(selector) {
      return selector === "progress"
        ? bar
        : selector === "[data-upload-label]"
          ? label
          : detail;
    },
  };
  const previous = globalThis.document;
  globalThis.document = { getElementById: () => box };
  try {
    const ui = uploadProgress("replace");
    assert.equal(box.hidden, false);
    assert.equal(bar.value, 0);
    ui.onProgress({ loaded: 3 * 1024 * 1024, total: 4 * 1024 * 1024 });
    assert.equal(bar.value, 75);
    assert.match(label.textContent, /75%/);
    assert.equal(detail.textContent, "3.0 of 4.0 MB");
    ui.onUploaded();
    assert.equal(bar.value, null);
    assert.match(label.textContent, /Processing/);
    ui.preparing();
    assert.match(label.textContent, /Preparing/);
    ui.complete();
    assert.equal(bar.value, 100);
    assert.equal(label.textContent, "Model ready");
    ui.failed();
    assert.match(label.textContent, /could not/);
    const retry = uploadProgress("replace");
    assert.equal(bar.value, 0);
    retry.onProgress({ loaded: 1024 * 1024, total: null });
    assert.equal(bar.value, null);
    assert.equal(detail.textContent, "1.0 MB sent");
    assert.doesNotMatch(label.textContent, /%/);
  } finally {
    globalThis.document = previous;
  }
});
