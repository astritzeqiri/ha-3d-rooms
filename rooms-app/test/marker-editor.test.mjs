import test from "node:test";
import assert from "node:assert/strict";
import { initMarkerEditor } from "../web/marker-editor.js";

function harness(extraControls = [], extraOptions = {}) {
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
      if (selector === "[data-icon]")
        return this.children.filter((c) => c.dataset.icon !== undefined);
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
    replaceChildren(...els) {
      this.children = [];
      els.forEach((el) => this.append(el));
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
        ...extraControls,
      ],
    }),
    scene: () => scene,
    onChange: () => changed++,
    ...extraOptions,
  });
  editor.open();
  const defaults = fields.get("dashboard-marker-settings").children[0];
  const picker = fields.get("dashboard-marker-settings").children[1];
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
    defaults,
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

test("AC editor marker keeps the card's AC glyph instead of Home Assistant's thermostat icon", async () => {
  const stateObj = {
    entity_id: "climate.living_room_ac",
    state: "cool",
    attributes: {},
  };
  const h = harness([{ id: "ac", type: "climate", label: "Air conditioner" }], {
    entityFor: (id) => (id === "ac" ? stateObj : undefined),
    resolveIcon: async () => ({
      viewBox: "0 0 24 24",
      paths: [{ d: "M1 1h2v2H1z" }],
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  h.scene.options.onRender();
  const layer = h.viewport.children.find(
    (el) => el.className === "marker-editor-overlay",
  );
  const button = layer.children.find((el) => el.dataset.markerId === "ac");
  const glyph = button.querySelector(".marker-editor-icon svg");
  assert.match(glyph.html, /M4 3h16/);
  assert.doesNotMatch(glyph.html, /M1 1h2v2H1z/);
  h.editor.close();
});

test("AC editor marker uses a climate icon and reported mode rather than a bulb and On", () => {
  const h = harness([{ id: "ac", type: "climate", label: "Air conditioner" }]);
  const layer = h.viewport.children.find(
    (el) => el.className === "marker-editor-overlay",
  );
  const button = layer.children.find((el) => el.dataset.markerId === "ac");
  assert.match(button.html, /M4 3h16/);
  assert.doesNotMatch(button.html, /M12 2a7/);
  h.scene.lastStates = new Map([
    [
      "ac",
      {
        on: true,
        mode: "cool",
        action: "cooling",
        temperature: 24,
        unavailable: false,
      },
    ],
  ]);
  h.scene.options.onRender();
  assert.equal(
    button.querySelector(".marker-editor-badge").textContent,
    "Cooling · 24°",
  );
  assert.equal(button.dataset.active, "true");
  h.scene.lastStates.set("ac", {
    on: true,
    mode: "heat",
    action: "heating",
    temperature: 25,
    unavailable: false,
  });
  h.scene.options.onRender();
  assert.equal(
    button.querySelector(".marker-editor-badge").textContent,
    "Heating · 25°",
  );
  h.scene.lastStates.set("ac", { on: false, mode: "off", unavailable: false });
  h.scene.options.onRender();
  assert.equal(button.querySelector(".marker-editor-badge").textContent, "Off");
  assert.equal(button.dataset.active, "false");
  h.scene.lastStates.set("ac", {
    on: false,
    mode: "unknown",
    unavailable: true,
  });
  h.scene.options.onRender();
  assert.equal(
    button.querySelector(".marker-editor-badge").textContent,
    "Unavailable",
  );
  h.editor.close();
});

test("view defaults stay inherited while per-device overrides and positions remain independent", () => {
  const h = harness();
  const size = h.defaults.querySelector('[data-setting="size"]');
  size.value = "44";
  size.onchange();
  assert.equal(h.rows[0].querySelector('[data-setting="size"]').value, 44);
  const own = h.rows[0].querySelector('[data-setting="size"]');
  own.value = "24";
  own.onchange();
  const axis = h.rows[0].axes[0];
  axis.value = "1";
  axis.validity = { valid: true };
  axis.oninput();
  size.value = "56";
  size.onchange();
  assert.equal(own.value, 24);
  assert.equal(h.rows[1].querySelector('[data-setting="size"]').value, 56);
  h.rows[0].querySelector("[data-inherit]").onclick();
  assert.equal(own.value, 56);
  assert.deepEqual(h.editor.read().light, { offset: [1, 0, 0] });
  assert.equal(h.editor.read()._defaults.size, 56);
  h.editor.close();
});

test("icon picker opens from the current-icon row, searches, sets and resets with undo", async () => {
  const h = harness();
  const row = h.rows[0];
  const slot = (r, name) => r.querySelector(`[data-icon-slot="${name}"]`);
  const all = (el) => [el, ...el.children.flatMap(all)];
  const picker = row.querySelector(".marker-icon-picker");
  const choices = all(row.querySelector(".marker-icon-list")).filter(
    (el) => el.dataset.icon !== undefined,
  );
  const marker = all(h.viewport).find((el) => el.dataset.markerId === "light");
  const glyph = marker.querySelector(".marker-editor-icon svg");
  const original = glyph.html;
  assert.equal(choices.length, 37);
  assert.equal(
    slot(row, "icon").querySelector(".marker-icon-name").textContent,
    "Default",
  );
  slot(row, "icon").querySelector("[data-icon-open]").onclick();
  assert.equal(picker.hidden, false);
  const search = row.querySelector("[data-icon-search]");
  search.value = "printer 3d";
  search.oninput();
  await new Promise((resolve) => setTimeout(resolve, 400));
  const found = row
    .querySelector(".marker-icon-results")
    .querySelector(".marker-icon-grid").children;
  assert.ok(found.length > 0);
  assert.ok(found.every((t) => /^mdi:printer-3d/.test(t.dataset.icon)));
  found.find((t) => t.dataset.icon === "mdi:printer-3d-nozzle").onclick();
  assert.equal(h.editor.read().light.icon, "mdi:printer-3d-nozzle");
  assert.equal(
    slot(row, "icon").querySelector(".marker-icon-name").textContent,
    "Printer 3d nozzle",
  );
  slot(row, "icon").querySelector("[data-icon-open]").onclick();
  const lamp = choices.find((c) => c.dataset.icon === "mdi:floor-lamp");
  lamp.onclick();
  assert.equal(picker.hidden, true);
  assert.equal(h.editor.read().light.icon, "mdi:floor-lamp");
  assert.equal(lamp["aria-pressed"], "true");
  assert.equal(
    slot(row, "icon").querySelector(".marker-icon-name").textContent,
    "Floor lamp",
  );
  assert.notEqual(glyph.html, original);
  slot(row, "icon").querySelector("[data-icon-open]").onclick();
  assert.equal(row.querySelector(".marker-icon-list").hidden, false);
  choices[0].onclick();
  assert.equal(h.editor.read().light, undefined);
  assert.equal(glyph.html, original);
  row.querySelector("[data-undo]").onclick();
  assert.equal(h.editor.read().light.icon, "mdi:floor-lamp");
  h.editor.close();
});

test("a device can have its own icon for the active and the inactive state", () => {
  const h = harness();
  const row = h.rows[0];
  const all = (el) => [el, ...el.children.flatMap(all)];
  const slot = (name) => row.querySelector(`[data-icon-slot="${name}"]`);
  const pick = (icon) =>
    all(row.querySelector(".marker-icon-list"))
      .find((el) => el.dataset.icon === icon)
      .onclick();
  assert.equal(slot("icon_off").hidden, false);
  slot("icon").querySelector("[data-icon-open]").onclick();
  pick("mdi:ceiling-light");
  assert.deepEqual(h.editor.read().light, { icon: "mdi:ceiling-light" });
  assert.equal(
    slot("icon_off").querySelector(".marker-icon-name").textContent,
    "Same as on",
  );
  slot("icon_off").querySelector("[data-icon-open]").onclick();
  pick("mdi:lightbulb-outline");
  assert.deepEqual(h.editor.read().light, {
    icon: "mdi:ceiling-light",
    icon_off: "mdi:lightbulb-outline",
  });
  assert.equal(
    slot("icon_off").querySelector(".marker-icon-name").textContent,
    "Bulb outline",
  );
  assert.equal(
    slot("icon").querySelector(".marker-icon-name").textContent,
    "Ceiling light",
  );
  // The default tile clears only the slot being edited.
  slot("icon_off").querySelector("[data-icon-open]").onclick();
  all(row.querySelector(".marker-icon-list"))
    .find((el) => el.dataset.icon === "")
    .onclick();
  assert.deepEqual(h.editor.read().light, { icon: "mdi:ceiling-light" });
  h.editor.close();
});
