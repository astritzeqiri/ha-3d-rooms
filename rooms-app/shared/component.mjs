/** Portable saved dashboard views. Layers leave room for future compositions. */
export function validateComponent(value, modelIds) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value.id) ||
    ["constructor", "prototype"].includes(value.id)
  )
    throw new Error("Use a version 1 component with a valid ID.");
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 160
  )
    throw new Error("Give the component a name up to 160 characters.");
  if (!Array.isArray(value.layers) || value.layers.length !== 1)
    throw new Error("This release supports one room per component.");
  const layer = value.layers[0];
  if (!layer || !modelIds.includes(layer.model))
    throw new Error("Import the referenced room model first.");
  if (!["front", "floor"].includes(layer.view))
    throw new Error("Choose perspective or floor view.");
  for (const [key, min, max] of [
    ["heading", 0, 359],
    ["tilt", 0, 35],
    ["zoom", 0.5, 3],
  ])
    if (!Number.isFinite(layer[key]) || layer[key] < min || layer[key] > max)
      throw new Error(`Invalid ${key}.`);
  if (
    !Number.isInteger(value.height) ||
    value.height < 180 ||
    value.height > 1600
  )
    throw new Error("Height must be 180–1600 pixels.");
  return {
    schemaVersion: 1,
    id: value.id,
    title: value.title.trim(),
    height: value.height,
    layers: [
      {
        model: layer.model,
        view: layer.view,
        heading: layer.heading,
        tilt: layer.tilt,
        zoom: layer.zoom,
      },
    ],
  };
}
export function componentYaml(component) {
  const layer = component.layers[0];
  return `type: custom:three-d-rooms-card\ntitle: ${JSON.stringify(component.title)}\nmodel: ${layer.model}\nheight: ${component.height}\nview: ${layer.view}\nheading: ${layer.heading}\ntilt: ${layer.tilt}\nzoom: ${layer.zoom}`;
}
