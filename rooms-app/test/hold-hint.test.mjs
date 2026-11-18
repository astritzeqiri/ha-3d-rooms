import test from "node:test";
import assert from "node:assert/strict";
import { HOLD_MS, holdRing, takeHoldTip } from "../dashboard/hold-hint.mjs";

test("the hold ring starts after a tap's length and clears on release", () => {
  const timers = {
    fn: null,
    setTimeout(fn, ms) {
      this.fn = fn;
      this.ms = ms;
      return 1;
    },
    clearTimeout() {
      this.fn = null;
    },
  };
  const style = new Map();
  const button = {
    dataset: {},
    style: { setProperty: (k, v) => style.set(k, v) },
  };
  holdRing(button, true, timers);
  assert.equal(button.dataset.holding, undefined, "a quick tap shows nothing");
  assert.ok(timers.ms < HOLD_MS);
  assert.equal(style.get("--hold-ms"), `${HOLD_MS - timers.ms}ms`);
  timers.fn();
  assert.equal(button.dataset.holding, "true");
  holdRing(button, false, timers);
  assert.equal(button.dataset.holding, undefined);
  assert.equal(timers.fn, null);
});

test("the hold tip shows three times per browser and survives broken storage", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(() => takeHoldTip(storage)),
    [true, true, true, false, false],
  );
  assert.equal(takeHoldTip(undefined), false);
  assert.equal(
    takeHoldTip({
      getItem() {
        throw new Error("blocked");
      },
    }),
    false,
  );
});
