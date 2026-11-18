/** How long a press must last to open an icon's details instead of switching it. */
export const HOLD_MS = 500;
// A tap is shorter than this, so taps never flash the ring.
const RING_DELAY_MS = 150;
const TIP_KEY = "three-d-rooms:hold-tip";
const TIP_TIMES = 3;

/**
 * Show (`on`) or clear the ring that fills round an icon while it is held,
 * so a resting finger sees that something is coming.
 */
export function holdRing(button, on, timers = globalThis) {
  timers.clearTimeout(button._holdRing);
  button._holdRing = undefined;
  delete button.dataset.holding;
  if (!on) return;
  button.style.setProperty("--hold-ms", `${HOLD_MS - RING_DELAY_MS}ms`);
  button._holdRing = timers.setTimeout(() => {
    button.dataset.holding = "true";
  }, RING_DELAY_MS);
}

/**
 * True for the first few icon taps in this browser: the undo message then
 * also says that holding an icon opens its details. Never throws.
 */
export function takeHoldTip(storage) {
  try {
    const shown = Number(storage?.getItem(TIP_KEY)) || 0;
    if (shown >= TIP_TIMES) return false;
    storage.setItem(TIP_KEY, String(shown + 1));
    return true;
  } catch {
    return false;
  }
}
