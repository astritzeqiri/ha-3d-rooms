/** Only room-navigation keys cross the same-origin HA panel bridge. */
export function roomRoute(search) {
  const input = new URLSearchParams(search),
    output = new URLSearchParams();
  for (const key of ["model", "saved_view"]) {
    const value = input.get(key);
    if (
      value &&
      /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value) &&
      !["constructor", "prototype"].includes(value)
    )
      output.set(key, value);
  }
  if (["devices", "views", "settings"].includes(input.get("tab")))
    output.set("tab", input.get("tab"));
  if (["floor", "front"].includes(input.get("view")))
    output.set("view", input.get("view"));
  return output;
}

/**
 * The manager page beside the card module. The module's `v` (the app version
 * Home Assistant loads it with) is carried over so browsers never keep showing
 * a previous release's manager page after an update.
 */
export function managerURL(moduleURL, query = new URLSearchParams()) {
  const params = new URLSearchParams(query),
    version = new URL(moduleURL).searchParams.get("v");
  if (version && /^[0-9A-Za-z.+-]{1,40}$/.test(version))
    params.set("v", version);
  return new URL(".", moduleURL).href + "index.html?" + params;
}
