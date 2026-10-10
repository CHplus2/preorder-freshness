// Explicit frontend fixtures matching contract v1. No model was run for these numbers.
export const demoCenters = {
  api_version: "1",
  forecast_week: 146,
  centers: [{ center_id: 13, center_type: "TYPE_A", op_area: 5 }],
  warnings: ["Frontend fixture center, not live data."],
};
export const demoMetrics = {
  api_version: "1",
  model_status: "ready",
  metrics: {
    train_max_week: 135,
    validation_start_week: 136,
    validation_end_week: 145,
    train_rows: 100,
    validation_rows: 10,
    model_wape_percent: 30,
    lag1_baseline_wape_percent: 36,
    model_beats_baseline: true,
    warning: "Illustrative metrics only; not evaluated model scores.",
  },
  warnings: ["Synthetic frontend fixture metrics."],
};
export function demoForecast({ center_id, week, promotion_scenario }) {
  const demand = promotion_scenario ? 230.5 : 210.25;
  return {
    api_version: "1",
    center_id,
    week,
    horizon_weeks: 1,
    promotion_scenario,
    sources: {
      demand: "GENPACT_HISTORICAL",
      operational: "SIMULATED",
      product_mapping: "UNMAPPED",
    },
    meal_forecasts: [
      { center_id, meal_id: 101, week, predicted_orders: demand },
      { center_id, meal_id: 102, week, predicted_orders: 170.75 },
    ],
    ingredient_risks: [
      {
        ingredient_id: "chicken",
        risk_type: "expiry_surplus",
        forecast_demand_kg: 28,
        available_kg: 46,
        expiring_unused_kg: 18,
        shortfall_kg: 0,
        potential_waste_cost_myr: 216,
        illustrative_reorder_kg: 0,
        action: "Defer replenishment",
        explanation:
          "Simulated expiring stock exceeds the forecast requirement.",
        risk_inputs_note: "Synthetic recipes and stock; weekly expiry buckets.",
      },
      {
        ingredient_id: "rice",
        risk_type: "shortage",
        forecast_demand_kg: 35,
        available_kg: 18,
        expiring_unused_kg: 0,
        shortfall_kg: 17,
        potential_waste_cost_myr: null,
        illustrative_reorder_kg: 19,
        action: "Review replenishment",
        explanation: "Expected ingredient need exceeds eligible stock.",
        risk_inputs_note: "Supplier lead time and prices are unverified.",
      },
    ],
    batch_allocations: [
      {
        batch_id: "fixture-chicken-1",
        ingredient_id: "chicken",
        expiry_week: week,
        eligible: true,
        exclusion_reason: null,
        consumed_kg: 28,
        remaining_kg: 18,
        potential_waste_cost_myr: 216,
      },
    ],
    warnings: [
      "All values are frontend fixtures, not actual model predictions.",
      "Promotion changes are hypothetical and do not establish causal uplift.",
    ],
  };
}
