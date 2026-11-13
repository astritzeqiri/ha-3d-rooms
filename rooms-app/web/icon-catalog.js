import { MARKER_ICONS } from "../shared/marker-icons.mjs";
import { haMdi } from "../shared/ha-mdi.mjs";
/**
 * Every icon Home Assistant's own icon picker offers: the Material Design set
 * (HA's own copy, see shared/ha-mdi.mjs; paths load per chunk as tiles are
 * drawn) plus each icon set registered
 * in HA's `window.customIcons` (`local:`, `phu:` …) with `getIconList()` and
 * `getIcon(name)`. The manager runs in a same-origin frame inside HA, so the
 * sets are read from the HA page.
 */
import { iconArt, MDI_VIEWBOX } from "../shared/icon-art.mjs";
export { iconArt };

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
/** Loads once per page; pass `sets` and `mdiSource` only in tests. */
export function loadIconCatalog(sets = hostIconSets(), mdiSource = haMdi) {
  loading ||= Promise.all([
    mdiSource.list().catch(() => {
      console.warn("Unable to load Home Assistant's icon list");
      return [];
    }),
    customEntries(sets),
  ]).then(([rows, custom]) => {
    // The suggested icons draw at once; the rest load from HA when shown.
    const art = new Map(
      [...MARKER_ICONS].map(([icon, { path }]) => [
        icon,
        { viewBox: MDI_VIEWBOX, html: `<path d="${path}"/>` },
      ]),
    );
    const mdi = rows
      .filter((row) => typeof row?.name === "string")
      .map((row) => ({
        icon: "mdi:" + row.name,
        set: "mdi",
        name: row.name.toLowerCase(),
        words: (Array.isArray(row.keywords) ? row.keywords : [])
          .join(" ")
          .toLowerCase(),
      }));
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
      /** Synchronous art if known (suggestions; others after `resolve`). */
      art: (icon) => art.get(icon),
      /** Fetch an icon's art from HA or its set (cached); undefined if unavailable. */
      resolve(icon) {
        if (art.has(icon)) return Promise.resolve(art.get(icon));
        if (!pending.has(icon)) {
          const split = icon.indexOf(":");
          const prefix = icon.slice(0, split);
          const set = sets[prefix];
          pending.set(
            icon,
            Promise.resolve(
              prefix === "mdi"
                ? mdiSource.path(icon).then((path) => path && { path })
                : typeof set?.getIcon === "function"
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
