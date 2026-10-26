import { rankEntities } from "../shared/entity-picker.mjs";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const chevron =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const searchIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const clearIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const checkIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

/** One searchable entity field replacing the old filter input + select pair. */
export function pickerHTML({ control, entities, selectedId, enabled }) {
  const entity = entities.find((e) => e.entity_id === selectedId);
  const name = entity?.attributes?.friendly_name || selectedId;
  const id = esc(control.id);
  const value = selectedId
    ? `<span class="picker-value"><strong>${esc(name)}</strong><small>${esc(selectedId)}${entity ? "" : " · not found in Home Assistant"}</small></span>`
    : `<span class="picker-value empty">${enabled ? "Choose an entity" : "Home Assistant not connected"}</span>`;
  return `<div class="entity-picker" data-picker="${id}">
    <button type="button" class="picker-field" id="map-${id}" aria-haspopup="listbox" aria-expanded="false" aria-controls="picker-list-${id}" ${enabled ? "" : "disabled"}>
      <span class="picker-label">Entity</span>${value}<span class="picker-chevron">${chevron}</span>
    </button>
    ${selectedId && enabled ? `<button type="button" class="picker-clear" data-clear="${id}" aria-label="Disconnect ${esc(control.label)}" title="Disconnect">${clearIcon}</button>` : ""}
    <div class="picker-pop" hidden>
      <div class="picker-search">${searchIcon}<input type="search" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="picker-list-${id}" aria-label="Search entities for ${esc(control.label)}" placeholder="Search by name or entity ID" autocomplete="off" spellcheck="false"></div>
      <ul id="picker-list-${id}" role="listbox" aria-label="Entities for ${esc(control.label)}"></ul>
    </div>
  </div>`;
}

/**
 * Wires every `.entity-picker` under `root` (delegated, so re-rendering rows is fine).
 * `context(controlId)` supplies `{control, entities, selectedId, pattern}`;
 * `onSelect(controlId, entityId)` persists the choice ("" disconnects).
 */
