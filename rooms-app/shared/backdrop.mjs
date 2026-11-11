// Card background presets. The room is drawn on a transparent canvas above a
// CSS layer, so a preset costs no extra 3D work. "classic" keeps the old opaque
// flat fill; "theme" shows the Home Assistant card background.
export const BACKGROUNDS = [
  "spotlight",
  "classic",
  "grid",
  "sky",
  "aurora",
  "image",
  "theme",
];
export const BACKGROUND_LABELS = {
  spotlight: "Spotlight · soft light behind the house",
  classic: "Classic · flat dark",
  grid: "Blueprint grid",
  sky: "Sky · follows day and night",
  aurora: "Aurora · slow ambient colour",
  image: "Custom image",
  theme: "Home Assistant theme",
};
/** Fields a saved view stores and a card may override. */
export const BACKGROUND_FIELDS = [
  "background",
  "background_image",
  "background_shadow",
];
export const DEFAULT_BACKGROUND = "spotlight";

export const BACKGROUND_NAMES = {
  spotlight: "Spotlight",
  classic: "Classic",
  grid: "Blueprint grid",
  sky: "Sky",
  aurora: "Aurora",
  image: "Custom image",
  theme: "Theme",
};
export const BACKGROUND_NOTES = {
  spotlight: "Soft light behind the house",
  classic: "The flat dark fill",
  grid: "A faint floor grid",
  sky: "Follows day and night",
  aurora: "Slow ambient colour",
  image: "Your own photo, dimmed",
  theme: "Home Assistant's own card colour",
};
/** Times of day the picker can preview; "" follows the room's real one. */
export const PREVIEW_TIMES = [
  ["", "Now"],
  ["day", "Day"],
  ["golden", "Golden hour"],
  ["dusk", "Dusk"],
  ["night", "Night"],
];

/**
 * The saved choices after the picker's values change: only what differs from
 * the defaults is kept (shadow is on by default, except on the flat classic fill).
 */
export function nextBackgroundState({ background, image, shadow }) {
  const next = {},
    trimmed = String(image || "").trim();
  if (background && background !== DEFAULT_BACKGROUND)
    next.background = background;
  if (background === "image" && trimmed) next.background_image = trimmed;
  if (shadow !== (background !== "classic")) next.background_shadow = shadow;
  return next;
}

/** Bounding box of the non-transparent pixels of RGBA data, or null when empty. */
export function contentBounds(data, width, height, threshold = 12) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  return right < 0
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** The classic opaque fill is the only preset that needs no transparent canvas. */
export const needsTransparentCanvas = (background) => background !== "classic";

export function validateBackground(config) {
  const {
    background,
    background_image: image,
    background_shadow: shadow,
  } = config;
  if (background !== undefined && !BACKGROUNDS.includes(background))
    throw new Error(`Background must be one of ${BACKGROUNDS.join(", ")}.`);
  if (shadow !== undefined && typeof shadow !== "boolean")
    throw new Error("background_shadow must be true or false.");
  if (image !== undefined) {
    if (typeof image !== "string" || image.length > 2000)
      throw new Error("Background image must be a web address.");
    if (image && !safeImageUrl(image))
      throw new Error(
        "Background image must start with /, http:// or https://.",
      );
  }
  if (background === "image" && !image)
    throw new Error("Choose a background image address.");
}

/** Only same-site paths and web addresses; never javascript: or data: URLs. */
export function safeImageUrl(value) {
  const url = String(value || "").trim();
  if (/\s/.test(url)) return "";
  if (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url)) return url;
  return "";
}

/** The contact shadow is on by default, except on the flat classic fill, and
 *  meaningless in the top-down plan view. */
export function groundShadowEnabled(config) {
  if (config.view === "floor") return false;
  const classic = (config.background || DEFAULT_BACKGROUND) === "classic";
  return classic
    ? config.background_shadow === true
    : config.background_shadow !== false;
}

/** Sun height → one of the four times of day the backdrop is painted for. */
export function tone(elevation) {
  if (!Number.isFinite(elevation)) return "night";
  if (elevation >= 12) return "day";
  if (elevation >= 0) return "golden";
  if (elevation >= -8) return "dusk";
  return "night";
}

/** Sun elevation to use, honouring the Day / Night / Auto switch of the room. */
export function effectiveElevation(mode, sun) {
  if (mode === "day") return 45;
  if (mode === "night") return -30;
  const elevation = Number(sun?.attributes?.elevation);
  if (Number.isFinite(elevation)) return elevation;
  return sun?.state === "above_horizon" ? 30 : -30;
}

const SKY = {
  day: { top: "#4f93d6", mid: "#8fc3ee", bottom: "#d9ecf8", stars: 0 },
  golden: { top: "#4a6fa8", mid: "#e8a46b", bottom: "#f6d9a8", stars: 0 },
  dusk: { top: "#1c2550", mid: "#6a4f86", bottom: "#d98a6a", stars: 0.35 },
  night: { top: "#070b1a", mid: "#0f1a38", bottom: "#1d2a4d", stars: 1 },
};
// Spotlight and grid stay dark in every tone so marker labels keep contrast;
// only the hue and strength of the light changes.
const SPOT = {
  day: { core: "#524d44", edge: "#1e1d1a" },
  golden: { core: "#55483a", edge: "#1f1b18" },
  dusk: { core: "#3a3550", edge: "#15141f" },
  night: { core: "#2b3447", edge: "#10141d" },
};

