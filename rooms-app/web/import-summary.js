import { packageSummary } from "../shared/package-summary.mjs";
export function initImportSummary({ models }) {
  const $ = (id) => document.getElementById(id);
  let generation = 0,
    checked = null,
    pending = null;
  const node = (tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  };
  function reset() {
    generation++;
    checked = null;
    pending = null;
    $("import-summary").hidden = true;
    $("import-summary").replaceChildren();
    $("import-submit").disabled = false;
  }
  async function inspect() {
    const file = $("package").files[0];
    if (!file) return false;
    const current = ++generation;
    checked = null;
    $("import-submit").disabled = true;
    $("import-summary").hidden = false;
    $("import-summary").replaceChildren(node("p", "Reading package summary…"));
    $("import-error").textContent = "";
    try {
      const summary = packageSummary(
        new Uint8Array(await file.arrayBuffer()),
        models(),
      );
      if (current !== generation) return false;
      const list = node("ul", "");
      for (const room of summary.rooms)
        list.append(node("li", `${room.title} · ${room.devices} controls`));
      $("import-summary").replaceChildren(
        node("h3", summary.title),
        node(
          "p",
          `${summary.rooms.length} rooms · ${summary.floors.length} floors · ${summary.controls} controls`,
        ),
        list,
        node(
          "p",
          summary.conflicts.length
            ? `Already in your library: ${summary.conflicts.join(", ")}. Use Replace model in the existing room’s settings.`
            : "Ready to import. Positions, floors and controls will be preserved.",
        ),
      );
      if (summary.conflicts.length) {
        $("import-error").textContent =
          "Existing rooms will not be overwritten. Resolve the duplicate room IDs before importing.";
        return false;
      }
      checked = file;
      return true;
    } catch (error) {
      if (current === generation)
        $("import-error").textContent =
          `Cannot read this ZIP: ${error.message}`;
      return false;
    } finally {
      if (current === generation) $("import-submit").disabled = !checked;
    }
  }
  $("package").onchange = () => {
    pending = inspect();
  };
  return {
    reset,
    async ready() {
      if (pending) await pending;
      return checked === $("package").files[0] || inspect();
    },
  };
}
