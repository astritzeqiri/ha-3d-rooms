// How a light's Home Assistant effect looks in the 3D room.
//
// Zigbee "identify" effects (blink, breathe, okay, channel_change) are
// one-shot: Home Assistant never reports when they end, so each plays for the
// duration the Zigbee specification gives it. Other effects (colour loop,
// candle, pulse, strobe) last while the light reports them. Unknown effects
// are not animated.
const ONE_SHOT = {
  // One flash; shown twice so it is not missed.
  blink: 1.2,
  // On/off over one second, fifteen times.
  breathe: 15,
  // Two green flashes.
  okay: 1.2,
  // Orange for eight seconds.
  channel_change: 8,
};
const NAMES = {
  blink: "blink",
  flash: "blink",
  breathe: "breathe",
  okay: "okay",
  channel_change: "channel_change",
  finish_effect: "stop",
  stop_effect: "stop",
  stop: "stop",
  colorloop: "colorloop",
  color_loop: "colorloop",
  colourloop: "colorloop",
  colour_loop: "colorloop",
  rainbow: "colorloop",
  candle: "flicker",
  candlelight: "flicker",
  fire: "flicker",
  fireplace: "flicker",
  flicker: "flicker",
  pulse: "pulse",
  breathing: "pulse",
  breath: "pulse",
  strobe: "strobe",
};

/**
 * The animation for an effect name: `{ kind, oneShot, duration }`, `{ kind:
 * "stop" }` for the effects that end another one, or null when the effect has
 * no animation.
 */
export function lightEffect(name) {
  if (typeof name !== "string") return null;
  const key = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
    kind = Object.hasOwn(NAMES, key) ? NAMES[key] : undefined;
  if (!kind) return null;
  if (kind === "stop") return { kind };
  return Object.hasOwn(ONE_SHOT, kind)
    ? { kind, oneShot: true, duration: ONE_SHOT[kind] }
    : { kind, oneShot: false };
}

const wave = (t, period) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
/** Hue (0–1) to linear-ish RGB 0–1, full saturation. */
const hue = (h) =>
  [0, 1 / 3, 2 / 3].map((offset) => {
    const x = Math.abs((((h - offset) % 1) + 1) % 1) * 6;
    return Math.max(0, Math.min(1, Math.abs(x - 3) - 1));
  });

/**
 * The light at `t` seconds into an effect: `gain` multiplies its brightness
 * and `tint` (RGB 0–1), when present, replaces its colour. Returns null once a
 * one-shot effect has finished.
 */
export function effectSample(effect, t) {
  if (!effect || effect.kind === "stop" || !(t >= 0)) return null;
  if (effect.oneShot && t >= effect.duration) return null;
  switch (effect.kind) {
    case "blink":
      return { gain: t % 0.6 < 0.3 ? 0.05 : 1 };
    case "breathe":
      return { gain: 0.05 + 0.95 * wave(t + 0.5, 1) };
    case "okay":
      return { gain: t % 0.6 < 0.4 ? 1 : 0.1, tint: [0.15, 1, 0.25] };
    case "channel_change":
      // Bright for half a second, then dimmed until it ends.
      return { gain: t < 0.5 ? 1 : 0.35, tint: [1, 0.5, 0.05] };
    case "colorloop":
      return { gain: 1, tint: hue(t / 12) };
    case "flicker":
      return {
        gain:
          0.72 +
          0.14 * Math.sin(t * 9.1) +
          0.09 * Math.sin(t * 23.7 + 1.3) +
          0.05 * Math.sin(t * 41.3 + 0.4),
      };
    case "pulse":
      return { gain: 0.25 + 0.75 * wave(t, 3) };
    case "strobe":
      // Capped at 2 flashes a second, well below photosensitivity limits.
      return { gain: t % 0.5 < 0.25 ? 1 : 0.1 };
    default:
      return null;
  }
}

/**
 * Tracks one light's effect over time. `report(name, on, now)` follows the
 * effect Home Assistant reports; `trigger(name, now)` starts one explicitly
 * (a service call seen on the event bus). `sample(now)` gives the current
 * frame, or null when nothing is animating.
 */
export function createEffectRun() {
  let reported, // last reported effect name; undefined until the first report
    active = null,
    start = 0,
    on = false;
  const begin = (name, now) => {
    const effect = lightEffect(name);
    active = effect && effect.kind !== "stop" ? effect : null;
    start = now;
  };
  return {
    report(name, isOn, now) {
      const next = typeof name === "string" ? name : "";
      on = !!isOn;
      if (next === reported) return;
      const first = reported === undefined;
      reported = next;
      const effect = lightEffect(next);
      // A one-shot name already present at load finished long ago.
      if (first && effect?.oneShot) return;
      begin(next, now);
    },
    trigger(name, now) {
      begin(name, now);
    },
    sample(now) {
      if (!active) return null;
      // Lasting effects need the light on; a one-shot also flashes a light
      // that is off, as the real bulb does.
      if (!active.oneShot && !on) return null;
      const frame = effectSample(active, now - start);
      if (!frame) active = null;
      return frame;
    },
    get animating() {
      return !!active && (active.oneShot || on);
    },
  };
}
