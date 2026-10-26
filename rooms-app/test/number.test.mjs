import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  numberState,
  numberCommand,
  setNumberValue,
} from "../shared/number.mjs";
import {
  validateManifest,
  validateBinding,
  commandFor,
} from "../server/manifest.mjs";
const control = {
  id: "desk-height",
  label: "Desk height",
  type: "number",
  position: [0, 0.782, 0],
  nodeIds: ["desk-height"],
  min: 73,
  max: 130,
  step: 0.1,
  unit: "cm",
  defaultValue: 78.2,
  capabilities: ["set_value"],
};
const entity = {
  entity_id: "number.desk_height",
  state: "78.2",
  attributes: { min: 73, max: 130, step: 0.1, unit_of_measurement: "cm" },
};
test("number mapping, units, limits and service targets", () => {
  const manifest = {
    schemaVersion: 1,
    id: "office",
    title: "Office",
    units: "meters",
    up: "Y",
    scene: "scene.glb",
    controls: [control],
  };
  assert.equal(validateManifest(manifest), manifest);
  for (const domain of ["number", "input_number"])
    assert.equal(
      validateBinding(control, {
        ...entity,
        entity_id: domain + ".desk_height",
      }),
      domain + ".desk_height",
    );
  for (const id of ["light.desk", "cover.desk", "switch.desk"])
    assert.throws(() => validateBinding(control, { ...entity, entity_id: id }));
  assert.deepEqual(
    commandFor(
      entity.entity_id,
      "set_value",
      undefined,
      control,
      { value: 130 },
      entity,
    ),
    {
      domain: "number",
      service: "set_value",
      target: { entity_id: entity.entity_id },
      service_data: { value: 130 },
    },
  );
  for (const value of [72, 131, NaN, Infinity, null, "100", true, 100.05])
    assert.throws(() => numberCommand(entity, control, "set_value", value));
  assert.throws(() =>
    numberCommand(
      {
        ...entity,
        attributes: { ...entity.attributes, unit_of_measurement: "in" },
      },
      control,
      "set_value",
      100,
    ),
  );
  assert.throws(() =>
    numberCommand(
      { ...entity, attributes: { ...entity.attributes, max: 120 } },
      control,
      "set_value",
      130,
    ),
  );
  assert.throws(() =>
    numberCommand(
      { ...entity, attributes: { ...entity.attributes, step: 1 } },
      control,
      "set_value",
      100.5,
    ),
  );
  assert.throws(() => numberCommand(entity, control, "on", 100));
  for (const state of ["unavailable", "unknown", "", "NaN", "Infinity", "72"])
    assert.equal(numberState({ ...entity, state }, control).unavailable, true);
  assert.equal(numberState(entity, control).value, 78.2);
});
test("rest-based desk movement carries contents, preserves feet, survives repeat and GLB-style reload", () => {
  const root = new THREE.Group();
  root.userData.numberMotion = {
    min: 73,
    max: 130,
    restValue: 78.2,
    metersPerUnit: 0.01,
  };
  const feet = new THREE.Group(),
    assembly = new THREE.Group(),
    middle = new THREE.Group(),
    monitor = new THREE.Group();
  assembly.userData.numberMotionPart = { baseY: 0, factor: 1 };
  middle.position.y = 0.486;
  middle.userData.numberMotionPart = { baseY: 0.486, factor: 0.5 };
  monitor.position.y = 1.2;
  assembly.add(monitor);
  root.add(feet, assembly, middle);
  for (let i = 0; i < 3; i++)
    for (const v of [73, 100, 130, 78.2]) {
      setNumberValue(root, v);
      assert.ok(Math.abs(assembly.position.y - (v - 78.2) * 0.01) < 1e-8);
      assert.equal(feet.position.y, 0);
      assert.equal(monitor.position.y, 1.2);
      assert.ok(
        Math.abs(middle.position.y - (0.486 + (v - 78.2) * 0.005)) < 1e-8,
      );
    }
  const loaded = new THREE.ObjectLoader().parse(root.toJSON());
  setNumberValue(loaded, 130);
  assert.ok(Math.abs(loaded.children[1].position.y - 0.518) < 1e-8);
  setNumberValue(loaded, undefined);
  assert.ok(Math.abs(loaded.children[1].position.y - 0.518) < 1e-8);
});

test("command-only desk cover and four independently mapped presets", async () => {
  const { actionCommand, actionState } = await import("../shared/action.mjs");
  const { markerAppearance } = await import("../shared/marker.mjs");
  const motion = {
    id: "desk-motion",
    label: "Desk motion",
    type: "cover",
    motion: "none",
    nodeIds: [],
    position: [0, 0.782, 0],
    capabilities: ["open_close", "stop"],
    group: control.id,
  };
  const presets = Array.from({ length: 4 }, (_, i) => ({
    id: `desk-preset-${i + 1}`,
    label: `Preset ${i + 1}`,
    type: "button",
    position: [i * 0.1, 0.8, 0],
    nodeIds: [],
    capabilities: ["press"],
    group: control.id,
  }));
  assert.doesNotThrow(() =>
    validateManifest({
      schemaVersion: 1,
      id: "office",
      title: "Office",
      units: "meters",
      up: "Y",
      scene: "scene.glb",
      controls: [control, motion, ...presets],
    }),
  );
  for (const domain of ["button", "input_button", "script", "scene"]) {
    const e = {
      entity_id: `${domain}.desk`,
      state: "unknown",
      attributes: { icon: "mdi:human-handsup" },
    };
    assert.equal(validateBinding(presets[0], e), e.entity_id);
    assert.equal(
      actionCommand(e, presets[0], "press").service,
      ["button", "input_button"].includes(domain) ? "press" : "turn_on",
    );
    assert.equal(
      markerAppearance(presets[0], e, actionState(e)).stateObj.attributes.icon,
      "mdi:human-handsup",
    );
  }
  for (const domain of ["light", "switch", "cover", "number"])
    assert.throws(() =>
      validateBinding(presets[0], { entity_id: domain + ".desk" }),
    );
  assert.throws(() =>
    actionCommand(
      { entity_id: "button.desk", state: "unavailable" },
      presets[0],
      "press",
    ),
  );
  assert.throws(() =>
    actionCommand(
      { entity_id: "button.desk", state: "unknown" },
      presets[0],
      "on",
    ),
  );
  assert.throws(() =>
    validateManifest({
      schemaVersion: 1,
      id: "office",
      title: "Office",
      units: "meters",
      up: "Y",
      scene: "scene.glb",
      controls: [control, { ...motion, nodeIds: ["desk-height"] }],
    }),
  );
});
