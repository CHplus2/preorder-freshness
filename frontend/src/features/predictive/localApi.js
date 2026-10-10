import { requestJSON } from "./api.js";

const number = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v) => Number.isInteger(v) && v > 0;
const count = (v) => Number.isInteger(v) && v >= 0;
const text = (v) => typeof v === "string" && v.length > 0;
const strings = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");
const nullable = (v) => v === null || number(v);
const units = new Set(["g", "kg", "ml", "l", "unit"]);
const riskTypes = new Set(["none", "shortage", "expiry_surplus", "expiry_surplus_and_shortage"]);
const date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
function requireValid(condition) {
  if (!condition) throw new Error("Kitchen API response does not match the local planning contract. Refresh or contact the backend team.");
}

export function validateLocalPlan(d, { scenario = false } = {}) {
  requireValid(d?.api_version === "1" && d.mode === "local_plan" && d.model_status === "not_used" &&
    d.sources?.demand === "CONFIRMED_PAID_PREORDERS" && d.sources?.product_mapping === "ACCEPTED_ORDER_RECIPES" &&
    d.sources?.operational === (scenario ? "DATABASE_WITH_HYPOTHETICAL_PURCHASE" : "DATABASE") &&
    date(d.as_of) && text(d.timezone) && strings(d.warnings) &&
    date(d.window?.start_date) && date(d.window?.end_date) && d.window.start_date <= d.window.end_date &&
    integer(d.window.horizon_days) && d.window.horizon_days <= 28 &&
    ["active_orders", "included_orders", "excluded_orders", "positive_batches", "eligible_batches", "hypothetical_batches"].every((key) => count(d.coverage?.[key])));
  requireValid(Array.isArray(d.ingredient_risks) && d.ingredient_risks.every((r) =>
    integer(r.raw_material_id) && r.ingredient_id === `raw-material-${r.raw_material_id}` && text(r.ingredient_name) &&
    units.has(r.unit) && riskTypes.has(r.risk_type) &&
    ["confirmed_requirement", "eligible_stock", "allocated_quantity", "shortfall_quantity", "expiring_unused_quantity"].every((key) => number(r[key])) &&
    nullable(r.potential_waste_cost_myr) && nullable(r.estimated_purchase_cost_myr) &&
    (r.urgent_by === null || date(r.urgent_by)) && text(r.action) && text(r.explanation)) &&
    new Set(d.ingredient_risks.map((r) => r.raw_material_id)).size === d.ingredient_risks.length);
  const material = new Map(d.ingredient_risks.map((r) => [r.raw_material_id, r]));
  const materialUnit = (r) => material.get(r.raw_material_id)?.unit === r.unit;
  const batchId = (id) => integer(id) || (scenario && id === -1);
  requireValid(Array.isArray(d.included_orders) && d.included_orders.every((o) => integer(o.order_id) && integer(o.portions) &&
    date(o.preparation_date) && date(o.use_by_date) && Array.isArray(o.items) && o.items.every((i) =>
      (i.product_id === null || integer(i.product_id)) && text(i.product_name) && integer(i.quantity)) &&
    Array.isArray(o.requirements) && o.requirements.every((r) => materialUnit(r) && number(r.quantity))) &&
    Array.isArray(d.excluded_orders) && d.excluded_orders.every((o) => integer(o.order_id) && text(o.reason)) &&
    d.coverage.included_orders === d.included_orders.length && d.coverage.excluded_orders === d.excluded_orders.length &&
    d.coverage.active_orders === d.included_orders.length + d.excluded_orders.length);
  requireValid(Array.isArray(d.batches) && d.batches.every((b) => batchId(b.batch_id) && materialUnit(b) &&
    typeof b.hypothetical === "boolean" && b.hypothetical === (b.batch_id === -1) &&
    date(b.received_date) && date(b.expiry_date) && typeof b.eligible === "boolean" && strings(b.exclusion_reasons) &&
    ["quantity", "allocated_quantity", "remaining_quantity"].every((key) => number(b[key]))) &&
    Array.isArray(d.batch_allocations) && d.batch_allocations.every((a) => integer(a.order_id) && batchId(a.batch_id) &&
      materialUnit(a) && number(a.quantity) && date(a.needed_by) && date(a.use_by_date)) &&
    Array.isArray(d.shortages) && d.shortages.every((s) => integer(s.order_id) && materialUnit(s) && number(s.quantity) && date(s.needed_by)) &&
    Array.isArray(d.recommendations) && d.recommendations.every((r, index) => r.priority === index + 1 &&
      material.get(r.raw_material_id)?.ingredient_id === r.ingredient_id && riskTypes.has(r.risk_type) &&
      (r.urgent_by === null || date(r.urgent_by)) && text(r.action) && text(r.explanation)));
  return d;
}

export async function loadLocalPlan(horizon = 7, options = {}) {
  requireValid(integer(horizon) && horizon <= 28);
  return validateLocalPlan(await requestJSON(`local-plan/?horizon_days=${horizon}`, options));
}

export async function loadLocalScenario(purchase, options = {}) {
  const d = await requestJSON("local-scenario/", { ...options, body: purchase });
  requireValid(d?.api_version === "1" && d.mode === "local_purchase_scenario" && strings(d.warnings) && units.has(d.purchase?.unit));
  validateLocalPlan(d.baseline);
  validateLocalPlan(d.scenario, { scenario: true });
  requireValid(d.baseline.window.start_date === d.scenario.window.start_date && d.baseline.window.end_date === d.scenario.window.end_date);
  return d;
}
