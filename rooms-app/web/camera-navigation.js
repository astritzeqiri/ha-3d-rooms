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
/** Compact camera-linked cube. The selector provides larger targets for every direction. */
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
  const controls = document.createElement("div");
  controls.className = "cube-controls";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "camera-home";
  reset.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v11h5v-6h4v6h5V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  reset.setAttribute("aria-label", "Reset camera view");
  reset.title = "Reset and fit room";
  const picker = document.createElement("select");
  picker.className = "cube-view-picker";
  picker.setAttribute("aria-label", "Choose camera view");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Views";
  picker.append(placeholder);
  for (const kind of ["face", "edge", "corner"]) {
    const group = document.createElement("optgroup");
    group.label = kind[0].toUpperCase() + kind.slice(1) + "s";
    for (const direction of CUBE_DIRECTIONS.filter((d) => d.kind === kind)) {
      const option = document.createElement("option");
      option.value = direction.name;
      option.textContent = label(direction.name);
      group.append(option);
    }
    picker.append(group);
  }
  function select(name) {
    const scene = getScene();
    if (!scene?.model) return;
    scene.setCameraPreset(name);
    onSelect();
  }
  reset.onclick = () => select("reset");
  picker.onchange = () => {
    if (picker.value) select(picker.value);
    picker.value = "";
  };
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
            tabindex: "0",
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
    const axes = svgElement("g", { "aria-hidden": "true", class: "cube-axes" });
    [
      ["X", [1, 0, 0]],
      ["Y", [0, 1, 0]],
      ["Z", [0, 0, 1]],
    ].forEach(([name, axis]) => {
      const dot = (v) => axis.reduce((s, n, i) => s + n * v[i], 0),
        x = 15 + dot(basis.right) * 16,
        y = 91 - dot(basis.up) * 16;
      axes.append(
        svgElement("line", {
          x1: 15,
          y1: 91,
          x2: x,
          y2: y,
          class: `axis-${name}`,
        }),
      );
      const text = svgElement("text", {
        x: x + 2,
        y: y - 2,
        class: `axis-${name}`,
      });
      text.textContent = name;
      axes.append(text);
    });
    cube.append(axes);
    if (focused)
      (
        Array.from(cube.querySelectorAll("[data-view]")).find(
          (el) => el.dataset.view === focused,
        ) || picker
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
  controls.append(reset, picker);
  nav.append(cube, controls);
  container.append(nav);
  return nav;
}
