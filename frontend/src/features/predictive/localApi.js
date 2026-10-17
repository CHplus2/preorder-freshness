import { requestJSON } from "./api.js";

const number = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v) => Number.isInteger(v) && v > 0;
const count = (v) => Number.isInteger(v) && v >= 0;
const text = (v) => typeof v === "string" && v.length > 0;
const strings = (v) =>
  Array.isArray(v) && v.every((s) => typeof s === "string");
const nullable = (v) => v === null || number(v);
const units = new Set(["g", "kg", "ml", "l", "unit"]);
const riskTypes = new Set([
  "none",
  "shortage",
  "expiry_surplus",
  "expiry_surplus_and_shortage",
]);
const date = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
function requireValid(condition) {
  if (!condition)
    throw new Error(
      "Kitchen API response does not match the local planning contract. Refresh or contact the backend team.",
    );
}

export function validateLocalPlan(d, { scenario = false } = {}) {
  requireValid(
    d?.api_version === "1" &&
      d.mode === "local_plan" &&
      d.model_status === "not_used" &&
      d.sources?.demand === "CONFIRMED_PAID_PREORDERS" &&
      d.sources?.product_mapping === "ACCEPTED_ORDER_RECIPES" &&
      d.sources?.operational ===
        (scenario ? "DATABASE_WITH_HYPOTHETICAL_PURCHASE" : "DATABASE") &&
      date(d.as_of) &&
      text(d.timezone) &&
      strings(d.warnings) &&
      date(d.window?.start_date) &&
      date(d.window?.end_date) &&
      d.window.start_date <= d.window.end_date &&
      integer(d.window.horizon_days) &&
      d.window.horizon_days <= 28 &&
      [
        "active_orders",
        "included_orders",
        "excluded_orders",
        "positive_batches",
        "eligible_batches",
        "hypothetical_batches",
      ].every((key) => count(d.coverage?.[key])),
  );
  requireValid(
    Array.isArray(d.ingredient_risks) &&
      d.ingredient_risks.every(
        (r) =>
          integer(r.raw_material_id) &&
          r.ingredient_id === `raw-material-${r.raw_material_id}` &&
          text(r.ingredient_name) &&
          units.has(r.unit) &&
          riskTypes.has(r.risk_type) &&
          [
            "confirmed_requirement",
            "eligible_stock",
            "allocated_quantity",
            "shortfall_quantity",
            "expiring_unused_quantity",
          ].every((key) => number(r[key])) &&
          nullable(r.potential_waste_cost_myr) &&
          nullable(r.estimated_purchase_cost_myr) &&
          (r.urgent_by === null || date(r.urgent_by)) &&
          text(r.action) &&
          text(r.explanation),
      ) &&
      new Set(d.ingredient_risks.map((r) => r.raw_material_id)).size ===
        d.ingredient_risks.length,
  );
  const material = new Map(
    d.ingredient_risks.map((r) => [r.raw_material_id, r]),
  );
  const materialUnit = (r) => material.get(r.raw_material_id)?.unit === r.unit;
  const batchId = (id) => integer(id) || (scenario && id === -1);
  requireValid(
    Array.isArray(d.included_orders) &&
      d.included_orders.every(
        (o) =>
          integer(o.order_id) &&
          integer(o.portions) &&
          date(o.preparation_date) &&
          date(o.use_by_date) &&
          Array.isArray(o.items) &&
          o.items.every(
            (i) =>
              (i.product_id === null || integer(i.product_id)) &&
              text(i.product_name) &&
              integer(i.quantity),
          ) &&
          Array.isArray(o.requirements) &&
          o.requirements.every((r) => materialUnit(r) && number(r.quantity)),
      ) &&
      Array.isArray(d.excluded_orders) &&
      d.excluded_orders.every((o) => integer(o.order_id) && text(o.reason)) &&
      d.coverage.included_orders === d.included_orders.length &&
      d.coverage.excluded_orders === d.excluded_orders.length &&
      d.coverage.active_orders ===
        d.included_orders.length + d.excluded_orders.length,
  );
  requireValid(
    Array.isArray(d.batches) &&
      d.batches.every(
        (b) =>
          batchId(b.batch_id) &&
          materialUnit(b) &&
          typeof b.hypothetical === "boolean" &&
          b.hypothetical === (b.batch_id === -1) &&
          date(b.received_date) &&
          date(b.expiry_date) &&
          typeof b.eligible === "boolean" &&
          strings(b.exclusion_reasons) &&
          ["quantity", "allocated_quantity", "remaining_quantity"].every(
            (key) => number(b[key]),
          ),
      ) &&
      Array.isArray(d.batch_allocations) &&
      d.batch_allocations.every(
        (a) =>
          integer(a.order_id) &&
          batchId(a.batch_id) &&
          materialUnit(a) &&
          number(a.quantity) &&
          date(a.needed_by) &&
          date(a.use_by_date),
      ) &&
      Array.isArray(d.shortages) &&
      d.shortages.every(
        (s) =>
          integer(s.order_id) &&
          materialUnit(s) &&
          number(s.quantity) &&
          date(s.needed_by),
      ) &&
      Array.isArray(d.recommendations) &&
      d.recommendations.every(
        (r, index) =>
          r.priority === index + 1 &&
          material.get(r.raw_material_id)?.ingredient_id === r.ingredient_id &&
          riskTypes.has(r.risk_type) &&
          (r.urgent_by === null || date(r.urgent_by)) &&
          text(r.action) &&
          text(r.explanation),
      ),
  );
  return d;
}