/** CSS custom properties the card writes on its backdrop element. */
export function backdropVars(background, time, image) {
  const sky = SKY[time] || SKY.night,
    spot = SPOT[time] || SPOT.night;
  const vars = {
    "--bd-sky-top": sky.top,
    "--bd-sky-mid": sky.mid,
    "--bd-sky-bottom": sky.bottom,
    "--bd-stars": String(sky.stars),
    "--bd-spot-core": spot.core,
    "--bd-spot-edge": spot.edge,
  };
  const url = safeImageUrl(image);
  // JSON string syntax is valid CSS and escapes quotes, backslashes and newlines.
  if (background === "image" && url)
    vars["--bd-image"] = `url(${JSON.stringify(url)})`;
  return vars;
}

/** Paint a `.backdrop` layer for a preset and time of day (shared by card and manager). */
export function paintBackdrop(layer, config, time) {
  const background = config.background || DEFAULT_BACKGROUND;
  layer.dataset.background = background;
  layer.dataset.time = time;
  for (const key of [...layer.style])
    if (key.startsWith("--bd-")) layer.style.removeProperty(key);
  for (const [key, value] of Object.entries(
    backdropVars(background, time, config.background_image),
  ))
    layer.style.setProperty(key, value);
  if (background === "aurora" && !layer.childElementCount)
    layer.append(
      ...[1, 2, 3].map(() => layer.ownerDocument.createElement("i")),
    );
  else if (background !== "aurora") layer.replaceChildren();
}

/** Two colours for the saved-view thumbnail, so it looks like the card. */
export function thumbnailFill(background, time) {
  const sky = SKY[time] || SKY.night,
    spot = SPOT[time] || SPOT.night;
  if (background === "spotlight")
    return { shape: "radial", from: spot.core, to: spot.edge };
  if (background === "sky")
    return { shape: "linear", from: sky.top, to: sky.bottom };
  if (background === "grid")
    return { shape: "radial", from: "#17304a", to: "#0b1624" };
  if (background === "aurora")
    return { shape: "radial", from: "#1b2c3c", to: "#0d1018" };
  return undefined;
}

/** Stylesheet text for the backdrop layer (inside the card's shadow root). */
export const BACKDROP_CSS = `
.backdrop{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;transition:background 1.2s ease}
.backdrop[data-background=classic]{background:#242320}
.backdrop[data-background=theme]{background:transparent}
.backdrop[data-background=spotlight]{background:radial-gradient(ellipse 70% 62% at 50% 46%,var(--bd-spot-core) 0%,var(--bd-spot-edge) 100%)}
.backdrop[data-background=sky]{background:linear-gradient(180deg,var(--bd-sky-top) 0%,var(--bd-sky-mid) 58%,var(--bd-sky-bottom) 100%)}
.backdrop[data-background=sky]::before{content:"";position:absolute;inset:0;opacity:var(--bd-stars);transition:opacity 1.2s ease;background-image:radial-gradient(1.4px 1.4px at 12% 18%,#fff 50%,transparent),radial-gradient(1px 1px at 27% 8%,#fff 50%,transparent),radial-gradient(1.6px 1.6px at 41% 26%,#fff 50%,transparent),radial-gradient(1px 1px at 58% 12%,#fff 50%,transparent),radial-gradient(1.4px 1.4px at 73% 22%,#fff 50%,transparent),radial-gradient(1px 1px at 86% 9%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 94% 30%,#fff 50%,transparent),radial-gradient(1px 1px at 6% 42%,#fff 50%,transparent),radial-gradient(1.2px 1.2px at 66% 40%,#fff 50%,transparent),radial-gradient(1px 1px at 34% 46%,#fff 50%,transparent)}
.backdrop[data-background=grid]{background:radial-gradient(ellipse 80% 70% at 50% 50%,#17304a 0%,#0b1624 100%)}
.backdrop[data-background=grid]::before{content:"";position:absolute;left:-50%;right:-50%;top:38%;bottom:-60%;background-image:linear-gradient(rgba(120,180,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(120,180,255,.22) 1px,transparent 1px);background-size:48px 48px;transform:perspective(520px) rotateX(62deg);transform-origin:50% 0;-webkit-mask-image:radial-gradient(ellipse 50% 60% at 50% 30%,#000 0%,transparent 78%);mask-image:radial-gradient(ellipse 50% 60% at 50% 30%,#000 0%,transparent 78%)}
.backdrop[data-background=aurora]{background:#0d1018}
.backdrop[data-background=aurora] i{position:absolute;width:62%;aspect-ratio:1;border-radius:50%;filter:blur(70px);opacity:.55;animation:bd-drift 26s ease-in-out infinite alternate}
.backdrop[data-background=aurora] i:nth-child(1){left:-12%;top:-20%;background:var(--primary-color,#03a9f4)}
.backdrop[data-background=aurora] i:nth-child(2){right:-14%;top:10%;background:#7b4fd6;animation-duration:32s;animation-delay:-8s}
.backdrop[data-background=aurora] i:nth-child(3){left:22%;bottom:-34%;background:#1fb89a;animation-duration:38s;animation-delay:-16s}
.backdrop[data-background=image]{background:#14130f var(--bd-image) center/cover no-repeat}
.backdrop[data-background=image]::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,.25),rgba(0,0,0,.6));backdrop-filter:blur(3px)}
@keyframes bd-drift{to{transform:translate(14%,10%) scale(1.18)}}
@media (prefers-reduced-motion:reduce){.backdrop[data-background=aurora] i{animation:none}}
`;
