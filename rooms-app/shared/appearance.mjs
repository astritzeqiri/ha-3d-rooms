export function validateAppearance(value) {
  if (!Array.isArray(value) || value.length > 40)
    throw new Error("Provide up to 40 optional architectural parts.");
  const seen = new Set();
  for (const part of value) {
    if (
      !part ||
      Object.keys(part).sort().join() !== "id,label,visible" ||
      typeof part.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(part.id) ||
      ["constructor", "prototype"].includes(part.id) ||
      seen.has(part.id) ||
      typeof part.label !== "string" ||
      !part.label.trim() ||
      part.label.length > 160 ||
      typeof part.visible !== "boolean"
    )
      throw new Error(
        "Optional architecture needs unique IDs, labels and visibility.",
      );
    seen.add(part.id);
  }
  return structuredClone(value);
}
