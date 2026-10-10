import test from "node:test";
import assert from "node:assert/strict";
import { rescueOutcome } from "./rescueOutcome.js";
const original = { sold: 11, price: 10, side: 0, setup: 0 };
const bundle = { sold: 18, price: 12, side: 2, setup: 12 };
test("preset example preserves contribution with all stock, side and setup costs", () => {
  assert.deepEqual(rescueOutcome(bundle), {
    sales: 18,
    unsold: 2,
    revenue: 216,
    exposure: 8,
    contribution: 88,
  });
  assert.equal(rescueOutcome(original).contribution, 30);
});
test("shared quieter demand changes both plans without claiming model uplift", () => {
  assert.equal(rescueOutcome(original, -4).sales, 7);
  assert.equal(rescueOutcome(bundle, -4).sales, 14);
  assert.equal(rescueOutcome(original, -4).contribution, -10);
});
test("sales saturate at available portions without negative remaining stock", () => {
  assert.equal(rescueOutcome(bundle, 4).sales, 20);
  assert.equal(rescueOutcome(bundle, 4).unsold, 0);
  assert.equal(rescueOutcome({ ...original, sold: 0 }, -4).sales, 0);
});
