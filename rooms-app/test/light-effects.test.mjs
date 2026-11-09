import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import {
  lightEffect,
  effectSample,
  createEffectRun,
} from "../shared/light-effects.mjs";

test("effect names map to an animation, a stop, or nothing", () => {
  assert.deepEqual(lightEffect("blink"), {
    kind: "blink",
    oneShot: true,
    duration: 1.2,
  });
  assert.equal(lightEffect("breathe").duration, 15);
  assert.equal(lightEffect("channel_change").duration, 8);
  assert.equal(lightEffect("okay").oneShot, true);
  assert.deepEqual(lightEffect("stop_effect"), { kind: "stop" });
  assert.deepEqual(lightEffect("finish_effect"), { kind: "stop" });
  assert.deepEqual(lightEffect("Color Loop"), {
    kind: "colorloop",
    oneShot: false,
  });
  assert.equal(lightEffect("Candle").kind, "flicker");
  assert.equal(lightEffect("strobe").kind, "strobe");
  for (const name of ["", "none", "Sparkle", "constructor", undefined, 5])
    assert.equal(lightEffect(name), null);
});

test("samples stay in a safe range and one-shots end", () => {
  for (const name of [
    "blink",
    "breathe",
    "okay",
    "channel_change",
    "colorloop",
    "candle",
    "pulse",
    "strobe",
  ]) {
    const effect = lightEffect(name);
    for (let t = 0; t < 20; t += 0.037) {
      const frame = effectSample(effect, t);
      if (!frame) {
        assert.ok(effect.oneShot && t >= effect.duration, name);
        continue;
      }
      assert.ok(frame.gain >= 0 && frame.gain <= 1.0001, `${name} gain`);
      for (const v of frame.tint || []) assert.ok(v >= 0 && v <= 1, name);
    }
  }
  assert.equal(effectSample(lightEffect("blink"), 1.2), null);
  assert.equal(effectSample(lightEffect("stop_effect"), 0), null);
  assert.equal(effectSample(null, 0), null);
  // Colour loop starts red and reaches green a third of the way round.
  const tint = (t) =>
    effectSample(lightEffect("colorloop"), t).tint.map(
      (v) => Math.round(v * 1e6) / 1e6,
    );
  assert.deepEqual(tint(0), [1, 0, 0]);
  assert.deepEqual(tint(4), [0, 1, 0]);
  // Strobe never flashes faster than twice a second.
  let flips = 0,
    last;
  for (let t = 0; t < 1; t += 0.01) {
    const gain = effectSample(lightEffect("strobe"), t).gain;
    if (last !== undefined && gain !== last) flips++;
    last = gain;
  }
  assert.ok(flips <= 4);
});

test("a run follows reported effects and explicit triggers", () => {
  const run = createEffectRun();
  // A one-shot name already present at load is stale: nothing plays.
  run.report("blink", true, 100);
  assert.equal(run.animating, false);
  assert.equal(run.sample(100.1), null);
  // The same name again changes nothing; a service call replays it.
  run.report("blink", true, 101);
  assert.equal(run.animating, false);
  run.trigger("blink", 102);
  assert.ok(run.sample(102.1));
  assert.equal(run.sample(103.3), null);
  assert.equal(run.animating, false);
  // A newly reported one-shot plays once, even on a light that is off.
  run.report("breathe", false, 110);
  assert.ok(run.sample(111));
  run.report("stop_effect", false, 112);
  assert.equal(run.sample(112.1), null);
  // Lasting effects play while the light is on and reports them.
  run.report("colorloop", true, 120);
  assert.ok(run.sample(500).tint);
  run.report("colorloop", false, 501);
  assert.equal(run.animating, false);
  assert.equal(run.sample(502), null);
  run.report("colorloop", true, 503);
  assert.ok(run.sample(504));
  run.report("", true, 505);
  assert.equal(run.sample(506), null);
  // A lasting effect present at load plays straight away.
  const loaded = createEffectRun();
  loaded.report("candle", true, 0);
  assert.equal(loaded.animating, true);
});

test("card plays an effect service call on the lights bound to its target", async () => {
  const source = (
    await readFile(new URL("../dashboard/card.js", import.meta.url), "utf8")
  )
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace("export class", "class");
  let Card;
  vm.runInContext(
    source,
    vm.createContext({
      HTMLElement: class {},
      customElements: { get: () => false, define: (_, v) => (Card = v) },
      window: {},
      document: {},
    }),
  );
  const card = Object.create(Card.prototype),
    played = [];
  card._model = {
    controls: [
      { id: "a", type: "light" },
      { id: "b", type: "light" },
      { id: "c", type: "light" },
      { id: "s", type: "cover" },
    ],
    bindings: {
      a: "light.group",
      b: "light.group",
      c: "light.other",
      s: "light.group",
    },
  };
  card._view = {
    triggerLightEffect: (id, effect) => played.push([id, effect]),
  };
  const call = (data) => card._lightEffectCalled(data);
  call({
    domain: "light",
    service: "turn_on",
    service_data: { entity_id: "light.group", effect: "blink" },
  });
  call({
    domain: "light",
    service: "turn_on",
    service_data: { entity_id: ["light.other"], effect: "breathe" },
  });
  // Not an effect call, another domain or another entity: nothing plays.
  call({
    domain: "light",
    service: "turn_on",
    service_data: { entity_id: "light.group" },
  });
  call({
    domain: "light",
    service: "turn_off",
    service_data: { entity_id: "light.group", effect: "blink" },
  });
  call({
    domain: "switch",
    service: "turn_on",
    service_data: { entity_id: "light.group", effect: "blink" },
  });
  call({
    domain: "light",
    service: "turn_on",
    service_data: { entity_id: "light.none", effect: "blink" },
  });
  call(undefined);
  assert.deepEqual(played, [
    ["a", "blink"],
    ["b", "blink"],
    ["c", "breathe"],
  ]);
});
