// Add a 3D Rooms card to one of the user's Home Assistant dashboards in one
// step, instead of three manual steps in the dashboard editor. Only
// dashboards stored in Home Assistant (not auto-generated or YAML ones) can
// take a card this way.

/** A copy of `config` with `card` added to view `viewIndex`. */
export function addCardToConfig(config, viewIndex, card) {
  const next = structuredClone(config);
  const view = next?.views?.[viewIndex];
  if (!view) throw new Error("That dashboard view no longer exists.");
  if (view.strategy)
    throw new Error("That view is generated automatically; choose another.");
  if (view.type === "sections" || Array.isArray(view.sections)) {
    view.sections ||= [];
    view.sections.push({ type: "grid", cards: [card] });
  } else {
    view.cards ||= [];
    view.cards.push(card);
  }
  return next;
}

/** The views a card can be added to, from one dashboard's stored config. */
export function editableViews(config) {
  if (!config || config.strategy || !Array.isArray(config.views)) return [];
  return config.views
    .map((view, index) => ({
      index,
      title: view.title || view.path || `View ${index + 1}`,
      path: view.path || String(index),
      editable: !view.strategy,
    }))
    .filter((view) => view.editable);
}

/** Dashboards (with their views) that can take a card, for one HA session. */
export async function listDashboards(hass) {
  const dashboards = [
    { url_path: null, title: "Overview" },
    ...((await hass.callWS({ type: "lovelace/dashboards/list" })) || []).filter(
      (d) => d.mode !== "yaml",
    ),
  ];
  const result = [];
  for (const dashboard of dashboards) {
    let config;
    try {
      config = await hass.callWS({
        type: "lovelace/config",
        ...(dashboard.url_path ? { url_path: dashboard.url_path } : {}),
      });
    } catch {
      continue; // Never edited yet: Home Assistant builds it automatically.
    }
    const views = editableViews(config);
    if (views.length)
      result.push({
        url_path: dashboard.url_path,
        title: dashboard.title || dashboard.url_path || "Dashboard",
        views,
      });
  }
  return result;
}

/** Add `card` to view `viewIndex` of dashboard `urlPath` and save it. */
export async function addDashboardCard(hass, urlPath, viewIndex, card) {
  const target = urlPath ? { url_path: urlPath } : {};
  const config = await hass.callWS({ type: "lovelace/config", ...target });
  await hass.callWS({
    type: "lovelace/config/save",
    ...target,
    config: addCardToConfig(config, viewIndex, card),
  });
}
