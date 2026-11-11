import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../dashboard/card.js", import.meta.url),
  "utf8",
);
const rules = (selector) =>
  [...source.matchAll(new RegExp(`${selector}\\{([^}]*)\\}`, "g"))].map(
    (m) => m[1],
  );

test("the room back button has a fixed width so the previous/next arrows never move with the room name", () => {
  const backRules = rules("\\.room-back");
  assert.ok(backRules.length >= 2, "wide and narrow rules exist");
  for (const body of backRules.filter((b) => b.includes("height:")))
    assert.match(body, /(^|;)width:clamp\(/);
  for (const body of backRules)
    assert.doesNotMatch(body, /min-width:fit-content/);
  // The name is what gives way when it is too long.
  assert.match(
    source,
    /\.room-back \.room-back-name\{min-width:0;overflow:hidden;text-overflow:ellipsis/,
  );
});
