import { problemSummary } from "./problemSummary.js";
// Presentation only: keep each source's meaning and native quantities intact.
export function ingredientPresentation(risk, local = false) {
  return {
    id: risk.ingredient_id,
    name: local ? risk.ingredient_name : risk.ingredient_id,
    unit: local ? risk.unit : "kg",
    need: local ? risk.confirmed_requirement : risk.forecast_demand_kg,
    stock: local ? risk.eligible_stock : risk.available_kg,
    waste: local ? risk.expiring_unused_quantity : risk.expiring_unused_kg,
    shortage: local ? risk.shortfall_quantity : risk.shortfall_kg,
    cost: risk.potential_waste_cost_myr,
    needLabel: local ? "Confirmed need" : "Forecast need",
    summary: local ? risk.explanation : problemSummary(risk),
  };
}
