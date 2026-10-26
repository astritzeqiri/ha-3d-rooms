import { viewThumbnail } from "./view-thumbnail.js";
import { validateComponent, componentYaml } from "../shared/component.mjs";

/** A room-scoped library; every view opens the same camera editor and scene. */
export function initComponents({ api, room, editor, toast, preview }) {
  const $ = (id) => document.getElementById(id);
  let components = [],
    generation = 0;
  const fail = (message) => {
    $("component-error").textContent = message || "";
  };
  function use(component) {
    $("use-view-name").textContent = `Saved view: ${component.title}`;
    $("use-view-yaml").value = componentYaml(component);
    $("use-view-dialog").showModal();
  }
  function draw() {
    const host = $("component-list");
    host.replaceChildren();
    const views = components.filter((c) => c.layers[0].model === room()?.id);
    if (!views.length) {
      const empty = document.createElement("div");
      empty.className = "saved-views-empty";
      const title = document.createElement("h3");
      title.textContent = "Save your first dashboard view";
      const text = document.createElement("p");
      text.className = "muted";
      text.textContent =
        "Frame the room above, then save an overview, floor plan or close-up.";
      empty.append(title, text);
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
      detail.textContent = `${c.layers[0].view === "floor" ? "Floor plan" : "Perspective"} · ${c.height}px card`;
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
        button("Edit view", () => editor.open(c)),
        button("Use in dashboard", () => use(c), true),
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
          editor.open(
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
        const cached = localStorage.getItem(key);
        const src =
          cached || localStorage.getItem(`3d-rooms-view-preview:${c.id}`);
        if (src?.startsWith("data:image/jpeg;base64,")) {
          const img = document.createElement("img");
          img.className = "saved-view-thumb";
          img.src = src;
          img.alt = `${c.title} preview`;
          img.loading = "lazy";
          if (!cached && c.layers[0].camera?.aspect) {
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
      const id = new URL(location.href).searchParams.get("saved_view");
      if (openLink && id) {
        const c = components.find(
          (c) => c.id === id && c.layers[0].model === room()?.id,
        );
        if (c) editor.open(c);
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
  $("import-component").onclick = () => $("component-file").click();
  $("component-file").onchange = async () => {
    try {
      const file = $("component-file").files[0];
      if (!file) return;
      if (file.size > 16384)
        throw new Error("Choose a saved view smaller than 16 KB.");
      const imported = JSON.parse(await file.text());
      if (imported?.layers?.[0]?.model !== room()?.id)
        throw new Error(
          "This view belongs to another room. Select that room before importing it.",
        );
      const c = validateComponent(imported, [room()?.id]);
      editor.open(
        { ...c, id: crypto.randomUUID(), title: c.title },
        { draft: true },
      );
      toast("View imported as a new draft. Review and save it.");
    } catch (e) {
      fail(e.message);
    } finally {
      $("component-file").value = "";
    }
  };
  window.addEventListener("rooms-view-saved", () => refresh());
  window.addEventListener("rooms-view-use", (event) => use(event.detail));
  refresh({ openLink: true });
  return { refresh };
}
