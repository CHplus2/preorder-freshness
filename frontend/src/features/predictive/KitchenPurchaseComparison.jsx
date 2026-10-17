import { useEffect, useRef, useState } from "react";
import {getCookie} from "../../utils/cookieUtils";
import {loadLocalDecisionScenario} from "./localApi";
import {estimateTradeoff} from "./decisionMath";
import {stockQuantity} from './kitchenPresentation';
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
  return <><h3>What if you bought more {risk.ingredient_name.toLowerCase()}?</h3><p>Compare a purchase without changing stock. The quantity starts with the confirmed gap, or the additional forecast gap. Check supplier availability and arrival timing before ordering.</p>
    <form onSubmit={calculate} className="local-purchase-form"><label>Purchase quantity ({risk.unit})<input aria-label="Purchase quantity" required type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => edit(setQuantity, e.target.value)} /></label>
      <label>Assumed cost per {risk.unit} (MYR)<input aria-label="Purchase unit cost" type="number" min="0" step="0.000001" value={unitCost} placeholder="Unknown if blank" onChange={(e) => edit(setUnitCost, e.target.value)} /></label>
      <label>Assumed arrival date<input aria-label="Purchase arrival date" type="date" required min={plan.window.start_date} max={plan.window.end_date} value={arrival} onChange={(e) => edit(setArrival, e.target.value)} /></label>
      <label>Assumed expiry date<input aria-label="Purchase expiry date" type="date" required min={arrival} value={expiry} onChange={(e) => edit(setExpiry, e.target.value)} /></label>
      <button disabled={status === "loading"}>{status === "loading" ? "Calculating comparison…" : "Compare purchase"}</button></form>
    {error && <p role="alert">{error}</p>}
    {scenarioRisk && <div className="pd-table-wrap"><table><caption>Same demand · hypothetical purchase · no stock changes</caption><thead><tr><th>Measure</th><th>Current plan</th><th>With assumed purchase</th></tr></thead><tbody>
      {(baselineRisk.shortfall_quantity>0 || scenarioRisk.shortfall_quantity>0) && <tr><td>Confirmed-order gap</td><td>{stockQuantity(baselineRisk.shortfall_quantity,risk.unit)}</td><td>{stockQuantity(scenarioRisk.shortfall_quantity,risk.unit)}</td></tr>}
      {[['Forecast stock gap','forecast_shortfall'],['Unused at expiry','forecast_expiring_unused'],['Estimated expiry exposure','forecast_waste_cost_myr']].map(([label,field])=>{
        const before=comparison.baseline.decision_support.ingredient_risks.find(r=>r.raw_material_id===risk.raw_material_id);
        const after=comparison.scenario.decision_support.ingredient_risks.find(r=>r.raw_material_id===risk.raw_material_id);
        return <tr key={field}><td>{label}</td><td>{field.endsWith('myr')?money(before[field]):stockQuantity(before[field],risk.unit)}</td><td>{field.endsWith('myr')?money(after[field]):stockQuantity(after[field],risk.unit)}</td></tr>;
      })}</tbody></table><p>Overbuying can increase expiry exposure. Forecast quantities are estimates.</p></div>}
    <details className="fc-worksheet"><summary>Optional waste-cost worksheet · hypothetical assumptions</summary><p>Uses projected expiry exposure after confirmed and forecast demand. These assumptions do not predict promotion uplift, revenue, shortage recovery or realized savings.</p>
      <div className="fc-assumption-inputs"><label>Assumed total action cost (MYR)<input aria-label="Assumed total action cost (MYR)" type="number" min="0" value={cost} onChange={(e) => {setCost(e.target.value);onWorksheet(null);}} /></label><label>Assumed waste avoided (%)<input aria-label="Assumed waste avoided (%)" type="number" min="0" max="100" value={percent} onChange={(e) => {setPercent(e.target.value);onWorksheet(null);}} /></label></div>
      {estimate ? <><p role="status">Hypothetical avoided exposure: {money(estimate.avoidedLoss)} · net benefit: {money(estimate.netBenefit)}</p><button onClick={()=>onWorksheet({...estimate,action_cost:estimate.actionCost,assumed_avoided_percent:Number(percent),type:'waste_cost_worksheet'})}>Include these assumptions in decision slip</button></> : <p>Enter assumptions; missing costs remain unknown.</p>}</details>
  </>;
}
