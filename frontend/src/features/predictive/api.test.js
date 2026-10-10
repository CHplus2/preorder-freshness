import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadOptions,
  loadDashboard,
  validateForecast,
  validateCenters,
  validateMetrics,
  rankRisks,
} from "./api.js";
import { demoForecast, demoCenters, demoMetrics } from "./mockData.js";
const selection = { center_id: 13, week: 146, promotion_scenario: false };
const reply = (data) => ({ ok: true, json: async () => structuredClone(data) });
test("five endpoints use v1 fields, integer IDs, session cookies and CSRF POST", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.credentials, "include");
    if (url.endsWith("centers/")) return reply(demoCenters);
    if (url.endsWith("metrics/")) return reply(demoMetrics);
    if (url.endsWith("what-if/")) {
      assert.equal(options.method, "POST");
      assert.equal(options.headers["X-CSRFToken"], "test-csrf");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(options.body), {
        ...selection,
        promotion_scenario: true,
      });
      return reply(demoForecast({ ...selection, promotion_scenario: true }));
    }
    const query = new URL(url, "http://local").searchParams;
    assert.deepEqual(Object.fromEntries(query), {
      center_id: "13",
      week: "146",
    });
    assert.equal(options.method, "GET");
    return reply(demoForecast(selection));
  };
  await loadOptions({ fetchImpl });
  await loadDashboard(selection, { fetchImpl });
  await loadDashboard(selection, { fetchImpl, view: "inventory" });
  const result = await loadDashboard(
    { ...selection, promotion_scenario: true },
    { fetchImpl, csrfToken: "test-csrf" },
  );
  assert.equal(result.baseline.promotion_scenario, false);
  assert.equal(result.scenario.promotion_scenario, true);
  assert.equal(new Set(calls.map((c) => c.url.split("?")[0])).size, 5);
});
test("forecast week comes from centers, not fixture constant", async () => {
  const options = await loadOptions({
    fetchImpl: async (url) =>
      reply(
        url.endsWith("centers/")
          ? { ...demoCenters, forecast_week: 222 }
          : demoMetrics,
      ),
  });
  const chosen = { ...selection, week: options.centers.forecast_week };
  await loadDashboard(chosen, {
    fetchImpl: async (url) => {
      assert.match(url, /week=222/);
      return reply(demoForecast(chosen));
    },
  });
});
test("unknown costs and zero estimates are preserved, risk ranking follows backend", () => {
  const d = demoForecast(selection);
  d.meal_forecasts[0].predicted_orders = 0;
  assert.equal(
    validateForecast(d, selection).meal_forecasts[0].predicted_orders,
    0,
  );
  assert.equal(d.ingredient_risks[1].potential_waste_cost_myr, null);
  const rows = [
    {
      ingredient_id: "unknown",
      potential_waste_cost_myr: null,
      expiring_unused_kg: 99,
      shortfall_kg: 0,
    },
    {
      ingredient_id: "zero",
      potential_waste_cost_myr: 0,
      expiring_unused_kg: 0,
      shortfall_kg: 0,
    },
    {
      ingredient_id: "loss",
      potential_waste_cost_myr: 10,
      expiring_unused_kg: 0,
      shortfall_kg: 0,
    },
  ];
  assert.deepEqual(
    rankRisks(rows).map((r) => r.ingredient_id),
    ["loss", "zero", "unknown"],
  );
  assert.equal(rows[0].ingredient_id, "unknown");
});
test("mismatched selections, provenance, invalid JSON numbers and missing fields fail", () => {
  for (const change of [
    (d) => (d.center_id = 1),
    (d) => (d.week = 1),
    (d) => (d.promotion_scenario = true),
    (d) => (d.sources.operational = "REAL"),
    (d) => (d.meal_forecasts[0].predicted_orders = Infinity),
    (d) => (d.meal_forecasts[0].meal_id = "101"),
    (d) => delete d.ingredient_risks[0].shortfall_kg,
    (d) => (d.ingredient_risks[0].potential_waste_cost_myr = undefined),
    (d) => (d.batch_allocations[0].eligible = false),
  ]) {
    const d = demoForecast(selection);
    change(d);
    assert.throws(() => validateForecast(d, selection));
  }
  assert.throws(() => validateCenters({ ...demoCenters, forecast_week: true }));
  assert.throws(() =>
    validateMetrics({ ...demoMetrics, model_status: "unavailable" }),
  );
});
test("successful empty arrays remain distinct from missing prerequisites", () => {
  const d = demoForecast(selection);
  d.meal_forecasts = [];
  d.ingredient_risks = [];
  d.batch_allocations = [];
  assert.equal(validateForecast(d, selection).meal_forecasts.length, 0);
  assert.equal(
    validateCenters({ ...demoCenters, centers: [] }).centers.length,
    0,
  );
});
test("documented backend errors never fall back to fixtures or expose raw internals", async () => {
  for (const [status, code] of [
    [400, "invalid_parameters"],
    [422, "no_eligible_history"],
    [503, "source_data_unavailable"],
    [503, "model_unavailable"],
    [503, "operational_data_unavailable"],
  ]) {
    await assert.rejects(
      loadDashboard(selection, {
        fetchImpl: async () => ({
          ok: false,
          status,
          json: async () => ({ code, detail: "/secret/path traceback" }),
        }),
      }),
      (e) => e.code === code && !e.message.includes("/secret"),
    );
  }
  for (const status of [403, 404, 500])
    await assert.rejects(
      loadOptions({
        fetchImpl: async () => ({ ok: false, status, json: async () => ({}) }),
      }),
    );
});
test("promotion rejects absent CSRF and detects failed CSRF without fabricating results", async () => {
  await assert.rejects(
    loadDashboard(
      { ...selection, promotion_scenario: true },
      { fetchImpl: async () => reply(demoForecast(selection)) },
    ),
    /CSRF token/,
  );
  await assert.rejects(
    loadDashboard(
      { ...selection, promotion_scenario: true },
      {
        csrfToken: "stale",
        fetchImpl: async (url) =>
          url.endsWith("what-if/")
            ? {
                ok: false,
                status: 403,
                json: async () => ({ detail: "CSRF Failed: invalid" }),
              }
            : reply(demoForecast(selection)),
      },
    ),
    /CSRF verification/,
  );
});
test("fixture mode is explicit and aborted requests stay aborted", async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    loadDashboard(selection, { mode: "demo", signal: c.signal }),
    { name: "AbortError" },
  );
  let requests = 0;
  await loadOptions({
    mode: "demo",
    fetchImpl: async () => {
      requests++;
    },
  });
  await loadDashboard(selection, {
    mode: "demo",
    fetchImpl: async () => {
      requests++;
    },
  });
  assert.equal(requests, 0);
});
test("non-JSON responses and invalid selection input fail", async () => {
  await assert.rejects(
    loadOptions({
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw Error("HTML");
        },
      }),
    }),
    /JSON/,
  );
  await assert.rejects(
    loadDashboard({ ...selection, center_id: true }, { mode: "demo" }),
    /valid center/,
  );
});
