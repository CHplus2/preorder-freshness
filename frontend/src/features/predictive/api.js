import { demoCenters, demoMetrics, demoForecast } from "./mockData.js";
const BASE = "/api/admin/predictive/";
const number = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer = (v) => Number.isInteger(v) && v > 0;
const text = (v) => typeof v === "string" && v.length > 0;
const nullable = (v) => v === null || number(v);
const strings = (v) =>
  Array.isArray(v) && v.every((s) => typeof s === "string");
const fail = () => {
  throw new Error(
    "Predictive API response does not match contract version 1. Contact the backend team.",
  );
};
const envelope = (d) => d && d.api_version === "1" && strings(d.warnings);
export function validateCenters(d) {
  if (
    !envelope(d) ||
    !integer(d.forecast_week) ||
    !Array.isArray(d.centers) ||
    !d.centers.every(
      (c) => integer(c.center_id) && text(c.center_type) && number(c.op_area),
    ) ||
    new Set(d.centers.map((c) => c.center_id)).size !== d.centers.length
  )
    fail();
  return d;
}
export function validateMetrics(d) {
  if (
    !envelope(d) ||
    d.model_status !== "ready" ||
    !d.metrics ||
    ![
      "train_max_week",
      "validation_start_week",
      "validation_end_week",
      "train_rows",
      "validation_rows",
    ].every((k) => integer(d.metrics[k])) ||
    !["model_wape_percent", "lag1_baseline_wape_percent"].every((k) =>
      number(d.metrics[k]),
    ) ||
    typeof d.metrics.model_beats_baseline !== "boolean" ||
    typeof d.metrics.warning !== "string"
  )
    fail();
  return d;
}
export function validateForecast(
  d,
  { center_id, week, promotion_scenario = false },
) {
  if (
    !envelope(d) ||
    d.center_id !== center_id ||
    d.week !== week ||
    d.horizon_weeks !== 1 ||
    d.promotion_scenario !== promotion_scenario ||
    d.sources?.demand !== "GENPACT_HISTORICAL" ||
    d.sources?.operational !== "SIMULATED" ||
    d.sources?.product_mapping !== "UNMAPPED"
  )
    fail();
  if (
    !Array.isArray(d.meal_forecasts) ||
    !d.meal_forecasts.every(
      (r) =>
        r.center_id === center_id &&
        r.week === week &&
        integer(r.meal_id) &&
        number(r.predicted_orders),
    ) ||
    new Set(d.meal_forecasts.map((r) => r.meal_id)).size !==
      d.meal_forecasts.length
  )
    fail();
  if (
    !Array.isArray(d.ingredient_risks) ||
    !d.ingredient_risks.every(
      (r) =>
        text(r.ingredient_id) &&
        [
          "expiry_surplus",
          "shortage",
          "expiry_surplus_and_shortage",
          "none",
        ].includes(r.risk_type) &&
        [
          "forecast_demand_kg",
          "available_kg",
          "expiring_unused_kg",
          "shortfall_kg",
          "illustrative_reorder_kg",
        ].every((k) => number(r[k])) &&
        nullable(r.potential_waste_cost_myr) &&
        ["action", "explanation", "risk_inputs_note"].every((k) => text(r[k])),
    ) ||
    new Set(d.ingredient_risks.map((r) => r.ingredient_id)).size !==
      d.ingredient_risks.length
  )
    fail();
  if (
    !Array.isArray(d.batch_allocations) ||
    !d.batch_allocations.every(
      (r) =>
        text(r.batch_id) &&
        text(r.ingredient_id) &&
        integer(r.expiry_week) &&
        typeof r.eligible === "boolean" &&
        [null, "expired"].includes(r.exclusion_reason) &&
        number(r.consumed_kg) &&
        number(r.remaining_kg) &&
        nullable(r.potential_waste_cost_myr) &&
        (r.eligible
          ? r.exclusion_reason === null
          : r.exclusion_reason === "expired" && r.consumed_kg === 0),
    )
  )
    fail();
  return d;
}
const errors = {
  invalid_parameters:
    "The selected center or forecast week is unsupported. Refresh the available centers.",
  no_eligible_history:
    "This center has no eligible meal history for forecasting. Choose another center.",
  source_data_unavailable:
    "Genpact source data is not provisioned on this server. Ask the backend team to provision the verified bundle.",
  model_unavailable:
    "The evaluated model, metrics or ML dependencies are unavailable. Ask the backend team to provision the Django runtime.",
  operational_data_unavailable:
    "Simulated operational inputs are unavailable for this center. The initial bundle covers center 13 only.",
};
export async function requestJSON(
  path,
  { signal, fetchImpl = fetch, body, csrfToken } = {},
) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (body && !csrfToken)
    throw new Error(
      "A CSRF token is required for the nonpersistent scenario. Sign in again, then retry.",
    );
  const response = await fetchImpl(BASE + path, {
    signal,
    credentials: "include",
    method: body ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      ...(body
        ? { "Content-Type": "application/json", "X-CSRFToken": csrfToken }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Predictive API did not return JSON."
        : "Predictive API request failed. Retry or ask the backend team to check the deployment.",
    );
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      throw new Error(
        data?.detail?.startsWith("CSRF")
          ? "CSRF verification failed. Sign in again before running a scenario."
          : "Staff access is required. Sign in again to load predictive data.",
      );
    if (response.status === 404)
      throw new Error(
        "Predictive endpoints are not deployed on this server yet. Integrate the backend branch before using Live API.",
      );
    const error = new Error(
      errors[data?.code] ||
        "Predictive data could not be loaded. Please retry.",
    );
    error.code = data?.code;
    throw error;
  }
  return data;
}
export async function loadOptions({ mode = "live", ...options } = {}) {
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const [centers, metrics] =
    mode === "demo"
      ? [structuredClone(demoCenters), structuredClone(demoMetrics)]
      : await Promise.all([
          requestJSON("centers/", options),
          requestJSON("metrics/", options),
        ]);
  return {
    centers: validateCenters(centers),
    metrics: validateMetrics(metrics),
  };
}
export async function loadDashboard(
  selection,
  { mode = "live", view = "forecast", ...options } = {},
) {
  if (
    !integer(selection.center_id) ||
    !integer(selection.week) ||
    typeof selection.promotion_scenario !== "boolean"
  )
    throw new Error("Choose a valid center, week and scenario.");
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const { center_id, week, promotion_scenario } = selection;
  const query = new URLSearchParams({
    center_id: String(center_id),
    week: String(week),
  });
  const getBaseline = async () =>
    validateForecast(
      mode === "demo"
        ? demoForecast({ ...selection, promotion_scenario: false })
        : await requestJSON(
            `${view === "inventory" ? "inventory-risk" : "forecast"}/?${query}`,
            options,
          ),
      { ...selection, promotion_scenario: false },
    );
  const getScenario = async () =>
    validateForecast(
      mode === "demo"
        ? demoForecast(selection)
        : await requestJSON("what-if/", {
            ...options,
            body: { center_id, week, promotion_scenario },
          }),
      selection,
    );
  const [baseline, scenario] = await Promise.all([
    getBaseline(),
    promotion_scenario ? getScenario() : Promise.resolve(null),
  ]);
  return { baseline, scenario };
}
// Preserve backend prioritization rules; null cost is unknown, never zero.
export function rankRisks(rows) {
  return [...rows].sort(
    (a, b) =>
      (b.potential_waste_cost_myr ?? -1) - (a.potential_waste_cost_myr ?? -1) ||
      b.expiring_unused_kg - a.expiring_unused_kg ||
      b.shortfall_kg - a.shortfall_kg ||
      a.ingredient_id.localeCompare(b.ingredient_id),
  );
}
