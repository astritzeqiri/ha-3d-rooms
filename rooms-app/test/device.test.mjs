import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import {
  validateDevices,
  validateDeviceSettings,
  deviceEntries,
  deviceForControl,
  macroName,
} from "../shared/device.mjs";
const controls = [
  { id: "height", type: "number" },
  { id: "motion", type: "cover", motion: "none" },
  ...[1, 2, 3, 4].map((i) => ({ id: "macro-" + i, type: "button" })),
  { id: "light", type: "light" },
];
const desk = {
  id: "desk",
  type: "adjustable_desk",
  label: "Desk",
  height: "height",
  motion: "motion",
  macros: ["macro-1", "macro-2", "macro-3", "macro-4"],
};
test("an adjustable desk is one device with six correctly typed roles and unnamed macros", () => {
  const model = { controls, devices: [desk] };
  assert.equal(validateDevices([desk], controls).length, 1);
  assert.equal(deviceEntries(model).length, 2);
  assert.equal(deviceForControl(model, "macro-1"), desk);
  assert.equal(macroName(model, desk, "macro-1"), "");
  for (const macros of [
    [],
    ["macro-1", "macro-1", "macro-3", "macro-4"],
    ["height", "macro-2", "macro-3", "macro-4"],
  ])
    assert.throws(() => validateDevices([{ ...desk, macros }], controls));
  assert.throws(() =>
    validateDeviceSettings(
      { desk: { macroNames: { "macro-1": "x".repeat(81) } } },
      [desk],
    ),
  );
  assert.throws(() =>
    validateDeviceSettings({ desk: { macroNames: { light: "Bad" } } }, [desk]),
  );
  assert.deepEqual(
    validateDeviceSettings(
      { desk: { macroNames: { "macro-1": "  My height  ", "macro-2": "" } } },
      [desk],
    ),
    { desk: { macroNames: { "macro-1": "My height", "macro-2": "" } } },
  );
});
test("macro names survive reopening the catalog and failed changes preserve the existing settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "desk-settings-"));
  try {
    const store = await new Store(dir).open();
    store.state.models = [
      {
        id: "office",
        controls,
        devices: [desk],
        bindings: { height: "number.desk" },
      },
    ];
    await store.setDeviceSettings("office", "desk", {
      "macro-1": "Focus",
      "macro-4": "Away",
    });
    const reopened = await new Store(dir).open();
    assert.equal(macroName(reopened.find("office"), desk, "macro-1"), "Focus");
    assert.equal(macroName(reopened.find("office"), desk, "macro-2"), "");
    assert.equal(reopened.find("office").bindings.height, "number.desk");
    await assert.rejects(
      store.setDeviceSettings("office", "desk", { wrong: "bad" }),
    );
    assert.equal(macroName(store.find("office"), desk, "macro-1"), "Focus");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
