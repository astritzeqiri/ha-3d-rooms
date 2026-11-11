import test from "node:test";
import assert from "node:assert/strict";
import { enableTooltips } from "../shared/tooltip.mjs";

function harness() {
  const handlers = {};
  const tip = {
    style: {},
    hidden: true,
    offsetWidth: 100,
    offsetHeight: 24,
    attributes: {},
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    remove() {
      this.removed = true;
    },
  };
  globalThis.document = { createElement: () => tip };
  const container = {
    children: [],
    append(child) {
      this.children.push(child);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
  };
  const root = {
    addEventListener: (type, fn) => (handlers[type] = fn),
    removeEventListener: (type) => delete handlers[type],
  };
  const button = (title, rect) => {
    const attrs = { title };
    return {
      dataset: {},
      getAttribute: (k) => attrs[k] ?? null,
      hasAttribute: (k) => k in attrs,
      setAttribute: (k, v) => (attrs[k] = v),
      removeAttribute: (k) => delete attrs[k],
      contains: (other) => other === button,
      matches: () => true,
      getBoundingClientRect: () => rect,
      closest() {
        return this;
      },
      attrs,
    };
  };
  const stop = enableTooltips(root, container);
  return { handlers, tip, container, button, stop };
}

test("a button's title shows at once beside it and goes back afterwards", () => {
  const { handlers, tip, button, stop } = harness();
  const size = button("Size: Standard", {
    left: 150,
    top: 100,
    width: 32,
    height: 32,
    bottom: 132,
  });
  handlers.pointerover({ target: size });
  assert.equal(tip.hidden, false);
  assert.equal(tip.textContent, "Size: Standard");
  assert.equal(size.attrs.title, undefined, "no second, native tooltip");
  // Centred above the button.
  assert.equal(tip.style.left, "116px");
  assert.equal(tip.style.top, "68px");
  handlers.pointerout({ target: size, relatedTarget: null });
  assert.equal(tip.hidden, true);
  assert.equal(size.attrs.title, "Size: Standard");
  stop();
  assert.equal(tip.removed, true);
  assert.equal(Object.keys(handlers).length, 0);
});

test("the tooltip stays inside the area and drops below a button at the top", () => {
  const { handlers, tip, button } = harness();
  const edge = button("Back", {
    left: 0,
    top: 4,
    width: 30,
    height: 30,
    bottom: 34,
  });
  handlers.pointerover({ target: edge });
  assert.equal(tip.style.left, "6px", "not off the left edge");
  assert.equal(tip.style.top, "42px", "below, as there is no room above");
  handlers.pointerout({ target: edge, relatedTarget: null });
  const right = button("Next", {
    left: 380,
    top: 150,
    width: 30,
    height: 30,
    bottom: 180,
  });
  handlers.pointerover({ target: right });
  assert.equal(tip.style.left, "294px", "not off the right edge");
});

test("touch taps and buttons without a title show nothing; pressing hides it", () => {
  const { handlers, tip, button } = harness();
  const rect = { left: 100, top: 100, width: 30, height: 30, bottom: 130 };
  handlers.pointerover({ target: button("Hello", rect), pointerType: "touch" });
  assert.equal(tip.hidden, true);
  const plain = button("", rect);
  handlers.pointerover({ target: plain });
  assert.equal(tip.hidden, true);
  const named = button("Reset", rect);
  handlers.pointerover({ target: named });
  assert.equal(tip.hidden, false);
  handlers.pointerdown();
  assert.equal(tip.hidden, true);
  assert.equal(named.attrs.title, "Reset");
});

test("keyboard focus shows the tooltip only for focus-visible", () => {
  const { handlers, tip, button } = harness();
  const rect = { left: 100, top: 100, width: 30, height: 30, bottom: 130 };
  const field = button("Angle", rect);
  field.matches = () => false;
  handlers.focusin({ target: field });
  assert.equal(tip.hidden, true);
  const key = button("Angle", rect);
  handlers.focusin({ target: key });
  assert.equal(tip.hidden, false);
  handlers.focusout();
  assert.equal(tip.hidden, true);
});
