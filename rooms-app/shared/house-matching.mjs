/**
 * Review state for full-house replacement. The server proposes matches; this
 * module tracks the user's room/device choices, summarizes their effect and
 * encodes only the changes for the confirming upload.
 */

/** Start from the server's suggestions: incoming roomId → existing room id or "". */
export function initialRooms(matching) {
  return Object.fromEntries(matching.map((r) => [r.roomId, r.match || ""]));
}

/** Assign an existing room to one incoming room, releasing it from any other. */
export function chooseRoom(rooms, roomId, modelId) {
  const next = { ...rooms };
  if (modelId)
    for (const [key, value] of Object.entries(next))
      if (value === modelId) next[key] = "";
  next[roomId] = modelId;
  return next;
}

/** Device rows for the chosen pairing, with the user's choices applied. */
export function mappingRows(room, modelId, controls = {}) {
  const chosen = controls[room.roomId] || {};
  return (room.mappings[modelId] || []).map((row) => {
    const target =
      row.control in chosen ? chosen[row.control] || null : row.target;
    return {
      ...row,
      target,
      matchedBy:
        row.control in chosen && target !== row.target
          ? target
            ? "manual"
            : null
          : row.matchedBy,
    };
  });
}

/** Change one device mapping's target; "" drops it. Clears the other row using that device. */
export function chooseControl(controls, room, modelId, control, target) {
  const current = { ...(controls[room.roomId] || {}) };
  current[control] = target;
  if (target)
    for (const row of mappingRows(room, modelId, controls))
      if (row.control !== control && row.target === target)
        current[row.control] = "";
  return { ...controls, [room.roomId]: current };
}

/** Counts used by the review header. */
export function summarize(matching, existing, rooms, controls) {
  const used = new Set(Object.values(rooms).filter(Boolean));
  let mappings = 0,
    kept = 0,
    byName = 0;
  for (const room of matching) {
    const modelId = rooms[room.roomId];
    if (!modelId) continue;
    for (const row of mappingRows(room, modelId, controls)) {
      mappings++;
      if (row.target) kept++;
      if (row.target && row.matchedBy === "name") byName++;
    }
  }
  return {
    matchedRooms: used.size,
    newRooms: matching.filter((r) => !rooms[r.roomId]).length,
    removedRooms: existing.filter((r) => !used.has(r.id)),
    mappings,
    kept,
    byName,
    unmatched: mappings - kept,
  };
}

/** Only choices that differ from the server's suggestion, as base64url JSON. */
export function encodeChoices(matching, rooms, controls) {
  const result = { rooms: { ...rooms }, controls: {} };
  for (const room of matching) {
    const modelId = rooms[room.roomId];
    if (!modelId) continue;
    const suggested = Object.fromEntries(
      (room.mappings[modelId] || []).map((r) => [r.control, r.target || ""]),
    );
    const changed = {};
    for (const row of mappingRows(room, modelId, controls))
      if ((row.target || "") !== suggested[row.control])
        changed[row.control] = row.target || "";
    if (Object.keys(changed).length) result.controls[room.roomId] = changed;
  }
  const json = JSON.stringify(result);
  const base64 =
    typeof btoa === "function"
      ? btoa(json)
      : Buffer.from(json, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
