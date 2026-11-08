import { searchableSelect } from "./searchable-select.js";

// Each kind groups one control type under a single existing HA entity.
// Shades and windows/doors are both cover controls; the loaded scene tells them
// apart (roller shade vs hinged/sliding leaf). Unknown covers fit either.
export const GROUP_KINDS = {
  light: {
    title: "Group lights",
    edit: "Edit light group",
    noun: "lights",
    intro:
      "Choose modeled lights that share one Home Assistant entity. They will appear as one control and light up together.",
    entity: /^(light|switch)\./,
    placeholder: "e.g. Dining lights",
    prefix: "lg-",
    member: (c) => c.type === "light",
  },
  shade: {
    title: "Group shades",
    edit: "Edit shade group",
    noun: "shades",
    intro:
      "Choose modeled shades or shutters that share one Home Assistant cover. They will appear as one control and move together.",
    entity: /^cover\./,
    placeholder: "e.g. Living room shutters",
    prefix: "cg-",
    member: (c, kind) => c.type === "cover" && kind !== "opening",
  },
  opening: {
    title: "Group windows & doors",
    edit: "Edit window & door group",
    noun: "windows or doors",
    intro:
      "Choose modeled windows or doors that share one Home Assistant cover. They will appear as one control and open or close together.",
    entity: /^cover\./,
    placeholder: "e.g. Dining windows",
    prefix: "cg-",
    member: (c, kind) => c.type === "cover" && kind !== "shade",
  },
};
export const groupKindFor = (room, group, coverKind) => {
  const first = room.controls.find((c) => c.id === group.controls[0]);
  return first?.type === "light" ? "light" : coverKind(first?.id) || "shade";
};

