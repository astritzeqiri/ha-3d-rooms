import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { validateComponent, componentYaml } from "../shared/component.mjs";
const source =
  (
    await readFile(
      new URL("../web/dashboard-editor.js", import.meta.url),
      "utf8",
    )
  )
    .replace(/^import .*;\n/gm, "")
    .replace("export function", "function") +
  "\nglobalThis.makeEditor=initDashboardEditor;";
function harness() {
  const fields = new Map(),
    calls = [];
  let allowed = true;
  const field = (id) => {
    if (!fields.has(id))
      fields.set(id, {
        value: "",
        hidden: id === "dashboard-panel",
        style: {},
        classList: { toggle() {} },
        validity: { valid: true },
        setAttribute() {},
        addEventListener() {},
        focus() {},
        getBoundingClientRect: () => ({ height: 500 }),
        closest: () => ({ open: false }),
      });
    return fields.get(id);
  };
  const scene = {
    model: { id: "kitchen" },
    options: { mode: "front", heading: 0, tilt: 28, zoom: 1 },
    captureView() {
      return {
        view: this.options.mode,
        heading: this.options.heading,
        tilt: this.options.tilt,
        zoom: this.options.zoom,
      };
    },
    setView(mode) {
      this.options.mode = mode;
    },
  };
  const listeners = new Map(),
    location = { href: "https://rooms.local/?model=kitchen&tab=views" };
  const context = {
    document: {
      getElementById: field,
      activeElement: null,
      body: { classList: { add() {}, remove() {} } },
    },
    window: {
      addEventListener: (n, fn) => listeners.set(n, fn),
      dispatchEvent() {},
    },
    history: { replaceState: (_, __, url) => (location.href = String(url)) },
    location,
    URL,
    structuredClone,
    confirm: () => allowed,
    crypto: { randomUUID: () => "new-view" },
    CustomEvent: class {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    mountCameraNavigation: () => ({ hidden: true }),
    validateComponent,
    componentYaml,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const editor = context.makeEditor({
    api: async (path, options) => {
      calls.push({ path, ...JSON.parse(options.body) });
    },
    model: () => ({ id: "kitchen", title: "Kitchen" }),
    scene: () => scene,
    toast() {},
  });
  return { editor, field, calls, scene, allow: (v) => (allowed = v) };
}
const saved = () => ({
  schemaVersion: 1,
  id: "existing-view",
  title: "Overview",
  height: 500,
  layers: [
    { model: "kitchen", view: "front", heading: 90, tilt: 28, zoom: 1.5 },
  ],
});
test("unified editor preserves existing view ID and saves edits in place", async () => {
  const h = harness();
  h.editor.open(saved());
  h.field("dashboard-title").value = "Updated overview";
  assert.equal(h.editor.dirty(), true);
  await h.field("dashboard-form").onsubmit({ preventDefault() {} });
  assert.equal(h.calls[0].id, "existing-view");
  assert.equal(h.calls[0].title, "Updated overview");
  assert.equal(h.editor.dirty(), false);
  assert.equal(h.editor.close(), true);
});
test("cancelled discard preserves a dirty view and prevents replacing it", () => {
  const h = harness();
  h.editor.open(saved());
  h.field("dashboard-title").value = "Unsaved";
  h.allow(false);
  assert.equal(h.editor.close(), false);
  assert.equal(h.field("dashboard-panel").hidden, false);
  assert.equal(h.editor.open(), false);
  assert.equal(h.field("dashboard-title").value, "Unsaved");
  h.allow(true);
  assert.equal(h.editor.close(), true);
  assert.equal(h.field("dashboard-panel").hidden, true);
});
test("new and duplicated views save under their own IDs", async () => {
  const h = harness();
  h.editor.open();
  await h.field("dashboard-form").onsubmit({ preventDefault() {} });
  assert.equal(h.calls[0].id, "new-view");
  h.editor.open({ ...saved(), id: "copied-view" }, { draft: true });
  assert.match(h.field("dashboard-save-state").textContent, /Not saved/);
  await h.field("dashboard-form").onsubmit({ preventDefault() {} });
  assert.equal(h.calls[1].id, "copied-view");
});

test("resizing a saved view does not create edits, but retains real unsaved changes", () => {
  const h = harness();
  h.editor.open(saved());
  h.scene.options.zoom = 2;
  h.scene.options.onCameraChange({ source: "resize" });
  assert.equal(h.editor.dirty(), false);
  h.field("dashboard-title").value = "Unsaved rename";
  h.scene.options.zoom = 2.5;
  h.scene.options.onCameraChange({ source: "resize" });
  assert.equal(h.editor.dirty(), true);
});

test("opening a view normalizes its camera without reporting a user edit", () => {
  const h = harness();
  h.scene.captureView = function () {
    return {
      view: this.options.mode,
      heading: this.options.heading + 0.01,
      tilt: this.options.tilt,
      zoom: this.options.zoom,
    };
  };
  h.editor.open(saved());
  assert.equal(h.editor.dirty(), false);
  assert.equal(h.field("dashboard-save-state").textContent, "Saved view");
  assert.equal(h.field("use-saved-view").hidden, false);
  h.scene.options.onCameraChange({ source: "orbit" });
  assert.equal(h.editor.dirty(), true);
});
