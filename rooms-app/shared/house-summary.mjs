import { deviceLabel } from "./workspace.mjs";

const OPENING_CLASSES = new Set([
  "door",
  "window",
  "garage",
  "gate",
  "opening",
]);
const OPEN_STATES = new Set(["open", "opening", "on"]);
const LOCK_WARN = new Set([
  "unlocked",
  "open",
  "opening",
  "jammed",
  "unlocking",
]);
const VACUUM_BUSY = {
  cleaning: "cleaning",
  returning: "going home",
  error: "needs help",
};
const CLIMATE_WORDS = {
  cool: "Cooling",
  heat: "Heating",
  dry: "Drying",
  fan_only: "Fan on",
  heat_cool: "Climate on",
  auto: "Climate on",
};

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A device's own name without its room ("Hallway · Front door" → "Front door").
const short = (c, fallback) => deviceLabel(c, fallback).split(" · ").pop();

/**
 * The few facts a glance at the house should answer: which lights are on,
 * which doors and windows are open, whether it is locked, and anything busy
 * (a robot cleaning, the AC running). One chip each, in that order, for the
 * controls shown in the current view (house, floor or room). Lights, doors
 * and locks always show once the view has any; the robot and the AC only
 * while they are doing something.
 *
 * Chip: `{ kind, text, tone, ids }`; `ids` are the controls it is about.
 */
export function houseSummary(model, states = {}) {
  const chips = [];
  const shown = (model?.controls || []).filter(
    (c) => !c.hidden && c.lightGroupPrimary !== false,
  );
  const entity = (c) => states[model.bindings?.[c.id]];
  const usable = (c) =>
    entity(c) && !["unavailable", "unknown"].includes(entity(c).state);

  const lights = shown.filter((c) => c.type === "light" && usable(c)),
    lightsOn = lights.filter((c) => entity(c).state === "on");
  if (lights.length)
    chips.push({
      kind: "light",
      text: lightsOn.length
        ? count(lightsOn.length, "light on", "lights on")
        : "Lights off",
      tone: lightsOn.length ? "light" : "",
      ids: lightsOn.map((c) => c.id),
    });

  const openings = shown.filter((c) => {
      if (c.type !== "cover" || !usable(c)) return false;
      const e = entity(c);
      return (
        model.bindings[c.id].startsWith("binary_sensor.") ||
        OPENING_CLASSES.has(e.attributes?.device_class)
      );
    }),
    open = openings.filter((c) => OPEN_STATES.has(entity(c).state));
  if (openings.length)
    chips.push({
      kind: "opening",
      text:
        open.length === 1
          ? `${short(open[0], "Door")} open`
          : open.length
            ? count(open.length, "door or window open", "doors & windows open")
            : "Doors & windows closed",
      tone: open.length ? "open" : "",
      ids: open.map((c) => c.id),
    });

  const locks = shown.filter((c) => c.type === "lock" && usable(c)),
    loose = locks.filter((c) => LOCK_WARN.has(entity(c).state));
  if (locks.length)
    chips.push({
      kind: "lock",
      text: loose.length
        ? loose.length === 1
          ? `${short(loose[0], "Lock")} ${entity(loose[0]).state === "jammed" ? "jammed" : "unlocked"}`
          : count(loose.length, "lock open", "locks open")
        : "Locked",
      tone: loose.length ? "unlocked" : "locked",
      ids: (loose.length ? loose : locks).map((c) => c.id),
    });

  for (const c of shown.filter((c) => c.type === "vacuum" && usable(c))) {
    const busy = VACUUM_BUSY[entity(c).state];
    if (busy)
      chips.push({
        kind: "vacuum",
        text: `Vacuum ${busy}`,
        tone: entity(c).state === "error" ? "unlocked" : "cleaning",
        ids: [c.id],
      });
  }
  // Heating and cooling: one chip, "Cooling" or "2 climate devices on".
  const climate = shown.filter(
    (c) => c.type === "climate" && usable(c) && CLIMATE_WORDS[entity(c).state],
  );
  if (climate.length)
    chips.push({
      kind: "climate",
      text:
        climate.length === 1
          ? CLIMATE_WORDS[entity(climate[0]).state]
          : count(climate.length, "climate device on", "climate devices on"),
      tone: climate.length === 1 ? entity(climate[0]).state : "auto",
      ids: climate.map((c) => c.id),
    });
  return chips;
}
