import test from "node:test";
import assert from "node:assert/strict";
import { ingredientPresentation } from "./ingredientPresentation.js";
test("kitchen presentation retains native quantities, stable IDs and booking meaning", () => {
  const r = {
    ingredient_id: "raw-material-5",
    ingredient_name: "Chicken",
    unit: "g",
    confirmed_requirement: 200,
    eligible_stock: 50,
    expiring_unused_quantity: 0,
    shortfall_quantity: 150,
    potential_waste_cost_myr: null,
    explanation: "Known recipe needs.",
  };
  const v = ingredientPresentation(r, true);
  assert.equal(v.unit, "g");
  assert.equal(v.name, "Chicken");
  assert.equal(v.need, 200);
  assert.equal(v.shortage, 150);
  assert.equal(v.cost, null);
  assert.equal(v.needLabel, "Confirmed need");
  assert.equal(r.confirmed_requirement, 200);
});
test("Genpact presentation retains forecast kilograms and distinct source meaning", () => {
  const v = ingredientPresentation({
    ingredient_id: "chicken",
    forecast_demand_kg: 28,
    available_kg: 46,
    expiring_unused_kg: 18,
    shortfall_kg: 0,
    potential_waste_cost_myr: 216,
  });
  assert.equal(v.unit, "kg");
  assert.equal(v.needLabel, "Forecast need");
  assert.equal(v.need, 28);
  assert.match(v.summary, /18 kg may expire unused/);
});
test("local volume and tiny quantities are passed through without conversion or fake forecasts", () => {
  const v = ingredientPresentation(
    {
      ingredient_id: "raw-material-6",
      ingredient_name: "Sauce",
      unit: "ml",
      confirmed_requirement: 0,
      eligible_stock: 0.001,
      expiring_unused_quantity: 0.001,
      shortfall_quantity: 0,
      potential_waste_cost_myr: 0,
      explanation: "Inventory only.",
    },
    true,
  );
  assert.equal(v.unit, "ml");
  assert.equal(v.waste, 0.001);
  assert.equal(v.need, 0);
  assert.equal(v.cost, 0);
});
