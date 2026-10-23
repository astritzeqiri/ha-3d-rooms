import * as THREE from "three";

export function daylightFactor(mode, entity, previous = 0) {
  if (mode === "day") return 1;
  if (mode === "night") return 0;
  if (!entity || ["unknown", "unavailable"].includes(entity.state))
    return previous;
  const elevation = entity.attributes?.elevation;
  if (Number.isFinite(elevation)) {
    const t = Math.max(0, Math.min(1, (elevation + 6) / 18));
    return t * t * (3 - 2 * t);
  }
  return entity.state === "above_horizon"
    ? 1
    : entity.state === "below_horizon"
      ? 0
      : previous;
}

/** Window-local approximation of diffuse daylight, independent of indoor lamps. */
export function createDaylight(config) {
  const group = new THREE.Group();
  group.name = "daylight-runtime";
  group.userData.daylightRuntime = true;
  const ambient = new THREE.HemisphereLight("#c4dfff", "#a39b82", 0);
  group.add(ambient);
  const windows = config.windows.map((w) => {
    const inward = new THREE.Vector3(...w.inward).normalize();
    const at = new THREE.Vector3(...w.position);
    const light = new THREE.SpotLight("#fff1d7", 0, 9, Math.PI / 2.8, 1, 2);
    light.position.copy(at).addScaledVector(inward, -0.08);
    light.target.position
      .copy(at)
      .addScaledVector(inward, 3)
      .add(new THREE.Vector3(0, -0.9, 0));
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.015;
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(w.width, w.height),
      new THREE.MeshBasicMaterial({
        color: "#070b0e",
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    );
    sky.name = `daylight-sky-${w.id}`;
    sky.position.copy(at).addScaledVector(inward, -0.13);
    sky.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
    group.add(light, light.target, sky);
    return { w, light, sky };
  });
  let factor = 0;
  const openings = new Map();
  function update(mode, entity, positions = new Map()) {
    factor = daylightFactor(mode, entity, factor);
    let energy = 0,
      area = 0;
    for (const { w, light, sky } of windows) {
      const value = positions.get(w.coverId);
      if (Number.isFinite(value))
        openings.set(w.id, Math.max(0, Math.min(100, value)));
      const opening = w.coverId
        ? (openings.get(w.id) ?? w.defaultPosition ?? 0) / 100
        : 1;
      const size = w.width * w.height;
      area += size;
      energy += size * opening;
      light.intensity = 35 * size * factor * opening;
      light.color.set(factor < 0.45 ? "#ffd5a4" : "#fff1d7");
      sky.material.color
        .set("#070b0e")
        .lerp(new THREE.Color("#b5d9f4"), factor);
    }
    ambient.intensity = factor * (0.035 + 1.2 * (area ? energy / area : 0));
    return factor;
  }
  return {
    group,
    update,
    get factor() {
      return factor;
    },
  };
}
