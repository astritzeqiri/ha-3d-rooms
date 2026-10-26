import { deviceForControl } from "../shared/device.mjs";
import { setNumberValue } from "../shared/number.mjs";
import { createDaylight } from "../shared/daylight.mjs";
import { setShadePosition } from "../shared/cover.mjs";
import { cameraPreset } from "../shared/camera-presets.mjs";
import {
  captureCameraView,
  restoreCameraView,
} from "../shared/camera-view.mjs";
import { floorFrame, perspectiveFrame } from "../shared/floor-view.mjs";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export class SceneView {
  constructor(container, onPick = () => {}, options = {}) {
    this.options = {
      mode: "dollhouse",
      markers: true,
      interactive: true,
      ...options,
    };
    this.container = container;
    this.onPick = onPick;
    this.materials = [];
    this.fixtures = new Map();
    this.generation = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D model. Drag to orbit; use the device controls below for keyboard access.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#242320");
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = false;
    this.orbit.enabled = this.options.interactive;
    this.orbit.addEventListener("change", () => {
      this.cutaway();
      this.render();
      this.options.onCameraChange?.({ source: "orbit" });
    });
    this.resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      this.renderer.setSize(width, height);
      if (!width || !height) return;
      this.camera.aspect = width / height;
      if (this.options.mode !== "dollhouse" && this.model) this.fitFloor();
      this.camera.updateProjectionMatrix();
      this.render();
      if (this.model) this.options.onCameraChange?.({ source: "resize" });
    });
    this.resize.observe(container);
    const ray = new THREE.Raycaster();
    let start;
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (e) => (start = [e.clientX, e.clientY]),
    );
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6)
        return;
      const r = this.renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
      for (const hit of ray.intersectObjects(this.scene.children, true)) {
        let o = hit.object;
        let visible = true;
        for (let parent = o; parent; parent = parent.parent)
          if (!parent.visible) visible = false;
        if (!visible) continue;
        while (o) {
          if (o.userData.pickControl) {
            onPick(o.userData.pickControl);
            return;
          }
          o = o.parent;
        }
      }
    });
  }
  disposeScene(scene) {
    scene.traverse((o) => {
      o.geometry?.dispose();
      o.shadow?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
    });
  }
  async load(model, url) {
    const started = performance.now();
    const generation = ++this.generation;
    const gltf = await new GLTFLoader().loadAsync(url);
    if (generation !== this.generation) {
      this.disposeScene(gltf.scene);
      return false;
    }
    this.disposeScene(this.scene);
    this.scene.clear();
    this.model = model;
    this.asset = gltf.scene;
    this.scene.add(this.asset);
    this.materials = [];
    this.nodes = new Map();
    this.asset.traverse((o) => {
      if (o.userData.controlId) this.nodes.set(o.userData.controlId, o);
      if (o.isMesh) {
        o.castShadow = !o.userData.daylightWindowId;
        o.receiveShadow = true;
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.isMeshBasicMaterial) this.materials.push([m, m.color.clone()]);
        }
      }
    });
    this.ambient = new THREE.HemisphereLight(
      "#e5e8ee",
      "#8c8378",
      model.ambient ?? 0.22,
    );
    this.scene.add(this.ambient);
    this.fill = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.fill);
    this.fixtures = new Map();
    for (const c of model.controls) {
      const light = new THREE.PointLight(
        c.color || "#fff0d4",
        c.type !== "light" ? 0 : (c.intensity ?? 12),
        20,
        2,
      );
      light.position.fromArray(c.position);
      light.castShadow = c.type === "light";
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.001;
      light.shadow.normalBias = 0.02;
      if (c.type === "light") this.scene.add(light);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#c3dbab", depthTest: false }),
      );
      const device = deviceForControl(model, c.id),
        companion = device && device.height !== c.id;
      marker.visible =
        !companion && this.options.markers && this.options.mode !== "floor";
      marker.position.fromArray(c.position);
      marker.userData.pickControl = c.id;
      marker.renderOrder = 10;
      this.scene.add(marker);
      const mats = [];
      for (const id of c.nodeIds || []) {
        const node = this.nodes.get(id);
        if (node)
          node.traverse((o) => {
            o.userData.pickControl = c.id;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              if (m?.isMeshStandardMaterial)
                mats.push([m, m.emissiveIntensity]);
          });
      }
      const coverNodes =
        c.type === "cover"
          ? (c.nodeIds || []).map((id) => this.nodes.get(id)).filter(Boolean)
          : [];
      for (const node of coverNodes)
        setShadePosition(node, c.defaultPosition ?? 0);
      const numberNodes =
        c.type === "number"
          ? (c.nodeIds || []).map((id) => this.nodes.get(id)).filter(Boolean)
          : [];
      for (const node of numberNodes) setNumberValue(node, c.defaultValue);
      if (numberNodes.length) {
        const motion = numberNodes[0].userData.numberMotion;
        marker.position.y =
          c.position[1] +
          (c.defaultValue - motion.restValue) * motion.metersPerUnit;
      }
      this.fixtures.set(c.id, {
        numberNodes,
        markerRestY: c.position[1],
        type: c.type,
        companion,
        light,
        marker,
        mats,
        coverNodes,
        base: c.intensity ?? 12,
      });
    }
    this.daylight = model.daylight ? createDaylight(model.daylight) : null;
    if (this.daylight) this.scene.add(this.daylight.group);
    this.daylightMode = model.daylight?.mode ?? "night";
    this.sunEntity = undefined;
    this.lastStates = new Map();
    const box = new THREE.Box3().setFromObject(this.asset),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    this.bounds = box;
    this.defaultTarget = model.camera?.target || center.toArray();
    this.defaultPosition =
      model.camera?.position ||
      center
        .clone()
        .add(new THREE.Vector3(size * 0.7, size * 0.65, size * 0.7))
        .toArray();
    const prepared = performance.now();
    this.setView(this.options.mode);
    this.renderer.domElement.dataset.prepareMs = Math.round(prepared - started);
    this.renderer.domElement.dataset.firstRenderMs = Math.round(
      performance.now() - prepared,
    );
    return true;
  }
  setView(mode) {
    if (
      this.options.camera &&
      (mode === "floor") !== (this.options.camera.projection === "orthographic")
    )
      this.options.camera = undefined;
    this.options.mode = ["floor", "front"].includes(mode) ? mode : "dollhouse";
    this.scene.background.set("#242320");
    if (this.fill)
      this.fill.intensity = this.options.mode !== "dollhouse" ? 0.35 : 0.25;
    this.camera =
      this.options.mode === "floor"
        ? new THREE.OrthographicCamera()
        : new THREE.PerspectiveCamera(
            this.options.mode === "front" ? 35 : 45,
            1,
            0.05,
            500,
          );
    // OrbitControls caches the camera up-axis when constructed.
    // Build it again after setting the floor camera orientation.
    if (this.options.mode !== "dollhouse") this.fitFloor();
    this.orbit.dispose();
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = false;
    this.orbit.enabled = this.options.interactive;
    this.orbit.addEventListener("change", () => {
      this.cutaway();
      this.render();
      this.options.onCameraChange?.({ source: "orbit" });
    });
    this.orbit.enableRotate =
      this.options.allowRotate ?? this.options.mode !== "floor";
    for (const f of this.fixtures.values())
      f.marker.visible =
        !f.companion && this.options.markers && this.options.mode !== "floor";
    this.renderer.domElement.setAttribute(
      "aria-label",
      this.options.mode === "floor"
        ? "3D floor plan with a slight overhead tilt. No device icons."
        : this.options.mode === "front"
          ? "3D room from the front. Select the modeled device to control it."
          : "3D model. Drag to orbit; use the device controls below for keyboard access.",
    );
    this.reset();
  }
  setCameraPreset(name) {
    if (!this.model) return;
    const preset = cameraPreset(name, this.options.mode);
    Object.assign(this.options, preset);
    this.setView(preset.view);
    this.options.onCameraChange?.({ source: "preset" });
  }
  rotateCamera(horizontal, vertical) {
    if (!this.model || !this.orbit.enabled) return;
    // Use the same up-axis as OrbitControls, including top/bottom presets.
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      this.camera.up,
      new THREE.Vector3(0, 1, 0),
    );
    const offset = this.camera.position
      .clone()
      .sub(this.orbit.target)
      .applyQuaternion(rotation);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= horizontal;
    spherical.phi -= vertical;
    spherical.phi = Math.max(1e-6, Math.min(Math.PI - 1e-6, spherical.phi));
    offset.setFromSpherical(spherical).applyQuaternion(rotation.invert());
    this.camera.position.copy(this.orbit.target).add(offset);
    this.orbit.update();
  }
  fitFloor() {
    if (!this.bounds) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    const f = this.options.camera
      ? restoreCameraView(this.options.camera, {
          aspect: width / height,
          heading: this.options.heading,
          tilt: this.options.tilt,
          zoom: this.options.zoom,
        })
      : (this.options.mode === "front" ? perspectiveFrame : floorFrame)(
          this.bounds.min.toArray(),
          this.bounds.max.toArray(),
          width / height,
          this.options.tilt ?? (this.options.mode === "front" ? 28 : 8),
          this.options.heading ?? 0,
        );
    Object.assign(this.camera, {
      aspect: width / height,
      left: f.left,
      right: f.right,
      top: f.top,
      bottom: f.bottom,
      near: f.near,
      far: f.far,
      zoom: f.zoom ?? this.options.zoom ?? 1,
    });
    if (this.camera.isPerspectiveCamera && f.fov) this.camera.fov = f.fov;
    this.camera.position.fromArray(f.position);
    this.camera.up.fromArray(f.up);
    this.orbit.target.fromArray(f.target);
    this.camera.lookAt(this.orbit.target);
    this.camera.updateProjectionMatrix();
  }
  captureView() {
    if (!this.model || !this.bounds) return null;
    return captureCameraView({
      position: this.camera.position.toArray(),
      target: this.orbit.target.toArray(),
      up: this.camera.up.toArray(),
      aspect: this.camera.aspect,
      zoom: this.camera.zoom,
      fov: this.camera.fov,
      ...(this.camera.isOrthographicCamera
        ? { halfHeight: (this.camera.top - this.camera.bottom) / 2 }
        : {}),
      min: this.bounds.min.toArray(),
      max: this.bounds.max.toArray(),
    });
  }
  reset() {
    if (!this.model) return;
    if (this.options.mode !== "dollhouse") {
      this.fitFloor();
      this.orbit.update();
      this.cutaway();
      this.render();
      return;
    }
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.camera.position.fromArray(this.defaultPosition);
    this.orbit.target.fromArray(this.defaultTarget);
    this.orbit.update();
    this.cutaway();
    this.render();
  }
  cutaway() {
    this.asset?.traverse((o) => {
      if (o.userData.ceiling) o.visible = !!o.userData.controlId;
      if (o.userData.wallNormal) o.visible = true;
    });
  }
  setStates(states) {
    if (!this.model) return;
    this.lastStates = states;
    for (const [id, f] of this.fixtures) {
      const s = states.get(id) || { on: false };
      if (f.numberNodes.length) {
        for (const node of f.numberNodes) setNumberValue(node, s.value);
        if (Number.isFinite(s.value)) {
          const motion = f.numberNodes[0].userData.numberMotion;
          f.marker.position.y =
            f.markerRestY +
            (Math.max(motion.min, Math.min(motion.max, s.value)) -
              motion.restValue) *
              motion.metersPerUnit;
        }
        f.marker.material.color.set(s.unavailable ? "#858b86" : "#c3dbab");
        continue;
      }
      if (f.type === "button") {
        f.marker.material.color.set(s.unavailable ? "#858b86" : "#c3dbab");
        continue;
      }
      if (f.type === "cover") {
        for (const node of f.coverNodes) setShadePosition(node, s.position);
        f.marker.material.color.set(s.unavailable ? "#858b86" : "#c3dbab");
        continue;
      }
      const amount = s.on ? (s.brightness ?? 255) / 255 : 0;
      const color = s.rgb
        ? new THREE.Color().setRGB(
            ...s.rgb.map((v) => v / 255),
            THREE.SRGBColorSpace,
          )
        : f.light.color;
      f.light.color.copy(color);
      f.light.intensity = f.base * amount;
      f.marker.material.color.set(
        s.unavailable ? "#88908b" : s.on ? color : "#697b6d",
      );
      for (const [m, intensity] of f.mats) {
        m.emissive.copy(color);
        m.emissiveIntensity = intensity * amount;
      }
    }
    this.ambient.intensity = this.daylight
      ? 0.12
      : this.options.mode !== "dollhouse"
        ? Math.max(this.model.ambient ?? 0.22, 0.55)
        : (this.model.ambient ?? 0.22);
    for (const [m, color] of this.materials)
      m.color.copy(color).multiplyScalar(0.5);
    this.updateDaylight();
    this.render();
  }
  setDaylight(mode, sunEntity) {
    this.daylightMode = mode;
    this.sunEntity = sunEntity;
    this.updateDaylight();
    this.render();
  }
  updateDaylight() {
    if (!this.daylight) return;
    this.fill.intensity = 0.08;
    const positions = new Map(
      [...this.lastStates].map(([id, s]) => [id, s.position]),
    );
    this.daylight.update(this.daylightMode, this.sunEntity, positions);
  }
  highlight(id) {
    for (const [key, f] of this.fixtures)
      f.marker.scale.setScalar(key === id ? 2 : 1);
    this.render();
  }
  clear() {
    ++this.generation;
    this.disposeScene(this.scene);
    this.scene.clear();
    this.model = null;
    this.render();
  }
  dispose() {
    ++this.generation;
    this.resize.disconnect();
    this.orbit.dispose();
    this.disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
  fixtureScreenPosition(id) {
    const fixture = this.fixtures.get(id);
    if (!fixture) return null;
    const point = fixture.marker.position.clone().project(this.camera);
    return {
      x: ((point.x + 1) * this.container.clientWidth) / 2,
      y: ((1 - point.y) * this.container.clientHeight) / 2,
      visible:
        point.z >= -1 &&
        point.z <= 1 &&
        Math.abs(point.x) <= 1 &&
        Math.abs(point.y) <= 1,
    };
  }
  render() {
    this.renderer.render(this.scene, this.camera);
    this.options.onRender?.();
    const e = this.camera.matrixWorld.elements;
    const vector = (offset) =>
      e.slice(offset, offset + 3).map((n) => Math.round(n * 1e5) / 1e5);
    this.container.dispatchEvent(
      new CustomEvent("room-camera-orientation", {
        detail: { right: vector(0), up: vector(4), normal: vector(8) },
      }),
    );
  }
}
