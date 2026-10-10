import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getCookie } from "../../utils/cookieUtils";
import { loadLocalPlan, loadLocalScenario } from "./localApi";
import RestaurantStations from "./RestaurantStations";
import { estimateTradeoff } from "./decisionMath";
import "./localKitchen.css";

const qty = (v) => new Intl.NumberFormat("en-MY", { maximumFractionDigits: 3 }).format(v);
const money = (v) => v === null ? "Unknown cost" : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(v);
const issues = { expiry_surplus: "Potential ingredient waste", shortage: "Confirmed-order shortage", expiry_surplus_and_shortage: "Waste and shortage exposure", none: "No reported issue" };
const steps = ["Spot the problem", "Understand why", "Explore actions", "Compare tradeoffs", "Review recommendation"];

export default function LocalKitchen({ view }) {
  const [params, setParams] = useSearchParams();
  const horizon = params.get("horizon") || "7";
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({});
  const [comparison, setComparison] = useState(null);
  const key = JSON.stringify([horizon, view, retry]);
  useEffect(() => {
    const controller = new AbortController();
    if (!/^(?:[1-9]|1[0-9]|2[0-8])$/.test(horizon)) {
      setState({ key, status: "error", error: "Choose a planning window from 1 to 28 days." });
      return () => controller.abort();
    }
    loadLocalPlan(Number(horizon), { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ key, status: "ready", data });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ key, status: "error", error: error.message });
    });
    return () => controller.abort();
  }, [horizon, view, retry, key]);
  const current = state.key === key ? state : { status: "loading" };
  const pair = comparison?.key === key ? comparison.data : null;
  const plan = pair?.baseline || current.data;
  function choose(name, value) {
    const next = new URLSearchParams(params);
    next.set(name, value);
    for (const field of ["ingredient", "step", "action", "scenario", "center", "meal", "lens"]) next.delete(field);
    setComparison(null);
    setParams(next, { replace: true });
  }
  return <main className="pd pd-visual">
    <header className="pd-header"><div><span className="pd-eyebrow">FRESHCAST · YOUR KITCHEN</span>
      <h1>Less waste. A better kitchen plan.</h1><p>Your confirmed preorders, accepted recipes and dated stock.</p></div>
      <button onClick={() => { setComparison(null); setRetry((n) => n + 1); }}><RefreshCw size={16} /> Refresh kitchen data</button></header>
    <div className="pd-source live" role="status"><strong>MY KITCHEN · Database planning · No demand model used</strong>
      <p>This site contains fictional demo transactions. Requirements and risks are calculated from stored orders, recipe commitments and inventory; they are not Genpact predictions.</p></div>
    <div className="pd-controls">
      <label>Data source<select aria-label="Data source" value="local" onChange={(e) => choose("source", e.target.value)}>
        <option value="local">My kitchen · database orders & stock</option><option value="live">Genpact · evaluated model demo</option><option value="demo">Frontend fixtures · no model run</option>
      </select></label>
      <label>Planning window<select aria-label="Planning window" value={horizon} onChange={(e) => choose("horizon", e.target.value)}>
        {[1, 3, 7, 14, 28].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}
        {!["1", "3", "7", "14", "28"].includes(horizon) && <option value={horizon}>{horizon} days</option>}
      </select></label>
    </div>
    <RestaurantStations params={params} baseline={plan} status={current.status} isLocal />
    {current.status === "loading" && <p className="pd-state" role="status">Loading current orders, recipes and stock…</p>}
    {current.status === "error" && <section className="pd-state" role="alert"><h2>Unable to load kitchen data</h2><p>{current.error}</p>
      <button onClick={() => setRetry((n) => n + 1)}>Try again</button></section>}
    {current.status === "ready" && <>
      <div className="pd-context"><span>{plan.window.start_date}–{plan.window.end_date} · {plan.timezone}</span><strong>{plan.coverage.included_orders} included paid orders · {plan.coverage.excluded_orders} excluded</strong></div>
      {!plan.coverage.included_orders && <section className="pd-card" role="status"><h2>No eligible confirmed orders in this window</h2>
        <p>This does not mean zero demand. Review payment, accepted recipes and preparation dates in <Link to="/admin/orders">Orders</Link> and <Link to="/admin/planner">Planner</Link>. Inventory-only expiry risks can still appear.</p></section>}
      {view === "forecast" ? <OrderEvidence plan={plan} /> : view === "inventory" ? <StockEvidence plan={plan} /> :
        <LocalJourney key={JSON.stringify([key, plan])} plan={plan} comparison={pair}
          onComparison={(data) => setComparison({ key, data })} onClear={() => setComparison(null)} />}
      <details className="pd-card"><summary>Order coverage & exclusions ({plan.excluded_orders.length})</summary>
        <p>Only paid, pending/processing orders with reviewed dates, complete accepted recipes and undeducted stock are included.</p>
        <ul>{plan.excluded_orders.map((o) => <li key={o.order_id}>Order #{o.order_id}: {o.reason.replaceAll("_", " ")}</li>)}</ul>
        <Link to="/admin/orders">Review orders</Link> · <Link to="/admin/planner">Review preparation plans</Link></details>
      <details className="pd-assumptions"><summary>Data sources & limitations</summary><ul>{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul></details>
    </>}
  </main>;
}

function OrderEvidence({ plan }) {
  return <section className="pd-card"><h2>Confirmed preorder requirements</h2><p>Known bookings, not predictions of future customers. Names and recipes are accepted order snapshots.</p>
    {plan.included_orders.map((o) => <article key={o.order_id} className="local-order"><h3>Order #{o.order_id} · {o.portions} portions</h3>
      <p>Prepare {o.preparation_date} · ingredients usable through {o.use_by_date}</p><ul>{o.items.map((i, index) => <li key={index}>{i.product_name} × {i.quantity}</li>)}</ul></article>)}
    <RiskTable plan={plan} />
  </section>;
}

function RiskTable({ plan }) {
  return <div className="pd-table-wrap"><table><caption>Ingredient requirements · native material units · backend priority order</caption><thead><tr>
    <th>Ingredient</th><th>Confirmed need</th><th>Eligible stock</th><th>Allocated</th><th>Shortfall</th><th>Expiring unused</th><th>Urgent by</th></tr></thead>
    <tbody>{plan.ingredient_risks.map((r) => <tr key={r.ingredient_id}><td>{r.ingredient_name}<small>{issues[r.risk_type]}</small></td>
      {["confirmed_requirement", "eligible_stock", "allocated_quantity", "shortfall_quantity", "expiring_unused_quantity"].map((field) => <td key={field}>{qty(r[field])} {r.unit}</td>)}<td>{r.urgent_by || "—"}</td></tr>)}</tbody></table></div>;
}

function StockEvidence({ plan }) {
  const names = new Map(plan.ingredient_risks.map((r) => [r.raw_material_id, r.ingredient_name]));
  return <><section className="pd-card"><h2>Database stock & ingredient risks</h2><p>Advisory FEFO allocation; no stock is deducted.</p><RiskTable plan={plan} /></section>
    <section className="pd-card"><h2>Batch evidence</h2><div className="pd-table-wrap"><table><caption>Recorded batches, expiry eligibility and unallocated balance</caption><thead><tr><th>Batch / ingredient</th><th>Expiry</th><th>Eligibility</th><th>Allocated</th><th>Remaining</th></tr></thead>
      <tbody>{plan.batches.map((b) => <tr key={b.batch_id}><td>#{b.batch_id} · {names.get(b.raw_material_id)}</td><td>{b.expiry_date}</td><td>{b.eligible ? "Eligible" : b.exclusion_reasons.join(", ")}</td><td>{qty(b.allocated_quantity)} {b.unit}</td><td>{qty(b.remaining_quantity)} {b.unit}</td></tr>)}</tbody></table></div></section></>;
}

function LocalJourney({ plan, comparison, onComparison, onClear }) {
  const [params, setParams] = useSearchParams();
  const risks = plan.ingredient_risks.filter((r) => r.risk_type !== "none");
  const selected = risks.find((r) => r.ingredient_id === params.get("ingredient")) || risks[0];
  const stepValue = Number(params.get("step") || 0);
  const step = Number.isInteger(stepValue) && stepValue >= 0 && stepValue <= 4 ? stepValue : 0;
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step, selected?.ingredient_id]);
  function choose(name, value) {
    const next = new URLSearchParams(params); next.set(name, String(value));
    if (name === "ingredient") { next.delete("step"); onClear(); }
    setParams(next, { replace: true });
  }
  if (!selected) return <section className="pd-card" role="status"><h2>No shortage or expiry surplus found for included orders</h2><p>Review coverage and exclusions before making a purchasing decision.</p></section>;
  const r = selected;
  return <section className="fc-assistant">
    <div className="local-risk-board" aria-label="Kitchen ingredient priorities">{risks.map((risk, index) => <button key={risk.ingredient_id} aria-pressed={r.ingredient_id === risk.ingredient_id}
      onClick={() => choose("ingredient", risk.ingredient_id)}><span className="pd-eyebrow">PRIORITY {index + 1} · {risk.urgent_by}</span><strong>{risk.ingredient_name}</strong><span>{issues[risk.risk_type]}</span></button>)}</div>
    <label>Ingredient problem<select aria-label="Ingredient problem" value={r.ingredient_id} onChange={(e) => choose("ingredient", e.target.value)}>{risks.map((risk) => <option key={risk.ingredient_id} value={risk.ingredient_id}>{risk.ingredient_name} · {issues[risk.risk_type]}</option>)}</select></label>
    <ol className="fc-steps" aria-label="Decision journey">{steps.map((label, index) => <li key={label}><button onClick={() => choose("step", index)} aria-current={step === index ? "step" : undefined}><span>{index + 1}</span>{label}</button></li>)}</ol>
    <section className="pd-card fc-problem" aria-live="polite"><span className="pd-eyebrow">STEP {step + 1} OF 5 · DATABASE KITCHEN PLAN</span>
      <h2 ref={heading} tabIndex={-1}>{step === 0 ? `${issues[r.risk_type]}: ${r.ingredient_name}` : steps[step]}</h2>
      {step === 0 && <><div className="fc-facts"><div><span>Expiring unused</span><strong>{qty(r.expiring_unused_quantity)} {r.unit}</strong></div><div><span>Confirmed-order shortfall</span><strong>{qty(r.shortfall_quantity)} {r.unit}</strong></div><div><span>Potential waste exposure</span><strong>{money(r.potential_waste_cost_myr)}</strong></div></div><p>Urgent by {r.urgent_by}. These are calculated planning risks for stored demo records, not observed waste or ML demand predictions.</p></>}
      {step === 1 && <><p className="fc-explanation">{r.explanation}</p><div className="fc-facts"><div><span>Accepted recipe requirement</span><strong>{qty(r.confirmed_requirement)} {r.unit}</strong></div><div><span>Eligible stock</span><strong>{qty(r.eligible_stock)} {r.unit}</strong></div><div><span>Allocated through preparation end</span><strong>{qty(r.allocated_quantity)} {r.unit}</strong></div></div>
        <ul>{plan.included_orders.filter((o) => o.requirements.some((q) => q.raw_material_id === r.raw_material_id)).map((o) => <li key={o.order_id}>Order #{o.order_id}: {o.items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ")} · usable through {o.use_by_date}</li>)}</ul>
        <p>Expired, quarantined, not-received and too-early-expiring batches cannot cover these dated needs. Earlier-expiring eligible stock is allocated first.</p></>}
      {step === 2 && <><h3>{r.action}</h3><p>{r.shortfall_quantity > 0 ? `Review buying ${qty(r.shortfall_quantity)} ${r.unit} to cover the dated shortfall. Estimated ingredient spend: ${money(r.estimated_purchase_cost_myr)}; verify supplier price and arrival.` : "Review safe uses for leftovers and avoid unnecessary additional buying."}</p>
        <p>Rescheduling can affect freshness and capacity. Review accepted commitments in the planner rather than silently changing an order.</p><Link to="/admin/planner">Open kitchen planner</Link> · <Link to="/admin/inventory">Inspect recorded batches</Link><p>Select Continue to compare a hypothetical purchase or a waste-cost worksheet. No action is executed.</p></>}
      {step === 3 && <LocalComparison key={r.ingredient_id} plan={plan} risk={r} comparison={comparison} onComparison={onComparison} onClear={onClear} />}
      {step === 4 && <><div className="fc-recommendation"><span className="pd-eyebrow">DATABASE REQUIREMENTS · ADVISORY GUIDANCE</span><h3>{r.action}</h3><p>{r.explanation}</p></div><p>Check the included orders, batch handling, supplier price, arrival and expiry before acting. A comparison does not place a purchase or deduct stock.</p><Link to="/admin/orders">Review affected orders</Link> · <Link to="/admin/inventory">Review inventory</Link></>}
      <div className="fc-journey-controls"><button disabled={step === 0} onClick={() => choose("step", step - 1)}>Back</button><span>{steps[step]}</span>{step < 4 && <button className="admin-primary" onClick={() => choose("step", step + 1)}>Continue</button>}</div>
    </section>
  </section>;
}

function LocalComparison({ plan, risk, comparison, onComparison, onClear }) {
  const [quantity, setQuantity] = useState(String(risk.shortfall_quantity || ""));
  const [unitCost, setUnitCost] = useState("");
  const [arrival, setArrival] = useState(plan.window.start_date);
  const [expiry, setExpiry] = useState("");
  const [cost, setCost] = useState("");
  const [percent, setPercent] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const scenarioRisk = comparison?.purchase.raw_material_id === risk.raw_material_id ? comparison.scenario.ingredient_risks.find((r) => r.raw_material_id === risk.raw_material_id) : null;
  const estimate = estimateTradeoff(risk.potential_waste_cost_myr, cost, percent);
  function edit(setter, value) { controller.current?.abort(); setStatus(""); setError(""); onClear(); setter(value); }
  async function calculate(event) {
    event.preventDefault(); controller.current?.abort(); const pending = new AbortController(); controller.current = pending;
    setStatus("loading"); setError(""); onClear();
    try {
      const result = await loadLocalScenario({ horizon_days: plan.window.horizon_days, raw_material_id: risk.raw_material_id, quantity, unit_cost: unitCost === "" ? null : unitCost, arrival_date: arrival, expiry_date: expiry }, { csrfToken: getCookie("csrftoken"), signal: pending.signal });
      if (!pending.signal.aborted) { setStatus("ready"); onComparison(result); }
    } catch (e) { if (!pending.signal.aborted) { setStatus("error"); setError(e.message); } }
  }
  return <><h3>Hypothetical purchase · {risk.ingredient_name}</h3><p>Recalculates FEFO against a fresh database snapshot. Arrival must be by preparation start and expiry must cover preparation end. Supplier availability and safe handling are assumptions.</p>
    <form onSubmit={calculate} className="local-purchase-form"><label>Purchase quantity ({risk.unit})<input aria-label="Purchase quantity" required type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => edit(setQuantity, e.target.value)} /></label>
      <label>Assumed cost per {risk.unit} (MYR)<input aria-label="Purchase unit cost" type="number" min="0" step="0.000001" value={unitCost} placeholder="Unknown if blank" onChange={(e) => edit(setUnitCost, e.target.value)} /></label>
      <label>Assumed arrival date<input aria-label="Purchase arrival date" type="date" required min={plan.window.start_date} max={plan.window.end_date} value={arrival} onChange={(e) => edit(setArrival, e.target.value)} /></label>
      <label>Assumed expiry date<input aria-label="Purchase expiry date" type="date" required min={arrival} value={expiry} onChange={(e) => edit(setExpiry, e.target.value)} /></label>
      <button disabled={status === "loading"}>{status === "loading" ? "Calculating comparison…" : "Compare purchase"}</button></form>
    {error && <p role="alert">{error}</p>}
    {scenarioRisk && <div className="pd-table-wrap"><table><caption>Same confirmed orders · hypothetical purchase · no stock changes</caption><thead><tr><th>Measure</th><th>Current database</th><th>With assumed purchase</th></tr></thead><tbody>
      {[['Shortfall', 'shortfall_quantity'], ['Expiring unused', 'expiring_unused_quantity']].map(([label, field]) => <tr key={field}><td>{label}</td><td>{qty(comparison.baseline.ingredient_risks.find((r) => r.raw_material_id === risk.raw_material_id)[field])} {risk.unit}</td><td>{qty(scenarioRisk[field])} {risk.unit}</td></tr>)}
      <tr><td>Potential waste exposure</td><td>{money(risk.potential_waste_cost_myr)}</td><td>{money(scenarioRisk.potential_waste_cost_myr)}</td></tr></tbody></table><p role="status">{scenarioRisk.action}</p></div>}
    <details className="fc-worksheet"><summary>Optional waste-cost worksheet · hypothetical assumptions</summary><p>These assumptions estimate avoided waste exposure only. They do not predict promotion uplift, revenue, shortage recovery or realized savings.</p>
      <div className="fc-assumption-inputs"><label>Assumed total action cost (MYR)<input aria-label="Assumed total action cost (MYR)" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></label><label>Assumed waste avoided (%)<input aria-label="Assumed waste avoided (%)" type="number" min="0" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} /></label></div>
      {estimate ? <p role="status">Hypothetical avoided exposure: {money(estimate.avoidedLoss)} · net benefit: {money(estimate.netBenefit)}</p> : <p>Enter assumptions; missing costs remain unknown.</p>}</details>
  </>;
}
