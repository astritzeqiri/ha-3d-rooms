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
      "3D model. Drag to orbit; use the Lights controls below for keyboard access.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0b100e");
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = false;
    this.orbit.enabled = this.options.interactive;
    this.orbit.addEventListener("change", () => {
      this.cutaway();
      this.render();
    });
    this.resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      this.renderer.setSize(width, height);
      if (!width || !height) return;
      this.camera.aspect = width / height;
      if (this.options.mode !== "dollhouse" && this.model) this.fitFloor();
      this.camera.updateProjectionMatrix();
      this.render();
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
        o.castShadow = true;
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
        c.intensity ?? 12,
        20,
        2,
      );
      light.position.fromArray(c.position);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.001;
      light.shadow.normalBias = 0.02;
      this.scene.add(light);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#c3dbab", depthTest: false }),
      );
      marker.visible = this.options.markers && this.options.mode !== "floor";
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
      this.fixtures.set(c.id, { light, marker, mats, base: c.intensity ?? 12 });
    }
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
    this.setView(this.options.mode);
    return true;
  }
  setView(mode) {
    this.options.mode = ["floor", "front"].includes(mode) ? mode : "dollhouse";
    this.scene.background.set(
      this.options.mode !== "dollhouse" ? "#1c1c1c" : "#0b100e",
    );
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
    });
    this.orbit.enableRotate = this.options.mode !== "floor";
    for (const f of this.fixtures.values())
      f.marker.visible = this.options.markers && this.options.mode !== "floor";
    this.renderer.domElement.setAttribute(
      "aria-label",
      this.options.mode === "floor"
        ? "3D floor plan with a slight overhead tilt. No device icons."
        : this.options.mode === "front"
          ? "3D room from the front. Select the pendant light to control it."
          : "3D model. Drag to orbit; use the Lights controls below for keyboard access.",
    );
    this.reset();
  }
  fitFloor() {
    if (!this.bounds) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    const f = (this.options.mode === "front" ? perspectiveFrame : floorFrame)(
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
      zoom: 1,
    });
    this.camera.position.fromArray(f.position);
    this.camera.up.fromArray(f.up);
    this.orbit.target.fromArray(f.target);
    this.camera.lookAt(this.orbit.target);
    this.camera.updateProjectionMatrix();
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
    for (const [id, f] of this.fixtures) {
      const s = states.get(id) || { on: false };
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
    this.ambient.intensity =
      this.options.mode !== "dollhouse"
        ? Math.max(this.model.ambient ?? 0.22, 0.55)
        : (this.model.ambient ?? 0.22);
    for (const [m, color] of this.materials)
      m.color.copy(color).multiplyScalar(0.5);
    this.render();
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
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
