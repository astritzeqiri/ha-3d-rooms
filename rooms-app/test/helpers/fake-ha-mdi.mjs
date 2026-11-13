// Stands in for Home Assistant's /static/mdi/ files in tests, built from the
// dev-only @mdi/js package (same 7.4.47 set HA serves).
import { readFileSync } from "node:fs";
import * as all from "@mdi/js";
import { mdiExportName } from "../../shared/marker-icons.mjs";

const meta = JSON.parse(
  readFileSync(
    new URL("../../node_modules/@mdi/svg/meta.json", import.meta.url),
  ),
);

/** `{ "door-open": path, … }` for every icon, like HA's chunks combined. */
export const MDI_PATHS = Object.fromEntries(
  meta
    .map((icon) => [icon.name, all[mdiExportName("mdi:" + icon.name)]])
    .filter(([, path]) => path),
);
const KEYWORDS = Object.fromEntries(
  meta.map((icon) => [
    icon.name,
    [...(icon.aliases || []), ...(icon.tags || [])],
  ]),
);

const FILES = {
  "/static/mdi/iconMetadata.json": {
    version: "7.4.47",
    parts: [{ file: "all" }],
  },
  "/static/mdi/all.json": MDI_PATHS,
  "/static/mdi/iconList.json": Object.keys(MDI_PATHS).map((name) => ({
    name,
    keywords: KEYWORDS[name],
  })),
};

/** Install a `fetch` that answers HA's icon URLs; returns the requested URLs. */
export function installFakeHaMdi() {
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const body = FILES[String(url)];
    return {
      ok: !!body,
      status: body ? 200 : 404,
      json: async () => body,
    };
  };
  return asked;
}
