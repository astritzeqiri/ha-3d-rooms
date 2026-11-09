import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { lockState, lockCommand, setLockTurn } from "../shared/lock.mjs";
import {
  markerAppearance,
  applyMarkerTone,
  readableInk,
} from "../shared/marker.mjs";
import { deviceGroup } from "../shared/workspace.mjs";
import {
  validateManifest,
  compatible,
  commandFor,
} from "../server/manifest.mjs";
const c = {
  id: "front-lock",
  label: "Front door lock",
  type: "lock",
  position: [0, 1, 0],
  nodeIds: ["lock"],
  capabilities: ["lock_unlock"],
};
const entity = (state, attributes = {}) => ({
  entity_id: "lock.front_door",
  state,
  attributes,
});
test("lock controls accept only lock entities and explicit lock/unlock", async () => {
  const m = JSON.parse(await readFile("examples/manifest.json", "utf8"));
  m.controls = [c];
  assert.equal(validateManifest(m).controls[0].type, "lock");
  assert.equal(compatible(c, { entity_id: "lock.front_door" }), true);
  for (const id of ["light.door", "switch.door", "cover.door"])
    assert.equal(compatible(c, { entity_id: id }), false);
  assert.throws(() =>
    validateManifest({ ...m, controls: [{ ...c, capabilities: ["on_off"] }] }),
  );
  assert.deepEqual(
    commandFor("lock.front_door", "unlock", undefined, c, {}, entity("locked")),
    {
      domain: "lock",
      service: "unlock",
      target: { entity_id: "lock.front_door" },
      service_data: {},
    },
  );
  for (const action of ["open", "on", "toggle"])
    assert.throws(() => lockCommand(entity("locked"), c, action));
  assert.throws(() => lockCommand(entity("unavailable"), c, "lock"));
  assert.throws(() =>
    lockCommand(entity("locked", { code_format: "^\\d+$" }), c, "unlock"),
  );
});
test("lock state reports HA states without guessing unknown ones", () => {
  assert.equal(lockState(entity("locked")).locked, true);
  assert.equal(lockState(entity("unlocked")).locked, false);
  assert.equal(lockState(entity("locking")).moving, true);
  assert.equal(lockState(entity("jammed")).jammed, true);
  for (const s of ["unknown", "unavailable"])
    assert.equal(lockState(entity(s)).unavailable, true);
  assert.equal(
    lockState({ ...entity("locked"), entity_id: "switch.x" }).unavailable,
    true,
  );
  const appearance = markerAppearance(c, entity("locked"), {});
  assert.equal(appearance.active, true);
  assert.equal(appearance.badge, "Locked");
  assert.equal(markerAppearance(c, undefined, {}).badge, "—");
  assert.equal(deviceGroup(c), "Locks");
});
test("thumb-turn rotates from its rest pose and returns exactly", () => {
  const root = new THREE.Group(),
    turn = new THREE.Group();
  turn.rotation.x = 0.3;
  turn.userData.lockTurn = { axis: [0, 0, 1], lockedAngle: Math.PI / 2 };
  root.add(turn);
  const rest = turn.quaternion.clone();
  setLockTurn(root, true);
  const expected = rest
    .clone()
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.PI / 2,
      ),
    );
  assert.ok(turn.quaternion.angleTo(expected) < 1e-6);
  setLockTurn(root, true);
  assert.ok(turn.quaternion.angleTo(expected) < 1e-6);
  setLockTurn(root, false);
  assert.ok(turn.quaternion.angleTo(rest) < 1e-6);
});

test("lock markers carry a state colour: locked, unlocked, moving, jammed", () => {
  const control = { id: "front", type: "lock", label: "Front door" },
    tone = (state) =>
      markerAppearance(control, { entity_id: "lock.front", state }).tone;
  assert.equal(tone("locked"), "locked");
  assert.equal(tone("unlocked"), "unlocked");
  assert.equal(tone("open"), "unlocked");
  assert.equal(tone("locking"), "moving");
  assert.equal(tone("unlocking"), "moving");
  assert.equal(tone("jammed"), "jammed");
  // No colour without a usable state.
  assert.equal(tone("unavailable"), undefined);
  assert.equal(markerAppearance(control, undefined).tone, undefined);
});

