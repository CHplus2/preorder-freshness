import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadOptions,
  loadDashboard,
  validateDashboard,
  requestJSON,
} from "./api.js";
const selection = {
  menu_item_id: "nasi-lemak",
  fulfillment_center_id: "north",
  scenario: "baseline",
};
test("demo provenance and menu/center/promotion filters", async () => {
  assert.equal((await loadOptions({ mode: "demo" })).menu_items.length, 2);
  const d = await loadDashboard(selection, { mode: "demo" });
  assert.equal(d.source, "mock");
  for (const change of [
    { menu_item_id: "chicken-rice" },
    { fulfillment_center_id: "south" },
    { scenario: "promotion" },
  ])
    assert.notEqual(
      (await loadDashboard({ ...selection, ...change }, { mode: "demo" }))
        .forecast[4].predicted_demand,
      d.forecast[4].predicted_demand,
    );
});
test("live query, credentials and model provenance", async () => {
  const d = await loadDashboard(selection, { mode: "demo" });
  d.source = "model";
  const result = await loadDashboard(selection, {
    mode: "live",
    fetchImpl: async (url, opts) => {
      assert.equal(
        new URL(url, "http://local").searchParams.get("menu_item_id"),
        "nasi-lemak",
      );
      assert.equal(opts.credentials, "include");
      return { ok: true, json: async () => d };
    },
  });
  assert.equal(result.source, "model");
});
test("API failure never falls back to demo", async () => {
  for (const status of [401, 403, 404, 500])
    await assert.rejects(
      loadDashboard(selection, {
        mode: "live",
        fetchImpl: async () => ({ ok: false, status }),
      }),
    );
  const d = await loadDashboard(selection, { mode: "demo" });
  await assert.rejects(
    loadDashboard(selection, {
      mode: "live",
      fetchImpl: async () => ({ ok: true, json: async () => d }),
    }),
    /demo data/,
  );
});
test("malformed data and mismatched selections are rejected", async () => {
  const d = await loadDashboard(selection, { mode: "demo" });
  for (const mutate of [
    (v) => (v.forecast[4].lower_bound = 9999),
    (v) => delete v.inventory_risks[0].projected_loss,
    (v) => (v.menu_item_id = "wrong"),
    (v) => (v.forecast[0].actual_demand = -1),
    (v) => (v.forecast[0].week_start = "invalid"),
  ]) {
    const copy = structuredClone(d);
    mutate(copy);
    assert.throws(() => validateDashboard(copy, selection));
  }
});
test("empty results and recorded zero remain valid", async () => {
  const d = await loadDashboard(selection, { mode: "demo" });
  d.forecast = [];
  d.inventory_risks = [];
  d.recommendations = [];
  d.comparison.baseline.projected_loss = 0;
  assert.equal(
    validateDashboard(d, selection).comparison.baseline.projected_loss,
    0,
  );
  assert.deepEqual(
    await loadOptions({
      mode: "live",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ menu_items: [], fulfillment_centers: [] }),
      }),
    }),
    { menu_items: [], fulfillment_centers: [] },
  );
});
test("aborts and non-JSON errors are preserved", async () => {
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    loadDashboard(selection, { mode: "demo", signal: c.signal }),
    { name: "AbortError" },
  );
  await assert.rejects(
    requestJSON("/test", {
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw Error("HTML");
        },
      }),
    }),
    /JSON/,
  );
});
