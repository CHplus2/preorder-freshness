import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Activity, AlertTriangle, ShoppingCart, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { loadDashboard, loadOptions } from "./api";
import "./predictive.css";

const money = (n) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    n,
  );
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const issues = {
  expiry_surplus: "Expiry exposure",
  overstock: "Excess purchasing",
  stockout: "Supply shortage",
  quality_hold: "Quality hold",
};
const tabs = [
  { id: "forecast", label: "Demand forecast", icon: Activity },
  { id: "inventory", label: "Inventory risk", icon: AlertTriangle },
  { id: "decisions", label: "Decision support", icon: ShoppingCart },
];

function Forecast({ data }) {
  const rows = [...data.forecast].sort((a, b) =>
    a.week_start.localeCompare(b.week_start),
  );
  if (!rows.length)
    return (
      <Empty text="No demand history or forecast is available for this selection." />
    );
  const max =
    Math.max(
      1,
      ...rows.flatMap((r) =>
        [r.actual_demand, r.predicted_demand, r.upper_bound].filter(
          (v) => v !== null,
        ),
      ),
    ) * 1.15;
  const x = (i) => 55 + (i * 630) / Math.max(1, rows.length - 1);
  const y = (v) => 215 - (v / max) * 175;
  // Individual segments preserve missing weeks instead of joining over gaps.
  const lines = (key) =>
    rows
      .slice(1)
      .map((r, i) =>
        rows[i][key] !== null && r[key] !== null ? (
          <line
            key={i}
            x1={x(i)}
            y1={y(rows[i][key])}
            x2={x(i + 1)}
            y2={y(r[key])}
          />
        ) : null,
      );
  return (
    <section className="pd-card">
      <div className="pd-section-heading">
        <div>
          <h2>Weekly menu demand</h2>
          <p>Portions per week · history and forward outlook</p>
        </div>
        <span className="pd-tag">
          {data.source === "mock" ? "Illustrative forecast" : "Model forecast"}
        </span>
      </div>
      <div className="pd-legend">
        <span className="pd-actual">● Historical demand</span>
        <span className="pd-predicted">● Predicted demand</span>
        <span>▧ Uncertainty range</span>
      </div>
      <svg
        className="pd-chart"
        viewBox="0 0 740 265"
        role="img"
        aria-label="Weekly historical and predicted demand. Exact values are in the table below."
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="55"
              x2="710"
              y1={y((max * i) / 4)}
              y2={y((max * i) / 4)}
              stroke="#dce2df"
            />
            <text x="45" y={y((max * i) / 4) + 4} textAnchor="end">
              {Math.round((max * i) / 4)}
            </text>
          </g>
        ))}
        {rows.map(
          (r, i) =>
            r.lower_bound !== null && (
              <rect
                key={r.week_start}
                x={x(i) - 10}
                y={y(r.upper_bound)}
                width="20"
                height={y(r.lower_bound) - y(r.upper_bound)}
                fill="#7868c0"
                opacity="0.25"
              />
            ),
        )}
        <g stroke="#285a3e" strokeWidth="3">
          {lines("actual_demand")}
        </g>
        <g stroke="#7868c0" strokeWidth="3" strokeDasharray="6 4">
          {lines("predicted_demand")}
        </g>
        {rows.map((r, i) => (
          <g key={r.week_start}>
            {["actual_demand", "predicted_demand"].map(
              (k) =>
                r[k] !== null && (
                  <circle
                    key={k}
                    cx={x(i)}
                    cy={y(r[k])}
                    r="4"
                    fill={k === "actual_demand" ? "#285a3e" : "#7868c0"}
                  >
                    <title>
                      {r.week_start}: {k.replaceAll("_", " ")} {qty(r[k])}{" "}
                      portions
                    </title>
                  </circle>
                ),
            )}
            <text x={x(i)} y="245" textAnchor="middle">
              {r.week_start.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p className="pd-note">
        {data.uncertainty_label}. Week labels are week start dates.
      </p>
      <details>
        <summary>View exact weekly values</summary>
        <div className="pd-table-wrap">
          <table>
            <caption>Demand in portions</caption>
            <thead>
              <tr>
                <th>Week starting</th>
                <th>Historical</th>
                <th>Predicted</th>
                <th>Range</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week_start}>
                  <td>{r.week_start}</td>
                  <td>
                    {r.actual_demand === null ? "—" : qty(r.actual_demand)}
                  </td>
                  <td>
                    {r.predicted_demand === null
                      ? "—"
                      : qty(r.predicted_demand)}
                  </td>
                  <td>
                    {r.lower_bound === null
                      ? "Unavailable"
                      : `${qty(r.lower_bound)}–${qty(r.upper_bound)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function Empty({ text }) {
  return (
    <div className="pd-empty" role="status">
      <Activity size={28} />
      <h2>No results yet</h2>
      <p>{text}</p>
    </div>
  );
}
function Inventory({ data }) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const rows = [...data.inventory_risks].sort(
    (a, b) =>
      order[a.urgency] - order[b.urgency] ||
      a.days_to_expiry - b.days_to_expiry,
  );
  if (!rows.length)
    return (
      <Empty text="No inventory risks were reported for this selection." />
    );
  return (
    <section className="pd-card">
      <h2>Where attention is needed</h2>
      <p>
        Usable stock, expected consumption and financial exposure within the
        selected forecast horizon.
      </p>
      <div className="pd-risk-groups">
        {Object.entries(issues).map(([k, label]) => (
          <span key={k}>
            {label}{" "}
            <strong>{rows.filter((r) => r.issue_category === k).length}</strong>
          </span>
        ))}
      </div>
      <div className="pd-table-wrap">
        <table>
          <caption>Ingredient risk · as of {data.as_of_date}</caption>
          <thead>
            <tr>
              <th>Ingredient / business issue</th>
              <th>Deadline / urgency</th>
              <th>Stock</th>
              <th>Consumption</th>
              <th>Surplus</th>
              <th>Loss exposure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ingredient_id}>
                <td>
                  <strong>{r.ingredient_name}</strong>
                  <small>{issues[r.issue_category]}</small>
                  <details>
                    <summary>Why at risk?</summary>
                    <p>{r.reason}</p>
                  </details>
                </td>
                <td>
                  <span className={`pd-risk ${r.urgency}`}>{r.urgency}</span>
                  <small>{r.expiry_date}</small>
                  <small>
                    {r.days_to_expiry < 0
                      ? `Expired ${Math.abs(r.days_to_expiry)} days ago`
                      : `${r.days_to_expiry} days remaining`}
                  </small>
                </td>
                <td>
                  {qty(r.stock_quantity)} {r.unit}
                </td>
                <td>
                  {qty(r.predicted_consumption)} {r.unit}
                </td>
                <td>
                  {qty(r.surplus_quantity)} {r.unit}
                </td>
                <td>{money(r.projected_loss)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pd-note">
        Expiry dates and forecasts support planning; they do not establish food
        safety. Units are ingredient-specific and are never summed together.
      </p>
    </section>
  );
}
function Decisions({ data }) {
  const { baseline, recommended } = data.comparison;
  const saving = baseline.projected_loss - recommended.projected_loss;
  return (
    <>
      <section className="pd-card">
        <h2>Baseline vs recommended purchasing</h2>
        <p>Scenario comparison · projected outcomes, not realized savings</p>
        <div className="pd-comparison">
          {[
            { name: "Baseline purchasing", value: baseline },
            { name: "Recommended decisions", value: recommended },
          ].map(({ name, value }) => (
            <div key={name}>
              <h3>{name}</h3>
              <p>
                Purchase spend <strong>{money(value.purchase_cost)}</strong>
              </p>
              <p>
                Projected waste loss{" "}
                <strong>{money(value.projected_loss)}</strong>
              </p>
              <div className="pd-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${(value.projected_loss / Math.max(1, baseline.projected_loss, recommended.projected_loss)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="pd-note">
          Projected waste loss {saving >= 0 ? "reduction" : "increase"}:{" "}
          <strong>{money(Math.abs(saving))}</strong>. Purchase spend excludes
          unreported promotion, labor and delivery costs.
        </p>
      </section>
      <section className="pd-card">
        <h2>Prioritized purchasing recommendations</h2>
        <p>
          Review supplier lead times and kitchen constraints before taking
          action.
        </p>
        {data.recommendations.length ? (
          <ol className="pd-recommendations">
            {[...data.recommendations]
              .sort((a, b) => a.priority - b.priority)
              .map((r) => (
                <li key={r.id}>
                  <span className="pd-priority">{r.priority}</span>
                  <div>
                    <h3>
                      {r.ingredient_name} <span>{r.action}</span>
                    </h3>
                    <p>{r.reason}</p>
                    <div className="pd-rec-metrics">
                      <span>
                        Suggested purchase{" "}
                        <strong>
                          {qty(r.purchase_quantity)} {r.unit}
                        </strong>
                      </span>
                      <span>
                        Projected waste{" "}
                        <strong>
                          {qty(r.projected_waste)} {r.unit}
                        </strong>
                      </span>
                      <span>
                        Projected loss{" "}
                        <strong>{money(r.projected_loss)}</strong>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
          </ol>
        ) : (
          <Empty text="No purchasing recommendations were returned." />
        )}
      </section>
    </>
  );
}

export default function PredictiveDashboard({ view = "forecast" }) {
  const { isAuthenticated, isAdmin } = useAuth();
  // Do not mount data requests until the existing staff session has resolved.
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
        <p>Sign in with a staff account to use predictive planning.</p>
      </main>
    );
  return <DashboardContent view={view} />;
}
function DashboardContent({ view }) {
  const [mode, setMode] = useState("demo");
  const [options, setOptions] = useState(null);
  const [selection, setSelection] = useState(null);
  const [scenario, setScenario] = useState("baseline");
  const [result, setResult] = useState({ status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadOptions({ mode, signal: controller.signal })
      .then((o) => {
        if (controller.signal.aborted) return;
        setOptions(o);
        if (!o.menu_items.length || !o.fulfillment_centers.length) {
          setResult({ status: "empty" });
          return;
        }
        setSelection({
          menu_item_id: o.menu_items[0].id,
          fulfillment_center_id: o.fulfillment_centers[0].id,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ status: "error", error: e.message });
      });
    return () => controller.abort();
  }, [mode, retry]);
  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    loadDashboard(
      { ...selection, scenario },
      { mode, signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setResult({ status: "ready", data });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ status: "error", error: e.message });
      });
    return () => controller.abort();
  }, [selection, scenario, mode]);
  function reset() {
    setOptions(null);
    setSelection(null);
    setResult({ status: "loading" });
  }
  function choose(key, value) {
    setResult({ status: "loading" });
    setSelection((s) => ({ ...s, [key]: value }));
  }
  const data = result.data;
  const future =
    data?.forecast.filter(
      (r) => r.actual_demand === null && r.predicted_demand !== null,
    ) || [];
  return (
    <main className="pd">
      <header className="pd-header">
        <div>
          <span className="pd-eyebrow">
            DORMATHON 2026 · KITCHEN INTELLIGENCE
          </span>
          <h1>Plan demand. Protect freshness.</h1>
          <p>
            Forecast menu demand, spot ingredient risk, and make informed
            purchasing decisions.
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setRetry((n) => n + 1);
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      <div className={`pd-source ${mode}`} role="status">
        <strong>
          {mode === "demo"
            ? "DEMO DATA · Synthetic examples"
            : "LIVE API · Backend model results"}
        </strong>
        <p>
          {mode === "demo"
            ? "No model has been run. All forecasts, stock, and financial figures below are illustrative."
            : "Results load from the predictive Django API. No demo fallback is used."}
        </p>
      </div>
      <div className="pd-controls">
        <label>
          Data source
          <select
            value={mode}
            onChange={(e) => {
              reset();
              setMode(e.target.value);
            }}
          >
            <option value="demo">Demo data</option>
            <option value="live">Live API</option>
          </select>
        </label>
        <label>
          Menu item
          <select
            disabled={!selection}
            value={selection?.menu_item_id || ""}
            onChange={(e) => choose("menu_item_id", e.target.value)}
          >
            {!selection && <option value="">Select after loading</option>}
            {options?.menu_items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fulfillment center
          <select
            disabled={!selection}
            value={selection?.fulfillment_center_id || ""}
            onChange={(e) => choose("fulfillment_center_id", e.target.value)}
          >
            {!selection && <option value="">Select after loading</option>}
            {options?.fulfillment_centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Simulation scenario
          <select
            value={scenario}
            onChange={(e) => {
              setResult({ status: "loading" });
              setScenario(e.target.value);
            }}
          >
            <option value="baseline">Baseline · no promotion</option>
            <option value="promotion">Promotion · what-if simulation</option>
          </select>
        </label>
      </div>
      <div className="pd-tabs" aria-label="Predictive dashboards">
        {tabs.map(({ id, label, icon: Icon }) => (
          <NavLink key={id} to={`/admin/ai/${id}`}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </div>
      {result.status === "loading" && (
        <div className="pd-state" role="status">
          Loading planning data…
        </div>
      )}
      {result.status === "error" && (
        <div className="pd-state" role="alert">
          <AlertTriangle />
          <h2>Unable to load this dashboard</h2>
          <p>{result.error}</p>
          <button
            onClick={() => {
              reset();
              setRetry((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {result.status === "empty" && (
        <Empty text="Add menu items and fulfillment centers in the backend before loading live planning results." />
      )}
      {result.status === "ready" && (
        <>
          <div className="pd-context">
            <span>
              As of {data.as_of_date} · Generated{" "}
              {new Date(data.generated_at).toLocaleString("en-MY", {
                timeZone: "Asia/Kuala_Lumpur",
              })}{" "}
              MYT
            </span>
            <strong>
              {data.scenario === "promotion"
                ? "WHAT-IF PROMOTION SIMULATION"
                : "Baseline scenario"}
            </strong>
          </div>
          <div className="pd-stats">
            <div>
              <span>Forward demand · {future.length} weeks</span>
              <strong>
                {future.length
                  ? qty(future.reduce((sum, r) => sum + r.predicted_demand, 0))
                  : "Unavailable"}
              </strong>
              <small>portions · selected menu / center</small>
            </div>
            <div>
              <span>Ingredients needing attention</span>
              <strong>{data.inventory_risks.length}</strong>
              <small>
                {
                  data.inventory_risks.filter((r) => r.urgency === "critical")
                    .length
                }{" "}
                critical risks
              </small>
            </div>
            <div>
              <span>Projected loss exposure</span>
              <strong>
                {money(
                  data.inventory_risks.reduce(
                    (sum, r) => sum + r.projected_loss,
                    0,
                  ),
                )}
              </strong>
              <small>within forecast horizon</small>
            </div>
          </div>
          {view === "forecast" ? (
            <Forecast data={data} />
          ) : view === "inventory" ? (
            <Inventory data={data} />
          ) : (
            <Decisions data={data} />
          )}
          <aside className="pd-assumptions">
            <h2>Assumptions & interpretation</h2>
            <ul>
              {data.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            <p>
              Decision support only. No purchases, promotions, or inventory
              changes are executed by this dashboard.
            </p>
          </aside>
        </>
      )}
    </main>
  );
}
