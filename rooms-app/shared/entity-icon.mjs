// Render HA's state icon in its own document. Moving Lit elements into the manager
// iframe breaks their document-owned constructed stylesheets; copy only SVG data.
function findSvg(root) {
  const own = root.querySelector?.("svg");
  if (own) return own;
  for (const child of root.querySelectorAll?.("*") || []) {
    if (child.shadowRoot) {
      const svg = findSvg(child.shadowRoot);
      if (svg) return svg;
    }
  }
  return null;
}
export async function resolveEntityIcon(
  host,
  hass,
  state,
  { frames = 120 } = {},
) {
  const doc = host.ownerDocument;
  if (!doc.defaultView.customElements.get("ha-state-icon")) return null;
  const icon = doc.createElement("ha-state-icon");
  icon.hass = hass;
  icon.stateObj = state;
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;width:24px;height:24px";
  host.append(icon);
  try {
    for (let frame = 0; frame < frames; frame++) {
      const svg = icon.shadowRoot && findSvg(icon.shadowRoot);
      const paths = svg && [...svg.querySelectorAll("path")];
      if (paths?.length)
        return {
          viewBox: svg.getAttribute("viewBox") || "0 0 24 24",
          paths: paths.map((path) => ({
            d: path.getAttribute("d") || "",
            fillRule: path.getAttribute("fill-rule"),
            clipRule: path.getAttribute("clip-rule"),
            transform: path.getAttribute("transform"),
          })),
        };
      await new Promise((resolve) =>
        doc.defaultView.requestAnimationFrame(resolve),
      );
    }
    return null;
  } finally {
    icon.remove();
  }
}
export function paintEntityIcon(host, data) {
  if (!data?.paths?.length) {
    host.textContent = "▶";
    return;
  }
  const doc = host.ownerDocument,
    ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", data.viewBox);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("aria-hidden", "true");
  for (const item of data.paths) {
    const path = doc.createElementNS(ns, "path");
    path.setAttribute("d", item.d);
    for (const [key, attr] of [
      ["fillRule", "fill-rule"],
      ["clipRule", "clip-rule"],
      ["transform", "transform"],
    ]) {
      if (item[key]) path.setAttribute(attr, item[key]);
    }
    svg.append(path);
  }
  host.replaceChildren(svg);
}
