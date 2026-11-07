import * as THREE from "three";
import { climateAppearance } from "./climate.mjs";

// Continuous curved streams with soft volume and traveling highlights.
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;
const fragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPhase;
  uniform float uStrength;
  uniform float uCore;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float softEdge = pow(facing, mix(2.6, 0.7, uCore));
    float fade = smoothstep(0.0, 0.06, vUv.x)
               * (1.0 - smoothstep(0.82, 1.0, vUv.x));
    float phase = fract(vUv.x * 2.2 - uTime * 0.65 + uPhase);
    float pulse = smoothstep(0.0, 0.15, phase)
                * (1.0 - smoothstep(0.40, 0.92, phase));
    float alpha = uStrength * softEdge * fade * (0.32 + 0.68 * pulse);
    if (uCore < 0.0) {
      float across = vUv.y * 2.0 - 1.0;
      float edge = pow(max(0.0, 1.0 - across * across), 1.4);
      float wave = pow(0.5 + 0.5 * cos((vUv.x + across * across * 0.10) * 21.0 - uTime * 3.2), 5.0);
      alpha = uStrength * edge * fade * (0.14 + 0.86 * wave);
    }
    vec3 color = mix(uColor, vec3(1.0), clamp(uCore, 0.0, 1.0) * 0.14);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function createClimateVisual(root, { reducedMotion = false } = {}) {
  const data = root.userData.climateVisual;
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.outlet) ||
    data.outlet.length !== 3 ||
    !data.outlet.every((n) => Number.isFinite(n) && Math.abs(n) < 10) ||
    !Number.isFinite(data.width) ||
    data.width < 0.1 ||
    data.width > 5
  )
    return null;
  const group = new THREE.Group();
  group.name = "climate-airflow-runtime";
  group.userData.climateRuntime = true;
  group.visible = false;
  group.position.fromArray(data.outlet);
  root.add(group);
  const time = { value: 0 },
    tint = { value: new THREE.Color() };
  const resources = [];
  for (let lane = 0; lane < 5; lane++) {
    const x = (lane - 2) * data.width * 0.19;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -0.015, 0.025),
      new THREE.Vector3(x * 1.12, -0.12, 0.4),
      new THREE.Vector3(x * 1.5, -0.3, 1.05),
      new THREE.Vector3(x * 2.1, -0.65, 1.8),
    ]);
    for (const core of [false, true]) {
      const radius = THREE.MathUtils.clamp(
        data.width * (core ? 0.012 : 0.044),
        core ? 0.005 : 0.02,
        core ? 0.014 : 0.045,
      );
      const geometry = new THREE.TubeGeometry(curve, 40, radius, 8, false);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: time,
          uColor: tint,
          uPhase: { value: lane * 0.13 },
          uStrength: { value: core ? 0.82 : 0.18 },
          uCore: { value: core ? 1 : 0 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = core ? "climate-flow-core" : "climate-flow-halo";
      mesh.raycast = () => {};
      mesh.renderOrder = core ? 3 : 2;
      group.add(mesh);
      resources.push({ geometry, material });
    }
  }
  // A broad curved veil stays legible in the normal overhead room view.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.015, 0.025),
    new THREE.Vector3(0, -0.12, 0.4),
    new THREE.Vector3(0, -0.3, 1.05),
    new THREE.Vector3(0, -0.65, 1.8),
  ]);
  const positions = [],
    uvs = [],
    indices = [],
    rows = 40,
    columns = 16;
  for (let i = 0; i <= rows; i++) {
    const s = i / rows,
      center = path.getPoint(s);
    const halfWidth = data.width * 0.45 * (1 + 1.5 * s);
    for (let j = 0; j <= columns; j++) {
      const t = j / columns;
      positions.push((t * 2 - 1) * halfWidth, center.y, center.z);
      uvs.push(s, t);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: time,
      uColor: tint,
      uPhase: { value: 0 },
      uStrength: { value: 0.72 },
      uCore: { value: -1 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const plume = new THREE.Mesh(geometry, material);
  plume.name = "climate-flow-plume";
  plume.raycast = () => {};
  plume.renderOrder = 1;
  group.add(plume);
  resources.push({ geometry, material });
  const indicators = [];
  root.traverse((o) => {
    if (o.userData.climateIndicator && o.material?.isMeshStandardMaterial)
      indicators.push(o.material);
  });
  const flap = root.getObjectByName("air-conditioner-lower-louver"),
    rest = flap?.rotation.x ?? 0;
  let visual = climateAppearance(),
    state = {};
  return {
    group,
    setReducedMotion(value) {
      reducedMotion = value;
    },
    get animating() {
      if (!visual.flow || reducedMotion) return false;
      for (let node = group; node; node = node.parent)
        if (!node.visible) return false;
      return true;
    },
    get appearance() {
      return visual;
    },
    setState(next) {
      state = next;
      visual = climateAppearance(next);
      group.visible = visual.flow;
      // Keep the LED calm while making the airflow readable in daylight.
      const hsl = new THREE.Color(visual.color).getHSL({});
      tint.value.setHSL(hsl.h, Math.max(0.85, hsl.s), 0.28);
      for (const m of indicators) {
        m.emissive.set(visual.color);
        m.color.set(visual.color);
        m.emissiveIntensity = next.on && !next.unavailable ? 1.1 : 0;
      }
      if (flap && !next.unavailable)
        flap.rotation.x = rest + (visual.open ? -0.36 : 0);
    },
    update(seconds) {
      if (!visual.flow) return;
      time.value = reducedMotion ? 0 : seconds * visual.speed;
      if (flap && /^(on|auto|vertical|both)$/i.test(state.swingMode || ""))
        flap.rotation.x =
          rest - 0.36 + (reducedMotion ? 0 : Math.sin(time.value * 0.8) * 0.07);
    },
    dispose() {
      visual = { ...visual, flow: false };
      root.remove(group);
      for (const { geometry, material } of resources) {
        geometry.dispose();
        material.dispose();
      }
      if (flap) flap.rotation.x = rest;
    },
  };
}
