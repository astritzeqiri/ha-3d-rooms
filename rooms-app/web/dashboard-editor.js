import { mountCameraNavigation } from "./camera-navigation.js";
import { componentYaml, validateComponent } from "../shared/component.mjs";

/** Edit the camera in the same scene that will be saved to the dashboard. */
export function initDashboardEditor({ api, model, scene, toast }) {
  const $ = (id) => document.getElementById(id);
  const panel = $("dashboard-panel");
  const navigation = mountCameraNavigation($("viewport"), scene);
  navigation.hidden = true;
  let current,
    draftId,
    busy = false,
    applying = false,
    saved = false,
    savedSnapshot;
  const fields = ["heading", "tilt", "zoom"];
  const read = () =>
    validateComponent(
      {
        schemaVersion: 1,
        id: draftId,
        title: $("dashboard-title").value,
        height: Number($("dashboard-height").value),
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
    $("dashboard-save-state").textContent = saved
      ? $("dashboard-yaml").value && JSON.stringify(read()) === savedSnapshot
        ? "Saved in HA components"
        : "Unsaved changes"
      : "Not saved yet";
  }
  function sync() {
    if (panel.hidden || applying || !scene()?.model) return;
    current = scene().captureView();
    if (!current) return;
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
    // Preserve drag/pan changes when the preview or window resizes.
    Object.assign(scene().options, current);
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
      Object.assign(scene().options, {
        camera: current.view === mode ? current.camera : undefined,
        heading: Number($("dashboard-heading").value),
        tilt: Number($("dashboard-tilt").value),
        zoom: Number($("dashboard-zoom").value),
      });
      scene().setView(mode);
    } finally {
      applying = false;
    }
    sync();
  }
  function close() {
    if (panel.hidden) return;
    scene().options.onCameraChange = undefined;
    panel.hidden = true;
    navigation.hidden = true;
    document.body.classList.remove("dashboard-editing");
    $("viewport").style.height = "";
    $("dashboard").setAttribute("aria-expanded", "false");
  }
  $("dashboard").setAttribute("aria-controls", "dashboard-panel");
  $("dashboard").setAttribute("aria-expanded", "false");
  $("dashboard").onclick = () => {
    if (!panel.hidden) {
      close();
      return;
    }
    current = scene()?.captureView();
    if (!current) {
      toast("Wait for the room to finish loading.");
      return;
    }
    draftId = crypto.randomUUID();
    saved = false;
    savedSnapshot = undefined;
    $("dashboard-title").value = `${model().title} view`;
    $("dashboard-height").value = Math.max(
      180,
      Math.min(1600, Math.round($("viewport").getBoundingClientRect().height)),
    );
    panel.hidden = false;
    navigation.hidden = false;
    scene().options.allowRotate = true;
    applying = true;
    Object.assign(scene().options, current);
    scene().setView(current.view);
    scene().options.onCameraChange = sync;
    document.body.classList.add("dashboard-editing");
    $("dashboard").setAttribute("aria-expanded", "true");
    applying = false;
    sync();
    $("dashboard-title").focus({ preventScroll: true });
  };
  $("close-dashboard").onclick = () => {
    close();
    $("dashboard").focus({ preventScroll: true });
  };
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      $("dashboard").focus();
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
      const snapshot = read();
      await api("components", {
        method: "PUT",
        body: JSON.stringify(snapshot),
      });
      saved = true;
      savedSnapshot = JSON.stringify(snapshot);
      $("dashboard-save-state").textContent =
        JSON.stringify(read()) === JSON.stringify(snapshot)
          ? "Saved in HA components"
          : "Unsaved changes";
      toast("Component saved. Find it under HA components.");
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
  return { close };
}
