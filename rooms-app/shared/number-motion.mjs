// The authored rest geometry is immutable. Values are expressed in the control's unit.
export function setNumberValue(root, value) {
  const config = root.userData.numberMotion;
  if (!config || !Number.isFinite(value)) return;
  const bounded = Math.max(config.min, Math.min(config.max, value));
  const delta = (bounded - config.restValue) * config.metersPerUnit;
  root.traverse((part) => {
    const motion = part.userData.numberMotionPart;
    if (motion) part.position.y = motion.baseY + delta * motion.factor;
  });
}
