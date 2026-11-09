import { mdiExportName } from "../shared/marker-icons.mjs";
/**
 * Every icon Home Assistant's own icon picker offers: the Material Design set
 * (loaded on demand, see tools/mdi-catalog.mjs) plus each icon set registered
 * in HA's `window.customIcons` (`local:`, `phu:` …) with `getIconList()` and
 * `getIcon(name)`. The manager runs in a same-origin frame inside HA, so the
 * sets are read from the HA page.
 */
const SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const SAFE_VIEWBOX = /^-?[\d.]+(?:[\s,]+-?[\d.]+){3}$/;
const MDI_VIEWBOX = "0 0 24 24";

/** Icon art as `{ viewBox, html }`, or undefined if a set returned anything but plain path data. */
export function iconArt({ path, secondaryPath, viewBox } = {}) {
  if (typeof path !== "string" || !SAFE_PATH.test(path)) return undefined;
  const box =
    typeof viewBox === "string" && SAFE_VIEWBOX.test(viewBox.trim())
      ? viewBox.trim()
      : MDI_VIEWBOX;
  const second =
    typeof secondaryPath === "string" && SAFE_PATH.test(secondaryPath)
      ? `<path d="${secondaryPath}" opacity="0.5"/>`
      : "";
  return { viewBox: box, html: `${second}<path d="${path}"/>` };
}

/** HA's registered icon sets, from the HA page around this frame (or this page). */
export function hostIconSets(win = globalThis.window) {
  for (const candidate of [win?.parent, win]) {
    try {
      if (candidate?.customIcons) return candidate.customIcons;
    } catch {
      // Cross-origin parent: no custom sets.
    }
  }
  return {};
}

async function customEntries(sets) {
  const lists = await Promise.all(
    Object.keys(sets)
      .filter(
        (prefix) =>
          prefix !== "mdi" && /^[a-z0-9][a-z0-9_-]{0,31}$/.test(prefix),
      )
      .map(async (prefix) => {
        try {
          if (typeof sets[prefix]?.getIconList !== "function") return [];
          const list = await sets[prefix].getIconList();
          return (Array.isArray(list) ? list : [])
            .filter((item) => typeof item?.name === "string")
            .map((item) => ({
              icon: `${prefix}:${item.name}`,
              set: prefix,
              name: item.name.toLowerCase(),
              words: (Array.isArray(item.keywords) ? item.keywords : [])
                .join(" ")
                .toLowerCase(),
            }));
        } catch {
          console.warn(`Unable to load the ${prefix} icon set`);
          return [];
        }
      }),
  );
  return lists.flat();
}

let loading;
/** Loads once per page; pass `sets` only in tests. */
export function loadIconCatalog(sets = hostIconSets()) {
  loading ||= Promise.all([
    import("@mdi/js"),
    import("./mdi-catalog.json", { with: { type: "json" } }),
    customEntries(sets),
  ]).then(([paths, { default: rows }, custom]) => {
    const art = new Map();
    const mdi = [];
    for (const [name, words] of rows) {
      const icon = "mdi:" + name;
      const path = paths[mdiExportName(icon)];
      if (!path) continue;
      art.set(icon, { viewBox: MDI_VIEWBOX, html: `<path d="${path}"/>` });
      mdi.push({ icon, set: "mdi", name, words });
    }
    const icons = [...mdi, ...custom];
    const pending = new Map();
    const setCounts = new Map();
    for (const entry of custom)
      setCounts.set(entry.set, (setCounts.get(entry.set) || 0) + 1);
    return {
      count: icons.length,
      mdiCount: mdi.length,
      /** Custom sets that listed icons, e.g. `[{ prefix: "local", count: 12 }]`. */
      sets: [...setCounts].map(([prefix, count]) => ({ prefix, count })),
      /** Synchronous art if known (all MDI; custom icons after `resolve`). */
      art: (icon) => art.get(icon),
      /** Fetch a custom icon's art from its set (cached); undefined if unavailable. */
      resolve(icon) {
        if (art.has(icon)) return Promise.resolve(art.get(icon));
        if (!pending.has(icon)) {
          const split = icon.indexOf(":");
          const set = sets[icon.slice(0, split)];
          pending.set(
            icon,
            Promise.resolve(
              typeof set?.getIcon === "function"
                ? set.getIcon(icon.slice(split + 1))
                : undefined,
            )
              .then((data) => iconArt(data))
              .catch(() => undefined)
              .then((found) => {
                if (found) art.set(icon, found);
                return found;
              }),
          );
        }
        return pending.get(icon);
      },
      /** Icons of one custom set, in its own order. */
      list: (prefix, limit = 60) =>
        custom.filter((entry) => entry.set === prefix).slice(0, limit),
      /**
       * Icons matching every word rank first (name prefix > name > keyword);
       * if none match them all, the best partial matches are shown instead.
       * A word with a colon (`local:`) matches the set prefix.
       */
      search(query, limit = 96) {
        const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return { total: 0, results: [], partial: false };
        const full = [],
          partial = [];
        for (const entry of icons) {
          let score = 0,
            matched = 0;
          for (const term of terms) {
            const points = term.includes(":")
              ? entry.icon.startsWith(term)
                ? 3
                : 0
              : entry.name.startsWith(term)
                ? 3
                : entry.name.includes(term)
                  ? 2
                  : entry.words.includes(term) || entry.set.startsWith(term)
                    ? 1
                    : 0;
            score += points;
            if (points) matched++;
          }
          if (matched === terms.length) full.push([score, entry]);
          else if (matched) partial.push([matched * 10 + score, entry]);
        }
        const found = full.length ? full : partial;
        found.sort(
          (a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length,
        );
        return {
          total: found.length,
          partial: !full.length && !!partial.length,
          results: found.slice(0, limit).map(([, entry]) => entry),
        };
      },
    };
  });
  return loading;
}
