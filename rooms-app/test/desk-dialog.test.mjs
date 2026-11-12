import test from "node:test";
import assert from "node:assert/strict";
import {
  heightAt,
  heightRatio,
  snapHeight,
} from "../dashboard/desk-dialog.mjs";

const range = { min: 60, max: 120, step: 0.5 };
const rect = { top: 100, height: 300 };

test("desk heights snap to the step and stay in range", () => {
  assert.equal(snapHeight(73.3, range), 73.5);
  assert.equal(snapHeight(40, range), 60);
  assert.equal(snapHeight(500, range), 120);
});

test("the top of the slider is the highest desk position", () => {
  assert.equal(heightAt(100, rect, range), 120);
  assert.equal(heightAt(400, rect, range), 60);
  assert.equal(heightAt(250, rect, range), 90);
  assert.equal(heightAt(50, rect, range), 120);
});

test("fill follows the height and ignores unknown values", () => {
  assert.equal(heightRatio(90, range), 0.5);
  assert.equal(heightRatio(undefined, range), 0);
  assert.equal(heightRatio(200, range), 1);
});
