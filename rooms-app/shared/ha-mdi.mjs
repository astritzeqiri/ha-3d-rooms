/**
 * Material Design Icons from Home Assistant itself. HA's frontend serves the
 * whole set at `/static/mdi/`: `iconMetadata.json` (which chunk holds which
 * names), the chunks (`{ name: path }`), and `iconList.json` (names and
 * keywords, what HA's icon picker searches). The manager frame and the
 * full-screen page share HA's origin, so they load icons from there instead
 * of bundling a 2.8 MB copy. Chunks load only for icons actually drawn.
 */
export const HA_MDI_BASE = "/static/mdi/";

async function fetchJson(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok)
    throw new Error(`Icon data unavailable (${response.status})`);
  return response.json();
}

/** The chunk file holding `name`, following HA's own lookup. */
export function chunkFor(metadata, name) {
  let file;
  for (const part of metadata?.parts || []) {
    if (part.start !== undefined && name < part.start) break;
    file = part.file;
  }
  return file;
}

export function createHaMdi({ base = HA_MDI_BASE, load = fetchJson } = {}) {
  let metadata, list;
  const chunks = new Map();
  const getMetadata = () => {
    metadata ||= load(base + "iconMetadata.json").catch((error) => {
      metadata = undefined; // try again next time (HA may have been restarting)
      throw error;
    });
    return metadata;
  };
  return {
    /** SVG path of `mdi:<name>` (or bare `<name>`), or undefined. */
    async path(icon) {
      const name = String(icon).replace(/^mdi:/, "");
      const file = chunkFor(await getMetadata(), name);
      if (!file || !/^[A-Za-z0-9_-]+$/.test(file)) return undefined;
      if (!chunks.has(file))
        chunks.set(
          file,
          load(base + file + ".json").catch((error) => {
            chunks.delete(file);
            throw error;
          }),
        );
      const path = (await chunks.get(file))[name];
      return typeof path === "string" ? path : undefined;
    },
    /** `[{ name, keywords }]` of every icon, as HA's icon picker lists them. */
    list() {
      list ||= load(base + "iconList.json").catch((error) => {
        list = undefined;
        throw error;
      });
      return list;
    },
  };
}

/** One shared instance per page, so every picker and marker reuses the chunks. */
export const haMdi = createHaMdi();
