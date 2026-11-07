import test from "node:test";
import assert from "node:assert/strict";
import {
  filterViews,
  scopeOptions,
  viewScopeLabel,
} from "../shared/view-library.mjs";
const models = [
  { id: "house", houseId: "a", houseView: true, title: "Home" },
  {
    id: "floor",
    houseId: "a",
    houseView: true,
    houseFloor: { name: "Downstairs" },
    title: "Floor",
  },
  { id: "room", title: "Kitchen", housePlacement: { houseId: "a" } },
  { id: "other", title: "Studio" },
];
const views = models.map((m) => ({
  id: `view-${m.id}`,
  title: `Saved ${m.title}`,
  layers: [{ model: m.id }],
}));
test("the global gallery includes views from every space and standalone room", () => {
  assert.deepEqual(filterViews(views, models), views);
  assert.equal(filterViews(views, models, { kind: "room" }).length, 2);
  assert.equal(
    filterViews(views, models, { kind: "floor" })[0].id,
    "view-floor",
  );
  assert.equal(
    filterViews(views, models, { query: " downstairs " })[0].id,
    "view-floor",
  );
  assert.equal(filterViews(views, models, { query: "no match" }).length, 0);
});
test("scope choices support room-only installations without fabricating houses", () => {
  assert.deepEqual(scopeOptions([models[3]], "house"), []);
  assert.deepEqual(scopeOptions([models[3]], "room"), [models[3]]);
  assert.equal(viewScopeLabel(models[2], models), "Home · Kitchen");
  assert.equal(viewScopeLabel(models[1], models), "Home · Downstairs");
});
test("missing models do not silently hide saved views or mutate persisted IDs", () => {
  const before = JSON.stringify(views);
  assert.deepEqual(filterViews(views, []), views);
  assert.equal(viewScopeLabel(undefined, []), "Missing space");
  assert.equal(JSON.stringify(views), before);
});
