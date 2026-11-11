import {
  BACKDROP_CSS,
  BACKGROUND_FIELDS,
  BACKGROUND_NAMES,
  BACKGROUND_NOTES,
  BACKGROUNDS,
  DEFAULT_BACKGROUND,
  PREVIEW_TIMES,
  contentBounds,
  effectiveElevation,
  groundShadowEnabled,
  nextBackgroundState,
  paintBackdrop,
  safeImageUrl,
  thumbnailFill,
  tone,
} from "../shared/backdrop.mjs";

// A plain house for rooms that have not loaded: a block with a roof.
const SAMPLE_HOUSE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><path d="m80 26 38 20v34L80 98 42 80V46Z" fill="#cdbfae"/><path d="m80 26 38 20-38 20-38-20Z" fill="#e8dccb"/><path d="M80 66v32L42 80V46Z" fill="#a8998a"/><path d="M80 66v32l38-18V46Z" fill="#8f8172"/><path d="m80 26 38 20-38 20-38-20Z" fill="none" stroke="#7a6c5e" stroke-width="1"/><path d="M58 70v-8l12 6v8Zm36 8v-8l12-6v8Z" fill="#f7d77a"/></svg>`,
)}`;
const TILE = { width: 960, height: 600 };

/**
 * The saved view's background. A toolbar button opens a picker that shows every
 * background behind this view's own house; the choice is painted behind the
 * manager's transparent canvas while the view is edited (and is flat classic
 * otherwise), so the preview matches the dashboard card.
 */
