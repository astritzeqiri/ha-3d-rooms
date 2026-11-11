// Tooltips for the buttons over a 3D view. The browser's own `title` tooltip
// waits about a second and cannot be styled, so while the pointer is over a
// button (or it has keyboard focus) its `title` is shown at once in a small
// bubble next to it, then put back. The bubble stays inside `container`.

const SELECTOR = "button[title], [role='button'][title], .has-tip[title]";

/**
 * Show tooltips for buttons inside `root`, in a bubble placed in `container`
 * (which must be positioned). Returns a function that removes it all.
 */
export function enableTooltips(root, container, selector = SELECTOR) {
  const tip = document.createElement("div");
  tip.className = "rooms-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  container.append(tip);
  let current = null;
  const place = (element) => {
    const area = container.getBoundingClientRect(),
      at = element.getBoundingClientRect();
    tip.style.left = "0px";
    tip.style.top = "0px";
    const width = tip.offsetWidth,
      height = tip.offsetHeight;
    const x = at.left + at.width / 2 - area.left - width / 2,
      above = at.top - area.top - height - 8;
    tip.style.left = Math.max(6, Math.min(area.width - width - 6, x)) + "px";
    // Above the button, or below it when there is no room above.
    tip.style.top =
      Math.max(6, above < 6 ? at.bottom - area.top + 8 : above) + "px";
  };
  const hide = () => {
    if (current) {
      const text = current.dataset.tipTitle;
      if (text !== undefined && !current.hasAttribute("title"))
        current.setAttribute("title", text);
      delete current.dataset.tipTitle;
      current = null;
    }
    tip.hidden = true;
  };
  const show = (element) => {
    const text = element.getAttribute("title");
    if (!text) return;
    hide();
    current = element;
    // The native tooltip would double this one; it comes back on hide.
    element.dataset.tipTitle = text;
    element.removeAttribute("title");
    tip.textContent = text;
    tip.hidden = false;
    place(element);
  };
  const over = (event) => {
    if (event.pointerType === "touch") return;
    const element = event.target.closest?.(selector);
    if (!element) hide();
    else if (element !== current) show(element);
  };
  const out = (event) => {
    if (current && !current.contains(event.relatedTarget)) hide();
  };
  const focus = (event) => {
    const element = event.target.closest?.(selector);
    if (element?.matches?.(":focus-visible")) show(element);
  };
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerout", out);
  root.addEventListener("focusin", focus);
  root.addEventListener("focusout", hide);
  root.addEventListener("pointerdown", hide, true);
  return () => {
    hide();
    root.removeEventListener("pointerover", over);
    root.removeEventListener("pointerout", out);
    root.removeEventListener("focusin", focus);
    root.removeEventListener("focusout", hide);
    root.removeEventListener("pointerdown", hide, true);
    tip.remove();
  };
}
