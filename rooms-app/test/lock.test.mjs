import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { lockState, lockCommand, setLockTurn } from "../shared/lock.mjs";
import { markerAppearance } from "../shared/marker.mjs";
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
