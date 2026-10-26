import test from "node:test";
import assert from "node:assert/strict";
import { uploadJSON, uploadNativeModel } from "../shared/upload.mjs";
function fakeXHR() {
  return {
    upload: {},
    headers: {},
    open(method, url) {
      this.method = method;
      this.url = url;
    },
    setRequestHeader(key, value) {
      this.headers[key] = value;
    },
    send(file) {
      this.file = file;
    },
  };
}
test("upload reports byte progress and waits for server response after bytes finish", async () => {
  const xhr = fakeXHR(),
    events = [],
    file = new Blob(["zip"]);
  let settled = false;
  const result = uploadJSON("/api/models", {
    file,
    createXHR: () => xhr,
    onProgress: (p) => events.push(p),
    onUploaded: () => events.push("processing"),
  }).then((v) => {
    settled = true;
    return v;
  });
  xhr.upload.onprogress({ loaded: 25, total: 100, lengthComputable: true });
  xhr.upload.onprogress({ loaded: 50, lengthComputable: false });
  xhr.upload.onload();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.deepEqual(events, [
    { loaded: 25, total: 100 },
    { loaded: 50, total: null },
    "processing",
  ]);
  assert.equal(xhr.file, file);
  xhr.status = 201;
  xhr.responseText = '{"id":"office"}';
  xhr.onload();
  assert.deepEqual(await result, { id: "office" });
});
test("upload surfaces validation errors, connection failure and cancellation", async () => {
  for (const event of ["onload", "onerror", "onabort"]) {
    const xhr = fakeXHR();
    const promise = uploadJSON("/api/models", { createXHR: () => xhr });
    xhr.status = 400;
    xhr.responseText = '{"error":"Invalid room ZIP"}';
    xhr[event]();
    await assert.rejects(
      promise,
      event === "onload"
        ? /Invalid room ZIP/
        : event === "onerror"
          ? /interrupted/
          : /cancelled/,
    );
  }
});
test("native upload refreshes HA auth and never sends credentials to other paths", async () => {
  const xhr = fakeXHR();
  let refreshed = 0;
  const hass = {
    auth: {
      expired: true,
      accessToken: "old-test-value",
      async refreshAccessToken() {
        refreshed++;
        this.accessToken = "fresh-test-value";
      },
    },
  };
  await assert.rejects(
    uploadNativeModel(hass, "https://other.test/api/models", {
      method: "POST",
    }),
    /Unknown/,
  );
  assert.equal(refreshed, 0);
  const result = uploadNativeModel(hass, "/api/three_d_rooms/models/office", {
    method: "PUT",
    file: "zip",
    createXHR: () => xhr,
  });
  await Promise.resolve();
  assert.equal(refreshed, 1);
  assert.equal(xhr.headers.Authorization, "Bearer fresh-test-value");
  assert.equal(xhr.url, "/api/three_d_rooms/models/office");
  assert.equal(xhr.method, "PUT");
  xhr.status = 200;
  xhr.responseText = '{"id":"office"}';
  xhr.onload();
  assert.equal((await result).id, "office");
});
