import { validateCameraSnapshot } from "./camera-view.mjs";

/**
 * Framings saved on this device (Adjust view → Save for this device). Each
 * one belongs to a card (its saved view or room), the view shown (whole
 * house, a floor or one room), the 3D view or the floor plan, and the screen
 * shape, so a phone, a wall tablet and an iPad turned sideways can each keep
 * their own. Kept in the browser's (or the iOS app's) local storage; nothing
 * is sent to Home Assistant. Every access tolerates blocked storage.
 */
const PREFIX = "three-d-rooms:device-camera:";

export function deviceCameraKey({ card, view, plan = false, aspect = 1 }) {
  if (!card || !view) return null;
  return `${PREFIX}${card}:${view}:${plan ? "plan" : "3d"}:${aspect < 1 ? "portrait" : "landscape"}`;
}

/** The saved framing for `key`, or undefined (missing, broken or blocked). */
export function readDeviceCamera(storage, key) {
  if (!key) return undefined;
  try {
    const raw = storage?.getItem(key);
    return raw ? validateCameraSnapshot(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

/** Save (`camera`) or forget (`undefined`); true when storage accepted it. */
export function writeDeviceCamera(storage, key, camera) {
  if (!key || !storage) return false;
  try {
    if (camera)
      storage.setItem(key, JSON.stringify(validateCameraSnapshot(camera)));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
