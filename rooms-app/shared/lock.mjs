/** Door locks: Home Assistant `lock.*` state, commands and thumb-turn motion. */
const LABELS = {
  locked: "Locked",
  unlocked: "Unlocked",
  locking: "Locking",
  unlocking: "Unlocking",
  jammed: "Jammed",
  open: "Open",
  opening: "Opening",
};
export function lockState(entity) {
  const state = entity?.state;
  const unavailable =
    !entity || !/^lock\./.test(entity.entity_id || "") || !(state in LABELS);
  return {
    state: unavailable ? undefined : state,
    // Show the bolt thrown while locked or locking; otherwise retracted.
    locked: unavailable ? undefined : state === "locked" || state === "locking",
    moving: state === "locking" || state === "unlocking" || state === "opening",
    jammed: state === "jammed",
    needsCode: !!entity?.attributes?.code_format,
    label: unavailable ? "Unavailable" : LABELS[state],
    unavailable,
  };
}
export function lockCommand(entity, control, action) {
  if (
    !["lock", "unlock"].includes(action) ||
    !control.capabilities.includes("lock_unlock") ||
    lockState(entity).unavailable
  )
    throw new Error("Choose an available lock and lock or unlock it.");
  if (lockState(entity).needsCode)
    throw new Error(
      "This lock needs a code; use the Home Assistant lock dialog.",
    );
  return {
    domain: "lock",
    service: action,
    target: { entity_id: entity.entity_id },
    service_data: {},
  };
}
/**
 * Rotate every `lockTurn` part below `root` (GLB extras) between its exported
 * unlocked rest pose and `lockedAngle` about its local `axis`.
 */
export function setLockTurn(root, locked) {
  root?.traverse?.((node) => {
    const turn = node.userData?.lockTurn;
    if (!turn) return;
    node.userData.lockRest ||= node.quaternion.clone();
    const [x, y, z] = turn.axis,
      half = (locked ? turn.lockedAngle : 0) / 2,
      sin = Math.sin(half);
    const rest = node.userData.lockRest;
    node.quaternion.copy(rest);
    node.quaternion.multiply(
      new rest.constructor(x * sin, y * sin, z * sin, Math.cos(half)),
    );
    node.updateMatrix?.();
  });
}
