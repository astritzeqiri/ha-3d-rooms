/**
 * The words Home Assistant's frontend shows for an entity's state
 * (`hass.formatEntityState`), for pages without its frontend. Same lookup
 * order: the integration's own state names (translation key), then the
 * domain's names for the device class (a door's on/off is Open/Closed), then
 * the domain's defaults, then the shared Unavailable/Unknown; numbers get
 * their unit.
 */
export function pickStateText(stateObj, resources = {}, entry, state) {
  const value = state ?? stateObj?.state;
  if (value === undefined || value === null) return "";
  const domain = (stateObj?.entity_id || "").split(".")[0];
  const deviceClass = stateObj?.attributes?.device_class;
  const keys = [];
  if (entry?.pl && entry.tk)
    keys.push(
      `component.${entry.pl}.entity.${domain}.${entry.tk}.state.${value}`,
    );
  if (deviceClass)
    keys.push(
      `component.${domain}.entity_component.${deviceClass}.state.${value}`,
    );
  keys.push(`component.${domain}.entity_component._.state.${value}`);
  for (const key of keys) if (resources[key]) return resources[key];
  if (value === "unavailable") return "Unavailable";
  if (value === "unknown") return "Unknown";
  const unit = stateObj?.attributes?.unit_of_measurement;
  if (value !== "" && !isNaN(Number(value)) && domain !== "input_text") {
    const n = Number(value);
    const text = Number.isInteger(n)
      ? String(n)
      : String(Math.round(n * 100) / 100);
    return unit ? `${text}${unit === "%" ? "" : " "}${unit}` : text;
  }
  const words = String(value).replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The page's language, as Home Assistant's frontend picks it. */
export function pageLanguage(storage, config, navigatorLanguage) {
  try {
    const chosen = JSON.parse(storage?.getItem("selectedLanguage") || "null");
    if (chosen) return chosen;
  } catch {
    /* Ignore a malformed saved choice. */
  }
  return config?.language || navigatorLanguage?.split("-")[0] || "en";
}

/**
 * `format(stateObj, state)` from Home Assistant's translation tables, loaded
 * once per integration; `onLoaded` is called when new tables arrive.
 */
export function createStateTextSource(
  connection,
  registry,
  language = "en",
  onLoaded = () => {},
) {
  const entries = new Map(
    (registry?.entities || []).filter((e) => e.ei).map((e) => [e.ei, e]),
  );
  const resources = {};
  const asked = new Set();
  const ask = (category, integration) => {
    const key = `${category}:${integration}`;
    if (asked.has(key)) return;
    asked.add(key);
    connection
      .sendMessagePromise({
        type: "frontend/get_translations",
        language,
        category,
        integration: [integration],
      })
      .then((r) => {
        Object.assign(resources, r?.resources || {});
        onLoaded();
      })
      .catch(() => {});
  };
  return {
    format(stateObj, state) {
      if (!stateObj?.entity_id) return "";
      const entry = entries.get(stateObj.entity_id);
      ask("entity_component", stateObj.entity_id.split(".")[0]);
      if (entry?.pl && entry.tk) ask("entity", entry.pl);
      return pickStateText(stateObj, resources, entry, state);
    },
  };
}
