import { unzipSync, strFromU8 } from "fflate";
const MAX = 300 * 1024 * 1024;
function entries(bytes, names) {
  let expanded = 0;
  return unzipSync(bytes, {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > MAX) throw new Error("Expanded package exceeds 300 MB.");
      return names.includes(entry.name);
    },
  });
}
const json = (bytes) => {
  if (!bytes || bytes.length > 4 * 1024 * 1024)
    throw new Error("Missing or oversized package manifest.");
  return JSON.parse(strFromU8(bytes));
};
/** Read only metadata and nested room ZIPs; never expand scene assets for preview. */
export function packageSummary(bytes, models = []) {
  if (bytes.length > 100 * 1024 * 1024)
    throw new Error("Choose a ZIP smaller than 100 MB.");
  const header = entries(bytes, ["manifest.json", "house-manifest.json"]);
  const house = header["house-manifest.json"]
    ? json(header["house-manifest.json"])
    : null;
  let manifests;
  if (house) {
    if (
      house.format !== "three-d-rooms-house/1" ||
      !Array.isArray(house.rooms) ||
      !house.rooms.length ||
      house.rooms.length > 50 ||
      !house.rooms.every(
        (path) =>
          typeof path === "string" && /^rooms\/[a-z0-9_-]+\.zip$/.test(path),
      ) ||
      new Set(house.rooms).size !== house.rooms.length
    )
      throw new Error(
        "Unsupported house ZIP. Use Export full house for Home Assistant.",
      );
    const rooms = entries(bytes, house.rooms);
    manifests = house.rooms.map((path) =>
      json(
        entries(rooms[path] || new Uint8Array(), ["manifest.json"])[
          "manifest.json"
        ],
      ),
    );
  } else manifests = [json(header["manifest.json"])];
  const seen = new Set();
  const conflicts = [];
  for (const manifest of manifests) {
    if (!manifest.id || !manifest.title || !Array.isArray(manifest.controls))
      throw new Error("Invalid room manifest.");
    if (
      models.some((m) => !m.houseView && m.id === manifest.id) ||
      seen.has(manifest.id)
    )
      conflicts.push(manifest.title);
    seen.add(manifest.id);
  }
  return {
    title: house?.houseName || manifests[0].title,
    house: !!house,
    rooms: manifests.map((m) => ({
      id: m.id,
      title: m.title,
      devices: m.controls.length,
    })),
    floors: manifests[0].housePlacement?.floors || [],
    controls: manifests.reduce((n, m) => n + m.controls.length, 0),
    conflicts,
  };
}
