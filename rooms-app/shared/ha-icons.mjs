/**
 * Home Assistant's own choice of icon for an entity, for pages outside its
 * frontend (the full-screen page), so every marker and row shows the icon a
 * dashboard shows. Follows home-assistant/frontend 20261028.4
 * (src/data/icons.ts getEntityIcon, src/common/entity/state_icon.ts,
 * src/components/ha-state-icon.ts; Apache License 2.0):
 *
 * 1. an icon on the state or chosen in the entity registry;
 * 2. the integration's icon for the entity's translation key, by state or range;
 * 3. a few domains decided in code (sun, update, device trackers, dates);
 * 4. the domain's icon for the device class (or "_"), by state or range;
 * 5. the domain's fallback icon, else a bookmark.
 */

/** FALLBACK_DOMAIN_ICONS from Home Assistant's frontend. */
export const FALLBACK_DOMAIN_ICONS = {
  ai_task: "mdi:star-four-points",
  air_quality: "mdi:air-filter",
  alert: "mdi:alert",
  automation: "mdi:robot",
  battery: "mdi:battery",
  calendar: "mdi:calendar",
  climate: "mdi:thermostat",
  configurator: "mdi:cog",
  conversation: "mdi:forum-outline",
  counter: "mdi:counter",
  date: "mdi:calendar",
  datetime: "mdi:calendar-clock",
  demo: "mdi:home-assistant",
  device_tracker: "mdi:account",
  door: "mdi:door-open",
  garage_door: "mdi:garage-open",
  gate: "mdi:gate",
  google_assistant: "mdi:google-assistant",
  group: "mdi:google-circles-communities",
  homeassistant: "mdi:home-assistant",
  homekit: "mdi:home-automation",
  humidity: "mdi:water-percent",
  illuminance: "mdi:brightness-6",
  image_processing: "mdi:image-filter-frames",
  image: "mdi:image",
  infrared: "mdi:led-on",
  input_boolean: "mdi:toggle-switch",
  input_button: "mdi:button-pointer",
  input_datetime: "mdi:calendar-clock",
  input_number: "mdi:ray-vertex",
  input_select: "mdi:format-list-bulleted",
  input_text: "mdi:form-textbox",
  lawn_mower: "mdi:robot-mower",
  light: "mdi:lightbulb",
  moisture: "mdi:water",
  motion: "mdi:motion-sensor",
  notify: "mdi:comment-alert",
  number: "mdi:ray-vertex",
  occupancy: "mdi:home-account",
  persistent_notification: "mdi:bell",
  person: "mdi:account",
  plant: "mdi:flower",
  power: "mdi:flash",
  proximity: "mdi:apple-safari",
  radio_frequency: "mdi:radio-tower",
  remote: "mdi:remote",
  scene: "mdi:palette",
  schedule: "mdi:calendar-clock",
  script: "mdi:script-text",
  select: "mdi:format-list-bulleted",
  sensor: "mdi:eye",
  simple_alarm: "mdi:bell",
  siren: "mdi:bullhorn",
  stt: "mdi:microphone-message",
  sun: "mdi:white-balance-sunny",
  temperature: "mdi:thermometer",
  text: "mdi:form-textbox",
  time: "mdi:clock",
  timer: "mdi:timer-outline",
  template: "mdi:code-braces",
  todo: "mdi:clipboard-list",
  tts: "mdi:speaker-message",
  vacuum: "mdi:robot-vacuum",
  wake_word: "mdi:chat-sleep",
  weather: "mdi:weather-partly-cloudy",
  window: "mdi:window-closed",
  zone: "mdi:map-marker-radius",
};
export const DEFAULT_DOMAIN_ICON = "mdi:bookmark";