test("lights, air conditioners and covers get state colours too", () => {
  const light = { id: "l", type: "light", label: "Lamp" },
    on = (attributes = {}) =>
      markerAppearance(
        light,
        { entity_id: "light.lamp", state: "on", attributes },
        { on: true },
      );
  // On: amber by default, or the light's own colour with a readable icon.
  assert.equal(on().tone, "light");
  assert.equal(on().toneColor, undefined);
  assert.deepEqual(
    [
      on({ rgb_color: [0, 0, 200] }).toneColor,
      on({ rgb_color: [0, 0, 200] }).toneInk,
    ],
    ["rgb(0,0,200)", "#fff"],
  );
  assert.equal(on({ rgb_color: [255, 240, 200] }).toneInk, "#1c1c1c");
  assert.equal(on({ rgb_color: ["x", 1, 2] }).toneColor, undefined);
  // Off, unavailable and unconnected lights stay neutral.
  assert.equal(
    markerAppearance(
      light,
      { entity_id: "light.lamp", state: "off" },
      { on: false },
    ).tone,
    undefined,
  );
  assert.equal(
    markerAppearance(light, undefined, { on: true }).tone,
    undefined,
  );
  // Air conditioner: what it is doing, else its mode; off is neutral.
  const ac = { id: "a", type: "climate", label: "AC" },
    mode = (state, hvac_action) =>
      markerAppearance(ac, {
        entity_id: "climate.ac",
        state,
        attributes: hvac_action ? { hvac_action } : {},
      }).tone;
  assert.equal(mode("cool"), "cool");
  assert.equal(mode("heat"), "heat");
  assert.equal(mode("dry"), "dry");
  assert.equal(mode("fan_only"), "fan_only");
  assert.equal(mode("heat_cool"), "auto");
  assert.equal(mode("heat_cool", "cooling"), "cool");
  assert.equal(mode("cool", "idle"), "cool");
  assert.equal(mode("off"), undefined);
  assert.equal(mode("unavailable"), undefined);
  // Covers: open or moving is coloured, closed is neutral.
  const shade = { id: "s", type: "cover", label: "Shade" },
    cover = (state, position) =>
      markerAppearance(shade, { entity_id: "cover.shade", state }, { position })
        .tone;
  assert.equal(cover("open", 40), "open");
  assert.equal(cover("closed", 0), undefined);
  assert.equal(cover("opening"), "open");
  // Presets and desks have no state colour.
  assert.equal(
    markerAppearance(
      { id: "b", type: "button" },
      { entity_id: "button.x", state: "x" },
      {},
    ).tone,
    undefined,
  );
  assert.equal(readableInk([255, 193, 7]), "#1c1c1c");
});

test("marker buttons take and drop their state colour", () => {
  const props = new Map(),
    button = {
      dataset: {},
      style: {
        setProperty: (k, v) => props.set(k, v),
        removeProperty: (k) => props.delete(k),
      },
    };
  applyMarkerTone(button, {
    tone: "light",
    toneColor: "rgb(1,2,3)",
    toneInk: "#fff",
  });
  assert.equal(button.dataset.tone, "light");
  assert.deepEqual(
    [...props],
    [
      ["--tone", "rgb(1,2,3)"],
      ["--tone-ink", "#fff"],
    ],
  );
  // A theme-coloured state clears a previous own colour.
  applyMarkerTone(button, { tone: "locked" });
  assert.equal(button.dataset.tone, "locked");
  assert.equal(props.size, 0);
  applyMarkerTone(button, { tone: undefined });
  assert.equal("tone" in button.dataset, false);
  applyMarkerTone({ dataset: {} }, null);
});
