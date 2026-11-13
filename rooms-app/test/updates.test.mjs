import test from "node:test";
import assert from "node:assert/strict";
import { subscribeUpdates } from "../dashboard/updates.mjs";

test("cards listen through the integration's own subscription", async () => {
  const calls = [];
  let push;
  const connection = {
    subscribeMessage: async (callback, message) => {
      calls.push(message);
      push = callback;
      return () => calls.push("unsubscribed");
    },
    subscribeEvents: async () => assert.fail("no custom event needed"),
  };
  let updates = 0;
  const unsubscribe = await subscribeUpdates(connection, () => updates++);
  assert.deepEqual(calls, [{ type: "three_d_rooms/subscribe" }]);
  push({ type: "updated" });
  assert.equal(updates, 1);
  unsubscribe();
  assert.equal(calls.at(-1), "unsubscribed");
});

test("an older backend without the command falls back to the event", async () => {
  const events = [];
  const connection = {
    subscribeMessage: async () => {
      throw { code: "unknown_command" };
    },
    subscribeEvents: async (callback, type) => {
      events.push(type);
      callback();
      return () => {};
    },
  };
  let updates = 0;
  await subscribeUpdates(connection, () => updates++);
  assert.deepEqual(events, ["three_d_rooms_updated"]);
  assert.equal(updates, 1);
});

test("other subscription errors are not hidden", async () => {
  const connection = {
    subscribeMessage: async () => {
      throw { code: "unauthorized" };
    },
    subscribeEvents: async () => assert.fail("must not fall back"),
  };
  await assert.rejects(
    subscribeUpdates(connection, () => {}),
    {
      code: "unauthorized",
    },
  );
});
