import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IngredientDrawing } from "./PantryScene";
import { KitchenRoom } from "./KitchenWalkthrough";
import VerificationChecklist from "./VerificationChecklist";
import KitchenPurchaseComparison from "./KitchenPurchaseComparison";
import KitchenForecastReplay from "./KitchenForecastReplay";
import StockFlowEvidence from "./StockFlowEvidence";
import KitchenStockStory, {EvidenceNotes} from "./KitchenStockStory";
import {kitchenCase, stockQuantity, caseQuantity} from "./kitchenPresentation";
import {DecisionSteps} from './FreshCastChrome';
import {decisionSteps as steps, selectedDecisionStep} from './decisionNavigation';
import {
  decisionSlip,
  kitchenActions,
  marketingWorksheet,
  workflowLinks,
  riskTiming,
} from "./kitchenDecision";
import { getCookie } from "../../utils/cookieUtils";
import { requestJSON } from "./api";
import {
  readReviews,
  saveReview as saveSignedReview,
  saveOutcomeNote,
} from "./kitchenReviewStore";
import "./localKitchen.css";

const qty = (v) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 3 }).format(v);
const money = (v) =>
  v === null
    ? "Unknown cost"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(v);
const positions = [
  [22, 34],
  [43, 24],
  [24, 61],
  [83, 47],
  [54, 49],
  [76, 73],
];

