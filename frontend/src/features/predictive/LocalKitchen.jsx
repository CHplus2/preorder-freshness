import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadLocalDecisionPlan } from "./localApi";
import KitchenDecisionJourney, { MenuEvidence } from "./KitchenDecisionJourney";
import RestaurantStations from "./RestaurantStations";
import KitchenForecast from "./KitchenForecast";
import KitchenEvidencePanel from "./KitchenEvidencePanel";
import "./localKitchen.css";
import PlanningFridge from "./PlanningFridge";
import { IngredientDrawing } from "./PantryScene";
import StockFlowEvidence from "./StockFlowEvidence";
import KitchenStockStory, {EvidenceNotes} from "./KitchenStockStory";
import {kitchenCase, caseQuantity, stockQuantity} from "./kitchenPresentation";
import {FreshCastHeading, SourceNotice, SourceSelector, BuildIdentity} from './FreshCastChrome';
import {stockViewSelection} from './decisionNavigation';
import EvidenceTabs from './EvidenceTabs';

const qty = (v) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 3 }).format(v);
const portionQty = value => new Intl.NumberFormat('en-MY',{maximumFractionDigits:2}).format(value);
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
  const [evidenceOpen,setEvidenceOpen]=useState(false);
  const evidenceRef=useRef(null);
  function reviewEvidence() {
    setEvidenceOpen(true);
    requestAnimationFrame(()=>{
      evidenceRef.current?.querySelector('summary')?.focus({preventScroll:true});
      evidenceRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  }
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
      <FreshCastHeading view={view} loading={current.status==='loading'} onRefresh={()=>{setComparison(null);setRetry(n=>n+1)}}/>
      <SourceNotice source="local" synthetic={demoBatchCount>0 || plan?.decision_support.synthetic_history_items>0}/>
      <div className="pd-controls">
        <SourceSelector value="local" onChange={value => choose('source',value)}/>
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
          <div className="pd-context">
            <span>
              Stock planning: {plan.window.start_date}–{plan.window.end_date} ·{" "}
              {plan.timezone}
            </span>
            <span>{plan.coverage.included_orders} confirmed orders included · {plan.coverage.excluded_orders} excluded. <button className="local-evidence-trigger" onClick={reviewEvidence} aria-controls="kitchen-data-checks" aria-expanded={evidenceOpen}>Review data checks</button></span>
          </div>
          {!plan.coverage.included_orders && <p className="local-booking-note">No confirmed bookings qualify in this window. Menu forecasts can still estimate additional demand.</p>}
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
          <KitchenEvidencePanel plan={plan} open={evidenceOpen} onToggle={setEvidenceOpen} panelRef={evidenceRef}>
            {view!=='inventory' && <WeeklySalesEvidence revision={retry}/>}
          </KitchenEvidencePanel>
        </>
      )}
      <BuildIdentity source="local" onSourceChange={value=>choose('source',value)}/>
    </main>
  );
}

function WeeklySalesEvidence({revision}) {
  return <KitchenForecast revision={revision}/>;
}

function OrderEvidence({ plan }) {
  const [params,setParams]=useSearchParams();
  const menuId=params.get('menu');
  const menus=plan.decision_support.menus;
  const selected=menus.find(menu=>String(menu.product_id)===menuId) || menus[0];
  return (
    <section className="pd-card">
      <h2>What might customers order?</h2>
      <p>Choose a menu to explore its forecast for {plan.window.start_date}–{plan.window.end_date}.</p>
      {menus.length>0 && <label className="local-menu-select">Menu<select aria-label="Menu" value={String(selected.product_id)} onChange={event=>{const next=new URLSearchParams(params);next.set('menu',event.target.value);setParams(next,{replace:true});}}>{menus.map(menu=><option key={menu.product_id} value={menu.product_id}>{menu.product_name}</option>)}</select></label>}
      {selected?.daily_predictions?.length>0 && <figure className="local-demand-strip"><figcaption>Expected portions by delivery day · forecast estimates</figcaption><div role="group" aria-label="Forecast portions by delivery day" tabIndex={0}>{selected.daily_predictions.map((value,index)=>{
        const day=new Date(Date.parse(`${plan.window.start_date}T12:00:00Z`)+index*86400000);
        const date=day.toISOString().slice(0,10);
        return <div key={date} title={`${date}: ${portionQty(value)} estimated portions`}><strong>{portionQty(value)}</strong><span className="local-day-bar" style={{height:`${12+64*value/Math.max(1,...selected.daily_predictions)}px`}}/><time dateTime={date}>{day.toLocaleDateString('en-MY',{day:'numeric',month:'short',timeZone:'UTC'})}</time></div>;
      })}</div></figure>}
      {selected ? <MenuEvidence support={{...plan.decision_support,menus:[selected]}}/> : <p>No active menus are available. Review menu records first.</p>}
      <details><summary>Confirmed bookings in this window · {plan.included_orders.length}</summary>
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
      </details>
    </section>
  );
}

