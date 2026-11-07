/** Preview scoped house changes before confirmation. */
export function initHouseActions({ api, selected, changed }) {
  const $ = (id) => document.getElementById(id),
    dialog = $("house-action-dialog");
  let action,
    house,
    summary,
    file,
    busy = false,
    opener;
  function lock(value) {
    busy = value;
    for (const id of [
      "house-action-confirm",
      "house-action-cancel",
      "house-review",
      "house-file",
    ])
      $(id).disabled = value || (id === "house-action-confirm" && !summary);
    $("house-action-form").setAttribute("aria-busy", String(value));
  }
  const text = (tag, value) => {
    const el = document.createElement(tag);
    el.textContent = value;
    return el;
  };
  function draw(data, replacement) {
    const host = $("house-action-summary");
    host.replaceChildren(
      text("h3", replacement ? "Review replacement" : `Delete ${data.title}?`),
    );
    host.append(
      text(
        "p",
        `${data.rooms.length} existing rooms: ${data.rooms.map((r) => r.title).join(", ")}.`,
      ),
    );
    if (replacement) {
      host.append(
        text(
          "p",
          `${data.incomingRooms.length} replacement rooms: ${data.incomingRooms.map((r) => r.title).join(", ")}.`,
        ),
      );
      host.append(
        text(
          "p",
          `${data.keptRooms} matching rooms keep their identity, compatible mappings and settings. Geometry, positions and floor membership come from the ZIP.`,
        ),
      );
      if (data.removedBindings?.length)
        host.append(
          text(
            "p",
            `Incompatible device mappings removed: ${data.removedBindings.join(", ")}.`,
          ),
        );
      if (data.removedRooms.length)
        host.append(
          text(
            "p",
            `Rooms and mappings removed: ${data.removedRooms.join(", ")}.`,
          ),
        );
      host.append(
        text(
          "p",
          `Saved views removed: ${data.removedViews.join(", ") || "None"}. Other saved views remain; check their camera framing after replacement.`,
        ),
      );
    } else
      host.append(
        text(
          "p",
          `This permanently removes these rooms, uploaded models, mappings and ${data.views.length} saved views${data.views.length ? ` (${data.views.join(", ")})` : ""}.`,
        ),
      );
    host.append(
      text(
        "p",
        "Home Assistant devices are unchanged. Dashboard cards for removed rooms or views will need to be removed or updated.",
      ),
    );
  }
  async function open(kind, button) {
    action = kind;
    house = selected()?.houseId;
    summary = null;
    file = null;
    opener = button;
    if (!house) return;
    $("house-action-form").reset();
    $("house-action-summary").replaceChildren();
    $("house-action-error").textContent = $(
      "house-action-progress",
    ).textContent = "";
    const replace = kind === "replace";
    $("house-action-title").textContent = replace
      ? "Replace house"
      : "Delete house";
    $("house-action-description").textContent = replace
      ? "Choose a full-house ZIP. Preview all changes before replacing anything."
      : "Review everything that will be removed. This cannot be undone.";
    $("house-file-field").hidden = $("house-review").hidden = !replace;
    $("house-action-confirm").textContent = replace
      ? "Replace house"
      : "Delete house";
    dialog.showModal();
    lock(true);
    try {
      const data = await api(`houses/${house}`);
      if (!replace) {
        summary = data;
        draw(data, false);
      }
    } catch (error) {
      $("house-action-error").textContent = error.message;
    } finally {
      lock(false);
    }
  }
  $("house-replace").onclick = (event) => open("replace", event.currentTarget);
  $("house-delete").onclick = (event) => open("delete", event.currentTarget);
  $("house-file").onchange = () => {
    summary = null;
    file = null;
    $("house-action-summary").replaceChildren();
    $("house-action-confirm").disabled = true;
    $("house-action-error").textContent = "";
  };
  $("house-action-cancel").onclick = () => dialog.close();
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => opener?.focus());
  const progress = ({ loaded, total }) => {
    $("house-action-progress").textContent = total
      ? `Uploading ${Math.round((loaded / total) * 100)}%…`
      : "Uploading…";
  };
  $("house-review").onclick = async () => {
    file = $("house-file").files[0];
    summary = null;
    $("house-action-error").textContent = "";
    $("house-action-summary").replaceChildren();
    if (!file || file.size > 100 * 1024 * 1024) {
      $("house-action-error").textContent =
        "Choose a full-house ZIP smaller than 100 MB.";
      lock(false);
      return;
    }
    lock(true);
    try {
      summary = await api(`houses/${house}`, {
        method: "POST",
        file,
        onProgress: progress,
        onUploaded: () => {
          $("house-action-progress").textContent = "Validating every room…";
        },
      });
      draw(summary, true);
    } catch (error) {
      $("house-action-error").textContent = error.message;
    } finally {
      $("house-action-progress").textContent = "";
      lock(false);
    }
  };
  $("house-action-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!summary || busy) return;
    lock(true);
    $("house-action-error").textContent = "";
    try {
      const result = await api(
        `houses/${house}`,
        action === "replace"
          ? {
              method: "PUT",
              file,
              headers: { "X-Rooms-Revision": summary.revision },
              onProgress: progress,
              onUploaded: () => {
                $("house-action-progress").textContent = "Replacing house…";
              },
            }
          : {
              method: "DELETE",
              body: JSON.stringify({ revision: summary.revision }),
            },
      );
      dialog.close();
      await changed(result);
    } catch (error) {
      summary = null;
      $("house-action-error").textContent =
        error.message +
        (action === "replace"
          ? " Preview the file again before retrying."
          : " Close and reopen this dialog to review again.");
    } finally {
      $("house-action-progress").textContent = "";
      lock(false);
    }
  };
}
