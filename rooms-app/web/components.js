import { validateComponent, componentYaml } from "../shared/component.mjs";
import { hexToRgb } from "../shared/light.mjs";

export function initComponents({ api, models, native, toast }) {
  const $ = (id) => document.getElementById(id);
  let components = [],
    draftId,
    saved = false,
    preview,
    loadedModel,
    generation = 0,
    active = false,
    deleteArmed = false;
  const error = (message) => {
    $("component-error").textContent = message || "";
  };
  const read = () =>
    validateComponent(
      {
        schemaVersion: 1,
        id: draftId,
        title: $("component-title").value,
        height: Number($("component-height").value),
        layers: [
          {
            model: $("component-model").value,
            view: $("component-view").value,
            heading: Number($("component-heading").value),
            tilt: Number($("component-tilt").value),
            zoom: Number($("component-zoom").value),
          },
        ],
      },
      models().map((m) => m.id),
    );
  const refreshModels = () => {
    const selected = $("component-model").value;
    $("component-model").replaceChildren(
      ...models().map((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.title;
        return option;
      }),
    );
    if (models().some((m) => m.id === selected))
      $("component-model").value = selected;
  };
  function drawList() {
    $("component-list").replaceChildren();
    if (!components.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No saved components yet.";
      $("component-list").append(p);
    }
    for (const c of components) {
      const button = document.createElement("button");
      const title = document.createElement("span");
      title.textContent = c.title;
      const detail = document.createElement("small");
      detail.textContent = `${models().find((m) => m.id === c.layers[0].model)?.title || "Missing room"} · ${c.layers[0].heading}° · ${c.layers[0].zoom}×`;
      button.append(title, detail);
      button.classList.toggle("active", c.id === draftId);
      if (c.id === draftId) button.setAttribute("aria-current", "true");
      button.onclick = () => edit(c, true);
      $("component-list").append(button);
    }
  }
  function edit(c, exists = false) {
    refreshModels();
    draftId = c.id;
    saved = exists;
    deleteArmed = false;
    error();
    $("component-editor").hidden = false;
    $("component-empty").hidden = true;
    $("component-title").value = c.title;
    $("component-height").value = c.height;
    for (const key of ["model", "view", "heading", "tilt", "zoom"])
      $("component-" + key).value = c.layers[0][key];
    $("delete-component").hidden = !saved;
    $("delete-component").textContent = "Delete";
    $("component-save-state").textContent = saved ? "Saved" : "Not saved yet";
    drawList();
    update();
  }
  function create() {
    if (!models().length) {
      error("Add a room in Models before creating a component.");
      return;
    }
    edit({
      id: crypto.randomUUID(),
      title: `${models()[0].title} overview`,
      height: 500,
      layers: [
        { model: models()[0].id, view: "front", heading: 0, tilt: 28, zoom: 1 },
      ],
    });
    $("component-title").focus();
  }
  async function update() {
    $("component-heading-value").textContent =
      `${$("component-heading").value}°`;
    $("component-tilt-value").textContent = `${$("component-tilt").value}°`;
    $("component-zoom-value").textContent =
      `${Number($("component-zoom").value).toFixed(2)}×`;
    let component;
    try {
      component = read();
      $("component-yaml").value = componentYaml(component);
    } catch (e) {
      $("component-yaml").value = "";
      error(e.message);
      return;
    }
    error();
    const current = ++generation,
      layer = component.layers[0],
      model = models().find((m) => m.id === layer.model);
    $("component-preview").style.height = `${component.height}px`;
    try {
      const { SceneView } = await import("./scene.js");
      if (current !== generation || !active) return;
      if (loadedModel !== model.id || !preview) {
        loadedModel = null;
        preview?.dispose();
        preview = new SceneView($("component-preview"), () => {}, {
          mode: layer.view,
          markers: false,
          interactive: false,
          ...layer,
        });
        const view = preview;
        $("component-preview-status").hidden = false;
        $("component-preview-status").textContent = "Loading room…";
        const url = native
          ? await native.sceneURL(model)
          : new URL(`api/models/${model.id}/scene.glb`, location.href).href;
        try {
          if (current !== generation) return;
          await view.load(model, url);
        } finally {
          if (native) URL.revokeObjectURL(url);
        }
        if (current !== generation) return;
        loadedModel = model.id;
        preview.setStates(
          new Map(
            model.controls.map((c) => [
              c.id,
              {
                on: true,
                brightness: 255,
                rgb: hexToRgb(c.color || "#fff0d4"),
              },
            ]),
          ),
        );
      }
      if (current !== generation) return;
      Object.assign(preview.options, layer);
      preview.setView(layer.view);
      $("component-preview-status").hidden = true;
    } catch (e) {
      if (current === generation) {
        loadedModel = null;
        $("component-preview-status").hidden = false;
        $("component-preview-status").textContent = e.message;
      }
    }
  }
  $("show-components").onclick = async () => {
    active = true;
    $("models-workspace").hidden = true;
    $("components-workspace").hidden = false;
    $("show-models").setAttribute("aria-pressed", "false");
    $("show-components").setAttribute("aria-pressed", "true");
    try {
      components = await api("components");
      refreshModels();
      drawList();
      if (!draftId && components.length) edit(components[0], true);
      else if (draftId) update();
    } catch (e) {
      error(e.message);
    }
  };
  $("show-models").onclick = () => {
    active = false;
    ++generation;
    preview?.dispose();
    preview = null;
    loadedModel = null;
    $("models-workspace").hidden = false;
    $("components-workspace").hidden = true;
    $("show-models").setAttribute("aria-pressed", "true");
    $("show-components").setAttribute("aria-pressed", "false");
  };
  $("new-component").onclick = create;
  $("component-editor").oninput = () => {
    deleteArmed = false;
    $("delete-component").textContent = "Delete";
    $("component-save-state").textContent = "Unsaved changes";
    update();
  };
  $("component-editor").onsubmit = async (event) => {
    event.preventDefault();
    $("save-component").disabled = true;
    try {
      const snapshot = read();
      const c = await api("components", {
        method: "PUT",
        body: JSON.stringify(snapshot),
      });
      components = [...components.filter((v) => v.id !== c.id), c];
      saved = true;
      $("delete-component").hidden = false;
      $("component-save-state").textContent =
        JSON.stringify(read()) === JSON.stringify(snapshot)
          ? "Saved"
          : "Unsaved changes";
      drawList();
      toast("Component saved.");
    } catch (e) {
      error(e.message);
    } finally {
      $("save-component").disabled = false;
    }
  };
  $("duplicate-component").onclick = () => {
    try {
      const c = read();
      edit({
        ...c,
        id: crypto.randomUUID(),
        title: `${c.title.slice(0, 150)} copy`,
      });
    } catch (e) {
      error(e.message);
    }
  };
  $("delete-component").onclick = async () => {
    if (!deleteArmed) {
      deleteArmed = true;
      $("delete-component").textContent = "Confirm delete";
      return;
    }
    $("delete-component").disabled = true;
    try {
      await api(`components/${draftId}`, { method: "DELETE" });
      components = components.filter((c) => c.id !== draftId);
      draftId = null;
      ++generation;
      preview?.dispose();
      preview = null;
      loadedModel = null;
      $("component-editor").hidden = true;
      $("component-empty").hidden = false;
      drawList();
      toast("Component deleted.");
    } catch (e) {
      error(e.message);
    } finally {
      $("delete-component").disabled = false;
    }
  };
  $("copy-component").onclick = async () => {
    try {
      await navigator.clipboard.writeText(componentYaml(read()));
      toast("Dashboard configuration copied.");
    } catch (e) {
      $("component-yaml").select();
      toast("Select and copy the configuration.");
    }
  };
  $("export-component").onclick = () => {
    try {
      const c = read(),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }),
        );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${c.id}.component.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      error(e.message);
    }
  };
  $("import-component").onclick = () => $("component-file").click();
  $("component-file").onchange = async () => {
    try {
      const file = $("component-file").files[0];
      if (!file) return;
      if (file.size > 16384)
        throw new Error("Component files must be smaller than 16 KB.");
      const c = validateComponent(
        JSON.parse(await file.text()),
        models().map((m) => m.id),
      );
      // Import creates a draft and never silently overwrites a saved component.
      edit({ ...c, id: crypto.randomUUID() });
      toast("Component imported. Review the preview and save.");
    } catch (e) {
      error(e.message);
    } finally {
      $("component-file").value = "";
    }
  };
  window.addEventListener("pagehide", () => {
    ++generation;
    preview?.dispose();
  });
}
