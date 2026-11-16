import { CUBE_DIRECTIONS, projectViewCube } from "../shared/view-cube.mjs";
const NS = "http://www.w3.org/2000/svg";
const svgElement = (tag, attributes = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes))
    el.setAttribute(key, value);
  return el;
};
const points = (vertices) => vertices.map((p) => p.join(",")).join(" ");
const label = (name) => name.replaceAll("-", " ");
/** Camera-linked cube: click to snap, drag to orbit, or use arrow keys. */
export function mountCameraNavigation(
  container,
  getScene,
  onSelect = () => {},
) {
  const nav = document.createElement("nav");
  nav.className = "camera-navigation";
  nav.setAttribute("aria-label", "Camera views");
  const cube = svgElement("svg", {
    viewBox: "0 0 104 104",
    class: "view-cube",
    role: "group",
    "aria-label": "View cube: choose a face, edge or corner",
  });
  function select(name) {
    const scene = getScene();
    if (!scene?.model) return;
    scene.setCameraPreset(name);
    onSelect();
  }
  // One tab stop: arrow keys rotate, letters snap to a face. The faces,
  // edges and corners stay clickable but out of the tab order.
  cube.setAttribute("tabindex", "0");
  cube.setAttribute(
    "aria-label",
    "View cube: arrow keys rotate; T, F, B, L, R or K snap to top, front, bottom, left, right or back; Home resets",
  );
  cube.setAttribute("aria-keyshortcuts", "T F B L R K Home");
  let drag,
    suppressClick = false;
  cube.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag || !getScene()?.model) return;
    event.preventDefault();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      view: event.target.closest("[data-view]")?.dataset.view,
    };
    suppressClick = false;
    cube.setPointerCapture(event.pointerId);
    cube.focus({ preventScroll: true });
  });
  cube.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    cube.classList.add("dragging");
    getScene()?.rotateCamera(dx * 0.012, dy * 0.012);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag;
    drag = undefined;
    suppressClick = true;
    cube.classList.remove("dragging");
    if (cube.hasPointerCapture(event.pointerId))
      cube.releasePointerCapture(event.pointerId);
    if (event.type === "pointerup" && !previous.moved && previous.view)
      select(previous.view);
  }
  cube.addEventListener("pointerup", finish);
  cube.addEventListener("pointercancel", finish);
  cube.addEventListener("lostpointercapture", finish);
  // Pointer capture retargets click to the SVG; suppress it after a drag or tap.
  cube.addEventListener(
    "click",
    (event) => {
      if (suppressClick && event.detail !== 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  const faceKeys = {
    t: "top",
    f: "front",
    b: "bottom",
    l: "left",
    r: "right",
    k: "back",
  };
  cube.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const face =
      event.key === "Home" ? "reset" : faceKeys[event.key.toLowerCase()];
    if (face) {
      event.preventDefault();
      select(face);
      return;
    }
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    getScene()?.rotateCamera(delta[0] * 0.12, delta[1] * 0.12);
  });
  let lastBasis = "";
  function draw(basis) {
    const key = JSON.stringify(basis);
    if (key === lastBasis) return;
    lastBasis = key;
    const focused = cube.contains(document.activeElement)
      ? document.activeElement?.dataset.view
      : null;
    const geometry = projectViewCube(basis),
      regions = new Map();
    cube.replaceChildren();
    for (const face of geometry) {
      const background = svgElement("polygon", {
        points: points(face.outline),
        class: `cube-face cube-face-${face.name}`,
      });
      cube.append(background);
      for (const zone of face.zones) {
        let group = regions.get(zone.name);
        if (!group) {
          const direction = CUBE_DIRECTIONS.find((d) => d.name === zone.name);
          group = svgElement("g", {
            role: "button",
            tabindex: "-1",
            "aria-label": `View from ${label(zone.name)}${direction.kind === "face" ? "" : " " + direction.kind}`,
            "data-view": zone.name,
            class: `cube-region cube-region-${direction.kind}`,
          });
          const title = svgElement("title");
          title.textContent = label(zone.name);
          group.append(title);
          group.addEventListener("click", () => select(zone.name));
          group.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select(zone.name);
            }
          });
          regions.set(zone.name, group);
        }
        group.append(svgElement("polygon", { points: points(zone.points) }));
      }
    }
    for (const group of regions.values()) cube.append(group);
    for (const face of geometry) {
      const outline = svgElement("polygon", {
        points: points(face.outline),
        class: "cube-outline",
      });
      cube.append(outline);
      if (face.shade > 0.16) {
        const text = svgElement("text", {
          "text-anchor": "middle",
          "dominant-baseline": "central",
          transform: `matrix(${face.textMatrix.join(" ")} ${face.center.join(" ")})`,
          class: "cube-label",
        });
        text.textContent = face.name.toUpperCase();
        cube.append(text);
      }
    }
    if (focused)
      (
        Array.from(cube.querySelectorAll("[data-view]")).find(
          (el) => el.dataset.view === focused,
        ) || cube
      ).focus({ preventScroll: true });
  }
  container.addEventListener("room-camera-orientation", (event) =>
    draw(event.detail),
  );
  draw({
    normal: [0.57735, 0.57735, 0.57735],
    right: [0.7071, 0, -0.7071],
    up: [-0.40825, 0.8165, -0.40825],
  });
  // Reset lives in the view's own toolbar ("Reset camera"); a second home
  // button on the cube did the same thing.
  nav.append(cube);
  container.append(nav);
  return nav;
}
