import {
  sidebarRooms,
  sidebarLabel,
  roomName,
  houseId,
  setupChecklist,
} from "../shared/workspace.mjs";
import { deviceEntries } from "../shared/device.mjs";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const $ = (id) => document.getElementById(id);
export function initWorkspace({
  getModels,
  getSelected,
  getFloors,
  choose,
  tab,
  api,
  reload,
  scene,
  toast,
  getViews = () => [],
  onChecklist = () => {},
}) {
  let query = "",
    focusedRoom = null,
    floorBaseline = "";
  let floorFilter = "all",
    browsingScope = null;
  const homeIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></svg>';
  const roomIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 21V4l12-2v19M2 21h20M16 5h4v16"/><circle cx="12" cy="12" r=".7"/></svg>';
  function drawLibrary() {
    const models = getModels(),
      selected = getSelected();
    const houses = models.filter((m) => m.houseView && !m.houseFloor);
    const scopes = [
      ...houses.map((m) => ({ id: m.houseId, name: m.title, model: m.id })),
      ...(models.some((m) => !m.houseView && !houseId(m))
        ? [{ id: "other", name: houses.length ? "Other rooms" : "Your rooms" }]
        : []),
    ];
    const scope = houseId(selected) || "other";
    if (browsingScope !== scope) {
      browsingScope = scope;
      floorFilter = selected?.houseFloor?.id || "all";
    }
    const current = scopes.find((s) => s.id === scope) || scopes[0];
    const all = sidebarRooms(models, current?.id);
    const rooms = sidebarRooms(models, current?.id, floorFilter, query);
    const floors = all[0]?.housePlacement?.floors || [];
    if (
      floorFilter !== "all" &&
      floorFilter !== "unassigned" &&
      !floors.some((f) => f.id === floorFilter)
    )
      floorFilter = "all";
    const overview = houses.find((model) => model.houseId === current?.id);
    const scopeHeading =
      scopes.length > 1
        ? `<label class="sr-only" for="library-house">House</label><select id="library-house">${scopes.map((s) => `<option value="${esc(s.id)}" ${s.id === current?.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`
        : `<div class="sidebar-house-name">${homeIcon}<span>${esc(current?.name || "Your home")}</span></div>`;
    $("models").innerHTML =
      `${scopeHeading}${overview ? `<button class="sidebar-overview ${selected?.id === overview.id ? "active" : ""}" data-model="${esc(overview.id)}" ${selected?.id === overview.id ? 'aria-current="page"' : ""}>${homeIcon}<span>Overview</span></button>` : ""}<div class="sidebar-room-heading"><h3>Rooms</h3><span>${rooms.length === all.length ? all.length : `${rooms.length} / ${all.length}`}</span></div>${floors.length ? `<label class="sr-only" for="library-floor">Filter rooms by floor</label><select id="library-floor"><option value="all">All floors</option>${floors.map((f) => `<option value="${esc(f.id)}" ${floorFilter === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}${all.some((m) => !m.housePlacement?.floorIds.length) ? `<option value="unassigned" ${floorFilter === "unassigned" ? "selected" : ""}>No floor assigned</option>` : ""}</select>` : ""}<div class="sidebar-rooms">${rooms
        .map((room) => {
          const count = deviceEntries(room).length;
          const levels = room.housePlacement?.floors
            .filter((f) => room.housePlacement.floorIds.includes(f.id))
            .map((f) => f.name)
            .join(" / ");
          return `<button class="nav-room ${selected?.id === room.id ? "active" : ""}" data-model="${esc(room.id)}" ${selected?.id === room.id ? 'aria-current="page"' : ""} title="${esc(room.title)}">${roomIcon}<span class="sidebar-room-copy"><span>${esc(sidebarLabel(room, all))}</span><small>${esc(levels || "No floor")} · ${count} ${count === 1 ? "device" : "devices"}</small></span></button>`;
        })
        .join(
          "",
        )}${!rooms.length ? '<p class="nav-empty">No rooms match this filter.</p>' : ""}</div>`;
    $("model-count").textContent = models.filter((m) => !m.houseView).length;
    $("library-search").hidden = all.length < 6 && !query;
    document.querySelector('label[for="library-search"]').hidden =
      $("library-search").hidden;
    $("library-result").textContent = query
      ? `${rooms.length} matching rooms`
      : "";
    document.querySelector(".aside-bottom").hidden = !!models.length;
    drawContext();
  }
  $("models").addEventListener("change", (event) => {
    if (event.target.id === "library-floor") {
      floorFilter = event.target.value;
      drawLibrary();
      $("library-floor")?.focus();
    }
    if (event.target.id === "library-house") {
      const id = event.target.value;
      const next =
        getModels().find(
          (m) => m.houseView && !m.houseFloor && m.houseId === id,
        ) || getModels().find((m) => !m.houseView && !houseId(m));
      if (next) {
        query = "";
        $("library-search").value = "";
        void choose(next.id, "overview");
      }
    }
  });
  $("library-search").oninput = (event) => {
    query = event.target.value;
    drawLibrary();
  };
  $("models").addEventListener("click", (event) => {
    const button = event.target.closest("[data-library-views]");
    if (button) void choose(button.dataset.libraryViews, "views");
  });
  $("library-toggle").onclick = () => {
    const opened = document.body.classList.toggle("library-open");
    $("library-toggle").setAttribute("aria-expanded", String(opened));
    if (opened) {
      const first = $("library-search").hidden
        ? $("models").querySelector("select,button")
        : $("library-search");
      first?.focus();
    }
  };
  function closeLibrary() {
    document.body.classList.remove("library-open");
    $("library-toggle").setAttribute("aria-expanded", "false");
  }
  $("library-close").onclick = () => {
    closeLibrary();
    $("library-toggle").focus();
  };
  $("library-scrim").onclick = () => {
    closeLibrary();
    $("library-toggle").focus();
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains("library-open")
    ) {
      closeLibrary();
      $("library-toggle").focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      !document.body.classList.contains("library-open")
    )
      return;
    const controls = [
      ...$("space-library").querySelectorAll("button,input,select,summary"),
    ].filter((el) => el.getClientRects().length && !el.disabled);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  function drawContext() {
    const model = getSelected();
    if (!model) {
      $("space-inspector").hidden = true;
      $("house-settings-section").hidden = true;
      $("space-breadcrumb").replaceChildren();
      return;
    }
    $("space-inspector").hidden = false;
    document.body.dataset.space = model.houseView ? "house" : "room";
    const house = getModels().find(
      (m) => m.houseView && !m.houseFloor && m.houseId === houseId(model),
    );
    $("space-breadcrumb").innerHTML =
      house && house.id !== model.id
        ? `<button data-model="${esc(house.id)}">${esc(house.title)}</button><span aria-hidden="true">/</span><span>${esc(roomName(model))}</span>`
        : `<span>${model.houseView ? "Your home" : "Other rooms"}</span>`;
    const options = house
      ? getModels().filter((m) => m.houseView && m.houseId === house.houseId)
      : [];
    $("space-floor").hidden = !house;
    $("space-floor").replaceChildren(
      ...options.map(
        (m) => new Option(m.houseFloor?.name || "Whole house", m.id),
      ),
    );
    $("space-floor").value = model.houseView ? model.id : house?.id;
    if (focusedRoom && !model.members?.some((m) => m.model === focusedRoom))
      focusedRoom = null;
    const rooms = model.houseView
      ? model.members
          .map((member) => getModels().find((m) => m.id === member.model))
          .filter(Boolean)
      : [model];
    const heading = model.houseView
      ? "Rooms in this space"
      : "Room at a glance";
    $("space-inspector").innerHTML =
      `${checklistHTML(model, rooms)}<div class="inspector-heading"><span class="eyebrow">${model.houseView ? "EXPLORE" : "OVERVIEW"}</span><h2>${heading}</h2></div><p class="muted small">${model.houseView ? "Select a room here or in the 3D model." : "Connect devices and adjust room settings."}</p><div class="space-room-list">${rooms
        .map(
          (room) =>
            `<article class="space-room ${focusedRoom === room.id ? "is-selected" : ""}"><button class="room-select" data-focus-room="${esc(room.id)}" ${model.houseView ? `aria-pressed="${focusedRoom === room.id}"` : ""}><span>${esc(roomName(room))}</span><small>${deviceEntries(room).length} devices · ${esc(
              room.housePlacement?.floorIds
                .map(
                  (id) =>
                    room.housePlacement.floors.find((f) => f.id === id)?.name,
                )
                .filter(Boolean)
                .join(" / ") || "Floor not assigned",
            )}</small></button><div class="room-quick-actions">${model.houseView ? `<button data-open-room="${esc(room.id)}">Open room</button>` : ""}<button data-room-devices="${esc(room.id)}">Devices</button></div></article>`,
        )
        .join(
          "",
        )}</div>${!model.houseView ? `<button data-open-settings>Room settings</button><details class="model-identity"><summary>Model details</summary><p>${esc(model.title)}</p><code>${esc(model.id)}</code></details>` : `<button data-open-settings>Set up house floors</button>`}`;
    $("house-settings-section").hidden =
      !model.houseView || document.body.dataset.roomTab !== "settings";
  }
  /**
   * Getting started: three steps until they are done or hidden. The house
   * shows its whole progress; each room its own.
   */
  const hiddenKey = (model) => `three-d-rooms:setup-hidden:${model.id}`;
  function checklistHidden(model) {
    try {
      return localStorage.getItem(hiddenKey(model)) === "1";
    } catch {
      return false;
    }
  }
  function checklistHTML(model, rooms) {
    if (!rooms.length || checklistHidden(model)) return "";
    const house = model.houseView
      ? getModels().filter((m) => m.houseView && m.houseId === model.houseId)
      : [];
    const { steps, done } = setupChecklist({
      rooms,
      views: getViews(),
      spaceIds: [
        model.id,
        ...house.map((m) => m.id),
        ...rooms.map((r) => r.id),
      ],
    });
    if (done === steps.length) return "";
    const check =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    const action = {
      connect: "Connect",
      icons: "Place icons",
      view: "Create view",
    };
    return `<section class="setup-checklist" aria-labelledby="setup-title"><div class="setup-head"><div><span class="eyebrow">GET STARTED</span><h2 id="setup-title">${done} of ${steps.length} done</h2></div><button type="button" class="setup-hide" data-setup-hide aria-label="Hide getting started">Hide</button></div><div class="setup-meter" role="progressbar" aria-label="Setup progress" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${done}"><span style="width:${(done / steps.length) * 100}%"></span></div><ol>${steps
      .map(
        (step, index) =>
          `<li data-done="${step.done}">${step.done ? `<div class="setup-step"><span class="setup-mark" aria-hidden="true">${check}</span><span class="setup-text"><strong>${esc(step.title)}</strong><small>${esc(step.detail)}</small></span><span class="sr-only">Done</span></div>` : `<button type="button" class="setup-step" data-setup="${step.id}" ${step.room ? `data-setup-room="${esc(step.room)}"` : ""} aria-label="${esc(step.title)}: ${esc(step.detail)}. ${action[step.id]}"><span class="setup-mark" aria-hidden="true">${index + 1}</span><span class="setup-text"><strong>${esc(step.title)}</strong><small>${esc(step.detail)}</small></span><svg class="setup-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`}</li>`,
      )
      .join("")}</ol></section>`;
  }
  /** Update only the checklist (after a connection or icon change). */
  function refreshChecklist() {
    const model = getSelected();
    const inspector = $("space-inspector");
    if (!model || !inspector || inspector.hidden) return;
    const rooms = model.houseView
      ? model.members
          .map((member) => getModels().find((m) => m.id === member.model))
          .filter(Boolean)
      : [model];
    const html = checklistHTML(model, rooms);
    const current = inspector.querySelector(".setup-checklist");
    if ((current?.outerHTML || "") === html) return;
    if (current && !html) current.remove();
    else if (current) current.outerHTML = html;
    else if (html) inspector.insertAdjacentHTML("afterbegin", html);
  }
  function focusRoom(id) {
    if (!getSelected()?.houseView) return;
    focusedRoom = id;
    scene()?.highlightRoom(id);
    drawContext();
    $("space-inspector")
      .querySelector(`[data-focus-room="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true });
  }
  $("space-inspector").onclick = (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-setup-hide")) {
      try {
        localStorage.setItem(hiddenKey(getSelected()), "1");
      } catch {}
      drawContext();
      toast(
        "Getting started hidden. Everything stays in the Devices tab and Dashboard views.",
      );
      return;
    }
    if (target.dataset.setup) {
      onChecklist(target.dataset.setup, target.dataset.setupRoom);
      return;
    }
    if (target.dataset.focusRoom) {
      if (getSelected().houseView) focusRoom(target.dataset.focusRoom);
      else tab("devices");
    }
    if (target.dataset.openRoom)
      void choose(target.dataset.openRoom, "overview");
    if (target.dataset.roomDevices)
      void choose(target.dataset.roomDevices, "devices");
    if (target.hasAttribute("data-open-settings")) tab("settings");
  };
  $("space-breadcrumb").onclick = (event) => {
    const target = event.target.closest("[data-model]");
    if (target) void choose(target.dataset.model, "overview");
  };
  $("space-floor").onchange = () =>
    void choose($("space-floor").value, "overview");
  function dirty() {
    return (
      !!getSelected()?.houseView &&
      document.body.dataset.roomTab === "settings" &&
      floorBaseline !==
        JSON.stringify(
          [...$("house-floor-form").querySelectorAll("select")].map(
            (s) => s.value,
          ),
        )
    );
  }
  function drawFloors() {
    const model = getSelected();
    if (!model?.houseView) return;
    const source = getModels().find(
      (m) => !m.houseView && houseId(m) === model.houseId,
    );
    const floors = source?.housePlacement?.floors || [];
    $("house-floor-form").innerHTML =
      `<p class="muted">Match the exported levels to Home Assistant floors once for this house. Rooms keep their saved positions and floor memberships.</p>${floors
        .map(
          (floor) =>
            `<label class="floor-match"><span><strong>${esc(floor.name)}</strong><small>${floor.minY}–${floor.maxY} m · ${
              getModels()
                .filter(
                  (m) =>
                    !m.houseView &&
                    houseId(m) === model.houseId &&
                    m.housePlacement.floorIds.includes(floor.id),
                )
                .map(roomName)
                .map(esc)
                .join(", ") || "No rooms assigned"
            }</small></span><select data-house-floor="${esc(floor.id)}" aria-label="Home Assistant floor for ${esc(floor.name)}"><option value="">Not linked</option>${getFloors()
              .map(
                (f) =>
                  `<option value="${esc(f.floor_id)}" ${f.floor_id === floor.haFloorId ? "selected" : ""}>${esc(f.name)}</option>`,
              )
              .join("")}</select></label>`,
        )
        .join(
          "",
        )}${!floors.length ? "<p>Add floor heights in the house editor, then import rooms with floor assignments.</p>" : '<button class="primary" type="submit">Save house floors</button>'}<p id="house-floor-error" role="alert" class="error"></p>`;
    floorBaseline = JSON.stringify(
      [...$("house-floor-form").querySelectorAll("select")].map((s) => s.value),
    );
  }
  $("house-floor-form").onsubmit = async (event) => {
    event.preventDefault();
    const model = getSelected();
    const source = getModels().find(
      (m) => !m.houseView && houseId(m) === model.houseId,
    );
    const button = event.submitter;
    button.disabled = true;
    try {
      await api(`models/${source.id}/room`, {
        method: "PUT",
        body: JSON.stringify({
          floorLinks: Object.fromEntries(
            [...$("house-floor-form").querySelectorAll("select")].map((s) => [
              s.dataset.houseFloor,
              s.value,
            ]),
          ),
        }),
      });
      await reload(model.id);
      drawFloors();
      toast("House floors saved for every room.");
    } catch (error) {
      $("house-floor-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  return {
    dirty,
    draw: drawLibrary,
    context: drawContext,
    checklist: refreshChecklist,
    drawFloors,
    focusRoom,
    closeLibrary,
  };
}
