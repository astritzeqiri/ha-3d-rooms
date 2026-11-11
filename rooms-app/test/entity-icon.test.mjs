import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveEntityIcon,
  paintEntityIcon,
  entityIconArt,
  entityInState,
} from "../shared/entity-icon.mjs";
import { stateIconName, markerStateWords } from "../shared/marker-icons.mjs";

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

test("entity icon data becomes escaped SVG markup", () => {
  assert.equal(entityIconArt(null), undefined);
  const art = entityIconArt({
    viewBox: "0 0 24 24",
    paths: [{ d: 'M1 2"<', fillRule: "evenodd", transform: null }],
  });
  assert.equal(art.viewBox, "0 0 24 24");
  assert.equal(art.html, '<path d="M1 2&quot;&lt;" fill-rule="evenodd"/>');
});

test("an entity can be shown in its active or inactive state", () => {
  const light = { entity_id: "light.a", state: "off", attributes: {} };
  assert.equal(entityInState(light, true).state, "on");
  assert.equal(entityInState(light, false), light);
  assert.equal(
    entityInState(
      { entity_id: "cover.a", state: "open", attributes: {} },
      false,
    ).state,
    "closed",
  );
  assert.equal(
    entityInState(
      { entity_id: "lock.a", state: "locked", attributes: {} },
      false,
    ).state,
    "unlocked",
  );
  const gone = { entity_id: "light.a", state: "unavailable", attributes: {} };
  assert.equal(entityInState(gone, true), gone);
});

test("a marker uses its own icon per state, then the room's, then HA's", () => {
  assert.equal(stateIconName({}, {}, true), undefined);
  assert.equal(stateIconName({ icon: "mdi:a" }, {}, false), "mdi:a");
  assert.equal(
    stateIconName({ icon: "mdi:a", icon_off: "mdi:b" }, {}, false),
    "mdi:b",
  );
  assert.equal(
    stateIconName({ icon: "mdi:a", icon_off: "mdi:b" }, {}, true),
    "mdi:a",
  );
  assert.equal(
    stateIconName({}, { icon: "mdi:r", iconOff: "mdi:s" }, false),
    "mdi:s",
  );
  assert.equal(stateIconName({}, { icon: "mdi:r" }, false), "mdi:r");
  // A view's single icon covers both states over the room's off icon.
  assert.equal(
    stateIconName({ icon: "mdi:a" }, { iconOff: "mdi:s" }, false),
    "mdi:a",
  );
  assert.equal(stateIconName({ icon_off: "mdi:b" }, {}, true), undefined);
  assert.deepEqual(markerStateWords({ type: "cover" }), ["Open", "Closed"]);
  assert.equal(markerStateWords({ type: "number" }), null);
});