export function initBackgroundEditor({ viewport, scene, onChange = () => {} }) {
  const $ = (id) => document.getElementById(id);
  if (!document.getElementById("backdrop-css")) {
    const style = document.createElement("style");
    style.id = "backdrop-css";
    style.textContent = BACKDROP_CSS;
    document.head.append(style);
  }
  const layer = document.createElement("div");
  layer.className = "backdrop";
  layer.setAttribute("aria-hidden", "true");
  viewport.prepend(layer);
  const dialog = $("background-dialog"),
    opener = $("background-open");
  let state = {},
    draft = {},
    active = false,
    previewTime = "",
    peek = null,
    house;

  const liveTime = () =>
    tone(effectiveElevation(scene()?.daylightMode, scene()?.sunEntity));
  function paint() {
    const config = active ? state : { background: "classic" };
    paintBackdrop(layer, config, liveTime());
    scene()?.setGroundShadow?.(active && groundShadowEnabled(config));
    if (opener) {
      const name = BACKGROUND_NAMES[config.background || DEFAULT_BACKGROUND];
      opener.title = `Card background: ${name}`;
      opener.setAttribute("aria-label", `Background: ${name}`);
    }
  }

  /** The room as a transparent picture cropped to the house, for the previews. */
  function snapshot() {
    const view = scene();
    if (!view?.model) return { src: SAMPLE_HOUSE, box: undefined };
    const shadow = !!view.options?.groundShadow;
    try {
      view.setGroundShadow(false);
      const source = view.renderer.domElement,
        width = 640,
        height = Math.max(
          1,
          Math.round((width * source.height) / source.width),
        ),
        work = document.createElement("canvas");
      work.width = width;
      work.height = height;
      const context = work.getContext("2d", { willReadFrequently: true });
      context.drawImage(source, 0, 0, width, height);
      const box = contentBounds(
        context.getImageData(0, 0, width, height).data,
        width,
        height,
      );
      if (!box) return { src: SAMPLE_HOUSE, box: undefined };
      // Fit the house inside the tile with some air around it.
      const scale = Math.min(
          (TILE.width * 0.74) / box.width,
          (TILE.height * 0.66) / box.height,
        ),
        out = document.createElement("canvas");
      out.width = TILE.width;
      out.height = TILE.height;
      const w = box.width * scale,
        h = box.height * scale,
        x = (TILE.width - w) / 2,
        y = (TILE.height - h) / 2 - TILE.height * 0.02;
      out
        .getContext("2d")
        .drawImage(work, box.left, box.top, box.width, box.height, x, y, w, h);
      return {
        src: out.toDataURL("image/png"),
        box: { x, y: y + h, w },
      };
    } catch {
      return { src: SAMPLE_HOUSE, box: undefined };
    } finally {
      view.setGroundShadow(shadow);
    }
  }

  const tileTime = () => previewTime || liveTime();
  function tileConfig(background) {
    return { background, background_image: draft.background_image };
  }
  /** One background painted behind the house: used by the stage and the strip. */
  function makeArt(id) {
    const art = document.createElement("div");
    art.className = "tile-art";
    art.dataset.background = id;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    paintBackdrop(backdrop, tileConfig(id), tileTime());
    art.append(backdrop);
    if (house?.box && $("background-shadow").checked) {
      const ground = document.createElement("div");
      ground.className = "tile-shadow";
      const { x, y, w } = house.box;
      Object.assign(ground.style, {
        left: `${((x - w * 0.12) / TILE.width) * 100}%`,
        top: `${((y - w * 0.07) / TILE.height) * 100}%`,
        width: `${((w * 1.24) / TILE.width) * 100}%`,
        height: `${((w * 0.22) / TILE.height) * 100}%`,
      });
      art.append(ground);
    }
    const image = document.createElement("img");
    image.className = "tile-house";
    image.alt = "";
    image.src = house?.src || SAMPLE_HOUSE;
    art.append(image);
    return art;
  }
  /** The big preview: the hovered background, else the selected one. */
  function renderStage() {
    const selected = draft.background || DEFAULT_BACKGROUND,
      shown = peek || selected,
      peeking = shown !== selected;
    $("background-stage-art").replaceChildren(makeArt(shown));
    $("background-caption-name").textContent = BACKGROUND_NAMES[shown];
    $("background-caption-note").textContent = BACKGROUND_NOTES[shown];
    const state = $("background-caption-state");
    state.textContent = peeking ? "Click to choose" : "Selected";
    state.dataset.state = peeking ? "peek" : "selected";
  }
  function buildTiles() {
    const wrap = $("background-tiles");
    wrap.replaceChildren();
    const selected = draft.background || DEFAULT_BACKGROUND;
    for (const id of BACKGROUNDS) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "background-tile";
      tile.dataset.background = id;
      tile.setAttribute("role", "radio");
      tile.setAttribute("aria-checked", String(id === selected));
      const name = document.createElement("strong");
      name.textContent = BACKGROUND_NAMES[id];
      tile.append(makeArt(id), name);
      tile.onclick = () => choose(id);
      // Hovering or tabbing to a background shows it large without choosing it.
      const look = () => {
        peek = id;
        renderStage();
      };
      const leave = () => {
        peek = null;
        renderStage();
      };
      tile.onmouseenter = look;
      tile.onfocus = look;
      tile.onmouseleave = leave;
      tile.onblur = leave;
      wrap.append(tile);
    }
    renderStage();
  }
  function showDraft() {
    const background = draft.background || DEFAULT_BACKGROUND;
    $("background-image-field").hidden = background !== "image";
    $("background-image").value = draft.background_image || "";
    $("background-image").setCustomValidity(
      !draft.background_image || safeImageUrl(draft.background_image)
        ? ""
        : "Use an address starting with /, http:// or https://",
    );
    $("background-shadow").checked = groundShadowEnabled({
      ...draft,
      view: "front",
    });
    renderStage();
    for (const tile of $("background-tiles").children)
      tile.setAttribute(
        "aria-checked",
        String(tile.dataset.background === background),
      );
    for (const button of dialog.querySelectorAll(".background-time button"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.time === previewTime),
      );
  }
  // Values the picker currently holds, folded back into a clean draft.
  const readDraft = (background) =>
    nextBackgroundState({
      background,
      image: $("background-image").value,
      shadow: $("background-shadow").checked,
    });
  function choose(id) {
    // Moving between presets keeps the image address the user typed.
    const image = $("background-image").value || draft.background_image;
    const wasClassic = (draft.background || DEFAULT_BACKGROUND) === "classic";
    draft = nextBackgroundState({
      background: id,
      image,
      // The shadow default flips with Classic; keep an explicit choice.
      shadow:
        (id === "classic") === wasClassic
          ? $("background-shadow").checked
          : id !== "classic",
    });
    if (id === "image" && !draft.background_image)
      delete draft.background_image;
    showDraft();
    rebuild();
    if (id === "image") $("background-image").focus();
  }
  function rebuild() {
    // Keep keyboard focus on the chosen tile when the grid repaints.
    const focused = document.activeElement?.dataset?.background;
    buildTiles();
    showDraft();
    if (focused)
      $("background-tiles")
        .querySelector(`[data-background="${focused}"]`)
        ?.focus();
  }

  const times = dialog.querySelector(".background-time");
  times.replaceChildren(
    ...PREVIEW_TIMES.map(([time, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.time = time;
      button.textContent = label;
      button.onclick = () => {
        previewTime = time;
        rebuild();
      };
      return button;
    }),
  );
  $("background-image").addEventListener("input", () => {
    draft = readDraft(draft.background || DEFAULT_BACKGROUND);
    showDraft();
    rebuild();
    $("background-image").focus();
  });
  $("background-shadow").addEventListener("change", () => {
    draft = readDraft(draft.background || DEFAULT_BACKGROUND);
    rebuild();
  });
  for (const button of dialog.querySelectorAll(".close"))
    button.onclick = () => dialog.close();
  $("background-apply").onclick = () => {
    const field = $("background-image");
    if (draft.background === "image" && !draft.background_image) {
      field.setCustomValidity(
        "Add an image address, or choose another background.",
      );
      field.reportValidity();
      field.setCustomValidity("");
      return;
    }
    if (!field.validity.valid) {
      field.reportValidity();
      return;
    }
    state = { ...draft };
    paint();
    dialog.close();
    onChange();
  };
  opener.onclick = () => {
    draft = { ...state };
    previewTime = "";
    peek = null;
    house = snapshot();
    showDraft();
    buildTiles();
    showDraft();
    dialog.showModal();
  };
  window.addEventListener("rooms-daylight", () => active && paint());
  paint();
  return {
    open(component) {
      state = Object.fromEntries(
        BACKGROUND_FIELDS.filter((key) => component?.[key] !== undefined).map(
          (key) => [key, component[key]],
        ),
      );
      active = true;
      opener.hidden = false;
      paint();
    },
    close() {
      active = false;
      opener.hidden = true;
      if (dialog.open) dialog.close();
      paint();
    },
    /** Only the choices that differ from the defaults. */
    read: () => ({ ...state }),
    thumbnailFill: () =>
      active
        ? thumbnailFill(state.background || DEFAULT_BACKGROUND, liveTime())
        : undefined,
  };
}
