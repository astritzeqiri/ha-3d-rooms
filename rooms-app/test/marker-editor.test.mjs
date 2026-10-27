import test from "node:test";
import assert from "node:assert/strict";
import { initMarkerEditor } from "../web/marker-editor.js";

function harness() {
  class Element {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {} };
      this.options = [24, 32, 44, 56].map((value) => ({
        value: String(value),
      }));
      this.listeners = {};
      this.nodes = new Map();
      this.open = false;
    }
    set innerHTML(value) {
      this.html = value;
      for (const key of ["visible", "show_label", "placement", "size"]) {
        const el = this.querySelector(`[data-setting="${key}"]`);
        el.dataset.setting = key;
        el.type = ["visible", "show_label"].includes(key)
          ? "checkbox"
          : "select";
        el.textContent = key;
      }
      this.axes = [0, 1, 2].map((axis) => {
        const el = new Element();
        el.dataset.axis = String(axis);
        return el;
      });
    }
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll(selector) {
      if (selector === "[data-axis]") return this.axes;
      const fields = ["visible", "show_label", "placement", "size"].map((key) =>
        this.querySelector(`[data-setting="${key}"]`),
      );
      return selector === "[data-setting]" ? fields : [...fields, ...this.axes];
    }
    append(el) {
      el.parentElement?.removeChild(el);
      this.children.push(el);
      el.parentElement = this;
    }
    removeChild(el) {
      this.children = this.children.filter((child) => child !== el);
    }
    after() {}
    remove() {}
    replaceChildren() {
      this.children = [];
    }
    setAttribute(key, value) {
      this[key] = value;
    }
    scrollIntoView() {}
    focus() {
      document.activeElement = this;
    }
    blur() {
      document.activeElement = null;
    }
    contains(el) {
      return (
        this === el ||
        [...this.nodes.values()].includes(el) ||
        this.children.includes(el)
      );
    }
    addEventListener(key, fn) {
      this.listeners[key] = fn;
    }
    setPointerCapture() {
      this.captured = true;
    }
    hasPointerCapture() {
      return this.captured;
    }
    releasePointerCapture() {
      this.captured = false;
    }
  }
  const fields = new Map();
  const document = {
    getElementById(id) {
      if (!fields.has(id)) fields.set(id, new Element());
      return fields.get(id);
    },
    createElement: () => new Element(),
    addEventListener(key, fn) {
      this[key] = fn;
    },
  };
  globalThis.document = document;
  const scene = {
    options: {},
    fixtures: new Map(),
    orbit: { enabled: true },
    render() {},
    fixtureScreenPosition: () => ({ visible: true, x: 100, y: 100 }),
    fixturePosition: () => [1, 2, 3],
    pickMarkerPosition: (x) => (x < 0 ? null : [x, 4, 5]),
  };
  let changed = 0;
  const editor = initMarkerEditor({
    model: () => ({
      controls: [
        { id: "light", label: "Light", type: "light" },
        { id: "shade", label: "Shade", type: "cover" },
      ],
    }),
    scene: () => scene,
    onChange: () => changed++,
  });
  editor.open();
  const picker = fields.get("dashboard-marker-settings").children[0];
  const viewport = fields.get("viewport");
  viewport.clientWidth = 386;
  viewport.clientHeight = 380;
  const inspector = viewport.children.find(
    (el) => el.className === "marker-floating-tools",
  );
  const rows = inspector.children;
  const event = (x = 10, y = 10) => ({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target: { closest: () => null },
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  return {
    editor,
    picker,
    inspector,
    rows,
    viewport,
    document,
    scene,
    event,
    changed: () => changed,
  };
}

test("device selection opens exactly one tools panel and highlights the matching icon", () => {
  const h = harness();
  const select = (id) => {
    h.picker.value = id;
    h.picker.onchange();
  };
  select("light");
  assert.equal(h.rows[0].open, true);
  select("shade");
  assert.deepEqual(
    h.rows.map((row) => row.open),
    [false, true],
  );
  h.rows[1].querySelector("[data-close]").onclick();
  assert.equal(h.inspector.hidden, true);
  assert.deepEqual(
    h.rows.map((row) => row.open),
    [false, false],
  );
  h.editor.close();
});

test("marker drag commits only a valid surface drop and restores camera controls", () => {
  const h = harness();
  const start = () => {
    const e = h.event();
    e.target.closest = () => ({ dataset: { markerId: "light" } });
    h.viewport.listeners.pointerdown(e);
  };
  start();
  assert.equal(h.scene.orbit.enabled, false);
  h.viewport.listeners.pointermove(h.event(20, 20));
  assert.deepEqual(h.editor.read(), {});
  assert.equal(h.changed(), 0);
  h.viewport.listeners.pointerup(h.event(20, 20));
  assert.deepEqual(h.editor.read().light.offset, [19, 2, 2]);
  assert.equal(h.changed(), 1);
  assert.equal(h.scene.orbit.enabled, true);
  start();
  h.viewport.listeners.pointermove(h.event(30, 30));
  h.document.keydown({ ...h.event(), key: "Escape" });
  assert.deepEqual(h.editor.read().light.offset, [19, 2, 2]);
  assert.equal(h.scene.orbit.enabled, true);
  start();
  h.viewport.listeners.pointermove(h.event(40, 40));
  h.viewport.listeners.pointerup(h.event(-1, 40));
  assert.deepEqual(h.editor.read().light.offset, [19, 2, 2]);
  assert.equal(h.changed(), 1);
  h.editor.close();
});

test("floating icon tools disclose appearance and position separately", () => {
  const h = harness();
  h.picker.value = "light";
  h.picker.onchange();
  const row = h.rows[0],
    appearance = row.querySelector(".marker-appearance"),
    position = row.querySelector(".marker-position");
  assert.equal(appearance.hidden, true);
  assert.equal(position.hidden, true);
  row.querySelector("[data-style]").onclick();
  assert.equal(appearance.hidden, false);
  assert.equal(position.hidden, true);
  row.querySelector("[data-more]").onclick();
  assert.equal(appearance.hidden, true);
  assert.equal(position.hidden, false);
  h.document.keydown({ ...h.event(), key: "Escape" });
  assert.equal(h.inspector.hidden, true);
  h.editor.close();
});

test("four satellite actions surround the icon with separate reachable targets", () => {
  const h = harness();
  h.picker.value = "light";
  h.picker.onchange();
  const row = h.rows[0];
  const points = ["undo", "style", "more", "eye"].map((key) => {
    const button = row.querySelector(`[data-${key}]`);
    return [parseFloat(button.style.left), parseFloat(button.style.top)];
  });
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      assert.ok(
        Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) >=
          44,
      );
  h.editor.close();
});

