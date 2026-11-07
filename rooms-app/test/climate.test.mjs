import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { climateState } from "../shared/climate.mjs";
import { markerAppearance } from "../shared/marker.mjs";
import {
  validateManifest,
  compatible,
  commandFor,
} from "../server/manifest.mjs";
const c = {
  id: "air-conditioner",
  label: "Air conditioner",
  type: "climate",
  position: [1, 2, 0],
  nodeIds: ["ac"],
  capabilities: ["more_info"],
};
test("climate controls accept only climate entities and native-dialog capabilities", async () => {
  const m = JSON.parse(await readFile("examples/manifest.json", "utf8"));
  m.controls = [c];
  assert.equal(validateManifest(m).controls[0].type, "climate");
  assert.equal(compatible(c, { entity_id: "climate.living" }), true);
  for (const id of ["light.ac", "switch.ac", "cover.ac"])
    assert.equal(compatible(c, { entity_id: id }), false);
  assert.throws(() =>
    validateManifest({ ...m, controls: [{ ...c, capabilities: ["on_off"] }] }),
  );
  assert.throws(
    () => commandFor("climate.living", "on", undefined, c, {}, {}),
    /Home Assistant climate/,
  );
});
test("climate state and markers distinguish off, idle, active and unavailable", () => {
  for (const mode of ["cool", "heat", "auto", "dry", "fan_only"]) {
    const e = {
      state: mode,
      entity_id: "climate.living",
      attributes: { temperature: 23, current_temperature: 25 },
    };
    assert.equal(climateState(e).on, true);
    assert.match(markerAppearance(c, e, {}).badge, /23°$/);
  }
  assert.equal(climateState({ state: "off" }).on, false);
  for (const e of [undefined, { state: "unknown" }, { state: "unavailable" }])
    assert.equal(climateState(e).unavailable, true);
});