export async function loadLocalPlan(horizon = 7, options = {}) {
  requireValid(integer(horizon) && horizon <= 28);
  return validateLocalPlan(
    await localRequest(`local-plan/?horizon_days=${horizon}`, options),
  );
}

export function validateDecisionPlan(data, options = {}) {
  validateLocalPlan(data, options);
  const d = data.decision_support;
  if (d?.synthetic_history_items !== undefined) requireValid(count(d.synthetic_history_items));
  if (Array.isArray(d?.menus)) d.menus.forEach(m=>{
    if(m?.synthetic_history_items !== undefined) requireValid(count(m.synthetic_history_items));
    if(m?.demand_adjustments !== undefined) requireValid(['delivery_day_excluded','lead_time_excluded','capacity_excluded','recorded_orders_offset'].every(k=>number(m.demand_adjustments?.[k])));
  });
  if(Array.isArray(d?.ingredient_risks)) d.ingredient_risks.forEach(r=>{
    if(r?.stock_flow===undefined)return;
    const f=r.stock_flow;
    requireValid(f && ['opening_quantity','confirmed_allocated','after_confirmed','forecast_consumed','projected_total_remaining','projected_expiring_unused','projected_carried_stock'].every(k=>number(f[k])) &&
      Array.isArray(f.batches) && f.batches.every(b=>Number.isInteger(b.batch_id) && b.batch_id!==0 && integer(b.raw_material_id) && b.unit===r.unit && date(b.expiry_date) &&
        ['opening_quantity','confirmed_allocated','after_confirmed','forecast_consumed','projected_remaining'].every(k=>number(b[k])) && typeof b.expires_in_window==='boolean' && nullable(b.unit_cost)) &&
      Array.isArray(f.allocations) && f.allocations.every(a=>date(a.date) && Number.isInteger(a.batch_id) && integer(a.raw_material_id) && number(a.quantity)));
  });
  requireValid(
    d?.source === "LOCAL_KITCHEN" &&
      strings(d.assumptions) &&
      count(d.alert_count) &&
      count(d.review_count) &&
      Array.isArray(d.menus) &&
      d.menus.every(
        (m) =>
          integer(m.product_id) &&
          text(m.product_name) &&
          ["mean_28", "mean_7", "same_weekday"].includes(m.method) &&
          count(m.history_days) &&
          nullable(m.forecast_portions) &&
          nullable(m.variable_cost_myr) &&
          nullable(m.additional_forecast_portions) &&
          typeof m.recipe_complete === "boolean" &&
          (m.evaluation === null ||
            (integer(m.evaluation?.train_days) &&
              integer(m.evaluation?.validation_days) &&
              integer(m.evaluation?.test_days) &&
              m.evaluation.test &&
              ["mean_28", "mean_7", "same_weekday"].every(
                (k) =>
                  number(m.evaluation.test[k]?.mae) &&
                  nullable(m.evaluation.test[k]?.wape_percent) &&
                  (m.evaluation.test[k].daily_actual === undefined ||
                    (Array.isArray(m.evaluation.test[k].daily_actual) &&
                      m.evaluation.test[k].daily_actual.every(number) &&
                      Array.isArray(m.evaluation.test[k].daily_predictions) &&
                      m.evaluation.test[k].daily_predictions.every(number) &&
                      m.evaluation.test[k].daily_actual.length ===
                        m.evaluation.test[k].daily_predictions.length)),
              ))) &&
          number(m.price_myr) &&
          ["evaluated", "limited", "unavailable"].includes(m.confidence) &&
          Array.isArray(m.history),
      ) &&
      Array.isArray(d.ingredient_risks) &&
      d.ingredient_risks.every(
        (r) =>
          integer(r.raw_material_id) &&
          data.ingredient_risks.some(
            (original) =>
              original.ingredient_id === r.ingredient_id &&
              original.unit === r.unit &&
              original.raw_material_id === r.raw_material_id,
          ) &&
          ["confirmed_shortage", "forecast_waste", "review", "watch"].includes(
            r.signal,
          ) &&
          text(r.alert_reason) &&
          [
            "forecast_requirement",
            "forecast_shortfall",
            "forecast_expiring_unused",
            "waste_sensitivity_low",
            "waste_sensitivity_high",
          ].every((k) => number(r[k])) &&
          nullable(r.forecast_waste_cost_myr) &&
          Array.isArray(r.menus) &&
          r.menus.every(
            (m) =>
              integer(m.product_id) &&
              text(m.product_name) &&
              number(m.quantity_per_portion),
          ),
      ),
  );
  requireValid(
    d.ingredient_risks.length === data.ingredient_risks.length &&
      new Set(d.ingredient_risks.map((r) => r.raw_material_id)).size ===
        d.ingredient_risks.length,
  );
  return data;
}

