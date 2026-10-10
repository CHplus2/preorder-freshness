import test from "node:test";
import assert from "node:assert/strict";
import { replayEvidence } from "./replayEvidence.js";
const batch = (id, ingredient, expiry, eligible, consumed, remaining) => ({
  batch_id: id,
  ingredient_id: ingredient,
  expiry_week: expiry,
  eligible,
  consumed_kg: consumed,
  remaining_kg: remaining,
});
test("playback scopes ingredient batches, sorts expiry with a stable tie-breaker, and never mutates the response", () => {
  const data = {
    meal_forecasts: [
      { predicted_orders: 210.25 },
      { predicted_orders: 170.75 },
    ],
    batch_allocations: [
      batch("z", "chicken", 146, true, 8, 3),
      batch("expired", "chicken", 145, false, 0, 9),
      batch("rice", "rice", 140, true, 100, 0),
      batch("a", "chicken", 146, true, 20, 15),
    ],
  };
  const before = JSON.stringify(data);
  const result = replayEvidence(data, "chicken");
  assert.deepEqual(
    result.batches.map((b) => b.batch_id),
    ["expired", "a", "z"],
  );
  assert.equal(result.allocatedKg, 28);
  assert.equal(result.weeklyOrders, 381);
  assert.equal(JSON.stringify(data), before);
});
test("missing evidence remains unavailable while returned zero allocations and orders remain zero", () => {
  assert.deepEqual(
    replayEvidence({ meal_forecasts: [], batch_allocations: [] }, "chicken"),
    { batches: [], weeklyOrders: null, allocatedKg: null },
  );
  const result = replayEvidence(
    {
      meal_forecasts: [{ predicted_orders: 0 }],
      batch_allocations: [batch("zero", "rice", 146, true, 0, 12)],
    },
    "rice",
  );
  assert.equal(result.weeklyOrders, 0);
  assert.equal(result.allocatedKg, 0);
});
test("excluded batch consumption is never included in eligible allocation, and remaining stock is never relabeled as waste", () => {
  const result = replayEvidence(
    {
      meal_forecasts: [{ predicted_orders: 10 }],
      batch_allocations: [
        batch("excluded", "rice", 145, false, 3, 9),
        batch("eligible", "rice", 147, true, 4, 8),
      ],
    },
    "rice",
  );
  assert.equal(result.allocatedKg, 4);
  assert.equal(result.batches[0].consumed_kg, 3);
  assert.equal(result.batches[1].remaining_kg, 8);
  assert.equal(result.expiring_unused_kg, undefined);
});
