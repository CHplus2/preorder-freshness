import { useEffect, useRef, useState } from "react";
import {getCookie} from "../../utils/cookieUtils";
import {loadLocalDecisionScenario} from "./localApi";
import {estimateTradeoff} from "./decisionMath";
const qty = v => new Intl.NumberFormat("en-MY",{maximumFractionDigits:3}).format(v);
const money = v => v === null ? "Unknown cost" : new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(v);
export default function KitchenPurchaseComparison({ plan, risk, comparison, onComparison, onClear, onWorksheet }) {
  const [quantity, setQuantity] = useState(String(risk.shortfall_quantity || risk.forecast_shortfall || ""));
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
  const baselineRisk = scenarioRisk ? comparison.baseline.ingredient_risks.find((r) => r.raw_material_id === risk.raw_material_id) : null;
  const estimate = estimateTradeoff(risk.forecast_waste_cost_myr, cost, percent);
  function edit(setter, value) { controller.current?.abort(); setStatus(""); setError(""); onClear(); onWorksheet(null); setter(value); }
  async function calculate(event) {
    event.preventDefault(); controller.current?.abort(); const pending = new AbortController(); controller.current = pending;
    setStatus("loading"); setError(""); onClear();
    try {
      const result = await loadLocalDecisionScenario({ horizon_days: plan.window.horizon_days, raw_material_id: risk.raw_material_id, quantity, unit_cost: unitCost === "" ? null : unitCost, arrival_date: arrival, expiry_date: expiry }, { csrfToken: getCookie("csrftoken"), signal: pending.signal });
      if (!pending.signal.aborted) { setStatus("ready"); onComparison(result); }
    } catch (e) { if (!pending.signal.aborted) { setStatus("error"); setError(e.message); } }
  }
  return <><h3>Hypothetical purchase · {risk.ingredient_name}</h3><p>Recalculates FEFO against a fresh database snapshot. The starting quantity uses the confirmed gap first, otherwise the speculative forecast gap. Arrival must cover dated needs; supplier availability and safe handling remain assumptions.</p>
    <form onSubmit={calculate} className="local-purchase-form"><label>Purchase quantity ({risk.unit})<input aria-label="Purchase quantity" required type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => edit(setQuantity, e.target.value)} /></label>
      <label>Assumed cost per {risk.unit} (MYR)<input aria-label="Purchase unit cost" type="number" min="0" step="0.000001" value={unitCost} placeholder="Unknown if blank" onChange={(e) => edit(setUnitCost, e.target.value)} /></label>
      <label>Assumed arrival date<input aria-label="Purchase arrival date" type="date" required min={plan.window.start_date} max={plan.window.end_date} value={arrival} onChange={(e) => edit(setArrival, e.target.value)} /></label>
      <label>Assumed expiry date<input aria-label="Purchase expiry date" type="date" required min={arrival} value={expiry} onChange={(e) => edit(setExpiry, e.target.value)} /></label>
      <button disabled={status === "loading"}>{status === "loading" ? "Calculating comparison…" : "Compare purchase"}</button></form>
    {error && <p role="alert">{error}</p>}
    {scenarioRisk && <div className="pd-table-wrap"><table><caption>Same confirmed orders · hypothetical purchase · no stock changes</caption><thead><tr><th>Measure</th><th>Current database</th><th>With assumed purchase</th></tr></thead><tbody>
      {[['Shortfall', 'shortfall_quantity'], ['Expiring unused', 'expiring_unused_quantity']].map(([label, field]) => <tr key={field}><td>{label}</td><td>{qty(comparison.baseline.ingredient_risks.find((r) => r.raw_material_id === risk.raw_material_id)[field])} {risk.unit}</td><td>{qty(scenarioRisk[field])} {risk.unit}</td></tr>)}
      <tr><td>Confirmed-only waste exposure</td><td>{money(baselineRisk.potential_waste_cost_myr)}</td><td>{money(scenarioRisk.potential_waste_cost_myr)}</td></tr>
      {['forecast_shortfall','forecast_expiring_unused','forecast_waste_cost_myr'].map(field=>{
        const before=comparison.baseline.decision_support.ingredient_risks.find(r=>r.raw_material_id===risk.raw_material_id);
        const after=comparison.scenario.decision_support.ingredient_risks.find(r=>r.raw_material_id===risk.raw_material_id);
        return <tr key={field}><td>{field.replaceAll('_',' ')}</td><td>{field.endsWith('myr')?money(before[field]):`${qty(before[field])} ${risk.unit}`}</td><td>{field.endsWith('myr')?money(after[field]):`${qty(after[field])} ${risk.unit}`}</td></tr>;
      })}</tbody></table><p role="status">{scenarioRisk.action}</p><p>Forecast rows add only estimated demand beyond booked portions. Overbuying can increase expiry exposure.</p></div>}
    <details className="fc-worksheet"><summary>Optional waste-cost worksheet · hypothetical assumptions</summary><p>Uses projected expiry exposure after confirmed and forecast demand. These assumptions do not predict promotion uplift, revenue, shortage recovery or realized savings.</p>
      <div className="fc-assumption-inputs"><label>Assumed total action cost (MYR)<input aria-label="Assumed total action cost (MYR)" type="number" min="0" value={cost} onChange={(e) => {setCost(e.target.value);onWorksheet(null);}} /></label><label>Assumed waste avoided (%)<input aria-label="Assumed waste avoided (%)" type="number" min="0" max="100" value={percent} onChange={(e) => {setPercent(e.target.value);onWorksheet(null);}} /></label></div>
      {estimate ? <><p role="status">Hypothetical avoided exposure: {money(estimate.avoidedLoss)} · net benefit: {money(estimate.netBenefit)}</p><button onClick={()=>onWorksheet({...estimate,action_cost:estimate.actionCost,assumed_avoided_percent:Number(percent),type:'waste_cost_worksheet'})}>Include these assumptions in decision slip</button></> : <p>Enter assumptions; missing costs remain unknown.</p>}</details>
  </>;
}
