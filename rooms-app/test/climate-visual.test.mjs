import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { climateState, climateAppearance } from "../shared/climate.mjs";
import { createClimateVisual } from "../shared/climate-visual.mjs";
const make = () => {
  const root = new THREE.Group();
  root.userData.climateVisual = {
    version: 1,
    width: 0.68,
    outlet: [0, -0.1, 0.1],
  };
  const flap = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.02, 0.025),
    new THREE.MeshStandardMaterial(),
  );
  flap.name = "air-conditioner-lower-louver";
  root.add(flap);
  return root;
};
test("reported HVAC action takes precedence over selected Auto mode", () => {
  assert.equal(
    climateAppearance(
      climateState({ state: "auto", attributes: { hvac_action: "heating" } }),
    ).color,
    "#ffa06a",
  );
  assert.equal(
    climateAppearance(
      climateState({ state: "auto", attributes: { hvac_action: "cooling" } }),
    ).label,
    "Cooling",
  );
  for (const action of ["idle", "off", "defrosting"])
    assert.equal(
      climateAppearance(
        climateState({ state: "heat", attributes: { hvac_action: action } }),
      ).flow,
      false,
    );
  assert.equal(
    climateAppearance(climateState({ state: "auto", attributes: {} })).flow,
    false,
  );
});
test("off/unavailable stop airflow; modes use distinct colors", () => {
  const colors = new Set();
  for (const mode of ["heat", "cool", "dry", "fan_only"]) {
    const v = climateAppearance(climateState({ state: mode, attributes: {} }));
    assert.ok(v.flow);
    colors.add(v.color);
  }
  assert.equal(colors.size, 4);
  for (const state of ["off", "unknown", "unavailable"])
    assert.equal(climateAppearance(climateState({ state })).flow, false);
});
test("airflow moves only its runtime parts and restores the flap on dispose", () => {
  const root = make(),
    flap = root.children[0],
    v = createClimateVisual(root);
  v.setState(climateState({ state: "cool", attributes: { fan_mode: "high" } }));
  assert.ok(v.animating);
  v.update(0);
  const first = v.group.children[0].material.uniforms.uTime.value;
  v.update(0.5);
  assert.notEqual(v.group.children[0].material.uniforms.uTime.value, first);
  assert.equal(root.position.length(), 0);
  assert.equal(flap.position.length(), 0);
  v.setState(climateState({ state: "off" }));
  assert.equal(v.animating, false);
  assert.equal(v.group.visible, false);
  v.dispose();
  assert.equal(flap.rotation.x, 0);
  assert.equal(root.children.length, 1);
});
test("reduced-motion preview is static and invalid metadata is ignored", () => {
  const v = createClimateVisual(make(), { reducedMotion: true });
  v.setState(climateState({ state: "cool" }));
  v.update(0);
  const a = v.group.children[0].material.uniforms.uTime.value;
  v.update(90);
  assert.deepEqual(v.group.children[0].material.uniforms.uTime.value, a);
  assert.equal(v.animating, false);
  v.dispose();
  assert.equal(createClimateVisual(new THREE.Group()), null);
});