export async function loadLocalDecisionPlan(horizon = 7, options = {}) {
  requireValid(integer(horizon) && horizon <= 28);
  return validateDecisionPlan(
    await localRequest(`local-decisions/?horizon_days=${horizon}`, options),
  );
}

export async function loadLocalDecisionScenario(purchase, options = {}) {
  const data = await localRequest("local-decision-scenario/", {
    ...options,
    body: purchase,
  });
  requireValid(
    data?.mode === "local_purchase_scenario" && units.has(data.purchase?.unit),
  );
  validateDecisionPlan(data.baseline);
  validateDecisionPlan(data.scenario, { scenario: true });
  requireValid(
    data.baseline.window.start_date === data.scenario.window.start_date &&
      data.baseline.window.end_date === data.scenario.window.end_date &&
      data.baseline.window.horizon_days === data.scenario.window.horizon_days,
  );
  return data;
}

export function validateLocalForecast(data) {
  if (data?.synthetic_history_orders !== undefined) requireValid(count(data.synthetic_history_orders));
  requireValid(
    data?.api_version === "1" &&
      data.source === "LOCAL_KITCHEN" &&
      ["insufficient_history", "baseline_only", "evaluated"].includes(
        data.status,
      ) &&
      date(data.forecast_week_start) &&
      count(data.eligible_orders) &&
      count(data.history_weeks) &&
      count(data.estimated_date_orders) &&
      nullable(data.next_week_portions) &&
      strings(data.warnings) &&
      Array.isArray(data.history) &&
      data.history.every(
        (r) => date(r.week_start) && count(r.orders) && number(r.portions),
      ) &&
      (data.selected_method === null || text(data.selected_method)),
  );
  if (data.baseline !== undefined)
    requireValid(
      data.baseline?.method === "moving_average_4_weeks" &&
        nullable(data.baseline.next_week_portions),
    );
  if (data.database_coverage !== undefined)
    requireValid(
      count(data.database_coverage?.total_orders) &&
        data.database_coverage.by_status &&
        Object.values(data.database_coverage.by_status).every(count),
    );
  if (data.recorded_preorders !== undefined)
    requireValid(
      text(data.recorded_preorders?.target) &&
        count(data.recorded_preorders.eligible_orders) &&
        count(data.recorded_preorders.history_weeks) &&
        nullable(data.recorded_preorders.next_week_portions) &&
        Array.isArray(data.recorded_preorders.history) &&
        data.recorded_preorders.history.every(
          (r) => date(r.week_start) && count(r.orders) && number(r.portions),
        ),
    );
  if (data.recent_orders !== undefined)
    requireValid(
      Array.isArray(data.recent_orders) &&
        data.recent_orders.every(
          (r) =>
            integer(r.order_id) &&
            date(r.sales_date) &&
            text(r.status) &&
            text(r.payment_status) &&
            number(r.portions) &&
            ["delivery_at", "preorder_date_fallback"].includes(r.date_basis),
        ),
    );
  requireValid(
    data.history_weeks === data.history.length &&
      data.estimated_date_orders <= data.eligible_orders,
  );
  const methods = [
    "moving_average_4_weeks",
    "last_week",
    "ridge_autoregression",
  ];
  requireValid(
    data.status === "insufficient_history"
      ? data.next_week_portions === null && data.selected_method === null
      : number(data.next_week_portions) &&
          methods.includes(data.selected_method),
  );
  if (data.status === "baseline_only")
    requireValid(data.selected_method === "moving_average_4_weeks");
  if (data.status === "evaluated")
    requireValid(
      data.evaluation &&
        date(data.evaluation.test_start) &&
        date(data.evaluation.test_end) &&
        ["train_weeks", "validation_weeks", "test_weeks"].every((k) =>
          integer(data.evaluation[k]),
        ) &&
        data.evaluation.test &&
        ["moving_average_4_weeks", "last_week", "ridge_autoregression"].every(
          (m) =>
            number(data.evaluation.test[m]?.mae_portions_per_week) &&
            nullable(data.evaluation.test[m]?.wape_percent),
        ),
    );
  return data;
}

export async function loadLocalForecast(options = {}) {
  return validateLocalForecast(await localRequest("local-forecast/", options));
}

export async function loadLocalScenario(purchase, options = {}) {
  const d = await localRequest("local-scenario/", {
    ...options,
    body: purchase,
  });
  requireValid(
    d?.api_version === "1" &&
      d.mode === "local_purchase_scenario" &&
      strings(d.warnings) &&
      units.has(d.purchase?.unit),
  );
  validateLocalPlan(d.baseline);
  validateLocalPlan(d.scenario, { scenario: true });
  requireValid(
    d.baseline.window.start_date === d.scenario.window.start_date &&
      d.baseline.window.end_date === d.scenario.window.end_date,
  );
  return d;
}

async function localRequest(path, options) {
  try {
    return await requestJSON(path, options);
  } catch (error) {
    if (error.code === "invalid_parameters")
      error.message =
        "Check the planning window, purchase quantity, unit cost and dates. Arrival must be within the window and expiry must be on or after arrival.";
    throw error;
  }
}
