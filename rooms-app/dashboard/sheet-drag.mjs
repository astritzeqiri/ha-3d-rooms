/**
 * Phone bottom sheets (3D Rooms' dialogs at ≤600 px): drag down to dismiss,
 * like Home Assistant's own. Shared by every sheet-style dialog.
 */
export const SHEET_DRAG_CSS =
  ".sheet-grab{display:none}" +
  "@media (max-width:600px){.sheet-grab{display:block;flex-shrink:0;width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:currentColor;opacity:.3}}" +
  "dialog.sheet-dragging{transition:none!important}" +
  "dialog.sheet-settling{transition:transform .22s cubic-bezier(.2,.8,.2,1)}";

// Controls that use a vertical drag themselves keep it.
const OWN_DRAG = "input, select, textarea, [role=slider]";

/** A grab handle for the top of a sheet (shown only at phone width). */
export function sheetGrab(doc) {
  const grab = doc.createElement("div");
  grab.className = "sheet-grab";
  grab.setAttribute("aria-hidden", "true");
  return grab;
}

/**
 * Follow a downward drag from the handle or header (`top` selector), or from
 * content that is scrolled to its top; a long or quick pull closes.
 */
export function enableSheetDrag(
  dialog,
  { close = () => dialog.close(), top = ".sheet-grab", ownDrag = "" } = {},
) {
  const win = dialog.ownerDocument.defaultView;
  const isSheet = () => win?.matchMedia?.("(max-width:600px)").matches;
  const keep = ownDrag ? `${OWN_DRAG}, ${ownDrag}` : OWN_DRAG;
  // True when something between the touch and the dialog is scrolled down.
  const scrolled = (target) => {
    for (let el = target; el && el !== dialog; el = el.parentElement)
      if (el.scrollTop > 0) return true;
    return false;
  };
  let drag = null;
  const place = (dy) =>
    dialog.style.setProperty("transform", dy ? `translateY(${dy}px)` : "");
  dialog.addEventListener(
    "touchstart",
    (event) => {
      if (!isSheet() || event.touches.length !== 1) return (drag = null);
      // A sheet opened inside this one handles its own drag.
      const inner = event.target.closest?.("dialog");
      if (inner && inner !== dialog) return (drag = null);
      if (event.target.closest?.(keep)) return (drag = null);
      drag = {
        y: event.touches[0].clientY,
        t: performance.now(),
        dy: 0,
        active: false,
        fromTop: !!event.target.closest?.(top),
        scrolled: scrolled(event.target),
      };
    },
    { passive: true },
  );
  dialog.addEventListener(
    "touchmove",
    (event) => {
      if (!drag) return;
      const dy = event.touches[0].clientY - drag.y;
      if (!drag.active) {
        if (dy < -6) return (drag = null); // scrolling up the content
        if (dy < 8 || !(drag.fromTop || !drag.scrolled)) return;
        drag.active = true;
        drag.y += dy; // follow from here, no jump
        drag.t = performance.now();
        dialog.classList.add("sheet-dragging");
        return;
      }
      event.preventDefault();
      drag.dy = Math.max(0, dy);
      place(drag.dy);
    },
    { passive: false },
  );
  const release = () => {
    const done = drag;
    drag = null;
    if (!done?.active) return;
    dialog.classList.remove("sheet-dragging");
    const speed = done.dy / Math.max(1, performance.now() - done.t);
    const reduced = win?.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (done.dy > Math.min(140, dialog.offsetHeight * 0.25) || speed > 0.8) {
      if (reduced) return close();
      dialog.classList.add("sheet-settling");
      place(dialog.offsetHeight);
      setTimeout(close, 220);
      return;
    }
    dialog.classList.add("sheet-settling");
    place(0);
    setTimeout(() => dialog.classList.remove("sheet-settling"), 240);
  };
  dialog.addEventListener("touchend", release);
  dialog.addEventListener("touchcancel", release);
}

/** Open without a focus ring on the first button (a touch is not a Tab). */
export function focusSheet(dialog) {
  dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}
