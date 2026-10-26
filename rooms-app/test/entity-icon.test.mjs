import test from "node:test";
import assert from "node:assert/strict";
import { resolveEntityIcon, paintEntityIcon } from "../shared/entity-icon.mjs";

test("HA icons stay in their parent document and only SVG data enters the manager frame", async () => {
  let removed = false,
    appended;
  const path = {
    getAttribute: (name) =>
      ({ d: "M1 2h3v4Z", "fill-rule": "evenodd" })[name] || null,
  };
  const svg = {
    getAttribute: () => "0 0 24 24",
    querySelectorAll: () => [path],
  };
  const icon = {
    style: {},
    setAttribute() {},
    shadowRoot: { querySelector: () => svg },
    remove() {
      removed = true;
    },
  };
  const doc = {
    defaultView: {
      customElements: { get: () => true },
      requestAnimationFrame: (fn) => fn(),
    },
    createElement: () => icon,
  };
  const data = await resolveEntityIcon(
    {
      ownerDocument: doc,
      append: (el) => {
        appended = el;
      },
    },
    {},
    { entity_id: "button.test" },
  );
  assert.equal(appended, icon);
  assert.equal(removed, true);
  assert.equal(data.paths[0].d, "M1 2h3v4Z");
  const localNodes = [];
  const localDoc = {
    createElementNS: (ns, tag) => {
      const el = {
        tag,
        ownerDocument: localDoc,
        attributes: {},
        children: [],
        setAttribute(k, v) {
          this.attributes[k] = v;
        },
        append(child) {
          this.children.push(child);
        },
      };
      localNodes.push(el);
      return el;
    },
  };
  let result;
  paintEntityIcon(
    {
      ownerDocument: localDoc,
      replaceChildren: (svg) => {
        result = svg;
      },
    },
    data,
  );
  assert.equal(result.ownerDocument, localDoc);
  assert.equal(result.children[0].ownerDocument, localDoc);
  assert.equal(result.children[0].attributes.d, "M1 2h3v4Z");
  assert.ok(!localNodes.includes(icon));
});
test("unresolved icons release the hidden HA element and use a safe fallback", async () => {
  let removed = false;
  const icon = {
    style: {},
    setAttribute() {},
    shadowRoot: { querySelector: () => null, querySelectorAll: () => [] },
    remove() {
      removed = true;
    },
  };
  const doc = {
    defaultView: {
      customElements: { get: () => true },
      requestAnimationFrame: (fn) => fn(),
    },
    createElement: () => icon,
  };
  assert.equal(
    await resolveEntityIcon(
      { ownerDocument: doc, append() {} },
      {},
      {},
      { frames: 2 },
    ),
    null,
  );
  assert.equal(removed, true);
  const host = { textContent: "" };
  paintEntityIcon(host, null);
  assert.equal(host.textContent, "▶");
});