/** Groups devices from this room under a single existing HA entity. */
export function initLightGroups({
  model,
  entities,
  save,
  coverKind = () => undefined,
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "light-groups-dialog";
  dialog.setAttribute("aria-labelledby", "light-group-heading");
  dialog.innerHTML = `<form id="light-group-form"><div class="dialog-top"><div><span class="eyebrow">Room devices</span><h2 id="light-group-heading">Group lights</h2></div><button type="button" data-close class="close" aria-label="Close light group">×</button></div><p class="muted" id="light-group-intro"></p><label>Group name<input id="light-group-name" maxlength="160" required placeholder=""></label><label id="light-group-entity-label" for="light-group-entity">Home Assistant entity</label><select id="light-group-entity"></select><p class="muted small" id="light-group-entity-help"></p><fieldset><legend id="light-group-legend"></legend><input id="light-group-search" type="search" aria-label="Search room devices" placeholder="Search…"><div id="light-group-members"></div><p id="light-group-count" class="muted small" role="status"></p></fieldset><p id="light-group-error" class="error" role="alert"></p><div class="actions"><button type="button" id="ungroup-lights" class="danger" hidden>Ungroup</button><button type="button" data-close>Cancel</button><button type="submit" class="primary" id="save-light-group">Save group</button></div></form>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector("#" + id);
  const picker = searchableSelect(
    $("light-group-entity"),
    $("light-group-entity-label"),
  );
  let editing,
    roomId,
    kind = GROUP_KINDS.light,
    busy = false;
  const count = () => {
    if (
      dialog.querySelectorAll("[name=group-member]:checked").length >= 2 &&
      $("light-group-error").textContent === `Choose at least two ${kind.noun}.`
    )
      $("light-group-error").textContent = "";
    $("light-group-count").textContent =
      `${dialog.querySelectorAll("[name=group-member]:checked").length} selected · choose at least two ${kind.noun}`;
  };
  dialog.querySelectorAll("[data-close]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!busy) dialog.close();
      }),
  );
  dialog.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  $("light-group-search").oninput = () => {
    const query = $("light-group-search").value.trim().toLocaleLowerCase();
    dialog
      .querySelectorAll(".light-group-member")
      .forEach(
        (row) =>
          (row.hidden = !row.textContent.toLocaleLowerCase().includes(query)),
      );
  };
  async function persist(groups) {
    busy = true;
    $("save-light-group").disabled = $("ungroup-lights").disabled = true;
    $("light-group-error").textContent = "";
    try {
      await save(roomId, groups);
      dialog.close();
    } catch (e) {
      $("light-group-error").textContent = e.message;
    } finally {
      busy = false;
      $("save-light-group").disabled = $("ungroup-lights").disabled = false;
    }
  }
  $("light-group-form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const ids = [...dialog.querySelectorAll("[name=group-member]:checked")].map(
      (i) => i.value,
    );
    if (ids.length < 2) {
      $("light-group-error").textContent = `Choose at least two ${kind.noun}.`;
      return;
    }
    if (model()?.id !== roomId) {
      $("light-group-error").textContent =
        "The selected room changed. Reopen the group.";
      return;
    }
    const group = {
      id: editing || kind.prefix + crypto.randomUUID().replaceAll("-", ""),
      label: $("light-group-name").value.trim(),
      controls: ids,
      entityId: $("light-group-entity").value,
    };
    await persist([
      ...(model().lightGroups || []).filter((g) => g.id !== editing),
      group,
    ]);
  };
  $("ungroup-lights").onclick = () => {
    if (
      !busy &&
      confirm(
        `Ungroup these ${kind.noun}? Individual controls and their previous entity connections will be restored.`,
      )
    )
      persist((model().lightGroups || []).filter((g) => g.id !== editing));
  };
  return {
    open(id, kindName = "light") {
      const room = model();
      if (!room || room.houseView) return;
      editing = id;
      roomId = room.id;
      const group = room.lightGroups?.find((g) => g.id === id);
      kind =
        GROUP_KINDS[group ? groupKindFor(room, group, coverKind) : kindName];
      $("light-group-heading").textContent = group ? kind.edit : kind.title;
      $("light-group-intro").textContent = kind.intro;
      $("light-group-legend").textContent =
        `${kind.noun[0].toUpperCase()}${kind.noun.slice(1)} in this group`;
      $("light-group-entity-help").textContent =
        `Choose the entity controlling these ${kind.noun}. No new Home Assistant entity is created.`;
      $("light-group-name").placeholder = kind.placeholder;
      $("light-group-name").value = group?.label || "";
      $("light-group-search").value = $("light-group-error").textContent = "";
      $("ungroup-lights").hidden = !group;
      const select = $("light-group-entity");
      select.replaceChildren(new Option("Connect an entity later", ""));
      for (const entity of entities().filter((e) =>
        kind.entity.test(e.entity_id),
      ))
        select.add(
          new Option(
            `${entity.attributes?.friendly_name || entity.entity_id} · ${entity.entity_id}`,
            entity.entity_id,
          ),
        );
      if (
        group?.entityId &&
        ![...select.options].some((o) => o.value === group.entityId)
      )
        select.add(
          new Option(group.entityId + " (unavailable)", group.entityId),
        );
      select.value = group?.entityId || "";
      picker.refresh();
      const host = $("light-group-members");
      host.replaceChildren();
      const taken = new Set(
        (room.lightGroups || [])
          .filter((g) => g.id !== id)
          .flatMap((g) => g.controls),
      );
      for (const c of room.controls.filter(
        (c) =>
          !c.hidden &&
          (kind.member(c, coverKind(c.id)) || group?.controls.includes(c.id)),
      )) {
        const row = document.createElement("label");
        row.className = "light-group-member";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = "group-member";
        input.value = c.id;
        input.checked = group?.controls.includes(c.id) || false;
        input.disabled = taken.has(c.id);
        input.onchange = count;
        const text = document.createElement("span");
        text.textContent = c.sourceLabel || c.label;
        if (input.disabled) {
          const note = document.createElement("small");
          note.textContent = "Already in another group";
          text.append(document.createElement("br"), note);
        }
        row.append(input, text);
        host.append(row);
      }
      count();
      dialog.showModal();
      $("light-group-name").focus();
    },
  };
}