function RiskTable({ plan }) {
  return (
    <div className="pd-table-wrap">
      <table>
        <caption>
          Confirmed orders only · before additional forecast use · native material units
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
  const [params,setParams]=useSearchParams();
  const {filter,rows:risks,selected}=stockViewSelection(plan.decision_support.ingredient_risks,params);
  const [page,setPage]=useState(()=>Math.floor(Math.max(0,risks.findIndex(risk=>risk.ingredient_id===selected?.ingredient_id))/6));
  const pages=Math.max(1,Math.ceil(risks.length/6));
  const currentPage=Math.min(page,pages-1);
  function inspect(id) {
    const next=new URLSearchParams(params);next.set('ingredient',id);setParams(next,{replace:true});
    setPage(Math.floor(Math.max(0,risks.findIndex(risk=>risk.ingredient_id===id))/6));
  }
  function chooseFilter(value) {
    const next=new URLSearchParams(params);next.set('stock_filter',value);
    const choice=stockViewSelection(plan.decision_support.ingredient_risks,next).selected;
    if(choice)next.set('ingredient',choice.ingredient_id);else next.delete('ingredient');
    setPage(0);setParams(next,{replace:true});
  }
  const decisionParams=new URLSearchParams(params);
  if(selected)decisionParams.set('ingredient',selected.ingredient_id);
  decisionParams.set('step','0');decisionParams.delete('action');
  const names = new Map(
    plan.ingredient_risks.map((r) => [r.raw_material_id, r.ingredient_name]),
  );
  return (
    <>
      <section className="pd-card">
        <h2>Which stock needs a closer look?</h2>
        <p>
          Open the fridge and choose an ingredient to compare forecast need with expiring stock.
        </p>
        <div className="fc-comparison-switch" role="group" aria-label="Stock issue filter">{[['all','All ingredients'],['waste','Waste exposure'],['shortage','Stock gaps']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>chooseFilter(value)}>{label}</button>)}</div>
        <label className="local-menu-select">Ingredient<select aria-label="Ingredient" value={selected?.ingredient_id || ''} onChange={event=>{
          inspect(event.target.value);
        }} disabled={!risks.length}>{!risks.length && <option value="">No matching ingredients</option>}{risks.map(risk=><option key={risk.ingredient_id} value={risk.ingredient_id}>{risk.ingredient_name} · {kitchenCase(risk).label}</option>)}</select></label>
        <div className="local-fridge-inspection">
          <PlanningFridge
            count={risks.length}
            evidenceLabel="recorded ingredient stock"
          >
            <div className="local-fridge-packages">
              {risks.slice(currentPage*6,currentPage*6+6).map((r) => (
                <button
                  key={r.ingredient_id}
                  aria-label={`Inspect kitchen ingredient ${r.ingredient_name}`}
                  aria-pressed={selected?.ingredient_id === r.ingredient_id}
                  onClick={() => inspect(r.ingredient_id)}
                >
                  <IngredientDrawing name={r.ingredient_name} />
                  <strong>{r.ingredient_name}</strong>
                  <span>
                    {caseQuantity(r)}
                  </span>
                </button>
              ))}
            </div>
          </PlanningFridge>
          <aside aria-label="Selected kitchen ingredient">
            {selected ? (
              <>
                <h3>{selected.ingredient_name}</h3>
                <p>{kitchenCase(selected).title}</p>
                <strong>{caseQuantity(selected)}</strong>
                <dl>
                  {[
                    ["Forecast need", selected.forecast_requirement],
                    [
                      "Projected unused at expiry",
                      selected.forecast_expiring_unused,
                    ],
                    ["Available after bookings", selected.stock_flow?.after_confirmed ?? selected.eligible_stock],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {stockQuantity(value, selected.unit)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <EvidenceNotes risk={selected}/>
                <Link className="fc-open-decision" to={{pathname:'/admin/ai/decisions',search:`?${decisionParams}`}}>Explore this decision →</Link>
              </>
            ) : (
              <p>
                No ingredients match this view. Try All ingredients or review stock records.
              </p>
            )}
          </aside>
        </div>
        {pages>1 && <div className="fc-journey-controls"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous shelf</button><span>Shelf {currentPage+1} of {pages}</span><button disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)}>Next shelf</button></div>}
      </section>
      {selected && <section className="pd-card"><KitchenStockStory risk={selected} window={plan.window}/></section>}
      <details className="pd-card"><summary>Supporting evidence</summary><EvidenceTabs label="Kitchen inventory evidence" sections={[
        ...(selected ? [{id:'selected',title:'Selected stock',content:<StockFlowEvidence risk={selected} window={plan.window}/>}]:[]),
        {id:'risks',title:'Ingredient risks',content:
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
                  <th>What-if waste outcomes (not an interval)</th>
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
      },
        {id:'batches',title:'Batch eligibility',content:
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
      },
      ]}/></details>
    </>
  );
}
