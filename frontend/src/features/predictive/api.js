import { mockDashboard, mockOptions } from "./mockData.js";

const failure = () => {
  throw new Error(
    "The predictive API returned incomplete or invalid data. Ask the backend team to check the contract.",
  );
};
const string = (v) => typeof v === "string" && v.length > 0;
const number = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const nullable = (v) => v === null || number(v);
const date = (v) =>
  string(v) &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
export function validateOptions(data) {
  if (
    !data ||
    !["menu_items", "fulfillment_centers"].every(
      (key) =>
        Array.isArray(data[key]) &&
        data[key].every((v) => string(v.id) && string(v.name)) &&
        new Set(data[key].map((v) => v.id)).size === data[key].length,
    )
  )
    failure();
  return data;
}
export function validateDashboard(d, selection) {
  if (
    !d ||
    !["mock", "model"].includes(d.source) ||
    d.currency !== "MYR" ||
    !date(d.as_of_date) ||
    !string(d.generated_at) ||
    !Number.isFinite(Date.parse(d.generated_at)) ||
    !string(d.uncertainty_label) ||
    !Array.isArray(d.assumptions) ||
    !d.assumptions.every(string)
  )
    failure();
  if (
    !["menu_item_id", "fulfillment_center_id", "scenario"].every(
      (k) => d[k] === selection[k],
    )
  )
    failure();
  if (
    !Array.isArray(d.forecast) ||
    !d.forecast.every(
      (v) =>
        date(v.week_start) &&
        [
          "actual_demand",
          "predicted_demand",
          "lower_bound",
          "upper_bound",
        ].every((k) => nullable(v[k])) &&
        (v.actual_demand !== null || v.predicted_demand !== null) &&
        ((v.lower_bound === null && v.upper_bound === null) ||
          (number(v.lower_bound) &&
            number(v.upper_bound) &&
            number(v.predicted_demand) &&
            v.lower_bound <= v.predicted_demand &&
            v.predicted_demand <= v.upper_bound)),
    )
  )
    failure();
  if (
    !Array.isArray(d.inventory_risks) ||
    !d.inventory_risks.every(
      (v) =>
        ["ingredient_id", "ingredient_name", "unit", "reason"].every((k) =>
          string(v[k]),
        ) &&
        date(v.expiry_date) &&
        Number.isInteger(v.days_to_expiry) &&
        [
          "stock_quantity",
          "predicted_consumption",
          "surplus_quantity",
          "projected_loss",
        ].every((k) => number(v[k])) &&
        ["critical", "high", "medium", "low"].includes(v.urgency) &&
        ["expiry_surplus", "overstock", "stockout", "quality_hold"].includes(
          v.issue_category,
        ),
    )
  )
    failure();
  if (
    !Array.isArray(d.recommendations) ||
    !d.recommendations.every(
      (v) =>
        [
          "id",
          "ingredient_id",
          "ingredient_name",
          "unit",
          "action",
          "reason",
        ].every((k) => string(v[k])) &&
        Number.isInteger(v.priority) &&
        v.priority > 0 &&
        ["purchase_quantity", "projected_waste", "projected_loss"].every((k) =>
          number(v[k]),
        ),
    )
  )
    failure();
  if (
    !d.comparison ||
    !["baseline", "recommended"].every(
      (k) =>
        d.comparison[k] &&
        ["purchase_cost", "projected_loss"].every((f) =>
          number(d.comparison[k][f]),
        ),
    )
  )
    failure();
  return d;
}
export async function requestJSON(path, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(path, {
    signal,
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw new Error(
        "Staff access is required. Sign in again to load predictive data.",
      );
    if (response.status === 404)
      throw new Error(
        "Predictive API is not available yet. Select Demo data to explore the dashboard.",
      );
    throw new Error("Predictive data could not be loaded. Please retry.");
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Predictive API did not return JSON.");
  }
}
export async function loadOptions({ mode, signal, fetchImpl } = {}) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return validateOptions(
    mode === "demo"
      ? structuredClone(mockOptions)
      : await requestJSON("/api/predictive/options/", { signal, fetchImpl }),
  );
}
export async function loadDashboard(
  selection,
  { mode, signal, fetchImpl } = {},
) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const data =
    mode === "demo"
      ? mockDashboard(selection)
      : await requestJSON(
          "/api/predictive/dashboard/?" + new URLSearchParams(selection),
          { signal, fetchImpl },
        );
  if (mode !== "demo" && data.source !== "model")
    throw new Error(
      "The live API returned demo data. Select Demo data to view simulated results.",
    );
  return validateDashboard(data, selection);
}
