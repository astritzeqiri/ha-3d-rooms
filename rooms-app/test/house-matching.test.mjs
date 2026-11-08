import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseControl,
  chooseRoom,
  encodeChoices,
  initialRooms,
  mappingRows,
  summarize,
} from "../shared/house-matching.mjs";

const existing = [
  { id: "hall", title: "Hallway" },
  { id: "living", title: "Living room" },
];
const living = {
  roomId: "r-living",
  title: "Living room",
  match: "living",
  matchedBy: "name",
  controls: [
    { id: "ceiling", label: "Ceiling" },
    { id: "lamp", label: "Lamp" },
  ],
  mappings: {
    living: [
      {
        control: "ceiling",
        label: "Ceiling",
        entity: "light.a",
        target: "ceiling",
        matchedBy: "id",
        options: ["ceiling", "lamp"],
      },
      {
        control: "old-lamp",
        label: "Floor lamp",
        entity: "light.b",
        target: null,
        matchedBy: null,
        options: ["ceiling", "lamp"],
      },
    ],
    hall: [],
  },
};
const corridor = {
  roomId: "r-corridor",
  title: "Corridor",
  match: null,
  matchedBy: null,
  controls: [],
  mappings: { living: [], hall: [] },
};
const decode = (value) =>
  JSON.parse(
    Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
  );

test("suggestions summarize matched rooms, kept and missing mappings", () => {
  const rooms = initialRooms([living, corridor]);
  assert.deepEqual(rooms, { "r-living": "living", "r-corridor": "" });
  const totals = summarize([living, corridor], existing, rooms, {});
  assert.equal(totals.matchedRooms, 1);
  assert.equal(totals.newRooms, 1);
  assert.deepEqual(totals.removedRooms, [{ id: "hall", title: "Hallway" }]);
  assert.equal(totals.kept, 1);
  assert.equal(totals.unmatched, 1);
  assert.deepEqual(decode(encodeChoices([living, corridor], rooms, {})), {
    rooms,
    controls: {},
  });
});

test("an existing room is used once and device targets stay unique", () => {
  let rooms = chooseRoom(
    initialRooms([living, corridor]),
    "r-corridor",
    "living",
  );
  assert.deepEqual(rooms, { "r-living": "", "r-corridor": "living" });
  rooms = chooseRoom(rooms, "r-living", "living");
  let controls = chooseControl({}, living, "living", "old-lamp", "ceiling");
  const rows = mappingRows(living, "living", controls);
  assert.deepEqual(
    rows.map((r) => [r.control, r.target, r.matchedBy]),
    [
      ["ceiling", null, null],
      ["old-lamp", "ceiling", "manual"],
    ],
  );
  assert.deepEqual(decode(encodeChoices([living, corridor], rooms, controls)), {
    rooms: { "r-living": "living", "r-corridor": "" },
    controls: { "r-living": { ceiling: "", "old-lamp": "ceiling" } },
  });
  controls = chooseControl(controls, living, "living", "ceiling", "ceiling");
  assert.equal(mappingRows(living, "living", controls)[1].target, null);
});