test("per-device undo restores edits and reset without changing another device", () => {
  const h = harness(),
    light = h.rows[0],
    shade = h.rows[1];
  const undo = light.querySelector("[data-undo]");
  assert.equal(undo.disabled, true);
  const size = light.querySelector('[data-setting="size"]');
  size.value = "44";
  size.onchange();
  const labels = shade.querySelector('[data-setting="show_label"]');
  labels.checked = false;
  labels.onchange();
  assert.equal(undo.disabled, false);
  undo.onclick();
  assert.equal(h.editor.read().light, undefined);
  assert.equal(h.editor.read().shade.show_label, false);
  assert.equal(undo.disabled, true);
  const start = h.event();
  start.target.closest = () => ({ dataset: { markerId: "light" } });
  h.viewport.listeners.pointerdown(start);
  h.viewport.listeners.pointermove(h.event(20, 20));
  h.viewport.listeners.pointerup(h.event(20, 20));
  const offset = h.editor.read().light.offset;
  light.querySelector("[data-reset]").onclick();
  assert.equal(h.editor.read().light.offset, undefined);
  undo.onclick();
  assert.deepEqual(h.editor.read().light.offset, offset);
  undo.onclick();
  assert.equal(h.editor.read().light, undefined);
  assert.equal(h.editor.read().shade.show_label, false);
  h.editor.close();
});
test("default drag keeps simple clicks as selection and does not add undo history", () => {
  const h = harness();
  const down = h.event();
  down.target.closest = () => ({ dataset: { markerId: "light" } });
  h.viewport.listeners.pointerdown(down);
  h.viewport.listeners.pointerup(h.event());
  assert.equal(h.rows[0].open, true);
  assert.equal(h.rows[0].querySelector("[data-undo]").disabled, true);
  assert.equal(h.changed(), 0);
  assert.equal(h.scene.orbit.enabled, true);
  h.viewport.listeners.pointerdown(down);
  h.viewport.listeners.pointerup(h.event());
  assert.equal(h.inspector.hidden, true);
  h.editor.close();
});