export function initEntityPicker({ root, context, onSelect }) {
  let active = 0;
  const openPicker = () => root.querySelector(".picker-pop:not([hidden])");
  const rows = new WeakMap();
  const optionsOf = (pop) => [...pop.querySelectorAll("[role=option]")];

  function close(pop = openPicker(), { restoreFocus = false } = {}) {
    if (!pop) return;
    pop.hidden = true;
    const picker = pop.closest(".entity-picker");
    picker
      .querySelector(".picker-field")
      .setAttribute("aria-expanded", "false");
    if (restoreFocus) picker.querySelector(".picker-field").focus();
  }
  function setActive(pop, index) {
    const options = optionsOf(pop);
    if (!options.length) return;
    active = (index + options.length) % options.length;
    options.forEach((o, i) => o.classList.toggle("active", i === active));
    pop
      .querySelector("input")
      .setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }
  function renderList(picker, query = "") {
    const controlId = picker.dataset.picker;
    const ctx = context(controlId);
    const list = picker.querySelector("ul");
    const ranked = rankEntities(ctx.entities, {
      label: ctx.control.label,
      pattern: ctx.pattern,
      query,
      selectedId: ctx.selectedId,
    });
    rows.set(list, ranked);
    const anySuggested = ranked.some((r) => r.suggested);
    let html = "";
    let heading = "";
    ranked.forEach((row, i) => {
      if (!query && !row.selected && anySuggested) {
        const next = row.suggested ? "Suggested" : "Other entities";
        if (next !== heading) {
          heading = next;
          html += `<li class="picker-group" role="presentation">${next}</li>`;
        }
      }
      const state = row.entity.state;
      html += `<li role="option" id="opt-${esc(controlId)}-${i}" data-entity="${esc(row.entity.entity_id)}" aria-selected="${row.selected}">
        <span class="opt-main"><span class="opt-name">${esc(row.name)}</span><span class="opt-id">${esc(row.entity.entity_id)}</span></span>
        <span class="opt-state" data-state="${esc(state)}">${esc(state)}</span>${row.selected ? `<span class="opt-check">${checkIcon}</span>` : ""}
      </li>`;
    });
    list.innerHTML =
      html ||
      `<li class="picker-empty" role="presentation">${query ? "No entities match your search." : "No compatible entities found in Home Assistant."}</li>`;
    const pop = picker.querySelector(".picker-pop");
    place(picker);
    setActive(
      pop,
      Math.max(
        0,
        ranked.findIndex((r) => r.selected),
      ),
    );
  }
  /** Float the list under (or above) its field; it may extend past the dialog. */
  function place(picker) {
    const pop = picker.querySelector(".picker-pop");
    if (pop.hidden) return;
    const ul = pop.querySelector("ul");
    const r = picker.querySelector(".picker-field").getBoundingClientRect();
    const gap = 6,
      margin = 12,
      chrome = pop.querySelector(".picker-search").offsetHeight + 14;
    const below = innerHeight - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    if (!pop.dataset.dir) {
      const wanted = Math.min(ul.scrollHeight + chrome, 260);
      pop.dataset.dir = below < wanted && above > below ? "up" : "down";
    }
    const up = pop.dataset.dir === "up";
    ul.style.maxHeight = `${Math.max(120, Math.min(300, (up ? above : below) - chrome))}px`;
    pop.style.left = `${r.left}px`;
    pop.style.width = `${r.width}px`;
    pop.style.top = up ? "auto" : `${r.bottom + gap}px`;
    pop.style.bottom = up ? `${innerHeight - r.top + gap}px` : "auto";
  }
  function open(picker) {
    close();
    const pop = picker.querySelector(".picker-pop");
    delete pop.dataset.dir;
    picker.querySelector(".picker-field").scrollIntoView({ block: "nearest" });
    pop.hidden = false;
    picker.querySelector(".picker-field").setAttribute("aria-expanded", "true");
    const input = pop.querySelector("input");
    input.value = "";
    renderList(picker);
    input.focus();
  }
  async function choose(picker, entityId) {
    const field = picker.querySelector(".picker-field");
    close(picker.querySelector(".picker-pop"));
    field.disabled = true;
    try {
      await onSelect(picker.dataset.picker, entityId);
    } finally {
      // The row is usually re-rendered by the caller; focus whatever replaced it.
      const fresh = root.querySelector(
        `[data-picker="${CSS.escape(picker.dataset.picker)}"] .picker-field`,
      );
      if (fresh) {
        fresh.disabled = false;
        fresh.focus();
      }
    }
  }

  root.addEventListener("click", (e) => {
    const picker = e.target.closest(".entity-picker");
    if (!picker) return;
    const clear = e.target.closest("[data-clear]");
    if (clear) return void choose(picker, "");
    const option = e.target.closest("[role=option]");
    if (option) return void choose(picker, option.dataset.entity);
    const field = e.target.closest(".picker-field");
    if (field) {
      if (picker.querySelector(".picker-pop").hidden) open(picker);
      else close(picker.querySelector(".picker-pop"));
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.matches(".picker-search input"))
      renderList(e.target.closest(".entity-picker"), e.target.value);
  });
  root.addEventListener("keydown", (e) => {
    const pop = e.target.closest(".picker-pop");
    if (!pop) {
      if (
        e.target.matches(".picker-field") &&
        ["ArrowDown", "ArrowUp"].includes(e.key)
      ) {
        e.preventDefault();
        open(e.target.closest(".entity-picker"));
      }
      return;
    }
    const picker = pop.closest(".entity-picker");
    if (e.key === "ArrowDown") setActive(pop, active + 1);
    else if (e.key === "ArrowUp") setActive(pop, active - 1);
    else if (e.key === "Home") setActive(pop, 0);
    else if (e.key === "End") setActive(pop, optionsOf(pop).length - 1);
    else if (e.key === "Enter") {
      const option = optionsOf(pop)[active];
      if (option) choose(picker, option.dataset.entity);
    } else if (e.key === "Escape") close(pop, { restoreFocus: true });
    else if (e.key === "Tab") close(pop);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  const reposition = () => {
    const pop = openPicker();
    if (pop) place(pop.closest(".entity-picker"));
  };
  window.addEventListener("resize", reposition);
  root.closest(".sheet-body")?.addEventListener("scroll", reposition);
  document.addEventListener("pointerdown", (e) => {
    const pop = openPicker();
    if (pop && !pop.closest(".entity-picker").contains(e.target)) close(pop);
  });
  return {
    /** Close an open list; true when one was open (so Esc doesn't also close the dialog). */
    closeOpen: () => {
      const pop = openPicker();
      if (!pop) return false;
      close(pop, { restoreFocus: true });
      return true;
    },
  };
}
