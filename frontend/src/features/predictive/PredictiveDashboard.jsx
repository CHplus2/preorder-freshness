import { useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ShoppingCart, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getCookie } from "../../utils/cookieUtils";
import { loadOptions, loadDashboard, rankRisks } from "./api";
import "./predictive.css";
import DecisionAssistant from "./DecisionAssistant";
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const money = (n) =>
  n === null
    ? "Unknown cost"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(n);
const issues = {
  expiry_surplus: "Expiry surplus",
  shortage: "Supply shortage",
  expiry_surplus_and_shortage: "Expiry surplus + shortage",
  none: "No reported risk",
};
const tabs = [
  { id: "forecast", label: "Demand analytics", icon: Activity },
  { id: "inventory", label: "Inventory evidence", icon: AlertTriangle },
  { id: "decisions", label: "Decision assistant", icon: ShoppingCart },
];
function Empty({ text }) {
  return (
    <div className="pd-empty" role="status">
      <h2>No results</h2>
      <p>{text}</p>
    </div>
  );
}
function Warnings({ items }) {
  return (
    <aside className="pd-assumptions">
      <h2>Sources, warnings & limitations</h2>
      <ul>
        {[...new Set(items.filter(Boolean))].map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </aside>
  );
}
function Forecast({ baseline, scenario, meal, setMeal, isFixture }) {
  const rows = baseline.meal_forecasts.filter(
    (r) => meal === "all" || String(r.meal_id) === meal,
  );
  const byMeal = new Map(
    scenario?.meal_forecasts.map((r) => [r.meal_id, r]) || [],
  );
  const maximum = Math.max(
    1,
    ...rows.map((r) =>
      Math.max(
        r.predicted_orders,
        byMeal.get(r.meal_id)?.predicted_orders || 0,
      ),
    ),
  );
  return (
    <section className="pd-card">
      <div className="pd-section-heading">
        <div>
          <h2>Weekly meal demand</h2>
          <p>
            Genpact week {baseline.week} · one-week horizon · estimated orders,
            not bookings
          </p>
        </div>
        <span className="pd-tag">External meal IDs · unmapped</span>
      </div>
      <label>
        Genpact meal
        <select
          aria-label="Genpact meal"
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
        >
          <option value="all">All returned meals</option>
          {baseline.meal_forecasts.map((r) => (
            <option key={r.meal_id} value={r.meal_id}>
              Meal {r.meal_id}
            </option>
          ))}
        </select>
      </label>
      <p className="pd-note">
        These IDs are not Dapur Kita menu items. Historical series and
        uncertainty ranges are not supplied by API v1.
      </p>
      {!rows.length ? (
        <Empty text="No meal forecasts were returned for this selection." />
      ) : (
        <>
          <div className="pd-demand-bars" aria-label="Demand chart">
            {rows.map((r) => (
              <div key={r.meal_id}>
                <strong>Meal {r.meal_id}</strong>
                <div className="pd-bar">
                  <span
                    style={{
                      width: `${(r.predicted_orders / maximum) * 100}%`,
                    }}
                  />
                </div>
                <small>Baseline: {qty(r.predicted_orders)} orders</small>
                {scenario && (
                  <>
                    <div className="pd-bar pd-scenario-bar">
                      <span
                        style={{
                          width: `${((byMeal.get(r.meal_id)?.predicted_orders || 0) / maximum) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      Promotion scenario:{" "}
                      {byMeal.has(r.meal_id)
                        ? qty(byMeal.get(r.meal_id).predicted_orders)
                        : "Unavailable"}{" "}
                      orders
                    </small>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="pd-table-wrap">
            <table>
              <caption>
                Exact {isFixture ? "fixture" : "model"} estimates for week{" "}
                {baseline.week}
              </caption>
              <thead>
                <tr>
                  <th>Meal ID</th>
                  <th>Baseline orders</th>
                  {scenario && <th>Promotion scenario orders</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.meal_id}>
                    <td>{r.meal_id}</td>
                    <td>{qty(r.predicted_orders)}</td>
                    {scenario && (
                      <td>
                        {byMeal.has(r.meal_id)
                          ? qty(byMeal.get(r.meal_id).predicted_orders)
                          : "Unavailable"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
function Inventory({ data }) {
  return (
    <>
      <section className="pd-card">
        <h2>Ingredient risk · center {data.center_id}</h2>
        <p>
          Center-wide simulated stock and recipes; meal filtering does not
          change ingredient totals. Quantities are kilograms.
        </p>
        {!data.ingredient_risks.length ? (
          <Empty text="No ingredient risks were returned after calculation." />
        ) : (
          <div className="pd-table-wrap">
            <table>
              <caption>
                Priority follows known waste cost, expiring surplus, then
                shortfall
              </caption>
              <thead>
                <tr>
                  <th>Ingredient / issue</th>
                  <th>Forecast need</th>
                  <th>Eligible stock</th>
                  <th>Expiring unused</th>
                  <th>Shortfall</th>
                  <th>Potential waste cost</th>
                </tr>
              </thead>
              <tbody>
                {rankRisks(data.ingredient_risks).map((r) => (
                  <tr key={r.ingredient_id}>
                    <td>
                      <strong>{r.ingredient_id}</strong>
                      <small>{issues[r.risk_type]}</small>
                      <details>
                        <summary>Why at risk?</summary>
                        <p>{r.explanation}</p>
                        <p>{r.risk_inputs_note}</p>
                      </details>
                    </td>
                    <td>{qty(r.forecast_demand_kg)} kg</td>
                    <td>{qty(r.available_kg)} kg</td>
                    <td>{qty(r.expiring_unused_kg)} kg</td>
                    <td>{qty(r.shortfall_kg)} kg</td>
                    <td>{money(r.potential_waste_cost_myr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="pd-card">
        <h2>Hypothetical FEFO allocation</h2>
        <p>
          Expiry is an inclusive week bucket, not a calendar deadline or food
          safety assessment.
        </p>
        {!data.batch_allocations.length ? (
          <Empty text="No batch allocations were returned." />
        ) : (
          <div className="pd-table-wrap">
            <table>
              <caption>
                Simulated batch allocation · forecast week {data.week}
              </caption>
              <thead>
                <tr>
                  <th>Batch / ingredient</th>
                  <th>Expiry week</th>
                  <th>Eligibility</th>
                  <th>Consumed</th>
                  <th>Remaining</th>
                  <th>Potential waste cost</th>
                </tr>
              </thead>
              <tbody>
                {data.batch_allocations.map((r) => (
                  <tr key={r.batch_id}>
                    <td>
                      {r.batch_id}
                      <small>{r.ingredient_id}</small>
                    </td>
                    <td>{r.expiry_week}</td>
                    <td>
                      {r.eligible
                        ? "Eligible"
                        : `Excluded: ${r.exclusion_reason}`}
                    </td>
                    <td>{qty(r.consumed_kg)} kg</td>
                    <td>{qty(r.remaining_kg)} kg</td>
                    <td>{money(r.potential_waste_cost_myr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
function Decisions({ baseline, scenario, data }) {
  const rows = rankRisks(data.ingredient_risks).filter(
    (r) => r.risk_type !== "none",
  );
  return (
    <>
      <section className="pd-card">
        <h2>Purchasing decision support</h2>
        <p>
          Illustrative reorder quantities from simulated safety stock and
          eligible inventory. Supplier prices and lead times are unverified.
        </p>
        {rows.length ? (
          <ol className="pd-recommendations">
            {rows.map((r, i) => (
              <li key={r.ingredient_id}>
                <span className="pd-priority">{i + 1}</span>
                <div>
                  <h3>
                    {r.ingredient_id}
                    <span>{r.action}</span>
                  </h3>
                  <p>{r.explanation}</p>
                  <p>{r.risk_inputs_note}</p>
                  <div className="pd-rec-metrics">
                    <span>
                      Illustrative reorder
                      <strong>{qty(r.illustrative_reorder_kg)} kg</strong>
                    </span>
                    <span>
                      Expiring unused
                      <strong>{qty(r.expiring_unused_kg)} kg</strong>
                    </span>
                    <span>
                      Potential waste cost
                      <strong>{money(r.potential_waste_cost_myr)}</strong>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty text="No purchasing issues were reported for this center." />
        )}
      </section>
      <section className="pd-card">
        <h2>Baseline vs promotion scenario</h2>
        <p>
          This compares observational promotion flags, not baseline vs optimized
          purchasing. It cannot establish causal uplift, guaranteed savings or
          profit.
        </p>
        {scenario ? (
          <div className="pd-table-wrap">
            <table>
              <caption>
                Center-wide scenario comparison, week {baseline.week};
                operational inputs remain simulated
              </caption>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Baseline</th>
                  <th>Promotion scenario</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Predicted orders</td>
                  <td>
                    {qty(
                      baseline.meal_forecasts.reduce(
                        (s, r) => s + r.predicted_orders,
                        0,
                      ),
                    )}
                  </td>
                  <td>
                    {qty(
                      scenario.meal_forecasts.reduce(
                        (s, r) => s + r.predicted_orders,
                        0,
                      ),
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Expiring unused kg</td>
                  <td>
                    {qty(
                      baseline.ingredient_risks.reduce(
                        (s, r) => s + r.expiring_unused_kg,
                        0,
                      ),
                    )}
                  </td>
                  <td>
                    {qty(
                      scenario.ingredient_risks.reduce(
                        (s, r) => s + r.expiring_unused_kg,
                        0,
                      ),
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Potential waste cost</td>
                  <td>{loss(baseline.ingredient_risks)}</td>
                  <td>{loss(scenario.ingredient_risks)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Select the promotion what-if scenario to compare with the baseline.
          </p>
        )}
        <p className="pd-note">
          API v1 does not supply purchasing spend, optimized-decision totals,
          promotion costs or realized savings. Those comparisons remain
          unavailable.
        </p>
      </section>
    </>
  );
}
function loss(rows) {
  if (rows.length && rows.every((r) => r.potential_waste_cost_myr === null))
    return "Unknown total · costs unavailable";
  const known = rows.reduce((s, r) => s + (r.potential_waste_cost_myr ?? 0), 0);
  return rows.some((r) => r.potential_waste_cost_myr === null)
    ? `${money(known)} known subtotal · incomplete costs`
    : money(known);
}
export default function PredictiveDashboard({ view = "decisions" }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated === null || isAdmin === null)
    return (
      <main className="pd">
        <p role="status">Checking staff access…</p>
      </main>
    );
  if (!isAuthenticated || !isAdmin)
    return (
      <main className="pd">
        <h1>Staff access required</h1>
      </main>
    );
  return <DashboardContent view={view} />;
}
function DashboardContent({ view }) {
  const [params, setParams] = useSearchParams();
  const mode = params.get("source") === "demo" ? "demo" : "live";
  const center = params.get("center") || "";
  const promo = params.get("scenario") === "promotion";
  const meal = params.get("meal") || "all";
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({});
  const key = JSON.stringify([mode, center, promo, view, retry]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      let options;
      try {
        options = await loadOptions({ mode, signal: controller.signal });
        if (!options.centers.centers.length) {
          if (!controller.signal.aborted)
            setState({ key, status: "empty", options });
          return;
        }
        const center_id = center
          ? Number(center)
          : (options.centers.centers.find((c) => c.center_id === 13)
              ?.center_id ?? options.centers.centers[0].center_id);
        if (!options.centers.centers.some((c) => c.center_id === center_id))
          throw new Error(
            "Selected center is not available. Choose a listed center.",
          );
        const result = await loadDashboard(
          {
            center_id,
            week: options.centers.forecast_week,
            promotion_scenario: promo,
          },
          {
            mode,
            view,
            signal: controller.signal,
            csrfToken: getCookie("csrftoken"),
          },
        );
        if (!controller.signal.aborted)
          setState({ key, status: "ready", options, ...result });
      } catch (e) {
        if (!controller.signal.aborted)
          setState({ key, status: "error", error: e.message, options });
      }
    }
    load();
    return () => controller.abort();
  }, [mode, center, promo, view, retry, key]);
  function choose(name, value) {
    const next = new URLSearchParams(params);
    next.set(name, value);
    if (name === "center" || name === "source") {
      for (const field of ["meal", "ingredient", "step", "action"])
        next.delete(field);
    }
    if (name === "scenario") next.set("step", "3");
    if (name === "source") next.delete("center");
    setParams(next, { replace: true });
  }
  const current = state.key === key ? state : { status: "loading" };
  const options = current.options;
  const data = current.scenario || current.baseline;
  const metrics = options?.metrics.metrics;
  return (
    <main className={`pd ${view === "decisions" ? "pd-visual" : ""}`}>
      <header className="pd-header">
        <div>
          <span className="pd-eyebrow">
            DORMATHON 2026 · DEMAND & INVENTORY INTELLIGENCE
          </span>
          <h1>A fresher kitchen starts with one good decision.</h1>
          <p>
            Start with an ingredient problem, explore your options, and review
            the reasoning before deciding.
          </p>
        </div>
        <button onClick={() => setRetry((n) => n + 1)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      <div className={`pd-source ${mode}`} role="status">
        <strong>
          {mode === "live"
            ? "LIVE API · Model demand / SIMULATED operations"
            : "FRONTEND FIXTURES · No model run"}
        </strong>
        <p>
          {mode === "live"
            ? "Genpact meal IDs are unmapped to Dapur Kita products. Recipes, stock, costs and supplier settings are simulated. No demo fallback is used."
            : "All displayed demand, metrics and operations are synthetic frontend fixtures, not actual model predictions."}
        </p>
      </div>
      <details className="fc-context" open={view !== "decisions"}>
        <summary>
          Kitchen context & data source ·{" "}
          {data
            ? `Center ${data.center_id}, week ${data.week}`
            : "configure this session"}
        </summary>
        <div className="pd-controls">
          <label>
            Data source
            <select
              aria-label="Data source"
              value={mode}
              onChange={(e) => choose("source", e.target.value)}
            >
              <option value="live">Live API</option>
              <option value="demo">Frontend fixtures</option>
            </select>
          </label>
          <label>
            Fulfillment center
            <select
              aria-label="Fulfillment center"
              disabled={!options?.centers.centers.length}
              value={
                center ||
                (data?.center_id ??
                  options?.centers.centers.find((c) => c.center_id === 13)
                    ?.center_id ??
                  options?.centers.centers[0]?.center_id ??
                  "")
              }
              onChange={(e) => choose("center", e.target.value)}
            >
              {!options && <option value="">Loading centers</option>}
              {options?.centers.centers.map((c) => (
                <option key={c.center_id} value={c.center_id}>
                  Center {c.center_id} · {c.center_type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Forecast horizon
            <input
              aria-label="Forecast horizon"
              readOnly
              value={
                options
                  ? `Week ${options.centers.forecast_week} · 1 week`
                  : "Not loaded"
              }
            />
          </label>
          <label>
            Nonpersistent scenario
            <select
              aria-label="Nonpersistent scenario"
              value={promo ? "promotion" : "baseline"}
              onChange={(e) => choose("scenario", e.target.value)}
            >
              <option value="baseline">Baseline · no promotion</option>
              <option value="promotion">Promotion · what-if simulation</option>
            </select>
          </label>
        </div>
      </details>
      <div className="pd-tabs" aria-label="Predictive dashboards">
        {[tabs[2], tabs[0], tabs[1]].map(({ id, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={{
              pathname: `/admin/ai/${id}`,
              search: params.toString() ? `?${params}` : "",
            }}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </div>
      {current.status === "loading" && (
        <div className="pd-state" role="status">
          Loading predictive API data…
        </div>
      )}
      {current.status === "error" && (
        <div className="pd-state" role="alert">
          <AlertTriangle />
          <h2>Unable to load this dashboard</h2>
          <p>{current.error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      {current.status === "empty" && (
        <Empty text="No fulfillment centers were returned." />
      )}
      {current.status === "ready" && (
        <>
          <div className="pd-context">
            <span>
              Center {data.center_id} · Genpact week {data.week} ·{" "}
              {data.horizon_weeks}-week horizon
            </span>
            <strong>
              {data.promotion_scenario
                ? view === "decisions"
                  ? "Baseline issue · promotion comparison available"
                  : "WHAT-IF PROMOTION · NOT CAUSAL UPLIFT"
                : mode === "demo"
                  ? "Baseline fixture · no model run"
                  : "Baseline model forecast"}
            </strong>
          </div>
          {view === "forecast" ? (
            <Forecast
              isFixture={mode === "demo"}
              baseline={current.baseline}
              scenario={current.scenario}
              meal={meal}
              setMeal={(value) => choose("meal", value)}
            />
          ) : view === "inventory" ? (
            <Inventory data={data} />
          ) : (
            <>
              <DecisionAssistant
                baseline={current.baseline}
                scenario={current.scenario}
                onPromotion={() => {
                  if (promo) {
                    choose("step", "3");
                    setRetry((n) => n + 1);
                  } else choose("scenario", "promotion");
                }}
              />
              <details className="pd-card">
                <summary>
                  Secondary analytics · center-wide scenario comparison
                </summary>
                <Decisions
                  baseline={current.baseline}
                  scenario={current.scenario}
                  data={data}
                />
              </details>
            </>
          )}
        </>
      )}
      {metrics && (
        <details className="pd-card">
          <summary>Secondary analytics · model evaluation</summary>
          <section className="pd-card">
            <h2>
              {mode === "demo"
                ? "Fixture metrics · not evaluated"
                : "Model evaluation · returned metrics"}
            </h2>
            <div className="pd-comparison">
              <div>
                <h3>Model WAPE</h3>
                <strong>{qty(metrics.model_wape_percent)}%</strong>
              </div>
              <div>
                <h3>Lag-1 baseline WAPE</h3>
                <strong>{qty(metrics.lag1_baseline_wape_percent)}%</strong>
              </div>
            </div>
            <p>
              Validation weeks {metrics.validation_start_week}–
              {metrics.validation_end_week} · {qty(metrics.validation_rows)}{" "}
              rows. Lower WAPE is better. Model beats baseline:{" "}
              {metrics.model_beats_baseline ? "yes" : "no"}.
            </p>
            <p className="pd-note">
              Aggregate holdout error is not an uncertainty interval for an
              individual meal.
            </p>
          </section>
        </details>
      )}
      <Warnings
        items={[
          "External Genpact weekly demand; no verified mapping to local menu items.",
          "Inventory risks are center-wide and are not filtered by the selected meal.",
          "No orders, purchases or stock changes are executed. Weekly expiry is not proof of food safety.",
          ...(options?.centers.warnings || []),
          ...(options?.metrics.warnings || []),
          metrics?.warning || "",
          ...(data?.warnings || []),
          ...(current.scenario ? current.baseline.warnings : []),
        ]}
      />
    </main>
  );
}