test("hidden editor markers remain clickable with a Hidden pill even when state labels are off", () => {
  const h = harness(),
    row = h.rows[0];
  const visible = row.querySelector('[data-setting="visible"]');
  const labels = row.querySelector('[data-setting="show_label"]');
  labels.checked = false;
  labels.onchange();
  visible.checked = false;
  visible.onchange();
  const layer = h.viewport.children.find(
    (el) => el.className === "marker-editor-overlay",
  );
  const button = layer.children.find((el) => el.dataset.markerId === "light");
  assert.equal(button.hidden, false);
  assert.equal(button.dataset.hidden, "true");
  const badge = button.querySelector(".marker-editor-badge");
  assert.equal(badge.textContent, "Hidden");
  assert.equal(badge.hidden, false);
  button.onclick();
  assert.equal(row.open, true);
  visible.checked = true;
  visible.onchange();
  assert.equal(button.dataset.hidden, "false");
  assert.equal(badge.hidden, true);
  const placement = row.querySelector('[data-setting="placement"]');
  placement.value = "tray";
  placement.onchange();
  visible.checked = false;
  visible.onchange();
  assert.equal(button.hidden, false);
  assert.equal(badge.textContent, "Hidden");
  h.editor.close();
});

test("eye action toggles visibility, checkbox, Hidden pill and undo together", () => {
  const h = harness(),
    row = h.rows[0],
    eye = row.querySelector("[data-eye]");
  assert.equal(eye["aria-label"], "Light: Hide icon");
  eye.onclick();
  assert.equal(h.editor.read().light.visible, false);
  assert.equal(row.querySelector('[data-setting="visible"]').checked, false);
  assert.equal(eye["aria-label"], "Light: Show icon");
  assert.equal(eye["aria-pressed"], "true");
  eye.onclick();
  assert.equal(h.editor.read().light.visible, true);
  row.querySelector("[data-undo]").onclick();
  assert.equal(h.editor.read().light.visible, false);
  row.querySelector("[data-undo]").onclick();
  assert.equal(h.editor.read().light, undefined);
  h.editor.close();
});

test("outside clicks dismiss tools and blur the selected marker without changing settings", () => {
  const h = harness();
  h.picker.value = "light";
  h.picker.onchange();
  const layer = h.viewport.children.find(
    (el) => el.className === "marker-editor-overlay",
  );
  const button = layer.children.find((el) => el.dataset.markerId === "light");
  button.focus();
  h.document.pointerdown({ target: { closest: () => button } });
  assert.equal(h.inspector.hidden, false);
  assert.equal(h.document.activeElement, button);
  h.document.pointerdown({ target: { closest: () => null } });
  assert.equal(h.inspector.hidden, true);
  assert.equal(button["aria-pressed"], "false");
  assert.equal(h.document.activeElement, null);
  assert.equal(h.picker.value, "");
  assert.equal(h.changed(), 0);
  assert.deepEqual(h.editor.read(), {});
  h.editor.close();
});
test("outside-click dismissal does not cancel click-to-place", () => {
  const h = harness();
  h.picker.value = "light";
  h.picker.onchange();
  h.rows[0].querySelector("[data-place]").onclick();
  h.document.pointerdown({ target: { closest: () => null } });
  assert.equal(h.scene.orbit.enabled, false);
  h.viewport.listeners.pointerdown(h.event());
  h.viewport.listeners.pointerup(h.event());
  assert.deepEqual(h.editor.read().light.offset, [9, 2, 2]);
  h.editor.close();
});