export default function KitchenDecisionJourney({
  plan,
  comparison,
  onComparison,
  onClear,
}) {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(0),
    [scene, setScene] = useState("kitchen"),
    [pinned, setPinned] = useState([]);
  const support = plan.decision_support;
  const lens = ["waste", "shortage"].includes(params.get("lens"))
    ? params.get("lens")
    : "priority";
  const risks = support.ingredient_risks;
  const ordered = [...risks].sort((a, b) =>
    lens === "waste"
      ? (b.forecast_waste_cost_myr ?? -1) - (a.forecast_waste_cost_myr ?? -1)
      : lens === "shortage"
        ? Number(b.shortfall_quantity > 0 || b.forecast_shortfall > 0) - Number(a.shortfall_quantity > 0 || a.forecast_shortfall > 0)
        : 0,
  );
  const selected =
    ordered.find((r) => r.ingredient_id === params.get("ingredient")) ||
    ordered[0];
  const pages = Math.max(1, Math.ceil(ordered.length / 6));
  const visible = ordered.slice(
    Math.min(page, pages - 1) * 6,
    Math.min(page, pages - 1) * 6 + 6,
  );
  const [reviewed, setReviewed] = useState([]),
    [note, setNote] = useState(""),
    [worksheet, setWorksheet] = useState(null);
  const [save, setSave] = useState({}),
    saveKey = useRef(null);
  const heading = useRef(null);
  const step = selectedDecisionStep(params.get('step'));
  const previousStep=useRef(step);
  const action =
    kitchenActions.find((a) => a.id === params.get("action") && !(a.id==='marketing' && selected?.forecast_expiring_unused===0)) ||
    kitchenActions.find(
      (a) =>
        a.id ===
        (selected?.shortfall_quantity > 0 || selected?.forecast_shortfall > 0
          ? "purchasing"
          : selected?.forecast_expiring_unused > 0 ? "menu" : "wait"),
    );
  function choose(name, value) {
    const next = new URLSearchParams(params);
    next.set(name, String(value));
    if (name === "ingredient" || name === "lens") {
      next.delete("step");
      next.delete("action");
      onClear();
      setReviewed([]);
      setNote("");
      setSave({});
      saveKey.current = null;
      setWorksheet(null);
    }
    if (name === "lens") {
      next.delete("ingredient");
      setPage(0);
    }
    if (name === "action") {
      setSave({});
      saveKey.current = null;
      setWorksheet(null);
    }
    setParams(next, { replace: true });
  }
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if(previousStep.current!==step)heading.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    previousStep.current=step;
  }, [step, selected?.ingredient_id]);
  if (!selected)
    return (
      <>
        <DecisionSteps disabled/>
        <section className="pantry-scene">
          <div className="fc-room">
            <KitchenRoom />
          </div>
        </section>
        <section className="pd-card">
          <h2>No ingredient evidence available for a decision</h2>
          <p>
            No actionable signal is currently returned. Check forecast history,
            recipe coverage and excluded orders above. An empty review board
            does not establish zero future waste or safe stock.
          </p>
          <Link to="/admin/inventory">Review inventory</Link> ·{" "}
          <Link to="/admin/planner">Open planner</Link>
        </section>
        <DecisionReviewBoard />
      </>
    );
  const r = selected,
    links = workflowLinks(r, plan);
  function download() {
    const text = decisionSlip({
      plan,
      risk: r,
      action: action.id,
      reviewed,
      note,
      worksheet,
      signedReview: save.signed,
    });
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `kitchen-decision-${r.raw_material_id}-${plan.as_of}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function captureWorksheet(value) {
    setWorksheet(value);
    setSave({});
    saveKey.current = null;
  }
  async function saveReview() {
    if (save.busy) return;
    setSave({ busy: true });
    const assumedCost = worksheet?.campaign_cost ?? worksheet?.action_cost;
    saveKey.current ||= crypto.randomUUID();
    try {
      const data = await requestJSON("local-reviews/", {
        csrfToken: getCookie("csrftoken"),
        body: {
          request_id: saveKey.current,
          raw_material_id: r.raw_material_id,
          horizon_days: plan.window.horizon_days,
          action: action.id,
          note,
          action_cost:
            assumedCost == null ? null : Number(assumedCost.toFixed(2)),
          assumed_avoided_percent:
            worksheet?.assumed_avoided_percent ??
            (worksheet && r.forecast_expiring_unused > 0
              ? Number(
                  (
                    (worksheet.ingredientUsed / r.forecast_expiring_unused) *
                    100
                  ).toFixed(2),
                )
              : null),
        },
      });
      saveSignedReview(data);
      saveKey.current = null;
      setSave({
        signed: data,
        message:
          "Signed review saved in this browser with fresh database evidence. Download a copy for your showcase. No operational action executed.",
        revision: data.id,
      });
    } catch (error) {
      setSave({ error: error.message });
    }
  }
  return (
    <section className="fc-assistant">
      <div className="pd-card">
        <span className="pd-eyebrow">
          YOUR KITCHEN · PREVENT WASTE BEFORE EXPIRY
        </span>
        <h2>What needs your attention?</h2>
        <p>
          Choose an ingredient, see what may happen, then compare your next move.
        </p>
        <div
          className="fc-comparison-switch"
          role="group"
          aria-label="Kitchen focus"
        >
          {[
            ["priority", "Priority"],
            ["waste", "Waste cost first"],
            ["shortage", "Stock gaps first"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={lens === id}
              onClick={() => choose("lens", id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <details className="local-scene-picker" open={step===0}>
      <summary>Choose an ingredient · {r.ingredient_name}</summary>
      <section
        className="pantry-scene"
        aria-label="Interactive kitchen decisions"
      >
        <div className="pantry-counter">
          <div className="pantry-counter-heading">
            <h3>Your kitchen, one step ahead</h3>
            <div className="fc-comparison-switch">
              {["kitchen", "crates"].map((v) => (
                <button
                  key={v}
                  aria-pressed={scene === v}
                  onClick={() => setScene(v)}
                >
                  {v === "kitchen" ? "Kitchen view" : "Crate view"}
                </button>
              ))}
            </div>
          </div>
          {scene === "kitchen" ? (
            <div className="fc-walkthrough">
              <div className="fc-room">
                <div className="fc-room-stage">
                  <KitchenRoom />
                  {visible.map((risk, i) => (
                    <button
                      key={risk.ingredient_id}
                      className={`fc-hotspot ${kitchenCase(risk).kind==='shortage' || kitchenCase(risk).kind==='mixed' ? "gap" : "waste"}`}
                      style={{
                        left: `${positions[i][0]}%`,
                        top: `${positions[i][1]}%`,
                      }}
                      aria-pressed={r.ingredient_id === risk.ingredient_id}
                      onClick={() => choose("ingredient", risk.ingredient_id)}
                    >
                      <span>{i + 1 + page * 6}</span>
                      <span className="fc-hotspot-ingredient">
                        <IngredientDrawing name={risk.ingredient_name} />
                      </span>
                      <span className="fc-hotspot-label">
                        {risk.ingredient_name}
                        <small>{kitchenCase(risk).label}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="fc-room-caption">
                  Illustrated positions · database stock, local forecasts · no
                  storage location inferred
                </p>
              </div>
              <aside className="fc-room-inspector">
                <IngredientDrawing name={r.ingredient_name} />
                <h3>{r.ingredient_name}</h3>
                <p>{kitchenCase(r).title}</p>
                <strong>
                  {caseQuantity(r)}
                </strong>
                <p>{r.forecast_expiring_unused>0 ? `${money(r.forecast_waste_cost_myr)} estimated expiry exposure` : 'Use expiring batches first, then review remaining demand.'}</p>
                <button
                  className="pantry-review-case"
                  onClick={() => {
                    heading.current?.scrollIntoView({
                      block: "start",
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                    });
                    heading.current?.focus({ preventScroll: true });
                  }}
                >
                  Explore this decision →
                </button>
                <Link to={links.inventory}>Inspect ingredient batches →</Link>
              </aside>
            </div>
          ) : (
            <div className="pantry-crates">
              {ordered.map((risk) => (
                <button
                  key={risk.ingredient_id}
                  className={`pantry-crate ${r.ingredient_id === risk.ingredient_id ? "is-selected" : ""}`}
                  aria-pressed={r.ingredient_id === risk.ingredient_id}
                  onClick={() => choose("ingredient", risk.ingredient_id)}
                >
                  <IngredientDrawing name={risk.ingredient_name} />
                  <span className="pantry-crate-label">
                    <strong>{risk.ingredient_name}</strong>
                    <span>{kitchenCase(risk).label}</span>
                    <small>
                      {caseQuantity(risk)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {scene === "kitchen" && pages > 1 && (
            <div className="fc-journey-controls">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous ingredients
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ingredients
              </button>
            </div>
          )}
        </div>
      </section>
      </details>
      <details className="pd-card">
        <summary>Manager review queue · {pinned.length} pinned</summary>
        <button
          onClick={() =>
            setPinned((ids) =>
              ids.includes(r.ingredient_id) ? ids : [...ids, r.ingredient_id],
            )
          }
        >
          Pin {r.ingredient_name}
        </button>
        <button onClick={() => setPinned([])}>Clear pins</button>
        <ul>
          {ordered
            .filter((risk) => pinned.includes(risk.ingredient_id))
            .map((risk) => (
              <li key={risk.ingredient_id}>
                <button
                  onClick={() => choose("ingredient", risk.ingredient_id)}
                >
                  {risk.ingredient_name} · {kitchenCase(risk).label}
                </button>
              </li>
            ))}
        </ul>
        <p>
          Pins stay in this page session. Save the final review to retain
          evidence.
        </p>
      </details>
      <label>
        Ingredient problem
        <select
          aria-label="Ingredient problem"
          value={r.ingredient_id}
          onChange={(e) => choose("ingredient", e.target.value)}
        >
          {ordered.map((risk) => (
            <option key={risk.ingredient_id} value={risk.ingredient_id}>
              {risk.ingredient_name} · {kitchenCase(risk).label}
            </option>
          ))}
        </select>
      </label>
      <DecisionSteps step={step} onChange={value => choose('step', value)}/>
      <section className="pd-card fc-problem" aria-live="polite">
        <span className="pd-eyebrow">
          STEP {step + 1} OF 5 · {r.ingredient_name}
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {step === 0
            ? kitchenCase(r).title
            : steps[step]}
        </h2>
        {step === 0 && (
          <>
            <p className="fc-problem-summary">{kitchenCase(r).action}.</p>
            <KitchenStockStory risk={r} window={plan.window} compact/>
            <p>{riskTiming(r, plan.window.end_date)}</p>
            <EvidenceNotes risk={r}/>
          </>
        )}
        {step === 1 && (
          <>
            <KitchenStockStory risk={r} window={plan.window}/>
            <details className="local-deep-evidence"><summary>Inspect batches & exact calculations</summary>
            <StockFlowEvidence risk={r} window={plan.window}/>
            </details>
            <details className="local-deep-evidence">
            <summary>Confirmed orders only · before additional forecast use</summary>
            <p className="fc-explanation">{r.explanation}</p>
            <div className="fc-facts">
              <div>
                <span>Confirmed recipe requirement</span>
                <strong>
                  {qty(r.confirmed_requirement)} {r.unit}
                </strong>
              </div>
              <div>
                <span>Eligible stock</span>
                <strong>
                  {qty(r.eligible_stock)} {r.unit}
                </strong>
              </div>
            </div>
            </details>
            {r.waste_sensitivity_high>0 && <details className="local-deep-evidence"><summary>Compare lower & higher demand assumptions</summary>
            <section aria-label="Demand what-if comparison">
              <h3>What if demand is lower or higher?</h3>
              <p>Same stock and confirmed orders, different assumptions about additional demand during {plan.window.start_date}–{plan.window.end_date}. This compares scenarios; it does not give a probability range.</p>
              <div className="fc-facts">
                <div><span>Lower demand → more unused</span><strong>{qty(r.waste_sensitivity_high)} {r.unit}</strong><small>Projected unused at expiry</small></div>
                <div><span>Central forecast · Step 1 result</span><strong>{qty(r.forecast_expiring_unused)} {r.unit}</strong><small>Projected unused at expiry</small></div>
                <div><span>Higher demand → less unused</span><strong>{qty(r.waste_sensitivity_low)} {r.unit}</strong><small>Projected unused at expiry</small></div>
              </div>
              <details><summary>How these what-if assumptions are set</summary><p>Each menu’s daily demand is shifted down or up by its one-day test MAE; menus without a test use their largest daily forecast as the shift. Demand is then constrained by delivery days, lead time, capacity and recorded orders, before dated expiry allocation is repeated. This heuristic is not calibrated uncertainty or a guarantee. Existing bookings are not added twice.</p></details>
            </section>
            </details>
            }
            <details className="local-deep-evidence"><summary>Menus behind this forecast · {r.menus.length}</summary><MenuEvidence support={support} risk={r} compact/></details>
            <div className="fc-workflow-links"><Link to={links.menus}>Review menu recipes</Link>
            <Link to={links.preparation}>Check preparation dates</Link></div>
          </>
        )}
        {step === 2 && (
          <>
            <fieldset className="fc-actions">
              <legend>What could you do?</legend>
              {kitchenActions.map((a) => (
                <label
                  key={a.id}
                  className={a.id === action.id ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="kitchen-action"
                    value={a.id}
                    checked={a.id === action.id}
                    disabled={a.id==='marketing' && r.forecast_expiring_unused===0}
                    onChange={() => choose("action", a.id)}
                  />
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.id==='purchasing' ? 'Dated stock simulation' : a.id==='marketing' ? 'Assumption-based worksheet' : 'Workflow review · outcome not simulated'}</small>
                    <span>{a.id==='marketing' && r.forecast_expiring_unused===0 ? 'No expiry surplus is projected. A promotion is not an ingredient rescue for this case.' : a.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="fc-brief-actions fc-workflow-links">
              <Link
                className="admin-primary"
                to={
                  action.id === "purchasing"
                    ? links.planner
                    : action.id === "menu"
                      ? links.preparation
                      : action.id === "marketing"
                        ? links.marketing
                        : links.inventory
                }
              >
                {action.id === "purchasing"
                  ? "Review shopping plan"
                  : action.id === "menu"
                    ? "Review kitchen schedule"
                    : action.id === "marketing"
                      ? "Review offer settings"
                      : "Verify stock & expiry"}{" "}
                →
              </Link>
              <Link to={links.inventory}>Inspect affected ingredient</Link>
            </div>
            <p>
              These links open existing workflows with context. No purchase,
              schedule or offer is changed automatically. Promotions must
              respect lead time, capacity and verified handling.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <KitchenStockStory risk={r} window={plan.window} compact/>
            {action.id === "purchasing" ? (
              <KitchenPurchaseComparison
                key={r.ingredient_id}
                plan={plan}
                risk={r}
                comparison={comparison}
                onComparison={onComparison}
                onClear={onClear}
                onWorksheet={captureWorksheet}
              />
            ) : action.id === "marketing" ? (
              <MarketingComparison
                key={r.ingredient_id}
                plan={plan}
                risk={r}
                onWorksheet={captureWorksheet}
              />
            ) : (
              <>
                <KitchenWorkflowReview action={action.id} risk={r} links={links}/>
                {(r.shortfall_quantity>0 || r.forecast_shortfall>0) && <button onClick={() => choose('action','purchasing')}>Compare a purchase instead</button>}
              </>
            )}
            {(action.id==='purchasing' || action.id==='marketing') && <p>Current stock and demand are the baseline. Any compared purchase or marketing assumptions remain hypothetical; no operational action is executed.</p>}
          </>
        )}
        {step === 4 && (
          <>
            <div className="fc-recommendation">
              <span className="pd-eyebrow">RECOMMENDATION TO REVIEW</span>
              <h3>
                {kitchenCase(r).action}
              </h3>
              <p>{r.forecast_shortfall>0 ? `Forecast gap: ${stockQuantity(r.forecast_shortfall,r.unit)}. Verify demand and purchase timing before committing.` : `Expected unused at expiry: ${stockQuantity(r.forecast_expiring_unused,r.unit)}. Review batch dates before acting.`}</p>
              <EvidenceNotes risk={r}/>
              <p>
                Chosen alternative: {action.title}. Target review date:{" "}
                {r.urgent_by || plan.window.end_date}.
              </p>
            </div>
            <VerificationChecklist
              reviewed={reviewed}
              setReviewed={setReviewed}
              note={note}
              setNote={(value) => {
                setNote(value);
                setSave({});
                saveKey.current = null;
              }}
            />
            <div className="fc-brief-actions">
              <button onClick={saveReview} disabled={save.busy}>
                {save.busy ? "Saving evidence…" : "Save decision for follow-up"}
              </button>
              <button onClick={download}>Download decision slip</button>
              <Link to={links.planner}>Continue in planner</Link>
              <Link to={links.inventory}>Continue in inventory</Link>
            </div>
            {save.message && <p role="status">{save.message}</p>}
            {save.error && <p role="alert">{save.error}</p>}
            <p>
              Reviews are saved in this browser, not in a shared server log.
              Save first to include signed evidence in the download. Downloaded
              slips also include this session’s worksheet. Neither executes a
              decision.
            </p>
          </>
        )}
        <div className="fc-journey-controls">
          <button
            disabled={step === 0}
            onClick={() => choose("step", step - 1)}
          >
            Back
          </button>
          <span>{steps[step]}</span>
          {step < 4 && (
            <button
              className="admin-primary"
              onClick={() => choose("step", step + 1)}
            >
              {step === 3 ? "Review recommendation" : "Continue"}
            </button>
          )}
        </div>
      </section>
      {step===4 && <DecisionReviewBoard revision={save.revision} />}
    </section>
  );
}

export function KitchenWorkflowReview({action, risk, links}) {
  const monitoring=action==='wait';
  return <section className="local-action-review" aria-label="Unsimulated workflow review">
    <span className="pd-eyebrow">WORKFLOW REVIEW · OUTCOME NOT SIMULATED</span>
    <h3>{monitoring ? 'Monitor before changing the plan' : 'Check preparation feasibility'}</h3>
    <p>{monitoring ? 'Monitoring keeps the current plan unchanged. Review physical stock and excluded orders before deciding whether to act.' : 'Prioritising a menu may help only if the kitchen can prepare and sell it in time. Open the planner to check tasks, equipment and freshness.'}</p>
    <div className="local-action-measures" role="group" aria-label="Current forecast versus proposed workflow change">{[
        ...(risk.shortfall_quantity>0 ? [['Confirmed-order gap',risk.shortfall_quantity]] : []),
        ['Forecast stock gap',risk.forecast_shortfall],
        ['Unused stock at expiry',risk.forecast_expiring_unused],
      ].map(([label,value])=><article key={label}><h4>{label}</h4><dl><div><dt>Current plan</dt><dd>{stockQuantity(value,risk.unit)}</dd></div><div><dt>{monitoring ? 'Continue monitoring' : 'After menu changes'}</dt><dd>{monitoring ? 'Unchanged' : 'Not simulated'}</dd></div></dl></article>)}</div>
    <p>{monitoring ? 'Monitoring alone does not reduce a gap or expiry exposure. No action cost or benefit is estimated.' : 'No new schedule, sales uplift, cost or benefit has been calculated for this option. The figures above are the baseline, not evidence that this action improves it.'}</p>
    <div className="fc-workflow-links"><Link to={monitoring ? links.inventory : links.preparation}>{monitoring ? 'Verify stock & expiry' : 'Review kitchen schedule'}</Link><Link to={links.menus}>Review recipes</Link></div>
  </section>;
}

export function MenuEvidence({ support, risk, compact = false }) {
  const [menuId, setMenuId] = useState('');
  const menus = support.menus.filter(
    (m) => !risk || risk.menus.some((r) => r.product_id === m.product_id),
  );
  const selectedMenu=menus.find(m=>String(m.product_id)===menuId) || menus[0];
  const visibleMenus=compact ? (selectedMenu ? [selectedMenu] : []) : menus;
  return (
    <div className={compact ? 'local-menu-evidence compact' : 'local-menu-evidence'}>
      <p>Forecast portions cover the full selected window. Ingredient planning uses only additional demand that meets delivery days, lead time and capacity, after recorded orders are accounted for. Fractions are estimates, not instructions to prepare part of a meal.</p>
      {compact && menus.length>1 && <label className="local-menu-select">Menu to inspect<select aria-label="Menu to inspect" value={selectedMenu.product_id} onChange={e=>setMenuId(e.target.value)}>{menus.map(m=><option key={m.product_id} value={m.product_id}>{m.product_name}</option>)}</select></label>}
      <div
        className="local-menu-tickets"
        aria-label="Local menu forecast tickets"
      >
        {visibleMenus.map((m) => (
          <article key={m.product_id}>
            {!compact && <IngredientDrawing name={m.product_name} />}
            <h3>{m.product_name}</h3>
            <strong>
              {m.forecast_portions === null
                ? "History needed"
                : `${qty(m.forecast_portions)} forecast portions · full window`}
            </strong>
            <span>
              {m.additional_forecast_portions === null
                ? "Additional demand unavailable"
                : `${qty(m.additional_forecast_portions)} additional portions eligible to plan`}
            </span>
            {!compact && <small>
              {m.history_days}-day history window{m.selling_days != null ? ` · ${m.selling_days} selling days` : ''} · {m.synthetic_history_items>0?'synthetic scenario evidence':m.confidence}
            </small>}
            {m.demand_adjustments && m.forecast_portions!==null && <details><summary>Why the planning count differs</summary>
              <p>{qty(m.forecast_portions)} forecast portions across the full window.</p>
              <ul>{[
                ['delivery_day_excluded','outside permitted delivery days'],
                ['lead_time_excluded','before the earliest permitted delivery (menu lead time)'],
                ['capacity_excluded','above daily capacity'],
                ['recorded_orders_offset','already represented by recorded orders'],
              ].filter(([key])=>m.demand_adjustments[key]>0).map(([key,label])=><li key={key}>− {qty(m.demand_adjustments[key])} portions {label}</li>)}</ul>
              <p>= {qty(m.additional_forecast_portions)} additional portions eligible for ingredient planning. The estimate is not a confirmed booking or a reserved preparation schedule.</p>
              {m.demand_adjustments.recorded_orders_offset>0 && <p>The order adjustment can include unpaid requests to avoid counting demand twice. Only eligible confirmed orders reserve stock.</p>}
            {m.sensitivity_error_portions_per_day != null && <details><summary>Technical demand scenario assumption</summary><p>Demand is shifted by ±{qty(m.sensitivity_error_portions_per_day)} portions per day for the lower/higher-demand comparison. This is not a probability range or a recommended production buffer.</p></details>}</details>}
            {m.forecast_portions === null && <Link to="/admin/orders">Review completed sales history</Link>}
            <Link to="/admin/products?review=recipes">
              {m.recipe_complete ? "Review recipe" : "Recipe needs review"}
            </Link>
          </article>
        ))}
      </div>
      <details>
        <summary>Exact menu forecast evidence</summary>
        <div className="pd-table-wrap">
          <table>
            <caption>
              Local menu demand · selected on validation; latest 14 days held
              out when sufficient history exists
            </caption>
            <thead>
              <tr>
                <th>Menu</th>
                <th>Expected portions</th>
                <th>Additional eligible for planning</th>
                <th>Method</th>
                <th>Test MAE/day</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.product_id}>
                  <td>{m.product_name}</td>
                  <td>
                    {m.forecast_portions === null
                      ? "Insufficient history"
                      : qty(m.forecast_portions)}
                  </td>
                  <td>
                    {m.additional_forecast_portions === null
                      ? "Not projected"
                      : qty(m.additional_forecast_portions)}
                  </td>
                  <td>{m.method.replaceAll("_", " ")}</td>
                  <td>
                    {m.evaluation
                      ? m.evaluation.test[m.method].mae
                      : "Not evaluated"}
                  </td>
                  <td>
                    {m.history_days}-day window{m.selling_days != null ? ` · ${m.selling_days} selling days` : ''} · {m.synthetic_history_items>0?'includes synthetic scenario history':m.confidence}
                    {!m.recipe_complete ? " · recipe missing" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!menus.length && (
            <p>
              No active mapped menu with eligible sales history. Review recipes
              and sales status before using forecast quantities.
            </p>
          )}
        </div>
      </details>
      <details><summary>Technical forecast evaluation &amp; historical replay</summary><KitchenForecastReplay menus={menus} /></details>
    </div>
  );
}

function MarketingComparison({ plan, risk, onWorksheet }) {
  const [product, setProduct] = useState(
      String(risk.menus[0]?.product_id || ""),
    ),
    [portions, setPortions] = useState(""),
    [discount, setDiscount] = useState(""),
    [cost, setCost] = useState("");
  const menu = plan.decision_support.menus.find(
      (m) => String(m.product_id) === product,
    ),
    recipe = risk.menus.find((m) => String(m.product_id) === product);
  const result = marketingWorksheet({
    portions,
    discount,
    cost,
    menu,
    recipe,
    risk,
  });
  // Parent receives assumptions only on explicit capture, not as predicted uplift.
  return (
    <section className="fc-worksheet">
      <h3>Marketing what-if · manager assumptions</h3>
      <p>
        No customer response is predicted. Enter a plausible extra response to
        compare an offer with doing nothing.
      </p>
      <div className="local-purchase-form">
        <label>
          Mapped menu
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              onWorksheet(null);
            }}
          >
            {risk.menus.map((m) => (
              <option value={m.product_id} key={m.product_id}>
                {m.product_name}
              </option>
            ))}
          </select>
        </label>
        {[
          ["Extra portions", portions, setPortions],
          ["Discount percent", discount, setDiscount],
          ["Campaign cost (MYR)", cost, setCost],
        ].map(([label, value, set]) => (
          <label key={label}>
            {label}
            <input
              type="number"
              min="0"
              max={label === "Discount percent" ? 100 : undefined}
              step="any"
              value={value}
              onChange={(e) => {
                set(e.target.value);
                onWorksheet(null);
              }}
            />
          </label>
        ))}
      </div>
      {result ? (
        <>
          <div className="fc-facts">
            <div>
              <span>Assumed ingredient use</span>
              <strong>
                {qty(result.ingredientUsed)} {risk.unit}
              </strong>
            </div>
            <div>
              <span>Remaining projected surplus</span>
              <strong>
                {qty(result.remaining)} {risk.unit}
              </strong>
            </div>
            <div>
              <span>Estimated contribution after campaign</span>
              <strong>{money(result.contribution)}</strong>
            </div>
          </div>
          <p>
            Assumed food revenue: {money(result.revenue)}. Campaign-cost
            break-even:{" "}
            {result.breakEven === null
              ? "Unavailable; check menu costs and margin"
              : `${result.breakEven} extra portions`}
            . Excludes labour, delivery, overhead and potential cannibalisation.
            Remaining ingredients, capacity and safe preparation are not
            verified.
          </p>
          <button
            onClick={() =>
              onWorksheet({
                ...result,
                discount_percent: Number(discount),
                campaign_cost: Number(cost),
                menu: menu.product_name,
              })
            }
          >
            Include these assumptions in decision slip
          </button>
        </>
      ) : (
        <p>
          Enter all assumptions and choose a mapped menu. Unknown variable costs
          remain unknown.
        </p>
      )}
      <p>
        Existing offer settings control a storewide bulk discount, not a
        targeted campaign for this ingredient. Check the promotion scope before
        saving any offer.
      </p>
      <Link to="/admin/planner">Check capacity first</Link> ·{" "}
      <Link to="/admin/settings#promotions">Review offer scope & settings</Link>
    </section>
  );
}

export function DecisionReviewBoard({ revision }) {
  const [state, setState] = useState({}),
    [retry, setRetry] = useState(0),
    [notes, setNotes] = useState({}),
    [importMessage, setImportMessage] = useState("");
  useEffect(() => {
    const c = new AbortController();
    const saved = readReviews();
    if (saved.error) {
      setState({ error: saved.error });
      return () => c.abort();
    }
    Promise.all(
      saved.rows.map(async (record) => {
        try {
          const data = await requestJSON("local-review-outcomes/", {
            body: { token: record.token },
            csrfToken: getCookie("csrftoken"),
            signal: c.signal,
          });
          if (
            data?.row?.id !== record.snapshot.id ||
            typeof data.definition !== "string"
          )
            throw Error("Recorded outcome evidence is incomplete.");
          return {
            ...data.row,
            outcome_note: record.outcome_note,
            reviewed_at: record.reviewed_at,
          };
        } catch (error) {
          return { ...record.snapshot, error: error.message };
        }
      }),
    ).then((rows) => {
      if (!c.signal.aborted) setState({ rows });
    });
    return () => c.abort();
  }, [revision, retry]);
  function record(id) {
    try {
      saveOutcomeNote(id, notes[id]);
      setRetry((n) => n + 1);
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  }
  async function restore(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 500000)
        throw Error("Choose a decision slip smaller than 500 KB.");
      const data = JSON.parse(await file.text()),
        record = data.signed_review || data;
      if (typeof record?.token !== "string")
        throw Error(
          "This file has no signed review. Save a decision before downloading its slip.",
        );
      const verified = await requestJSON("local-review-outcomes/", {
        body: { token: record.token },
        csrfToken: getCookie("csrftoken"),
      });
      saveSignedReview({ token: record.token, snapshot: verified.row });
      setImportMessage("Signed decision restored in this browser.");
      setRetry((n) => n + 1);
    } catch (error) {
      setImportMessage(error.message);
    }
  }
  return (
    <details className="pd-card">
      <summary>Saved decisions &amp; follow-up</summary>
      <p>Revisit a saved decision and compare it with recorded outcomes. Save a decision above to start; no stock, purchase or schedule is changed.</p>
      <details><summary>Restore a saved decision file</summary>
      <p>Choose a JSON decision slip previously downloaded from FreshCast after saving it. This restores its signed evidence in this browser; it does not import sales, change inventory or train the model.</p>
      <label>
        Decision slip (.json)
        <input type="file" accept="application/json,.json" onChange={restore} />
      </label>
      </details>
      {importMessage && <p role="status">{importMessage}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.rows?.map((row) => (
        <article className="local-order" key={row.id}>
          <h3>
            {row.ingredient_name} · {row.action}
          </h3>
          <p>
            Review by {row.review_by}. Snapshot expiry exposure:{" "}
            {qty(row.baseline.forecast_expiring_unused)} {row.unit}.
          </p>
          {row.error ? (
            <p role="alert">Recorded outcomes unavailable: {row.error}</p>
          ) : (
            <p>
              {row.outcome_status.replaceAll("_", " ")} · Observed menu
              portions: {row.observed_menu_portions}. Recorded batch waste:{" "}
              {qty(row.recorded_waste_quantity)} {row.unit} across{" "}
              {row.recorded_waste_records} records. Known waste cost:{" "}
              {money(row.known_waste_cost)}; {row.unpriced_waste_records}{" "}
              unpriced records.
            </p>
          )}
          <p>{row.note}</p>
          {row.reviewed_at ? (
            <p>Outcome note: {row.outcome_note}</p>
          ) : (
            <>
              <label>
                What happened?
                <textarea
                  maxLength={1000}
                  value={notes[row.id] || ""}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [row.id]: e.target.value }))
                  }
                />
              </label>
              <button
                disabled={!notes[row.id]?.trim()}
                onClick={() => record(row.id)}
              >
                Record browser follow-up note
              </button>
            </>
          )}
        </article>
      ))}
      {state.rows && !state.rows.length && (
        <p>No saved decisions in this browser yet.</p>
      )}
      <details><summary>Storage &amp; outcome limitations</summary>
        <p>Up to 20 signed decisions and their follow-up notes are kept in this browser. Clearing browser storage removes them; download a copy to keep a backup. Signed baseline evidence is checked on the server, but this is not a shared decision log.</p>
        <p>Outcomes apply only to the saved batches and menus. No waste records does not prove no waste. Recorded sales and costs do not establish savings caused by the decision or a promotion.</p>
      </details>
      <div className="fc-workflow-links"><Link to="/admin/reports#costs">
        Record actual waste & costs in Sales
      </Link></div>
    </details>
  );
}
