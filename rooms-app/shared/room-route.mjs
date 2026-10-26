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
