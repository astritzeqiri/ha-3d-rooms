import test from "node:test";
import assert from "node:assert/strict";
import { pageHeight } from "../dashboard/standalone-fit.mjs";

const phone = { screenWidth: 393, screenHeight: 852, innerWidth: 393 };

test("home-screen app short by the status bar gets the full screen", () => {
  assert.equal(
    pageHeight({ ...phone, standalone: true, innerHeight: 793, insetTop: 59 }),
    852,
  );
});

test("a correct home-screen viewport is left alone", () => {
  assert.equal(
    pageHeight({ ...phone, standalone: true, innerHeight: 852, insetTop: 59 }),
    852,
  );
});

test("browser tabs and split views keep their own height", () => {
  assert.equal(
    pageHeight({ ...phone, standalone: false, innerHeight: 700, insetTop: 59 }),
    700,
  );
  assert.equal(
    pageHeight({ ...phone, standalone: true, innerHeight: 600, insetTop: 59 }),
    600,
  );
});

test("landscape compares against the short side", () => {
  assert.equal(
    pageHeight({
      ...phone,
      innerWidth: 852,
      standalone: true,
      innerHeight: 373,
      insetTop: 20,
    }),
    393,
  );
});
