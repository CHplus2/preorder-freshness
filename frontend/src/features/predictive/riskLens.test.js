import test from "node:test";
import assert from "node:assert/strict";
import { riskLens } from "./riskLens.js";
const rows = [
  {
    ingredient_id: "costly",
    expiring_unused_kg: 2,
    shortfall_kg: 0,
    potential_waste_cost_myr: 500,
  },
  {
    ingredient_id: "unknown",
    expiring_unused_kg: 8,
    shortfall_kg: 3,
    potential_waste_cost_myr: null,
  },
  {
    ingredient_id: "gap",
    expiring_unused_kg: 0,
    shortfall_kg: 10,
    potential_waste_cost_myr: null,
  },
];
test("default and unsupported lenses preserve supplied priority without mutating rows", () => {
  assert.deepEqual(riskLens(rows, "priority"), rows);
  assert.deepEqual(riskLens(rows, "invalid"), rows);
  assert.notEqual(riskLens(rows, "priority"), rows);
});
test("waste and shortage lenses rank quantities without treating unknown costs as zero", () => {
  assert.deepEqual(
    riskLens(rows, "waste").map((r) => r.ingredient_id),
    ["unknown", "costly", "gap"],
  );
  assert.deepEqual(
    riskLens(rows, "shortage").map((r) => r.ingredient_id),
    ["gap", "unknown", "costly"],
  );
  assert.equal(rows[0].ingredient_id, "costly");
  assert.equal(rows[1].potential_waste_cost_myr, null);
});
test("ties retain backend order and zero-only or empty results remain visible", () => {
  const tied = rows.map((r) => ({ ...r, shortfall_kg: 0 }));
  assert.deepEqual(riskLens(tied, "shortage"), tied);
  assert.deepEqual(riskLens([], "waste"), []);
});
