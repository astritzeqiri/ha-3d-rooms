// The icon chooser of the view editor's icon tools: a "Default icon" tile,
// the bundled suggestions, your Home Assistant icon sets, and a search over
// every icon. Same markup and classes as the device icons' chooser.
import { MARKER_ICON_GROUPS, iconLabel } from "../shared/marker-icons.mjs";

export const ICON_PICKER_HTML = `<div class="marker-icon-picker" hidden><div class="marker-icon-picker-head"><button type="button" class="marker-icon-back" data-icon-back aria-label="Back to icon settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button><strong>Choose icon</strong></div><input type="search" class="marker-icon-search" data-icon-search placeholder="Search icons" aria-label="Search icons" autocomplete="off"><p class="marker-icon-status muted small" aria-live="polite"></p><div class="marker-icon-list"></div><div class="marker-icon-results" hidden><div class="marker-icon-grid" role="group" aria-label="Search results"></div><p class="marker-icon-more muted small" hidden></p></div><p class="marker-icon-empty muted small" hidden>No icons match.</p></div>`;

/**
 * Wire the chooser inside `root` (which holds `ICON_PICKER_HTML`).
 * `iconArtFor(name)` gives `{ viewBox, html }` or undefined; `needCatalog()`
 * loads every icon; `current()` is the chosen name ("" for the default);
 * `onChoose(name)` gets the pick ("" for the default).
 */
export function wireIconPicker({
  root,
  defaultArt,
  defaultLabel = "Default icon",
  iconArtFor,
  needCatalog,
  current,
  onChoose,
  onToggle = () => {},
}) {
  const picker = root.querySelector(".marker-icon-picker");
  const list = picker.querySelector(".marker-icon-list");
  const search = picker.querySelector("[data-icon-search]");
  const results = picker.querySelector(".marker-icon-results");
  const resultGrid = results.querySelector(".marker-icon-grid");
  const more = picker.querySelector(".marker-icon-more");
  const status = picker.querySelector(".marker-icon-status");
  const empty = picker.querySelector(".marker-icon-empty");
  let catalog = null,
    run = 0,
    timer,
    tiles = [],
    resultTiles = [],
    customShown = false;
  const paint = (svg, art) => {
    if (!svg || !art) return;
    svg.innerHTML = art.html;
    svg.setAttribute("viewBox", art.viewBox || "0 0 24 24");
  };
  const tile = (value, title, art, wide = false) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = wide ? "marker-icon-default" : "marker-icon-tile";
    choice.dataset.icon = value;
    choice.dataset.name = title.toLowerCase();
    choice.title = title;
    choice.setAttribute("aria-label", `Icon: ${title}`);
    choice.setAttribute("aria-pressed", String(value === current()));
    choice.innerHTML = `<svg viewBox="${art?.viewBox || "0 0 24 24"}" aria-hidden="true">${art?.html || ""}</svg>${wide ? `<span>${title}</span>` : ""}`;
    if (!art && value)
      needCatalog()
        .then((loaded) => loaded?.resolve(value))
        .then((found) => paint(choice.querySelector("svg"), found));
    choice.onclick = () => {
      show(false);
      onChoose(value);
    };
    return choice;
  };
  tiles.push(tile("", defaultLabel, defaultArt, true));
  list.append(tiles[0]);
  for (const [group, icons] of MARKER_ICON_GROUPS) {
    const heading = document.createElement("p");
    heading.className = "marker-icon-group";
    heading.textContent = group;
    const grid = document.createElement("div");
    grid.className = "marker-icon-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", group);
    for (const [id, text] of icons) {
      const t = tile(id, text, iconArtFor(id));
      tiles.push(t);
      grid.append(t);
    }
    list.append(heading, grid);
  }
  const showCustomSets = (loaded) => {
    if (!loaded || customShown) return;
    customShown = true;
    const nodes = [];
    for (const { prefix, count } of loaded.sets) {
      const heading = document.createElement("p");
      heading.className = "marker-icon-group";
      heading.textContent = `${prefix}: icons`;
      const grid = document.createElement("div");
      grid.className = "marker-icon-grid";
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", `${prefix} icons`);
      for (const entry of loaded.list(prefix)) {
        const t = tile(
          entry.icon,
          iconLabel(entry.icon),
          iconArtFor(entry.icon),
        );
        tiles.push(t);
        grid.append(t);
      }
      nodes.push(heading, grid);
      if (count > grid.children.length) {
        const hint = document.createElement("p");
        hint.className = "marker-icon-more muted small";
        hint.textContent = `Search “${prefix}:” to see all ${count}.`;
        nodes.push(hint);
      }
    }
    tiles[0].after(...nodes);
  };
  function filter() {
    const needle = search.value.trim().toLowerCase();
    const mine = ++run;
    list.hidden = !!needle;
    if (!needle) {
      results.hidden = true;
      empty.hidden = true;
      status.textContent = catalog
        ? `Suggestions · search all ${catalog.count.toLocaleString()} icons`
        : "Suggestions · search to browse every icon";
      return;
    }
    status.textContent = "Loading icons…";
    needCatalog().then((loaded) => {
      if (mine !== run) return;
      catalog = loaded || catalog;
      const found = loaded
        ? loaded.search(needle)
        : {
            total: 0,
            results: tiles
              .filter((t) => t.dataset.icon && t.dataset.name.includes(needle))
              .map((t) => ({ icon: t.dataset.icon })),
          };
      resultTiles = found.results.map((entry) => {
        const t = tile(
          entry.icon,
          iconLabel(entry.icon),
          iconArtFor(entry.icon),
        );
        t.title = `${iconLabel(entry.icon)} (${entry.icon})`;
        return t;
      });
      resultGrid.replaceChildren(...resultTiles);
      const total = loaded ? found.total : resultTiles.length;
      results.hidden = !resultTiles.length;
      empty.hidden = !!resultTiles.length;
      status.textContent = loaded
        ? `${total.toLocaleString()} ${total === 1 ? "icon" : "icons"}${found.partial ? " matching some words" : ""}`
        : "Showing suggestions only (icon set unavailable)";
      more.hidden = total <= resultTiles.length;
      more.textContent = `Showing ${resultTiles.length} — keep typing to narrow.`;
    });
  }
  function show(open) {
    picker.hidden = !open;
    onToggle(open);
    if (!open) return;
    for (const t of [...tiles, ...resultTiles])
      t.setAttribute("aria-pressed", String(t.dataset.icon === current()));
    needCatalog().then((loaded) => {
      catalog = loaded || catalog;
      showCustomSets(loaded);
      if (!search.value.trim()) filter();
    });
    search.value = "";
    filter();
    search.focus?.();
  }
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(filter, 120);
  };
  search.onkeydown = (event) => {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      show(false);
    }
  };
  picker.querySelector("[data-icon-back]").onclick = () => show(false);
  return {
    open: () => show(true),
    close: () => {
      if (!picker.hidden) show(false);
    },
    get isOpen() {
      return !picker.hidden;
    },
    /** Repaint the default tile (its entity icon arrived later). */
    setDefaultArt: (art) => paint(tiles[0].querySelector("svg"), art),
    /** Rename the default tile ("Default icon", "Same as on icon"…). */
    setDefaultLabel(label) {
      const first = tiles[0];
      first.title = label;
      first.dataset.name = label.toLowerCase();
      first.setAttribute("aria-label", `Icon: ${label}`);
      const text = first.querySelector("span");
      if (text) text.textContent = label;
    },
  };
}
