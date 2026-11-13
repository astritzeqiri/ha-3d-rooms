import { filterViews, viewScopeLabel } from "../shared/view-library.mjs";
import { viewThumbnail } from "./view-thumbnail.js";
import { BACKDROP_CSS, paintBackdrop } from "../shared/backdrop.mjs";
import {
  validateComponent,
  componentYaml,
  standaloneViewURL,
} from "../shared/component.mjs";

const stroke = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
/** Small line icons for the view cards and their menu. */
const ICONS = {
  edit: stroke('<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>'),
  more: stroke(
    '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  ),
  preview: stroke(
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  ),
  open: stroke(
    '<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  ),
  duplicate: stroke(
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  ),
  export: stroke('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  delete: stroke(
    '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  ),
};

/** One library across all houses, floors and rooms. Saved IDs remain unchanged. */
export function initComponents({
  api,
  room,
  editor,
  toast,
  preview,
  selectModel,
  getModels,
  createView,
  initialViewId,
  standalone = false,
  liveTime = () => "night",
  onList = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  let components = [],
    generation = 0;
  const fail = (message) => {
    $("component-error").textContent = message || "";
  };
  async function openEditor(component, options) {
    const id = component?.layers?.[0]?.model;
    try {
      if (!component) return createView();
      if (!getModels().some((m) => m.id === id))
        throw new Error(
          "This view’s space is missing. Import the matching model before editing it.",
        );
      if (id !== room()?.id && !(await selectModel(id))) return false;
      return editor.open(component, options);
    } catch (error) {
      fail(error.message);
      return false;
    }
  }
  function use(component) {
    $("use-view-name").textContent = `Saved view: ${component.title}`;
    $("use-view-yaml").value = componentYaml(component);
    // Only inside Home Assistant, which serves the page.
    $("use-view-page").hidden = !standalone;
    if (standalone) {
      const url = standaloneViewURL(component.id, location.origin);
      $("use-view-page-url").value = url;
      $("open-view-page").href = url;
    }
    $("use-view-dialog").showModal();
  }
  // A view card's menu closes on a click elsewhere or Escape.
  document.addEventListener?.("click", (event) => {
    for (const menu of document.querySelectorAll?.(".saved-view-menu[open]") ||
      [])
      if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener?.("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const menu of document.querySelectorAll?.(".saved-view-menu[open]") ||
      []) {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
  });
  function draw() {
    const host = $("component-list");
    host.replaceChildren();
    const models = getModels();
    const views = filterViews(components, models, {
      query: $("view-search").value,
      kind: $("view-kind-filter").value,
    });
    $("view-results").textContent =
      views.length === components.length
        ? `${views.length} ${views.length === 1 ? "view" : "views"}`
        : `${views.length} of ${components.length} views`;
    $("create-library-view").disabled = !models.length;
    $("saved-view-count").textContent = components.length;
    $("saved-view-count").setAttribute(
      "aria-label",
      `${components.length} saved ${components.length === 1 ? "view" : "views"}`,
    );
    if (!views.length) {
      const empty = document.createElement("div");
      empty.className = "saved-views-empty";
      const title = document.createElement("h3");
      title.textContent = components.length
        ? "No views match"
        : models.length
          ? "Create your first dashboard view"
          : "Your views start with a space";
      const text = document.createElement("p");
      text.className = "muted";
      text.textContent = components.length
        ? "Try another search or show all views."
        : models.length
          ? "Choose your house, a floor or a room. Save the framing once and use it on any dashboard."
          : "Import a house or room in My home, then create your first view here.";
      const create = document.createElement("button");
      create.type = "button";
      create.className = "primary";
      create.textContent = components.length
        ? "Clear filters"
        : models.length
          ? "New view"
          : "Go to My home";
      create.onclick = () => {
        if (components.length) {
          $("view-search").value = "";
          $("view-kind-filter").value = "all";
          draw();
          $("view-search").focus();
        } else if (models.length) createView();
        else $("nav-home").click();
      };
      empty.append(title, text, create);
      host.append(empty);
      return;
    }
    for (const c of views) {
      const card = document.createElement("article");
      card.className = "saved-view-card";
      const title = document.createElement("h3");
      title.textContent = c.title;
      const detail = document.createElement("p");
      detail.className = "muted small";
      detail.textContent = `${viewScopeLabel(
        models.find((m) => m.id === c.layers[0].model),
        models,
      )} · ${c.layers[0].view === "floor" ? "Floor plan" : "Perspective"} · ${c.height === "auto" ? "auto height" : `${c.height}px card`}`;
      // One clear row: Edit, Add to dashboard (the main step) and a menu
      // for everything else. The preview picture also opens the editor.
      const actions = document.createElement("div");
      actions.className = "saved-view-actions";
      const button = (text, action, primary = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        if (primary) b.className = "primary";
        b.onclick = action;
        return b;
      };
      const edit = button("Edit", () => openEditor(c));
      edit.className = "saved-view-edit";
      edit.innerHTML = `${ICONS.edit}<span>Edit</span>`;
      edit.setAttribute("aria-label", `Edit ${c.title}`);
      const add = button("Add to dashboard", () => use(c), true);
      const more = document.createElement("details");
      more.className = "saved-view-menu";
      const summary = document.createElement("summary");
      summary.innerHTML = ICONS.more;
      summary.title = "More actions";
      summary.setAttribute("aria-label", `More actions for ${c.title}`);
      const list = document.createElement("div");
      list.className = "saved-view-menu-list";
      list.setAttribute("role", "menu");
      more.append(summary, list);
      const item = (icon, text, action, className = "") => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.className = className;
        b.innerHTML = `${ICONS[icon]}<span></span>`;
        b.querySelector("span").textContent = text;
        b.onclick = async () => {
          more.open = false;
          await action(b);
        };
        list.append(b);
        return b;
      };
      if (preview)
        item("preview", "Preview in dashboard", async () => {
          try {
            await preview(structuredClone(c));
          } catch (error) {
            toast(error.message);
          } finally {
            summary.focus({ preventScroll: true });
          }
        });
      if (standalone)
        item("open", "Open full screen", () =>
          window.open(
            standaloneViewURL(c.id, location.origin),
            "_blank",
            "noopener",
          ),
        ).title = "Open this view as a full-screen page in a new tab";
      if (list.children.length) list.append(document.createElement("hr"));
      item("duplicate", "Duplicate", () =>
        openEditor(
          {
            ...structuredClone(c),
            id: crypto.randomUUID(),
            title: `${c.title.slice(0, 150)} copy`,
          },
          { draft: true },
        ),
      );
      item("export", "Export view", () => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(c, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${c.id}.component.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      list.append(document.createElement("hr"));
      const remove = item(
        "delete",
        "Delete view",
        async () => {
          if (!confirm(`Delete the saved view “${c.title}”?`)) return;
          if (!editor.close()) return;
          remove.disabled = true;
          try {
            await api(`components/${c.id}`, { method: "DELETE" });
            components = components.filter((v) => v.id !== c.id);
            draw();
            toast("Saved view deleted.");
          } catch (e) {
            fail(e.message);
            remove.disabled = false;
          }
        },
        "danger",
      );
      actions.append(edit, add, more);
      if (c.thumbnailArt) {
        // The room is stored on its own; the view's current background (and
        // time of day) is painted behind it, so the preview never goes stale.
        if (!document.getElementById("backdrop-css")) {
          const style = document.createElement("style");
          style.id = "backdrop-css";
          style.textContent = BACKDROP_CSS;
          document.head.append(style);
        }
        const frame = document.createElement("div");
        frame.className = "saved-view-thumb saved-view-art";
        frame.dataset.previewSource = "art";
        const layer = document.createElement("div");
        layer.className = "backdrop";
        layer.setAttribute("aria-hidden", "true");
        paintBackdrop(layer, c, liveTime(c));
        const img = document.createElement("img");
        img.src = c.thumbnailArt;
        img.alt = `${c.title} preview`;
        img.loading = "lazy";
        frame.append(layer, img);
        card.append(frame);
      } else
        try {
          const key = `3d-rooms-view-preview-v2:${c.id}`;
          let cached;
          try {
            cached = localStorage.getItem(key);
          } catch {}
          const src =
            c.thumbnail ||
            cached ||
            (() => {
              try {
                return localStorage.getItem(`3d-rooms-view-preview:${c.id}`);
              } catch {
                return null;
              }
            })();
          if (src?.startsWith("data:image/jpeg;base64,")) {
            const img = document.createElement("img");
            img.className = "saved-view-thumb";
            img.dataset.previewSource = c.thumbnail ? "shared" : "browser";
            img.src = src;
            img.alt = `${c.title} preview`;
            img.loading = "lazy";
            if (!c.thumbnail && !cached && c.layers[0].camera?.aspect) {
              img.addEventListener(
                "load",
                () => {
                  try {
                    img.src = viewThumbnail(img, c.layers[0].camera.aspect);
                    localStorage.setItem(key, img.src);
                  } catch {
                    /* Thumbnail storage is optional. */
                  }
                },
                { once: true },
              );
            }
            card.append(img);
          }
        } catch {
          /* Browser storage is optional. */
        }
      if (!card.querySelector("img")) {
        const placeholder = document.createElement("div");
        placeholder.className = "saved-view-placeholder";
        placeholder.innerHTML =
          '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="m10 18 22-12 22 12v16L32 46 10 34V18Zm0 0 22 12 22-12M32 30v16" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
        const hint = document.createElement("span");
        hint.textContent = "Edit and save to capture a preview";
        placeholder.append(hint);
        card.append(placeholder);
      }
      // The picture opens the editor too, with a hint on hover and focus.
      const picture = card.firstElementChild;
      const cover = document.createElement("button");
      cover.type = "button";
      cover.className = "saved-view-cover";
      cover.setAttribute("aria-label", `Edit ${c.title}`);
      cover.onclick = () => openEditor(c);
      const hint = document.createElement("span");
      hint.className = "saved-view-cover-hint";
      hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = `${ICONS.edit}<span>Edit view</span>`;
      cover.append(picture, hint);
      card.prepend(cover);
      card.append(title, detail, actions);
      host.append(card);
    }
  }
  async function refresh({ openLink = false } = {}) {
    const current = ++generation;
    fail("");
    try {
      const next = await api("components");
      if (current !== generation) return;
      components = next;
      draw();
      onList();
      const id =
        initialViewId || new URL(location.href).searchParams.get("saved_view");
      if (openLink && id) {
        const c = components.find((c) => c.id === id);
        if (c) await openEditor(c);
        else fail("This saved view could not be found.");
      }
    } catch (e) {
      if (current === generation) fail(e.message);
    } finally {
      // The editor is open (or could not open): the page shows itself again.
      if (openLink && document.body?.dataset)
        delete document.body.dataset.openingView;
    }
  }
  // The Day / Night switch changes what a sky or spotlight looks like.
  window.addEventListener("rooms-daylight", () => draw());
  $("copy-view-yaml").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("use-view-yaml").value);
      toast("Dashboard configuration copied.");
    } catch {
      $("use-view-yaml").select();
      toast("Select and copy the configuration.");
    }
  };
  $("copy-view-page").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("use-view-page-url").value);
      toast("Page link copied.");
    } catch {
      $("use-view-page-url").select();
      toast("Select and copy the link.");
    }
  };
  $("create-library-view").onclick = () => openEditor();
  $("import-component").onclick = () => $("component-file").click();
  $("component-file").onchange = async () => {
    try {
      const file = $("component-file").files[0];
      if (!file) return;
      if (file.size > 196608)
        throw new Error("Choose a saved view smaller than 192 KB.");
      const imported = JSON.parse(await file.text());
      if (!getModels().some((m) => m.id === imported?.layers?.[0]?.model))
        throw new Error(
          "Import this view’s matching house or room in My home first.",
        );
      const c = validateComponent(
        imported,
        getModels().map((m) => m.id),
      );
      const opened = await openEditor(
        { ...c, id: crypto.randomUUID(), title: c.title },
        { draft: true },
      );
      if (opened) toast("View imported as a new draft. Review and save it.");
    } catch (e) {
      fail(e.message);
    } finally {
      $("component-file").value = "";
    }
  };
  $("view-search").oninput = draw;
  $("view-kind-filter").onchange = draw;
  window.addEventListener("rooms-view-saved", () => refresh());
  window.addEventListener("rooms-view-use", (event) => use(event.detail));
  refresh({ openLink: true });
  return { refresh, list: () => components };
}
