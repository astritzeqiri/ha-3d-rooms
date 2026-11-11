import { filterViews, viewScopeLabel } from "../shared/view-library.mjs";
import { viewThumbnail } from "./view-thumbnail.js";
import { validateComponent, componentYaml } from "../shared/component.mjs";

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
    $("use-view-dialog").showModal();
  }
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
      )} · ${c.layers[0].view === "floor" ? "Floor plan" : "Perspective"} · ${c.height}px card`;
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
      actions.append(
        button("Edit view", () => openEditor(c)),
        button("Add to dashboard", () => use(c), true),
      );
      if (preview) {
        const previewButton = button("Preview in dashboard", async () => {
          try {
            await preview(structuredClone(c));
          } catch (error) {
            toast(error.message);
          } finally {
            previewButton.focus({ preventScroll: true });
          }
        });
        previewButton.className = "saved-view-preview";
        actions.insertBefore(previewButton, actions.firstChild);
      }
      const more = document.createElement("details");
      more.className = "saved-view-more";
      const summary = document.createElement("summary");
      summary.textContent = "More actions";
      more.append(summary);
      more.append(
        button("Duplicate", () =>
          openEditor(
            {
              ...structuredClone(c),
              id: crypto.randomUUID(),
              title: `${c.title.slice(0, 150)} copy`,
            },
            { draft: true },
          ),
        ),
        button("Export view", () => {
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
        }),
      );
      const remove = button("Delete view", async () => {
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
      });
      remove.className = "danger";
      more.append(remove);
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
      card.append(title, detail, actions, more);
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
    }
  }
  $("copy-view-yaml").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("use-view-yaml").value);
      toast("Dashboard configuration copied.");
    } catch {
      $("use-view-yaml").select();
      toast("Select and copy the configuration.");
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
