import { applyShadowBudget } from "../shared/shadow-budget.mjs";
import { setLockTurn } from "../shared/lock.mjs";
import {
  capShadowMapSize,
  isMobileDevice,
  renderProfile,
} from "../shared/render-profile.mjs";
import { createClimateVisual } from "../shared/climate-visual.mjs";
import { climateAppearance } from "../shared/climate.mjs";
import { offsetPoint } from "../shared/marker-settings.mjs";
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
import { frontPoint } from "../shared/room-focus.mjs";
import {
  coveredByOtherRoom,
  unpackDepth,
  viewDistance,
} from "../shared/occlusion.mjs";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadSceneAsset } from "../shared/scene-assets.mjs";
import { createEffectRun } from "../shared/light-effects.mjs";
/**
 * What decides a view's shader variants: the rooms shown (their materials
 * and lights). Floors or a whole house that show the same rooms share them.
 */
function houseViewKey(model) {
  return (model?.members || [])
    .map((member) => member.model)
    .sort()
    .join("|");
}
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
    this.effectColor = new THREE.Color();
    this.generation = 0;
    this.climateFrame = 0;
    this.visibilityChanged = () => this.syncClimateAnimation();
    document.addEventListener("visibilitychange", this.visibilityChanged);
    this.profile = renderProfile({
      quality: this.options.quality,
      mobile: isMobileDevice(),
      devicePixelRatio: globalThis.devicePixelRatio,
    });
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.profile.antialias,
      // A transparent canvas lets the card paint its own backdrop behind the room.
      alpha: !!this.options.transparent,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Lights and geometry do not move with the camera, so orbiting reuses shadow maps.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setPixelRatio(this.profile.pixelRatio);
    this.renderer.domElement.dataset.renderProfile = this.profile.low
      ? "low"
      : "high";
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D model. Drag to orbit; use the device controls below for keyboard access.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    container.append(this.renderer.domElement);
    // The browser can take the graphics context away (GPU reset, memory
    // pressure, too many 3D views). Stop drawing, tell the owner, and redraw
    // everything if the browser hands the context back.
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.contextLost = true;
      if (this.climateFrame) cancelAnimationFrame(this.climateFrame);
      this.climateFrame = 0;
      this.options.onContextLost?.();
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.shadowsCurrent = false;
      this.render();
      this.options.onContextRestored?.();
    });
    // On a page that scrolls, the wheel scrolls the page until the model has
    // been clicked or dragged; Ctrl/⌘ + wheel (and trackpad pinch) always zoom.
    this.wheelGate = (event) => {
      if (
        !this.options.scrollSafeZoom ||
        event.ctrlKey ||
        event.metaKey ||
        this.wheelEngaged
      )
        return;
      const page = document.scrollingElement;
      if (page && page.scrollHeight > page.clientHeight + 1)
        event.stopPropagation();
    };
    container.addEventListener("wheel", this.wheelGate, { capture: true });
    this.renderer.domElement.addEventListener("pointerdown", () => {
      this.wheelEngaged = true;
    });
    this.renderer.domElement.addEventListener("pointerleave", () => {
      this.wheelEngaged = false;
    });
    this.scene = new THREE.Scene();
    this.scene.background = this.options.transparent
      ? null
      : new THREE.Color("#242320");
    if (this.options.transparent) this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = false;
    this.setInteractive(this.options.interactive);
    this.orbit.addEventListener("change", () => {
      this.cutaway();
      this.render({ cameraOnly: true });
      this.options.onCameraChange?.({ source: "orbit" });
    });
    this.resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      if (this.options.mode !== "dollhouse" && this.model) this.fitFloor();
      this.camera.updateProjectionMatrix();
      this.render({ cameraOnly: true });
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
          if (this.model?.houseView && o.userData.pickRoom) {
            this.options.onRoomPick?.(o.userData.pickRoom);
            this.recordRoomTap(o.userData.pickRoom, e.clientX, e.clientY);
            return;
          }
          if (
            o.userData.pickControl &&
            !this.model?.controls.find((c) => c.id === o.userData.pickControl)
              ?.hidden &&
            (!this.model?.houseView || !this.options.onRoomPick)
          ) {
            const control = this.model.controls.find(
              (c) => c.id === o.userData.pickControl,
            );
            const primary = control?.lightGroup
              ? this.model.controls.find(
                  (c) =>
                    c.lightGroup === control.lightGroup && c.lightGroupPrimary,
                )
              : control;
            onPick(primary?.id || o.userData.pickControl);
            return;
          }
          o = o.parent;
        }
      }
    });
  }
  highlightRoom(id) {
    if (this.roomHighlight) {
      this.scene.remove(this.roomHighlight);
      this.roomHighlight.geometry.dispose();
      this.roomHighlight.material.dispose();
      this.roomHighlight = null;
    }
    const room = this.asset?.children.find(
      (child) => child.userData.pickRoom === id,
    );
    if (room) {
      room.updateWorldMatrix(true, true);
      this.roomHighlight = new THREE.BoxHelper(room, 0xedac8c);
      this.scene.add(this.roomHighlight);
    }
    this.render();
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
  async load(model, url, assetCache) {
    const started = performance.now();
    const generation = ++this.generation;
    const gltf = await loadSceneAsset(url, assetCache, this.renderer);
    this.renderer.domElement.dataset.assetCache = gltf.hit ? "hit" : "miss";
    if (generation !== this.generation) {
      this.disposeScene(gltf.scene);
      return false;
    }
    return this.prepareAsset(model, gltf.scene, started);
  }
  async loadLayers(model, layers) {
    const started = performance.now(),
      generation = ++this.generation;
    const root = new THREE.Group();
    let cacheHits = 0;
    const cacheSizes = [];
    try {
      for (const layer of layers) {
        const gltf = await loadSceneAsset(
          layer.url,
          layer.assetCache,
          this.renderer,
        );
        if (gltf.hit) cacheHits++;
        cacheSizes.push(Math.round((gltf.bytes || 0) / 1024 / 1024));
        if (generation !== this.generation) {
          this.disposeScene(gltf.scene);
          this.disposeScene(root);
          return false;
        }
        gltf.scene.traverse((object) => {
          if (object.userData.appearanceId)
            object.userData.appearanceVisible =
              (layer.appearance || []).find(
                (p) => p.id === object.userData.appearanceId,
              )?.visible ?? true;
          if (
            object.userData.controlId &&
            layer.nodeIds[object.userData.controlId]
          )
            object.userData.controlId =
              layer.nodeIds[object.userData.controlId];
        });
        const placement = new THREE.Group();
        placement.userData.pickRoom = layer.model;
        placement.matrixAutoUpdate = false;
        placement.matrix.fromArray(layer.transform);
        placement.matrixWorldNeedsUpdate = true;
        placement.add(gltf.scene);
        root.add(placement);
      }
      this.renderer.domElement.dataset.assetCacheMb = cacheSizes.join(",");
      this.renderer.domElement.dataset.assetCache =
        cacheHits === layers.length ? "hit" : cacheHits ? "partial" : "miss";
      return this.prepareAsset(model, root, started);
    } catch (error) {
      this.disposeScene(root);
      throw error;
    }
  }
  prepareAsset(model, asset, started) {
    this.shadowsCurrent = false;
    // Shader variants belong to the previous scene's materials.
    this.preparedViews = new Map();
    this.clearClimateVisuals();
    this.disposeScene(this.scene);
    this.scene.clear();
    this.groundShadow = null;
    this.groundBox = null;
    this.roomHighlight = null;
    this.model = model;
    this.asset = asset;
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
        companion =
          (device && device.height !== c.id) || c.lightGroupPrimary === false;
      marker.visible =
        !c.hidden &&
        !companion &&
        c.lightGroupPrimary !== false &&
        this.options.markers &&
        (this.options.mode !== "floor" || !!this.options.floorMarkers);
      marker.position.fromArray(c.markerPosition || c.position);
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
      const climateVisuals =
        c.type === "climate"
          ? (c.nodeIds || [])
              .map((id) => this.nodes.get(id))
              .filter(Boolean)
              .map((root) =>
                createClimateVisual(root, {
                  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches,
                }),
              )
              .filter(Boolean)
          : [];
      const lockNodes =
        c.type === "lock"
          ? (c.nodeIds || []).map((id) => this.nodes.get(id)).filter(Boolean)
          : [];
      this.fixtures.set(c.id, {
        lockNodes,
        climateVisuals,
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
    // Nested controls (a lock on a hinged door) own their own meshes: assign
    // picking from the outermost control root inwards so the deepest wins.
    const depth = (o) => {
      let d = 0;
      for (let p = o.parent; p; p = p.parent) d++;
      return d;
    };
    model.controls
      .flatMap((c) =>
        (c.nodeIds || [])
          .map((id) => this.nodes.get(id))
          .filter(Boolean)
          .map((node) => [c.id, node]),
      )
      .sort((a, b) => depth(a[1]) - depth(b[1]))
      .forEach(([id, node]) =>
        node.traverse((o) => {
          o.userData.pickControl = id;
        }),
      );
    this.daylight = model.daylight ? createDaylight(model.daylight) : null;
    if (this.daylight) this.scene.add(this.daylight.group);
    this.daylightMode = model.daylight?.mode ?? "night";
    this.sunEntity = undefined;
    this.lastStates = new Map();
    const { center, size } = this.applyHouseScope();
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
  /**
   * Limit a loaded house to one of its views: member rooms, in-scope fixtures,
   * floor clipping, shadow budget and camera bounds. Rooms use every fixture.
   */
  applyHouseScope() {
    const model = this.model,
      floor = model.houseFloor,
      placements = model.members
        ? this.asset.children.filter((child) => child.userData.pickRoom)
        : [];
    const members = new Set((model.members || []).map((m) => m.model));
    for (const placement of placements)
      placement.visible = members.has(placement.userData.pickRoom);
    const scoped = new Set(model.controls.map((c) => c.id));
    for (const [id, fixture] of this.fixtures) {
      fixture.outOfScope = !scoped.has(id);
      fixture.light.visible = !fixture.outOfScope;
      fixture.light.castShadow =
        fixture.type === "light" && !fixture.outOfScope;
      if (fixture.outOfScope) fixture.marker.visible = false;
    }
    // Only the shown rooms' windows light the view.
    this.daylight?.setScope(model.members ? [...members] : null);
    // Re-offer window shadows: an earlier, narrower view may have budgeted them out.
    this.daylight?.group.traverse((o) => {
      if (o.isSpotLight) o.castShadow = true;
    });
    const shadows = applyShadowBudget(
      this.scene,
      this.renderer.capabilities.maxTextures,
      this.profile?.shadowPasses,
    );
    capShadowMapSize(this.scene, this.profile?.shadowMapSize);
    if (this.renderer.domElement)
      this.renderer.domElement.dataset.shadowLights = shadows.shadowLights;
    // Manual house placements and restored control transforms must reach world space before fitting the camera.
    this.asset.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const object of placements.length
      ? placements.filter((placement) => placement.visible)
      : [this.asset])
      box.expandByObject(object);
    if (box.isEmpty()) box.setFromObject(this.asset);
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    if (floor) {
      box.min.y = Math.max(box.min.y, floor.minY);
      box.max.y = Math.min(box.max.y, floor.maxY);
      if (box.max.y < box.min.y) box.max.y = box.min.y + 0.1;
    }
    this.updateGroundShadow(box);
    // Houses always keep two planes (open-ended for the whole house) so a floor
    // switch only moves them and never recompiles every material.
    const clipped = !!floor || !!model.houseView;
    this.renderer.localClippingEnabled = clipped;
    const planes = clipped
      ? [
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -(floor?.minY ?? -1e5)),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), floor?.maxY ?? 1e5),
        ]
      : [];
    this.asset.traverse((object) => {
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        if (material) {
          if ((material.clippingPlanes?.length || 0) !== planes.length)
            material.needsUpdate = true;
          material.clippingPlanes = planes;
          material.clipShadows = true;
        }
    });
    this.bounds = box;
    this.clipPlanes = planes;
    // One box per shown room, for the room-focus buttons.
    this.roomBoxes = new Map();
    if (model.members)
      for (const placement of placements)
        if (placement.visible)
          this.roomBoxes.set(
            placement.userData.pickRoom,
            new THREE.Box3().expandByObject(placement),
          );
    return { center, size };
  }
  /** Screen position of a world point: `{ x, y, visible }` in container pixels. */
  /** A soft contact shadow under the model, sized to what is currently shown. */
  /** Turn the contact shadow on or off for the view being edited. */
  setGroundShadow(enabled) {
    this.options.groundShadow = !!enabled;
    if (this.groundShadow)
      this.groundShadow.visible = !!enabled && this.options.mode !== "floor";
    if (enabled && !this.groundShadow && this.groundBox)
      this.updateGroundShadow(this.groundBox);
    this.render();
  }
  updateGroundShadow(box) {
    this.groundBox = box.clone();
    if (!this.options.groundShadow || this.options.mode === "floor") {
      if (this.groundShadow) this.groundShadow.visible = false;
      return;
    }
    if (!this.groundShadow) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const context = canvas.getContext("2d"),
        gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(0,0,0,0.55)");
      gradient.addColorStop(0.55, "rgba(0,0,0,0.28)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = -1;
      mesh.name = "ground-shadow";
      mesh.raycast = () => {};
      this.groundShadow = mesh;
      this.scene.add(mesh);
    }
    const size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    this.groundShadow.position.set(center.x, box.min.y - 0.02, center.z);
    this.groundShadow.scale.set(size.x * 1.5, size.z * 1.5, 1);
    this.groundShadow.visible = true;
  }
  screenPoint(point) {
    const v = new THREE.Vector3(...point).project(this.camera);
    return {
      x: ((v.x + 1) * this.container.clientWidth) / 2,
      y: ((1 - v.y) * this.container.clientHeight) / 2,
      visible:
        v.z >= -1 && v.z <= 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    };
  }
  /**
   * The world point under a screen position on the horizontal plane at
   * height `y` (or null when the view never meets it). Used to drag room
   * buttons around, also beside the model.
   */
  groundPoint(clientX, clientY, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      ),
      this.camera,
    );
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -y),
      new THREE.Vector3(),
    );
    return hit ? hit.toArray() : null;
  }
  /**
   * The height (y) of the point under a screen position on the vertical
   * plane through `point` that faces the camera; null when looking straight
   * down. Used to raise and lower room buttons.
   */
  verticalPoint(clientX, clientY, point) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ray = new THREE.Raycaster(),
      forward = this.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return null;
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      ),
      this.camera,
    );
    const hit = ray.ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(
        forward.normalize(),
        new THREE.Vector3(...point),
      ),
      new THREE.Vector3(),
    );
    return hit ? hit.y : null;
  }
  /**
   * Where each shown room's button goes and how much of the room can be seen:
   * `[{ room, x, y, visible, exposure, manual }]`. `positions` maps a room to
   * a world point chosen for its button; otherwise the button sits at the
   * middle of the room's floor edge that is lowest on screen. `exposure` is
   * the share (0 to 1) of the room's footprint on screen that is not covered
   * by another room in front of it.
   */
  roomFrontPoints(positions = {}) {
    const boxes = [...(this.roomBoxes || [])];
    if (!boxes.length) return [];
    const width = this.container.clientWidth,
      height = this.container.clientHeight,
      v = new THREE.Vector3(),
      point = (p) => {
        v.set(...p).project(this.camera);
        return {
          world: [...p],
          x: ((v.x + 1) * width) / 2,
          y: ((1 - v.y) * height) / 2,
          visible:
            v.z >= -1 && v.z <= 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
        };
      },
      ray = new THREE.Raycaster(),
      ndc = new THREE.Vector2(),
      at = new THREE.Vector3();
    // The room whose box a screen point sees first.
    const nearest = (x, y) => {
      ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2);
      ray.setFromCamera(ndc, this.camera);
      let best = null,
        distance = Infinity;
      for (const [room, box] of boxes)
        if (ray.ray.intersectBox(box, at)) {
          const d = at.distanceToSquared(ray.ray.origin);
          if (d < distance) {
            distance = d;
            best = room;
          }
        }
      return best;
    };
    const exposure = (room, box) => {
      const xs = [],
        ys = [];
      for (let corner = 0; corner < 8; corner++) {
        const p = point(
          [0, 1, 2].map((i) =>
            ((corner >> i) & 1 ? box.max : box.min).getComponent(i),
          ),
        );
        xs.push(p.x);
        ys.push(p.y);
      }
      const left = Math.max(0, Math.min(...xs)),
        right = Math.min(width, Math.max(...xs)),
        top = Math.max(0, Math.min(...ys)),
        bottom = Math.min(height, Math.max(...ys));
      if (right <= left || bottom <= top) return 1;
      let seen = 0,
        total = 0;
      const steps = 8;
      for (let i = 0; i < steps; i++)
        for (let j = 0; j < steps; j++) {
          const x = left + ((i + 0.5) * (right - left)) / steps,
            y = top + ((j + 0.5) * (bottom - top)) / steps;
          // Only samples that land on this room's box count.
          const first = nearest(x, y);
          if (first === room) seen++;
          if (first === room || ray.ray.intersectsBox(box)) total++;
        }
      return total ? seen / total : 1;
    };
    return boxes.map(([room, box]) => {
      const manual = positions[room];
      let placed;
      if (manual) placed = point(manual);
      else {
        const cx = (box.min.x + box.max.x) / 2,
          cz = (box.min.z + box.max.z) / 2,
          y = box.min.y;
        placed = frontPoint(
          [
            [cx, y, box.min.z],
            [cx, y, box.max.z],
            [box.min.x, y, cz],
            [box.max.x, y, cz],
          ].map(point),
        );
      }
      return {
        room,
        ...placed,
        exposure: exposure(room, box),
        manual: !!manual,
      };
    });
  }
  /**
   * Show another view (whole house or one floor) of the loaded house in place.
   * Returns false when that view needs rooms this scene did not load.
   */
  setHouseView(model, { keepCamera = false, render = true } = {}) {
    if (!this.canShowHouseView(model)) return false;
    this.model = model;
    // Draw once at the end; callers that apply new states pass render: false.
    this.renderSuspended = true;
    try {
      this.applyHouseScope();
      if (this.roomHighlight) this.highlightRoom(null);
      if (keepCamera) this.cutaway();
      else this.reset();
    } finally {
      this.renderSuspended = false;
    }
    if (render) this.setStates(this.lastStates || new Map());
    return true;
  }
  /**
   * True when `setHouseView(model)` can show the view without compiling
   * shaders. Every distinct set of visible rooms (and so of lights) needs its
   * own shader variants; the first time one is drawn the page freezes for as
   * long as the graphics driver takes to build them (seconds on a big room).
   */
  isHouseViewPrepared(model) {
    return (
      !model?.houseView || this.preparedViews?.get(houseViewKey(model)) === true
    );
  }
  /**
   * Build the shaders of another view of the loaded house ahead of time,
   * without showing it. The compile runs in the graphics driver's own
   * threads, so the page stays responsive; the promise resolves (true) when
   * the view can be shown without a pause, or false when it cannot be shown.
   */
  prepareHouseView(model) {
    if (!this.canShowHouseView(model)) return Promise.resolve(false);
    const key = houseViewKey(model);
    this.preparedViews ||= new Map();
    if (this.isHouseViewPrepared(model)) return Promise.resolve(true);
    const views = this.preparedViews,
      pending = views.get(key);
    if (pending) return pending;
    const current = this.model,
      shadowsCurrent = this.shadowsCurrent;
    let compiled;
    this.renderSuspended = true;
    try {
      // Show the view's lights and rooms for the length of the compile call
      // only; nothing is drawn in between.
      this.model = model;
      this.applyHouseScope();
      // three compiles every material of the object it is given, shown or
      // not; hand it only what this view shows (lights come from the scene).
      const shown = {
        traverse: (visit) => this.scene.traverseVisible(visit),
        traverseVisible: () => {},
      };
      compiled = this.renderer.compileAsync(shown, this.camera, this.scene);
    } catch {
      compiled = Promise.resolve();
    } finally {
      this.model = current;
      this.applyHouseScope();
      this.refreshVisibility();
      this.renderSuspended = false;
      // Nothing was drawn, so the shadow maps are as current as before.
      this.shadowsCurrent = shadowsCurrent;
    }
    const ready = Promise.resolve(compiled)
      .catch(() => {})
      .then(() => {
        // The scene was replaced meanwhile: these shaders are not its own.
        if (views !== this.preparedViews) return false;
        views.set(key, true);
        return true;
      });
    views.set(key, ready);
    return ready;
  }
  /** Whether the loaded house has every room of `model` to show. */
  canShowHouseView(model) {
    if (!this.asset || !this.model?.houseView || !model?.houseView)
      return false;
    if (model.houseId !== this.model.houseId) return false;
    const loaded = new Set(
      this.asset.children.map((child) => child.userData.pickRoom),
    );
    return model.members.every((member) => loaded.has(member.model));
  }
  setView(mode) {
    if (
      this.options.camera &&
      (mode === "floor") !== (this.options.camera.projection === "orthographic")
    )
      this.options.camera = undefined;
    this.options.mode = ["floor", "front"].includes(mode) ? mode : "dollhouse";
    this.scene.background?.set("#242320");
    if (this.groundShadow)
      this.groundShadow.visible =
        !!this.options.groundShadow && this.options.mode !== "floor";
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
    this.setInteractive(this.options.interactive);
    this.orbit.addEventListener("change", () => {
      this.cutaway();
      this.render({ cameraOnly: true });
      this.options.onCameraChange?.({ source: "orbit" });
    });
    this.orbit.enableRotate =
      this.options.allowRotate ?? this.options.mode !== "floor";
    // Without rotation (floor plans), a one-finger or left drag pans the plan.
    if (!this.orbit.enableRotate) {
      this.orbit.mouseButtons.LEFT = THREE.MOUSE.PAN;
      this.orbit.touches.ONE = THREE.TOUCH.PAN;
    }
    for (const [id, f] of this.fixtures)
      f.marker.visible =
        !this.model.controls.find((c) => c.id === id)?.hidden &&
        !f.outOfScope &&
        !f.companion &&
        this.options.markers &&
        (this.options.mode !== "floor" || !!this.options.floorMarkers);
    this.renderer.domElement.setAttribute(
      "aria-label",
      this.model.houseView
        ? "3D house view. Drag to orbit and use the camera controls to frame the house."
        : this.options.mode === "floor"
          ? "3D floor plan. Select a device control to interact."
          : this.options.mode === "front"
            ? "3D room from the front. Select the modeled device to control it."
            : "3D model. Drag to orbit; use the device controls below for keyboard access.",
    );
    this.reset();
  }
  /**
   * Two quick taps on the same room (not on a device) count as a double tap:
   * `onRoomDoubleTap(room)`. Returns true when this tap completed one.
   */
  recordRoomTap(room, x, y, now = performance.now()) {
    const last = this.lastRoomTap;
    if (
      last &&
      last.room === room &&
      now - last.time < 400 &&
      Math.hypot(x - last.x, y - last.y) < 24
    ) {
      this.lastRoomTap = null;
      this.options.onRoomDoubleTap?.(room);
      return true;
    }
    this.lastRoomTap = { room, x, y, time: now };
    return false;
  }
  /** Allow or lock camera movement; locked views leave touch scrolling to the page. */
  setInteractive(enabled) {
    this.options.interactive = !!enabled;
    this.orbit.enabled = this.options.interactive;
    this.renderer.domElement.style.touchAction = this.options.interactive
      ? "none"
      : this.options.onRoomDoubleTap
        ? "manipulation"
        : "";
  }
  setFloorPlan() {
    if (!this.model) return;
    Object.assign(this.options, cameraPreset("top", "floor"));
    this.setView("floor");
    this.options.onCameraChange?.({ source: "preset" });
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
    // A focused room is framed on its own; the card's saved camera frames the house.
    const focused = !!this.model?.focusRoom;
    // A room may ask for its own angle when opened on its own.
    const frame = focused ? this.model.focusFrame : undefined;
    const f =
      this.options.camera && !focused
        ? restoreCameraView(this.options.camera, {
            aspect: width / height,
            min: this.bounds.min.toArray(),
            max: this.bounds.max.toArray(),
            heading: this.options.heading,
            tilt: this.options.tilt,
            zoom: this.options.zoom,
          })
        : (this.options.mode === "front" ? perspectiveFrame : floorFrame)(
            this.bounds.min.toArray(),
            this.bounds.max.toArray(),
            width / height,
            frame?.tilt ??
              this.options.tilt ??
              (this.options.mode === "front" ? 28 : 0),
            frame?.heading ?? this.options.heading ?? 0,
          );
    Object.assign(this.camera, {
      aspect: width / height,
      left: f.left,
      right: f.right,
      top: f.top,
      bottom: f.bottom,
      near: f.near,
      far: f.far,
      zoom: f.zoom ?? (focused ? 1 : this.options.zoom) ?? 1,
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
      if (o.userData.appearanceId)
        o.visible = this.model.houseView
          ? o.userData.appearanceVisible !== false
          : (this.model.appearance || []).find(
              (p) => p.id === o.userData.appearanceId,
            )?.visible !== false;
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
      if (f.type === "lock") {
        // Unknown state keeps the exported (unlocked) pose rather than guessing.
        for (const node of f.lockNodes) setLockTurn(node, s.locked === true);
        f.marker.material.color.set(
          s.unavailable
            ? "#858b86"
            : s.jammed
              ? "#d9654f"
              : s.locked
                ? "#7fbf8a"
                : "#e2b45a",
        );
        continue;
      }
      if (f.type === "climate") {
        const appearance = climateAppearance(s);
        f.marker.material.color.set(appearance.color);
        for (const effect of f.climateVisuals) effect.setState(s);
        if (!f.climateVisuals.length)
          this.asset.traverse((o) => {
            if (
              o.userData.climateIndicator === id &&
              o.material?.isMeshStandardMaterial
            ) {
              o.material.emissive.set(appearance.color);
              o.material.emissiveIntensity = s.on && !s.unavailable ? 1 : 0;
            }
          });
        continue;
      }
      if (f.type === "cover") {
        for (const node of f.coverNodes)
          setShadePosition(node, s.position ?? s.motionPosition);
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
      // Remember the plain look; a running effect animates away from it.
      f.lightBase = { color: f.light.color.clone(), amount };
      f.effectRun ||= createEffectRun();
      f.effectRun.report(
        s.effect,
        !!s.on && !s.unavailable,
        performance.now() / 1000,
      );
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
    this.applyWorkLight();
    this.syncClimateAnimation();
    this.render();
  }
  setDaylight(mode, sunEntity) {
    this.daylightMode = mode;
    this.sunEntity = sunEntity;
    this.options.onDaylight?.();
    this.updateDaylight();
    this.applyWorkLight();
    this.render();
  }
  /**
   * With `workLight` (the manager), a room whose lights are all off stays
   * readable enough to find and connect its devices. Any light that is on
   * shows the room as it really looks.
   */
  applyWorkLight() {
    if (!this.options.workLight || !this.ambient) return;
    for (const f of this.fixtures.values())
      if (f.type === "light" && !f.outOfScope && f.light.intensity > 0) return;
    this.ambient.intensity = Math.max(this.ambient.intensity, 0.5);
    this.fill.intensity = Math.max(this.fill.intensity, 0.3);
  }
  updateDaylight() {
    if (!this.daylight) return;
    this.fill.intensity = 0.08;
    const positions = new Map(
      [...this.lastStates].map(([id, s]) => [id, s.position]),
    );
    this.daylight.update(this.daylightMode, this.sunEntity, positions);
  }
  refreshVisibility() {
    if (!this.model || !this.fixtures) return;
    for (const [id, fixture] of this.fixtures) {
      fixture.marker.visible =
        !this.model.controls.find((c) => c.id === id)?.hidden &&
        !fixture.outOfScope &&
        !fixture.companion &&
        this.options.markers &&
        (this.options.mode !== "floor" || !!this.options.floorMarkers);
    }
    this.render();
  }
  highlight(id) {
    for (const [key, f] of this.fixtures)
      f.marker.scale.setScalar(key === id ? 2.6 : 1);
    this.render();
  }
  clear() {
    this.clearClimateVisuals();
    ++this.generation;
    this.disposeScene(this.scene);
    this.scene.clear();
    this.groundShadow = null;
    this.groundBox = null;
    this.model = null;
    this.render();
  }
  dispose() {
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.container.removeEventListener("wheel", this.wheelGate, {
      capture: true,
    });
    this.clearClimateVisuals();
    ++this.generation;
    this.resize.disconnect();
    this.orbit.dispose();
    this.disposeScene(this.scene);
    this.coverTarget?.dispose();
    for (const material of this.coverMaterials || []) material?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
  /** Move a device's marker anchor (room icon moved in the manager). */
  setMarkerPosition(id, position) {
    const fixture = this.fixtures?.get(id);
    if (!fixture || !Array.isArray(position)) return;
    fixture.marker.position.fromArray(position);
    this.render({ cameraOnly: true });
  }
  fixturePosition(id) {
    return this.fixtures.get(id)?.marker.position.toArray() || null;
  }
  pickMarkerPosition(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height || !this.asset) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      ),
      this.camera,
    );
    const hit = ray.intersectObject(this.asset, true).find(({ object }) => {
      for (let node = object; node; node = node.parent)
        if (!node.visible) return false;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      return materials.some((m) => m && m.visible && m.opacity > 0);
    });
    return hit ? hit.point.toArray() : null;
  }
  /**
   * Which device icons are covered by another room of the house (a light
   * under the bedroom's floor): the ids among `entries`
   * (`{ id, room, offset }`, room being the source room's id). Draws each
   * shown room's surfaces with its number and depth into a small buffer from
   * the current camera and compares each icon's own depth with it.
   */
  coveredMarkers(entries) {
    const covered = new Set();
    const placements = (this.asset?.children || []).filter(
      (child) => child.userData.pickRoom && child.visible,
    );
    if (
      !this.model?.houseView ||
      this.model.focusRoom ||
      placements.length < 2 ||
      !entries.length ||
      !this.clipPlanes
    )
      return covered;
    const { clientWidth: cw, clientHeight: ch } = this.container;
    if (!cw || !ch) return covered;
    const long = 384,
      w = Math.max(1, Math.round(cw >= ch ? long : (long * cw) / ch)),
      h = Math.max(1, Math.round(cw >= ch ? (long * ch) / cw : long));
    if (
      !this.coverTarget ||
      this.coverTarget.width !== w ||
      this.coverTarget.height !== h
    ) {
      this.coverTarget?.dispose();
      this.coverTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
      });
    }
    this.coverMaterials ||= [];
    const material = (index) =>
      (this.coverMaterials[index] ||= new THREE.ShaderMaterial({
        uniforms: { room: { value: index / 255 } },
        vertexShader:
          "#include <clipping_planes_pars_vertex>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n#include <clipping_planes_vertex>\n}",
        fragmentShader:
          "#include <clipping_planes_pars_fragment>\nuniform float room;\nvoid main(){\n#include <clipping_planes_fragment>\nvec3 p=fract(gl_FragCoord.z*vec3(1.,255.,65025.));\np-=p.yzz*vec3(1./255.,1./255.,0.);\ngl_FragColor=vec4(room,p);\n}",
        clipping: true,
        side: THREE.DoubleSide,
        blending: THREE.NoBlending,
      }));
    const swaps = [],
      hidden = [],
      numbers = new Map(placements.map((p, i) => [p.userData.pickRoom, i + 1]));
    // Only the shown rooms' solid surfaces: no helpers, glass or daylight.
    const hide = (object) => {
      hidden.push([object, object.visible]);
      object.visible = false;
    };
    for (const child of this.scene.children)
      if (child !== this.asset) hide(child);
    for (const child of this.asset.children)
      if (!placements.includes(child)) hide(child);
    placements.forEach((placement, i) => {
      const own = material(i + 1);
      own.clippingPlanes = this.clipPlanes;
      placement.traverseVisible((object) => {
        if (!object.isMesh) return;
        const list = Array.isArray(object.material)
          ? object.material
          : [object.material];
        if (list.some((m) => m?.transparent && m.opacity < 0.95)) {
          hide(object);
          return;
        }
        swaps.push([object, object.material]);
        object.material = Array.isArray(object.material)
          ? object.material.map(() => own)
          : own;
      });
    });
    const renderer = this.renderer,
      before = {
        target: renderer.getRenderTarget(),
        color: renderer.getClearColor(new THREE.Color()),
        alpha: renderer.getClearAlpha(),
        background: this.scene.background,
      },
      pixels = new Uint8Array(w * h * 4);
    try {
      this.scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.coverTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      renderer.readRenderTargetPixels(this.coverTarget, 0, 0, w, h, pixels);
    } finally {
      renderer.setRenderTarget(before.target);
      renderer.setClearColor(before.color, before.alpha);
      this.scene.background = before.background;
      for (const [object, original] of swaps) object.material = original;
      for (const [object, visible] of hidden) object.visible = visible;
    }
    const orthographic = !!this.camera.isOrthographicCamera,
      point = new THREE.Vector3();
    for (const { id, room, offset } of entries) {
      const fixture = this.fixtures.get(id),
        own = numbers.get(room);
      if (!fixture || !own) continue;
      point
        .fromArray(offsetPoint(fixture.marker.position.toArray(), offset))
        .project(this.camera);
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || point.z > 1)
        continue;
      const x = Math.min(
          w - 1,
          Math.max(0, Math.floor((point.x * 0.5 + 0.5) * w)),
        ),
        y = Math.min(h - 1, Math.max(0, Math.floor((point.y * 0.5 + 0.5) * h))),
        distance = viewDistance(
          point.z,
          this.camera.near,
          this.camera.far,
          orthographic,
        ),
        samples = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx,
            sy = y + dy;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          const at = (sy * w + sx) * 4,
            z = unpackDepth(pixels[at + 1], pixels[at + 2], pixels[at + 3]);
          samples.push({
            room: pixels[at],
            distance: viewDistance(
              z * 2 - 1,
              this.camera.near,
              this.camera.far,
              orthographic,
            ),
          });
        }
      if (coveredByOtherRoom(samples, own, distance)) covered.add(id);
    }
    return covered;
  }
  fixtureScreenPosition(id, offset) {
    const fixture = this.fixtures.get(id);
    if (!fixture) return null;
    const point = new THREE.Vector3()
      .fromArray(offsetPoint(fixture.marker.position.toArray(), offset))
      .project(this.camera);
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
  clearClimateVisuals() {
    if (this.climateFrame) cancelAnimationFrame(this.climateFrame);
    this.climateFrame = 0;
    for (const f of this.fixtures?.values() || []) {
      for (const effect of f.climateVisuals || []) effect.dispose();
      f.climateVisuals = [];
    }
  }
  /** Start a light effect seen as a service call (one-shot effects repeat). */
  triggerLightEffect(id, name) {
    const f = this.fixtures?.get(id);
    if (!f?.light || !f.lightBase) return false;
    f.effectRun ||= createEffectRun();
    f.effectRun.trigger(name, performance.now() / 1000);
    this.render({ cameraOnly: true });
    return f.effectRun.animating;
  }
  /**
   * Draw each light's running effect for this frame, or put back its plain
   * look when the effect has ended. Returns whether any effect is running.
   */
  applyLightEffects(now) {
    let animating = false;
    if (this.reducedMotion === undefined)
      this.reducedMotion =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const f of this.fixtures?.values() || []) {
      if (!f.effectRun || !f.lightBase) continue;
      const frame = this.reducedMotion ? null : f.effectRun.sample(now);
      if (!frame && !f.effectShown) continue;
      // A one-shot flashes even a light that is off, like the real bulb.
      const amount = frame
          ? (f.lightBase.amount || 1) * frame.gain
          : f.lightBase.amount,
        color = frame?.tint
          ? this.effectColor.setRGB(...frame.tint, THREE.SRGBColorSpace)
          : f.lightBase.color;
      f.light.color.copy(color);
      f.light.intensity = f.base * amount;
      for (const [m, intensity] of f.mats) {
        m.emissive.copy(color);
        m.emissiveIntensity = intensity * amount;
      }
      f.effectShown = !!frame;
      animating ||= !!frame;
    }
    return animating;
  }
  get lightEffectsAnimating() {
    if (this.reducedMotion) return false;
    for (const f of this.fixtures?.values() || [])
      if (f.effectRun?.animating || f.effectShown) return true;
    return false;
  }
  syncClimateAnimation() {
    const effects = [...this.fixtures.values()].flatMap(
      (f) => f.climateVisuals || [],
    );
    const shouldRun =
      !document.hidden &&
      !this.contextLost &&
      (effects.some((effect) => effect.animating) ||
        this.lightEffectsAnimating);
    if (!shouldRun) {
      if (this.climateFrame) cancelAnimationFrame(this.climateFrame);
      this.climateFrame = 0;
      return;
    }
    if (this.climateFrame) return;
    const tick = (time) => {
      this.climateFrame = 0;
      if (document.hidden) return;
      const lights = this.applyLightEffects(performance.now() / 1000);
      if (!lights && !effects.some((effect) => effect.animating)) {
        // The last effect just ended: draw the lights' plain look once.
        this.renderer.shadowMap.needsUpdate ||= !this.shadowsCurrent;
        this.renderer.render(this.scene, this.camera);
        return;
      }
      for (const effect of effects) effect.update(time / 1000);
      // Climate effects cast no shadows; keep any pending shadow refresh.
      this.renderer.shadowMap.needsUpdate ||= !this.shadowsCurrent;
      this.renderer.render(this.scene, this.camera);
      this.climateFrame = requestAnimationFrame(tick);
    };
    this.climateFrame = requestAnimationFrame(tick);
  }
  /** `cameraOnly` renders that follow camera movement reuse the last shadow maps. */
  render({ cameraOnly = false } = {}) {
    if (this.contextLost) {
      this.shadowsCurrent = false;
      return;
    }
    if (this.renderSuspended) {
      if (!cameraOnly) this.shadowsCurrent = false;
      return;
    }
    this.syncClimateAnimation();
    for (const f of this.fixtures.values())
      for (const effect of f.climateVisuals || [])
        effect.update(performance.now() / 1000);
    this.applyLightEffects(performance.now() / 1000);
    this.renderer.shadowMap.needsUpdate = !cameraOnly || !this.shadowsCurrent;
    this.renderer.render(this.scene, this.camera);
    this.shadowsCurrent = true;
    // What has been drawn once needs no preparation.
    if (this.model?.houseView && this.preparedViews)
      this.preparedViews.set(houseViewKey(this.model), true);
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
