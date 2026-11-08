import {
  chooseControl,
  chooseRoom,
  encodeChoices,
  initialRooms,
  mappingRows,
  summarize,
} from "../shared/house-matching.mjs";

/** Preview scoped house changes before confirmation. */
export function initHouseActions({ api, selected, changed }) {
  const $ = (id) => document.getElementById(id),
    dialog = $("house-action-dialog");
  let action,
    house,
    summary,
    file,
    busy = false,
    opener,
    rooms = {},
    controls = {};
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
  const BY = {
    id: ["Same device", "same"],
    name: ["Matched by name", "name"],
    manual: ["Your choice", "manual"],
  };
  const ROOM_BY = {
    id: "Same room",
    name: "Matched by name",
    manual: "Your choice",
  };
  function select(label, options, value, onchange) {
    const el = document.createElement("select");
    el.setAttribute("aria-label", label);
    for (const [optionValue, optionLabel] of options) {
      const option = text("option", optionLabel);
      option.value = optionValue;
      el.append(option);
    }
    el.value = value;
    el.onchange = () => onchange(el.value);
    return el;
  }
  function pill(label, kind) {
    const el = text("span", label);
    el.className = "match-pill";
    el.dataset.kind = kind;
    return el;
  }
  function drawRoom(data, room) {
    const modelId = rooms[room.roomId];
    const section = document.createElement("section");
    section.className = "house-match-room";
    const head = document.createElement("div");
    head.className = "house-match-head";
    const how =
      modelId && modelId === room.match ? room.matchedBy : modelId && "manual";
    head.append(
      text("h4", room.title),
      modelId
        ? pill(ROOM_BY[how] || "Your choice", how || "manual")
        : pill("New room", "new"),
    );
    section.append(head);
    const label = text("label", "Replaces ");
    label.className = "house-match-replaces";
    label.append(
      select(
        `Existing room replaced by ${room.title}`,
        [
          ["", "Nothing — add as a new room"],
          ...data.rooms.map((r) => [r.id, r.title]),
        ],
        modelId,
        (value) => {
          rooms = chooseRoom(rooms, room.roomId, value);
          redraw();
        },
      ),
    );
    section.append(label);
    if (!modelId) {
      section.append(
        text("p", "Starts without device mappings from your existing rooms."),
      );
      return section;
    }
    const rows = mappingRows(room, modelId, controls);
    if (!rows.length) {
      section.append(text("p", "The existing room has no device mappings."));
      return section;
    }
    const names = Object.fromEntries(room.controls.map((c) => [c.id, c.label]));
    const list = document.createElement("ul");
    list.className = "house-match-list";
    for (const row of rows) {
      const item = document.createElement("li");
      const what = document.createElement("div");
      what.append(text("strong", row.label), text("small", row.entity));
      const [status, kind] = row.target
        ? BY[row.matchedBy] || BY.manual
        : ["Not matched", "missing"];
      item.dataset.kind = kind;
      item.append(
        what,
        select(
          `New device for ${row.label}`,
          [
            ["", "Don't keep this mapping"],
            ...row.options.map((id) => [id, names[id] || id]),
          ],
          row.target || "",
          (value) => {
            controls = chooseControl(
              controls,
              room,
              modelId,
              row.control,
              value,
            );
            redraw();
          },
        ),
        pill(status, kind),
      );
      list.append(item);
    }
    section.append(list);
    return section;
  }
  function drawReplacement(data, host) {
    const totals = summarize(data.matching, data.rooms, rooms, controls);
    const intro = text(
      "p",
      `${totals.matchedRooms} of ${data.rooms.length} existing rooms matched` +
        (totals.newRooms ? ` · ${totals.newRooms} new` : "") +
        ` · ${totals.kept} of ${totals.mappings} device mappings kept` +
        (totals.byName ? ` (${totals.byName} matched by name)` : "") +
        ".",
    );
    intro.className = "house-match-totals";
    host.append(
      intro,
      text(
        "p",
        "Rooms match by their house ID, then by name; devices by ID, then by name and type. Check each room and change anything that looks wrong. Matched rooms keep their name, area, mappings, light groups and hidden devices; geometry, positions and floors come from the ZIP.",
      ),
    );
    for (const room of data.matching) host.append(drawRoom(data, room));
    if (totals.unmatched)
      host.append(
        text(
          "p",
          `${totals.unmatched} device mappings are not matched and will be removed. Choose a device for them above, or map them again after replacing.`,
        ),
      );
    if (totals.removedRooms.length)
      host.append(
        text(
          "p",
          `Removed with their mappings: ${totals.removedRooms.map((r) => r.title).join(", ")}.`,
        ),
      );
    const suggested = data.matching.every(
      (r) => (r.match || "") === rooms[r.roomId],
    );
    host.append(
      text(
        "p",
        suggested
          ? `Saved views removed: ${data.removedViews.join(", ") || "None"}. Other saved views remain; check their camera framing after replacement.`
          : "Saved views of removed rooms are removed too. Other saved views remain; check their camera framing after replacement.",
      ),
    );
  }
  function redraw() {
    const host = $("house-action-summary");
    const scroll = dialog.scrollTop;
    const focused = document.activeElement?.getAttribute("aria-label");
    draw(summary, true);
    dialog.scrollTop = scroll;
    if (focused)
      host.querySelector(`[aria-label="${CSS.escape(focused)}"]`)?.focus();
  }
  function draw(data, replacement) {
    const host = $("house-action-summary");
    host.replaceChildren(
      text("h3", replacement ? "Review replacement" : `Delete ${data.title}?`),
    );
    if (replacement) drawReplacement(data, host);
    else {
      host.append(
        text(
          "p",
          `${data.rooms.length} existing rooms: ${data.rooms.map((r) => r.title).join(", ")}.`,
        ),
      );
      host.append(
        text(
          "p",
          `This permanently removes these rooms, uploaded models, mappings and ${data.views.length} saved views${data.views.length ? ` (${data.views.join(", ")})` : ""}.`,
        ),
      );
    }
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
      rooms = initialRooms(summary.matching);
      controls = {};
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
              headers: {
                "X-Rooms-Revision": summary.revision,
                "X-Rooms-Matches": encodeChoices(
                  summary.matching,
                  rooms,
                  controls,
                ),
              },
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
