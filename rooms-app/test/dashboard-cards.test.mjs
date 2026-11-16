import test from "node:test";
import assert from "node:assert/strict";
import {
  addCardToConfig,
  editableViews,
  listDashboards,
  addDashboardCard,
} from "../shared/dashboard-cards.mjs";

const card = { type: "custom:three-d-rooms-card", saved_view: "v1" };

test("a card goes to the end of a masonry view or into a new section", () => {
  const config = {
    views: [
      { title: "Home", cards: [{ type: "entities" }] },
      {
        title: "Rooms",
        type: "sections",
        sections: [{ type: "grid", cards: [] }],
      },
    ],
  };
  const masonry = addCardToConfig(config, 0, card);
  assert.deepEqual(masonry.views[0].cards.at(-1), card);
  const sections = addCardToConfig(config, 1, card);
  assert.deepEqual(sections.views[1].sections.at(-1), {
    type: "grid",
    cards: [card],
  });
  assert.equal(config.views[0].cards.length, 1, "the original is not changed");
  assert.throws(() => addCardToConfig(config, 5, card));
});

test("only stored, non-generated views are offered", () => {
  assert.deepEqual(
    editableViews({ strategy: { type: "original-states" } }),
    [],
  );
  assert.deepEqual(
    editableViews({ views: [{ path: "kitchen" }, { strategy: {} }, {}] }).map(
      (v) => [v.index, v.title],
    ),
    [
      [0, "kitchen"],
      [2, "View 3"],
    ],
  );
});

test("dashboards are listed with their views and a card is saved once", async () => {
  const saved = [];
  const hass = {
    async callWS(message) {
      if (message.type === "lovelace/dashboards/list")
        return [
          { url_path: "rooms-check", title: "3D Rooms Check", mode: "storage" },
          { url_path: "yaml-one", title: "YAML", mode: "yaml" },
        ];
      if (message.type === "lovelace/config") {
        if (!message.url_path) throw new Error("config_not_found");
        return { views: [{ title: "Kitchen", cards: [] }] };
      }
      if (message.type === "lovelace/config/save") saved.push(message);
    },
  };
  const dashboards = await listDashboards(hass);
  assert.deepEqual(
    dashboards.map((d) => [d.url_path, d.views.map((v) => v.title)]),
    [["rooms-check", ["Kitchen"]]],
  );
  await addDashboardCard(hass, "rooms-check", 0, card);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].url_path, "rooms-check");
  assert.deepEqual(saved[0].config.views[0].cards, [card]);
});
