import { initMarkerEditor } from "./marker-editor.js";
import { componentYaml, validateComponent } from "../shared/component.mjs";
import { viewThumbnail } from "./view-thumbnail.js";

/** Edit the camera in the same scene that will be saved to the dashboard. */
export function initDashboardEditor({
  api,
  model,
  scene,
  toast,
  preview,
  onOpen = () => {},
  onClose = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  const panel = $("dashboard-panel");
  const markerEditor = initMarkerEditor({ model, scene, onChange: update });
  let current,
    draftId,
    thumbnail,
    busy = false,
    applying = false,
    saved = false,
    savedSnapshot,
    baseline;
  const fields = ["heading", "tilt", "zoom"];
  const read = () =>
    validateComponent(
      {
        schemaVersion: 1,
        id: draftId,
        title: $("dashboard-title").value,
        ...(!$("dashboard-show-title").checked ? { show_title: false } : {}),
        height: Number($("dashboard-height").value),
        ...(thumbnail ? { thumbnail } : {}),

        ...(Object.keys(markerEditor.read()).length
          ? { markers: markerEditor.read() }
          : {}),
        layers: [{ model: model().id, ...current }],
      },
      [model().id],
    );
  function update() {
    if (panel.hidden || !current) return;
    $("dashboard-error").textContent = "";
    try {
      $("dashboard-yaml").value = componentYaml(read());
    } catch (e) {
      $("dashboard-error").textContent = e.message;
      $("dashboard-yaml").value = "";
    }
    const unchanged = !!(
      saved &&
      $("dashboard-yaml").value &&
      JSON.stringify(read()) === savedSnapshot
    );
    $("dashboard-save-state").textContent = unchanged
      ? "Saved view"
      : saved
        ? "Unsaved changes"
        : "Not saved yet";
    $("use-saved-view").hidden = !unchanged;
    $("save-dashboard-component").classList.toggle("primary", !unchanged);
  }
  function sync(event = {}) {
    if (panel.hidden || applying || !scene()?.model) return;
    // Resizing changes only the rendered fit, never the authored camera.
    if (event.source === "resize") {
      update();
      return;
    }
    if (!current?.camera || ["orbit", "preset"].includes(event.source)) {
      const captured = scene().captureView();
      if (!captured) return;
      current = captured;
      Object.assign(scene().options, current);
    }
    $("dashboard-view").value = current.view;
    for (const key of fields) {
      const input = $("dashboard-" + key);
      // Keep an in-progress decimal intact while the user is typing.
      if (document.activeElement !== input) input.value = current[key];
      const range = $("dashboard-" + key + "-range");
      if (key === "zoom") {
        range.min = Math.min(0.25, current.zoom);
        range.max = Math.max(3, Math.ceil(current.zoom));
      }
      range.value = current[key];
    }
    update();
  }
  function apply() {
    if (panel.hidden || !current || applying) return;
    const inputs = fields.map((key) => $("dashboard-" + key));
    if (inputs.some((input) => !input.validity.valid)) {
      $("dashboard-error").textContent =
        "Enter valid rotation, tilt and zoom values.";
      $("dashboard-yaml").value = "";
      return;
    }
    const mode = $("dashboard-view").value;
    applying = true;
    try {
      current = {
        ...current,
        view: mode,
        camera: current.view === mode ? current.camera : undefined,
        heading: Number($("dashboard-heading").value),
        tilt: Number($("dashboard-tilt").value),
        zoom: Number($("dashboard-zoom").value),
      };
      Object.assign(scene().options, current);
      scene().setView(mode);
    } finally {
      applying = false;
    }
    sync();
  }
  function dirty() {
    if (panel.hidden || !baseline) return false;
    try {
      return JSON.stringify(read()) !== baseline;
    } catch {
      return true;
    }
  }
  function close({ force = false } = {}) {
    if (panel.hidden) return true;
    if (!force && dirty() && !confirm("Discard unsaved view changes?"))
      return false;
    scene().options.onCameraChange = undefined;
    markerEditor.close();
    panel.hidden = true;
    document.body.classList.remove("dashboard-editing");
    $("viewport").style.height = "";
    $("dashboard").setAttribute("aria-expanded", "false");
    const url = new URL(location.href);
    url.searchParams.delete("saved_view");
    history.replaceState(null, "", url);
    window.dispatchEvent(new CustomEvent("rooms-route-change"));
    onClose();
    return true;
  }
  $("dashboard").setAttribute("aria-controls", "dashboard-panel");
  $("dashboard").setAttribute("aria-expanded", "false");
  function open(component, { draft = false } = {}) {
    if (!panel.hidden && !close()) return false;
    if (!scene()?.model) {
      toast("Wait for the room to finish loading.");
      return;
    }
    if (component && component.layers[0].model !== model().id)
      throw new Error("Choose the view’s room first.");
    const fromLibrary = document.body.dataset?.roomTab === "views";
    panel.hidden = false;
    document.body.classList.add("dashboard-editing");
    // A library opened directly has never laid out its hidden room canvas.
    if (!component && fromLibrary) scene().fitFloor?.();
    current = component
      ? structuredClone(component.layers[0])
      : scene().captureView();
    if (!current) {
      panel.hidden = true;
      document.body.classList.remove("dashboard-editing");
      toast("Wait for the room to finish loading.");
      return;
    }
    draftId = component?.id || crypto.randomUUID();
    thumbnail = component?.thumbnail;
    saved = !!component && !draft;
    savedSnapshot = saved ? JSON.stringify(component) : undefined;
    $("dashboard-title").value =
      component?.title || `${model().title} overview`;
    $("dashboard-show-title").checked = component
      ? component.show_title !== false
      : false;
    $("dashboard-height").value =
      component?.height ??
      Math.max(
        180,
        Math.min(
          1600,
          Math.round($("viewport").getBoundingClientRect().height),
        ),
      );
    $("dashboard-advanced").open = false;
    scene().options.allowRotate = true;
    applying = true;
    Object.assign(scene().options, current);
    scene().setView(current.view);
    scene().options.onCameraChange = sync;
    $("dashboard").setAttribute("aria-expanded", "true");
    markerEditor.open(component?.markers);
    applying = false;
    sync();
    baseline = JSON.stringify(read());
    if (saved) savedSnapshot = baseline;
    update();
    $("dashboard-panel-title").textContent = saved
      ? "Edit saved view"
      : "Create dashboard view";
    onOpen();
    const url = new URL(location.href);
    if (component && !draft) url.searchParams.set("saved_view", component.id);
    else url.searchParams.delete("saved_view");
    history.replaceState(null, "", url);
    window.dispatchEvent(new CustomEvent("rooms-route-change"));
    if (saved) cachePreview();
    $("dashboard-title").focus({ preventScroll: true });
    return true;
  }
  $("dashboard").onclick = () => open();
  $("preview-dashboard").hidden = !preview;
  $("preview-dashboard").onclick = async () => {
    try {
      if (!$("dashboard-form").reportValidity()) return;
      sync();
      await preview(read());
    } catch (error) {
      $("dashboard-error").textContent = error.message;
    } finally {
      $("preview-dashboard").focus({ preventScroll: true });
    }
  };
  $("dashboard-preset").onchange = () => {
    if (!$("dashboard-preset").value) return;
    scene().setCameraPreset($("dashboard-preset").value);
    sync({ source: "preset" });
    $("dashboard-preset").value = "";
  };
  $("close-dashboard").onclick = () => {
    close();
  };
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  for (const key of fields) {
    $("dashboard-" + key).oninput = apply;
    $("dashboard-" + key).onchange = sync;
    $("dashboard-" + key + "-range").oninput = (e) => {
      $("dashboard-" + key).value = e.target.value;
      apply();
    };
  }
  $("dashboard-view").onchange = apply;
  $("dashboard-title").oninput = update;
  $("dashboard-show-title").onchange = update;
  $("dashboard-height").oninput = () => {
    const input = $("dashboard-height");
    if (input.validity.valid) $("viewport").style.height = `${input.value}px`;
    update();
  };
  $("dashboard-form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    $("save-dashboard-component").disabled = true;
    try {
      sync();
      thumbnail = captureThumbnail() || thumbnail;
      const snapshot = read();
      await api("components", {
        method: "PUT",
        body: JSON.stringify(snapshot),
      });
      saved = true;
      savedSnapshot = JSON.stringify(snapshot);
      baseline = savedSnapshot;
      cachePreview();
      update();
      window.dispatchEvent(
        new CustomEvent("rooms-view-saved", { detail: snapshot }),
      );
      $("dashboard-save-state").textContent =
        JSON.stringify(read()) === JSON.stringify(snapshot)
          ? "Saved view"
          : "Unsaved changes";
      toast(
        "View saved. Choose it in Saved views or the Home Assistant card editor.",
      );
    } catch (error) {
      $("dashboard-error").textContent = error.message;
    } finally {
      busy = false;
      $("save-dashboard-component").disabled = false;
    }
  };
  $("copy-dashboard").onclick = async () => {
    try {
      await navigator.clipboard.writeText(componentYaml(read()));
      toast("Dashboard configuration copied.");
    } catch {
      $("dashboard-yaml").closest("details").open = true;
      $("dashboard-yaml").select();
      toast("Select and copy the configuration.");
    }
  };
  function captureThumbnail() {
    try {
      const view = scene();
      view.render();
      return viewThumbnail(view.renderer.domElement);
    } catch {
      return undefined;
    }
  }
  function cachePreview() {
    try {
      const view = scene();
      view.render();
      localStorage.setItem(
        `3d-rooms-view-preview-v2:${draftId}`,
        viewThumbnail(view.renderer.domElement),
      );
    } catch {
      /* Thumbnails are optional and remain private to this browser. */
    }
  }
  $("use-saved-view").onclick = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("rooms-view-use", { detail: read() }),
      );
    } catch (error) {
      toast(error.message);
    }
  };
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  return { close, open, dirty };
}
