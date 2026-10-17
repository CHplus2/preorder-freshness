import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { loadLocalDecisionPlan } from "./localApi";
import KitchenDecisionJourney, { MenuEvidence } from "./KitchenDecisionJourney";
import RestaurantStations from "./RestaurantStations";
import KitchenForecast from "./KitchenForecast";
import KitchenReadiness from "./KitchenReadiness";
import "./localKitchen.css";
import PlanningFridge from "./PlanningFridge";
import { IngredientDrawing } from "./PantryScene";

const qty = (v) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 3 }).format(v);
const issues = {
  expiry_surplus: "Potential ingredient waste",
  shortage: "Confirmed-order shortage",
  expiry_surplus_and_shortage: "Waste and shortage exposure",
  none: "No reported issue",
};

export default function LocalKitchen({ view }) {
  const [params, setParams] = useSearchParams();
  const horizon = params.get("horizon") || "7";
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({});
  const [comparison, setComparison] = useState(null);
  const key = JSON.stringify([horizon, view, retry]);
  const validHorizon = /^(?:[1-9]|1[0-9]|2[0-8])$/.test(horizon);
  useEffect(() => {
    const controller = new AbortController();
    if (!validHorizon) {
      return () => controller.abort();
    }
    loadLocalDecisionPlan(Number(horizon), { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, status: "ready", data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, status: "error", error: error.message });
      });
    return () => controller.abort();
  }, [horizon, view, retry, key, validHorizon]);
  const current = !validHorizon
    ? { status: "error", error: "Choose a planning window from 1 to 28 days." }
    : state.key === key
      ? state
      : { status: "loading" };
  const pair = comparison?.key === key ? comparison.data : null;
  const plan = pair?.baseline || current.data;
  const demoBatchCount = plan?.batches.filter(b => b.batch_code?.startsWith('DEMO-FC-INV-')).length || 0;
  function choose(name, value) {
    const next = new URLSearchParams(params);
    next.set(name, value);
    for (const field of [
      "ingredient",
      "step",
      "action",
      "scenario",
      "center",
      "meal",
      "lens",
    ])
      next.delete(field);
    setComparison(null);
    setParams(next, { replace: true });
  }
  return (
    <main className="pd pd-visual">
      <header className="pd-header">
        <div>
          <span className="pd-eyebrow">FRESHCAST · YOUR KITCHEN</span>
          <h1>Less waste. A better kitchen plan.</h1>
          <p>Your confirmed preorders, accepted recipes and dated stock.</p>
        </div>
        <button
          onClick={() => {
            setComparison(null);
            setRetry((n) => n + 1);
          }}
        >
          <RefreshCw size={16} /> Refresh kitchen data
        </button>
      </header>
      <div className="pd-source live" role="status">
        <strong>
          MY KITCHEN · Local sales forecasts & confirmed-order planning
        </strong>
        <p>
          Forecasts use kitchen sales history. Stock requirements use confirmed
          orders and accepted recipes. Database records may include fictional
          demo transactions.
        </p>
        {demoBatchCount>0 && <p><strong>Fictional inventory scenario · {demoBatchCount} batches</strong>. Quantities and expiry dates are demo assumptions; costs use recorded estimates. Sales forecasts still use the existing kitchen history algorithm.</p>}
        {plan?.decision_support.synthetic_history_items>0 && <p><strong>Synthetic sales history is included.</strong> Generated daily summaries exercise the workflow. Forecast replay and evaluation scores on these patterns do not measure real customer accuracy.</p>}
      </div>
      <div className="pd-controls">
        <label>
          Data source
          <select
            aria-label="Data source"
            value="local"
            onChange={(e) => choose("source", e.target.value)}
          >
            <option value="local">My kitchen · database orders & stock</option>
            <option value="live">Genpact · evaluated model demo</option>
            <option value="demo">Frontend fixtures · no model run</option>
          </select>
        </label>
        <label>
          Planning window
          <select
            aria-label="Planning window"
            value={horizon}
            onChange={(e) => choose("horizon", e.target.value)}
          >
            {[1, 3, 7, 14, 28].map((n) => (
              <option key={n} value={n}>
                {n} day{n === 1 ? "" : "s"}
              </option>
            ))}
            {!["1", "3", "7", "14", "28"].includes(horizon) && (
              <option value={horizon}>{horizon} days</option>
            )}
          </select>
        </label>
      </div>
      <RestaurantStations
        params={params}
        baseline={plan}
        status={current.status}
        isLocal
      />
      {view === "forecast" ? (
        <KitchenForecast revision={retry} />
      ) : (
        view !== "inventory" && (
          <details className="pd-card">
            <summary>Local sales history & baseline evidence</summary>
            <KitchenForecast revision={retry} />
          </details>
        )
      )}
      {current.status === "loading" && (
        <p className="pd-state" role="status">
          Loading current orders, recipes and stock…
        </p>
      )}
      {current.status === "error" && (
        <section className="pd-state" role="alert">
          <h2>Unable to load kitchen data</h2>
          <p>{current.error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </section>
      )}
      {current.status === "ready" && (
        <>
          {view === "decisions" && <KitchenReadiness plan={plan} />}
          <div className="pd-context">
            <span>
              Stock planning: {plan.window.start_date}–{plan.window.end_date} ·{" "}
              {plan.timezone}
            </span>
            <strong>
              {plan.coverage.included_orders} orders ready for stock planning ·{" "}
              {plan.coverage.excluded_orders} need review or fall outside this
              window
            </strong>
          </div>
          {!plan.coverage.included_orders && (
            <details className="pd-card">
              <summary>
                No confirmed orders ready for stock allocation · review coverage
              </summary>
              <p>
                Your order history and local baseline are independent of this
                stock-planning filter. Review the reasons below before changing
                orders.
              </p>
              <ul>
                {Object.entries(
                  plan.excluded_orders.reduce(
                    (counts, order) => ({
                      ...counts,
                      [order.reason]: (counts[order.reason] || 0) + 1,
                    }),
                    {},
                  ),
                ).map(([reason, count]) => (
                  <li key={reason}>
                    {count} orders: {reason.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
              <Link to="/admin/orders">Review orders</Link> ·{" "}
              <Link to="/admin/planner">Review schedules</Link>
            </details>
          )}
          {view === "forecast" ? (
            <OrderEvidence plan={plan} />
          ) : view === "inventory" ? (
            <StockEvidence plan={plan} />
          ) : (
            <KitchenDecisionJourney
              key={key}
              plan={plan}
              comparison={pair}
              onComparison={(data) => setComparison({ key, data })}
              onClear={() => setComparison(null)}
            />
          )}
          <details className="pd-card">
            <summary>
              Order coverage & exclusions ({plan.excluded_orders.length})
            </summary>
            <p>
              Only paid, pending/processing orders with reviewed dates, complete
              accepted recipes and undeducted stock are included.
            </p>
            <ul>
              {plan.excluded_orders.map((o) => (
                <li key={o.order_id}>
                  Order #{o.order_id}: {o.reason.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
            <Link to="/admin/orders">Review orders</Link> ·{" "}
            <Link to="/admin/planner">Review preparation plans</Link>
          </details>
          <details className="pd-assumptions">
            <summary>Data sources & limitations</summary>
            <ul>
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </main>
  );
}

function OrderEvidence({ plan }) {
  return (
    <section className="pd-card">
      <h2>Menu demand estimates</h2>
      <p>Estimated portions come from paid, delivered sales history. Adding inventory enables stock projections, but does not create missing sales history.</p>
      <MenuEvidence support={plan.decision_support} />
      <h2>Confirmed preorder requirements</h2>
      <p>
        Known bookings, not predictions of future customers. Names and recipes
        are accepted order snapshots.
      </p>
      {!plan.included_orders.length && <p>No confirmed bookings qualify within this stock-planning window. Available menu forecasts above are separate from bookings.</p>}
      {plan.included_orders.map((o) => (
        <article key={o.order_id} className="local-order">
          <h3>
            Order #{o.order_id} · {o.portions} portions
          </h3>
          <p>
            Prepare {o.preparation_date} · ingredients usable through{" "}
            {o.use_by_date}
          </p>
          <ul>
            {o.items.map((i, index) => (
              <li key={index}>
                {i.product_name} × {i.quantity}
              </li>
            ))}
          </ul>
        </article>
      ))}
      <details>
        <summary>Exact ingredient requirements</summary>
        <RiskTable plan={plan} />
      </details>
    </section>
  );
}

function RiskTable({ plan }) {
  return (
    <div className="pd-table-wrap">
      <table>
        <caption>
          Ingredient requirements · native material units · backend priority
          order
        </caption>
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Confirmed need</th>
            <th>Eligible stock</th>
            <th>Allocated</th>
            <th>Shortfall</th>
            <th>Expiring unused</th>
            <th>Urgent by</th>
          </tr>
        </thead>
        <tbody>
          {plan.ingredient_risks.map((r) => (
            <tr key={r.ingredient_id}>
              <td>
                {r.ingredient_name}
                <small>{issues[r.risk_type]}</small>
              </td>
              {[
                "confirmed_requirement",
                "eligible_stock",
                "allocated_quantity",
                "shortfall_quantity",
                "expiring_unused_quantity",
              ].map((field) => (
                <td key={field}>
                  {qty(r[field])} {r.unit}
                </td>
              ))}
              <td>{r.urgent_by || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockEvidence({ plan }) {
  const [inspected, setInspected] = useState("");
  const selected =
    plan.decision_support.ingredient_risks.find(
      (r) => r.ingredient_id === inspected,
    ) || plan.decision_support.ingredient_risks[0];
  const names = new Map(
    plan.ingredient_risks.map((r) => [r.raw_material_id, r.ingredient_name]),
  );
  return (
    <>
      <section className="pd-card">
        <h2>Your kitchen planning fridge</h2>
        <p>
          Recorded stock, confirmed bookings and additional forecast demand
          retain their distinct meanings and native units.
        </p>
        <div className="local-fridge-inspection">
          <PlanningFridge
            count={plan.decision_support.ingredient_risks.length}
            evidenceLabel="database ingredient records"
          >
            <div className="local-fridge-packages">
              {plan.decision_support.ingredient_risks.map((r) => (
                <button
                  key={r.ingredient_id}
                  aria-label={`Inspect kitchen ingredient ${r.ingredient_name}`}
                  aria-pressed={selected?.ingredient_id === r.ingredient_id}
                  onClick={() => setInspected(r.ingredient_id)}
                >
                  <IngredientDrawing name={r.ingredient_name} />
                  <strong>{r.ingredient_name}</strong>
                  <span>
                    {qty(r.forecast_expiring_unused)} {r.unit} projected unused
                  </span>
                </button>
              ))}
            </div>
          </PlanningFridge>
          <aside aria-label="Selected kitchen ingredient">
            {selected ? (
              <>
                <h3>{selected.ingredient_name}</h3>
                <p>{selected.alert_reason}</p>
                <dl>
                  {[
                    ["Extra forecast need", selected.forecast_requirement],
                    [
                      "Projected unused at expiry",
                      selected.forecast_expiring_unused,
                    ],
                    ["Confirmed shortfall", selected.shortfall_quantity],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {qty(value)} {selected.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {selected.signal.replaceAll("_", " ")} · sensitivity{" "}
                  {qty(selected.waste_sensitivity_low)}–
                  {qty(selected.waste_sensitivity_high)} {selected.unit}
                </p>
              </>
            ) : (
              <p>
                No ingredient evidence returned. Check coverage, recipes and
                recorded stock.
              </p>
            )}
          </aside>
        </div>
      </section>
      <details className="pd-card">
        <summary>Exact forecast and ingredient risk evidence</summary>
        <section>
          <h2>Database stock & ingredient risks</h2>
          <p>
            Advisory FEFO allocation; no stock is deducted. Forecast demand
            beyond booked portions is projected through the recorded expiry
            dates.
          </p>
          <div className="pd-table-wrap">
            <table>
              <caption>
                Forecast-linked stock evidence · native ingredient units
              </caption>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Extra forecast need</th>
                  <th>Projected unused at expiry</th>
                  <th>Sensitivity range</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {plan.decision_support.ingredient_risks.map((r) => (
                  <tr key={r.ingredient_id}>
                    <td>{r.ingredient_name}</td>
                    <td>
                      {qty(r.forecast_requirement)} {r.unit}
                    </td>
                    <td>
                      {qty(r.forecast_expiring_unused)} {r.unit}
                    </td>
                    <td>
                      {qty(r.waste_sensitivity_low)}–
                      {qty(r.waste_sensitivity_high)} {r.unit}
                    </td>
                    <td>{r.signal.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RiskTable plan={plan} />
        </section>
      </details>
      <details className="pd-card">
        <summary>All batch allocations and eligibility</summary>
        <section>
          <h2>Batch evidence</h2>
          <div className="pd-table-wrap">
            <table>
              <caption>
                Recorded batches, expiry eligibility and unallocated balance
              </caption>
              <thead>
                <tr>
                  <th>Batch / ingredient</th>
                  <th>Expiry</th>
                  <th>Eligibility</th>
                  <th>Allocated</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {plan.batches.map((b) => (
                  <tr key={b.batch_id}>
                    <td>
                      #{b.batch_id} · {names.get(b.raw_material_id)}
                    </td>
                    <td>{b.expiry_date}</td>
                    <td>
                      {b.eligible ? "Eligible" : b.exclusion_reasons.join(", ")}
                    </td>
                    <td>
                      {qty(b.allocated_quantity)} {b.unit}
                    </td>
                    <td>
                      {qty(b.remaining_quantity)} {b.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </details>
    </>
  );
}
