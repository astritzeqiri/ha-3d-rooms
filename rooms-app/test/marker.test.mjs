import test from "node:test";
import assert from "node:assert/strict";
import { markerAppearance } from "../shared/marker.mjs";
import { coverState } from "../shared/cover.mjs";
const cover = { type: "cover" };
test("cover markers show reported height and movement, including closed and unknown positions", () => {
  for (const [raw, position, badge, active] of [
    ["closed", 0, "0%", false],
    ["open", 50, "50%", true],
    ["opening", 25, "↑ 25%", true],
    ["closing", 70, "↓ 70%", true],
  ]) {
    const entity = {
      entity_id: "cover.shade",
      state: raw,
      attributes: {
        current_position: position,
        device_class: "shutter",
        icon: "mdi:blinds-horizontal",
      },
    };
    const a = markerAppearance(cover, entity, coverState(entity));
    assert.equal(a.badge, badge);
    assert.equal(a.active, active);
    assert.equal(a.stateObj, entity);
    assert.equal(a.moving, ["opening", "closing"].includes(raw));
  }
  const entity = { entity_id: "cover.shade", state: "open", attributes: {} };
  assert.equal(
    markerAppearance(cover, entity, coverState(entity)).badge,
    "Open",
  );
});
test("light markers reflect confirmed power and preserve HA custom icon attributes", () => {
  const entity = {
    entity_id: "light.desk",
    state: "on",
    attributes: { icon: "mdi:desk-lamp", brightness: 128 },
  };
  const a = markerAppearance({ type: "light" }, entity, {
    on: true,
    brightness: 128,
  });
  assert.equal(a.badge, "On");
  assert.match(a.description, /50% brightness/);
  assert.equal(a.stateObj.attributes.icon, "mdi:desk-lamp");
  assert.equal(
    markerAppearance(
      { type: "light" },
      { ...entity, state: "off" },
      { on: false },
    ).active,
    false,
  );
});
test("unmapped, unavailable and preview markers never display stale live percentages", () => {
  assert.equal(
    markerAppearance(cover, undefined, { position: 75, unavailable: true })
      .badge,
    "—",
  );
  const entity = {
    entity_id: "cover.shade",
    state: "unavailable",
    attributes: { current_position: 75 },
  };
  const a = markerAppearance(cover, entity, coverState(entity));
  assert.equal(a.badge, "!");
  assert.equal(a.active, false);
  const p = markerAppearance(cover, entity, { position: 30 }, true);
  assert.equal(p.badge, "30%");
  assert.equal(p.stateObj.entity_id, "cover.three_d_rooms_preview");
});
