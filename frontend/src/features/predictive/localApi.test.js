import test from "node:test";
import assert from "node:assert/strict";
import { loadLocalPlan, loadLocalScenario, validateLocalPlan } from "./localApi.js";

function plan() {
  return { api_version: "1", mode: "local_plan", model_status: "not_used", as_of: "2026-10-10", timezone: "Asia/Kuala_Lumpur",
    sources: { demand: "CONFIRMED_PAID_PREORDERS", operational: "DATABASE", product_mapping: "ACCEPTED_ORDER_RECIPES" },
    window: { start_date: "2026-10-10", end_date: "2026-10-16", horizon_days: 7 },
    coverage: { active_orders: 2, included_orders: 1, excluded_orders: 1, positive_batches: 1, eligible_batches: 1, hypothetical_batches: 0 },
    included_orders: [{ order_id: 1, portions: 2, preparation_date: "2026-10-11", use_by_date: "2026-10-11", items: [{ product_id: 3, product_name: "Nasi Ayam", quantity: 2 }], requirements: [{ raw_material_id: 5, quantity: 200, unit: "g" }] }],
    excluded_orders: [{ order_id: 2, reason: "not_paid" }],
    ingredient_risks: [{ ingredient_id: "raw-material-5", raw_material_id: 5, ingredient_name: "Chicken", unit: "g", risk_type: "shortage", confirmed_requirement: 200, eligible_stock: 50, allocated_quantity: 50, shortfall_quantity: 150, expiring_unused_quantity: 0, potential_waste_cost_myr: 0, estimated_purchase_cost_myr: null, urgent_by: "2026-10-11", action: "Review replenishment.", explanation: "Known order needs exceed usable stock." }],
    batches: [{ batch_id: 2, raw_material_id: 5, unit: "g", hypothetical: false, quantity: 50, allocated_quantity: 50, remaining_quantity: 0, received_date: "2026-10-10", expiry_date: "2026-10-12", eligible: true, exclusion_reasons: [] }],
    batch_allocations: [{ order_id: 1, batch_id: 2, raw_material_id: 5, quantity: 50, unit: "g", needed_by: "2026-10-11", use_by_date: "2026-10-11" }],
    shortages: [{ order_id: 1, raw_material_id: 5, quantity: 150, unit: "g", needed_by: "2026-10-11" }],
    recommendations: [{ priority: 1, ingredient_id: "raw-material-5", raw_material_id: 5, risk_type: "shortage", urgent_by: "2026-10-11", action: "Review replenishment.", explanation: "Known requirements." }], warnings: ["Known bookings only."] };
}

test("local contract preserves native units, menu snapshots, exclusions and unknown costs", () => {
  const d = validateLocalPlan(plan());
  assert.equal(d.ingredient_risks[0].unit, "g");
  assert.equal(d.ingredient_risks[0].estimated_purchase_cost_myr, null);
  assert.equal(d.included_orders[0].items[0].product_name, "Nasi Ayam");
  assert.equal(d.excluded_orders[0].reason, "not_paid");
});

test("source mismatch, invalid units, missing coverage and nonfinite values are rejected", () => {
  for (const change of [d => d.sources.demand = "GENPACT_HISTORICAL", d => d.model_status = "ready",
    d => d.ingredient_risks[0].unit = "tonne", d => d.ingredient_risks[0].shortfall_quantity = NaN,
    d => d.coverage.included_orders = 0, d => delete d.included_orders,
    d => d.batches[0].unit = "kg", d => d.batches[0].batch_id = -1,
    d => d.window.start_date = "2026-02-31", d => d.recommendations[0].priority = 2]) {
    const d = plan(); change(d); assert.throws(() => validateLocalPlan(d));
  }
});

test("local requests use existing staff sessions; failed API never returns fixtures", async () => {
  let call;
  const d = await loadLocalPlan(7, { fetchImpl: async (url, options) => {
    call = { url, options }; return { ok: true, json: async () => plan() };
  } });
  assert.equal(call.url, "/api/admin/predictive/local-plan/?horizon_days=7");
  assert.equal(call.options.credentials, "include");
  assert.equal(d.mode, "local_plan");
  await assert.rejects(loadLocalPlan(7, { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ code: "database_unavailable" }) }) }));
});

test("purchase comparison uses CSRF and a separately validated hypothetical response", async () => {
  const baseline = plan(), scenario = plan();
  scenario.sources.operational = "DATABASE_WITH_HYPOTHETICAL_PURCHASE";
  scenario.coverage.hypothetical_batches = 1;
  let call;
  const result = await loadLocalScenario({ raw_material_id: 5 }, { csrfToken: "test-csrf", fetchImpl: async (url, options) => {
    call = { url, options }; return { ok: true, json: async () => ({ api_version: "1", mode: "local_purchase_scenario", purchase: { unit: "g" }, baseline, scenario, warnings: ["No action executed."] }) };
  } });
  assert.equal(call.url, "/api/admin/predictive/local-scenario/");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers["X-CSRFToken"], "test-csrf");
  assert.equal(result.scenario.sources.operational, "DATABASE_WITH_HYPOTHETICAL_PURCHASE");
  await assert.rejects(loadLocalScenario({}, { fetchImpl: async () => { throw Error("Must not call"); } }), /CSRF/);
});