/** An icon by range: the highest threshold at or below the value. */
function fromRange(value, range) {
  const steps = Object.keys(range)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (!steps.length || value < steps[0]) return undefined;
  let chosen = steps[0];
  for (const step of steps) if (value >= step) chosen = step;
  return range[String(chosen)];
}
function fromTranslations(state, icons) {
  if (!icons) return undefined;
  if (state && icons.state?.[state]) return icons.state[state];
  if (state !== undefined && icons.range && !Number.isNaN(Number(state)))
    return fromRange(Number(state), icons.range) ?? icons.default;
  return icons.default;
}
/** stateIcon: domains Home Assistant decides in code. */
function codeIcon(stateObj, state) {
  const domain = stateObj.entity_id.split(".")[0],
    a = stateObj.attributes || {};
  if (domain === "sun")
    return state === "above_horizon"
      ? "mdi:white-balance-sunny"
      : "mdi:weather-night";
  if (domain === "update")
    return state === "on"
      ? a.in_progress
        ? "mdi:package-down"
        : "mdi:package-up"
      : "mdi:package";
  if (domain === "device_tracker")
    return state === "not_home" ? "mdi:account-arrow-right" : "mdi:account";
  if (domain === "input_datetime") {
    if (!a.has_date) return "mdi:clock";
    if (!a.has_time) return "mdi:calendar";
  }
  return undefined;
}
/**
 * The icon name for `stateObj`, given its registry entry
 * (`{ ic, pl, tk }` from `config/entity_registry/list_for_display`) and the
 * icon tables `frontend/get_icons` returns: `platform` for the entity's
 * integration (`resources[integration]`), `component` for its domain.
 */
export function pickEntityIcon(
  stateObj,
  { entry, platform, component, state = stateObj?.state } = {},
) {
  if (!stateObj?.entity_id) return undefined;
  const domain = stateObj.entity_id.split(".")[0],
    a = stateObj.attributes || {};
  if (a.icon) return a.icon;
  if (entry?.ic) return entry.ic;
  let icon;
  if (entry?.tk && platform)
    icon = fromTranslations(state, platform[domain]?.[entry.tk]);
  icon ||= codeIcon(stateObj, state);
  if (!icon && component)
    icon = fromTranslations(
      state,
      (a.device_class && component[a.device_class]) || component._,
    );
  return icon || FALLBACK_DOMAIN_ICONS[domain] || DEFAULT_DOMAIN_ICON;
}
/**
 * Loads Home Assistant's icon tables over `connection` once (and each
 * integration's when first needed); `iconFor(stateObj)` resolves to a name.
 */
export function createEntityIconSource(
  connection,
  registry,
  { timeoutMs = 4000, timers = globalThis } = {},
) {
  const entries = new Map(
    (registry?.entities || []).filter((e) => e.ei).map((e) => [e.ei, e]),
  );
  // One integration per request: asking for every integration at once makes
  // Home Assistant load all of their icon files first, which can take longer
  // than anyone waits (the icons then stayed on their placeholder). A table
  // that does not arrive in time counts as empty; the built-in icons draw.
  const ask = (category, integration) =>
    new Promise((resolve) => {
      const timer = timers.setTimeout(() => resolve({}), timeoutMs);
      connection
        .sendMessagePromise({
          type: "frontend/get_icons",
          category,
          integration: [integration],
        })
        .then(
          (r) => resolve(r?.resources?.[integration] || {}),
          () => resolve({}),
        )
        .finally(() => timers.clearTimeout(timer));
    });
  const components = new Map(),
    platforms = new Map();
  const table = (cache, category, integration) => {
    if (!cache.has(integration))
      cache.set(integration, ask(category, integration));
    return cache.get(integration);
  };
  return {
    async iconFor(stateObj) {
      if (!stateObj?.entity_id) return undefined;
      const entry = entries.get(stateObj.entity_id),
        domain = stateObj.entity_id.split(".")[0];
      const [component, platform] = await Promise.all([
        table(components, "entity_component", domain),
        entry?.pl && entry.tk
          ? table(platforms, "entity", entry.pl)
          : undefined,
      ]);
      return pickEntityIcon(stateObj, { entry, platform, component });
    },
  };
}
