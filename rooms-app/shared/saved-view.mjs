/** A linked card stores only a view ID and explicit per-field overrides. */
export const VIEW_FIELDS = [
  "model",
  "title",
  "view",
  "heading",
  "tilt",
  "zoom",
  "height",
  "interactive",
];
export function resolveSavedView(config, components) {
  if (!config.saved_view) return { ...config };
  const saved = components?.find((item) => item.id === config.saved_view);
  if (!saved || saved.layers?.length !== 1)
    throw new Error(
      "Saved view not found. Choose another saved view in the card editor.",
    );
  const layer = saved.layers[0];
  const resolved = {
    ...structuredClone(layer),
    title: saved.title,
    height: saved.height,
    interactive: false,
    ...config,
  };
  // Exact framing belongs to its room and projection. Numeric camera overrides
  // can still use the snapshot's target and composition.
  if (resolved.model !== layer.model || resolved.view !== layer.view)
    delete resolved.camera;
  return resolved;
}
