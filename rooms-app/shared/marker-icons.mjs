/**
 * Curated Material Design icons a view may use for a device marker. Values are
 * Home Assistant icon names, so the dashboard renders them natively; the
 * manager draws the same paths, generated into marker-icon-paths.mjs so the
 * full `@mdi/js` set stays out of the startup bundle.
 */
import { SUGGESTED_ICON_PATHS as P } from "./marker-icon-paths.mjs";

export const MARKER_ICON_GROUPS = [
  [
    "Lights",
    [
      ["mdi:lightbulb", "Bulb", P["mdi:lightbulb"]],
      ["mdi:lightbulb-outline", "Bulb outline", P["mdi:lightbulb-outline"]],
      ["mdi:ceiling-light", "Ceiling light", P["mdi:ceiling-light"]],
      ["mdi:lamp", "Table lamp", P["mdi:lamp"]],
      ["mdi:floor-lamp", "Floor lamp", P["mdi:floor-lamp"]],
      ["mdi:desk-lamp", "Desk lamp", P["mdi:desk-lamp"]],
      ["mdi:wall-sconce", "Wall light", P["mdi:wall-sconce"]],
      ["mdi:outdoor-lamp", "Outdoor light", P["mdi:outdoor-lamp"]],
      ["mdi:led-strip", "LED strip", P["mdi:led-strip"]],
      ["mdi:string-lights", "String lights", P["mdi:string-lights"]],
    ],
  ],
  [
    "Doors & windows",
    [
      ["mdi:door", "Door", P["mdi:door"]],
      ["mdi:door-open", "Open door", P["mdi:door-open"]],
      ["mdi:door-sliding", "Sliding door", P["mdi:door-sliding"]],
      ["mdi:garage", "Garage", P["mdi:garage"]],
      ["mdi:window-closed-variant", "Window", P["mdi:window-closed-variant"]],
      ["mdi:window-open-variant", "Open window", P["mdi:window-open-variant"]],
      ["mdi:blinds-horizontal", "Blinds", P["mdi:blinds-horizontal"]],
      ["mdi:roller-shade", "Roller shade", P["mdi:roller-shade"]],
      ["mdi:curtains", "Curtains", P["mdi:curtains"]],
      ["mdi:lock", "Lock", P["mdi:lock"]],
      ["mdi:lock-open-variant", "Unlocked", P["mdi:lock-open-variant"]],
    ],
  ],
  [
    "Other",
    [
      ["mdi:air-conditioner", "Air conditioner", P["mdi:air-conditioner"]],
      ["mdi:fan", "Fan", P["mdi:fan"]],
      ["mdi:thermometer", "Thermometer", P["mdi:thermometer"]],
      ["mdi:radiator", "Radiator", P["mdi:radiator"]],
      ["mdi:television", "TV", P["mdi:television"]],
      ["mdi:speaker", "Speaker", P["mdi:speaker"]],
      ["mdi:power-plug", "Plug", P["mdi:power-plug"]],
      ["mdi:power", "Power", P["mdi:power"]],
      ["mdi:flash", "Flash", P["mdi:flash"]],
      ["mdi:play", "Play", P["mdi:play"]],
      ["mdi:desk", "Desk", P["mdi:desk"]],
      ["mdi:bed", "Bed", P["mdi:bed"]],
      ["mdi:sofa", "Sofa", P["mdi:sofa"]],
      ["mdi:home", "Home", P["mdi:home"]],
      ["mdi:star", "Star", P["mdi:star"]],
    ],
  ],
];
export const MARKER_ICONS = new Map(
  MARKER_ICON_GROUPS.flatMap(([, icons]) =>
    icons.map(([id, label, path]) => [id, { label, path }]),
  ),
);
/**
 * Any icon name Home Assistant's icon picker can offer: `mdi:door-open`, or a
 * name from an icon set registered in HA's `window.customIcons`, such as
 * `local:front-door`.
 */
export const MARKER_ICON_PATTERN =
  /^[a-z0-9][a-z0-9_-]{0,31}:[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/;
export function isMarkerIcon(icon) {
  return typeof icon === "string" && MARKER_ICON_PATTERN.test(icon);
}
/** HA icon name → `@mdi/js` export name (`mdi:printer-3d-nozzle` → `mdiPrinter3dNozzle`). */
export function mdiExportName(icon) {
  return (
    "mdi" +
    icon
      .replace(/^mdi:/, "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")
  );
}
/** Readable label (`mdi:door-open` → `Door open`, `local:front_door` → `Front door · local`). */
export function iconLabel(icon) {
  const known = MARKER_ICONS.get(icon)?.label;
  if (known) return known;
  const [prefix, ...rest] = String(icon).split(":");
  const words = rest.join(":").replace(/[-_]/g, " ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return prefix === "mdi" ? label : `${label} · ${prefix}`;
}
/** `<path>` markup for a chosen icon, or undefined to keep the default glyph. */
export function markerIconPath(icon) {
  const found = MARKER_ICONS.get(icon);
  return found ? `<path d="${found.path}"/>` : undefined;
}
