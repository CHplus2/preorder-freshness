import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IngredientDrawing } from "./PantryScene";
import { KitchenRoom } from "./KitchenWalkthrough";
import VerificationChecklist from "./VerificationChecklist";
import KitchenPurchaseComparison from "./KitchenPurchaseComparison";
import KitchenForecastReplay from "./KitchenForecastReplay";
import {
  decisionSlip,
  kitchenActions,
  marketingWorksheet,
  workflowLinks,
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
const steps = [
  "Spot the problem",
  "Understand why",
  "Explore actions",
  "Compare tradeoffs",
  "Review recommendation",
];
const signals = {
  confirmed_shortage: "Confirmed stock gap",
  forecast_waste: "Forecast waste exposure",
  review: "Needs verification",
  watch: "Monitor",
};
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
  const risks = support.ingredient_risks.filter((r) => r.signal !== "watch");
  const ordered = [...risks].sort((a, b) =>
    lens === "waste"
      ? (b.forecast_waste_cost_myr ?? -1) - (a.forecast_waste_cost_myr ?? -1)
      : lens === "shortage"
        ? Number(b.shortfall_quantity > 0) - Number(a.shortfall_quantity > 0)
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
  const rawStep = Number(params.get("step") || 0),
    step =
      Number.isInteger(rawStep) && rawStep >= 0 && rawStep < 5 ? rawStep : 0;
  const action =
    kitchenActions.find((a) => a.id === params.get("action")) ||
    kitchenActions.find(
      (a) =>
        a.id ===
        (selected?.signal === "review"
          ? "wait"
          : selected?.signal === "forecast_waste"
            ? "menu"
            : "purchasing"),
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
  }, [step, selected?.ingredient_id]);
  if (!selected)
    return (
      <>
        <ol className="fc-steps" aria-label="Decision journey">
          {steps.map((label, i) => (
            <li key={label}>
              <button disabled>
                <span>{i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <section className="pantry-scene">
          <div className="fc-room">
            <KitchenRoom />
          </div>
        </section>
        <section className="pd-card">
          <h2>No current action flagged</h2>
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
          {support.alert_count} evidence-backed planning signals ·{" "}
          {support.review_count} cases need verification.{" "}
          {plan.coverage.excluded_orders} active orders excluded from stock
          allocation.
        </p>
        <div
          className="fc-comparison-switch"
          role="group"
          aria-label="Kitchen focus"
        >
          {[
            ["priority", "Priority"],
            ["waste", "Waste cost first"],
            ["shortage", "Confirmed shortages first"],
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
        <p>
          Mixed units are never ranked against one another. Unknown cost stays
          unknown.
        </p>
      </div>
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
                      className={`fc-hotspot ${risk.shortfall_quantity > 0 ? "gap" : "waste"}`}
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
                        <small>{signals[risk.signal]}</small>
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
                <p>{r.alert_reason}</p>
                <strong>
                  {qty(r.forecast_expiring_unused)} {r.unit} projected unused at
                  expiry
                </strong>
                <p>{money(r.forecast_waste_cost_myr)} estimated exposure</p>
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
                    <span>{signals[risk.signal]}</span>
                    <small>
                      {qty(risk.forecast_expiring_unused)} {risk.unit} ·{" "}
                      {money(risk.forecast_waste_cost_myr)}
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
                  {risk.ingredient_name} · {signals[risk.signal]}
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
          value={r.ingredient_id}
          onChange={(e) => choose("ingredient", e.target.value)}
        >
          {ordered.map((risk) => (
            <option key={risk.ingredient_id} value={risk.ingredient_id}>
              {risk.ingredient_name} · {signals[risk.signal]}
            </option>
          ))}
        </select>
      </label>
      <ol className="fc-steps" aria-label="Decision journey">
        {steps.map((label, i) => (
          <li key={label}>
            <button
              aria-current={step === i ? "step" : undefined}
              onClick={() => choose("step", i)}
            >
              <span>{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section className="pd-card fc-problem" aria-live="polite">
        <span className="pd-eyebrow">
          STEP {step + 1} OF 5 · LOCAL KITCHEN EVIDENCE
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {step === 0
            ? `${signals[r.signal]}: ${r.ingredient_name}`
            : steps[step]}
        </h2>
        {step === 0 && (
          <>
            <p className="fc-problem-summary">{r.alert_reason}</p>
            <div className="fc-facts">
              <div>
                <span>Projected unused at expiry</span>
                <strong>
                  {qty(r.forecast_expiring_unused)} {r.unit}
                </strong>
              </div>
              <div>
                <span>Confirmed stock gap</span>
                <strong>
                  {qty(r.shortfall_quantity)} {r.unit}
                </strong>
              </div>
              <div>
                <span>Potential waste exposure</span>
                <strong>{money(r.forecast_waste_cost_myr)}</strong>
              </div>
            </div>
            <p>
              Act before {r.urgent_by || plan.window.end_date}.{" "}
              {r.confidence === "limited"
                ? "Verification is needed before treating forecast exposure as an alert."
                : "The forecast has a chronological evaluation; future performance can differ."}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p className="fc-explanation">{r.explanation}</p>
            <div className="fc-facts">
              <div>
                <span>Confirmed recipe requirement</span>
                <strong>
                  {qty(r.confirmed_requirement)} {r.unit}
                </strong>
              </div>
              <div>
                <span>Additional forecast requirement</span>
                <strong>
                  {qty(r.forecast_requirement)} {r.unit}
                </strong>
              </div>
              <div>
                <span>Eligible stock</span>
                <strong>
                  {qty(r.eligible_stock)} {r.unit}
                </strong>
              </div>
            </div>
            <p>
              Projected waste sensitivity: {qty(r.waste_sensitivity_low)}–
              {qty(r.waste_sensitivity_high)} {r.unit}. This is not a calibrated
              prediction interval. Existing bookings are not added twice.
            </p>
            <MenuEvidence support={support} risk={r} />
            <p>
              Stock is allocated by expiry after confirmed needs; speculative
              demand uses current recipes and conservative delivery dates.
            </p>
            <Link to={links.menus}>Review menu recipes</Link> ·{" "}
            <Link to={links.preparation}>Check preparation dates</Link>
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
                    onChange={() => choose("action", a.id)}
                  />
                  <span>
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="fc-brief-actions">
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
                <h3>{action.title}</h3>
                <p>
                  Confirmed gap: {qty(r.shortfall_quantity)} {r.unit}. Projected
                  expiry exposure: {qty(r.forecast_expiring_unused)} {r.unit}.
                </p>
                <p>
                  A schedule change is not simulated here: use the planner to
                  verify actual tasks, equipment, lead time and freshness before
                  adopting it.
                </p>
                <Link to={links.preparation}>Review preparation options</Link> ·{" "}
                <Link to={links.menus}>Review recipes</Link>
              </>
            )}
            <p>
              Compare against “monitor”: no assumed action cost, with the same
              baseline exposure. Projected exposure is not measured waste or
              realised savings.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <div className="fc-recommendation">
              <span className="pd-eyebrow">RECOMMENDATION TO REVIEW</span>
              <h3>
                {r.shortfall_quantity > 0
                  ? "Cover the confirmed gap before speculative demand"
                  : r.signal === "review"
                    ? "Verify the evidence before buying or promoting"
                    : "Review expiring surplus before placing the next purchase"}
              </h3>
              <p>{r.alert_reason}</p>
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
      <details className="pd-card">
        <summary>Forecast assumptions & alert rules</summary>
        <ul>
          {support.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
      <DecisionReviewBoard revision={save.revision} />
    </section>
  );
}

export function MenuEvidence({ support, risk }) {
  const menus = support.menus.filter(
    (m) => !risk || risk.menus.some((r) => r.product_id === m.product_id),
  );
  return (
    <div className="pd-table-wrap">
      <table>
        <caption>
          Local menu demand · selected on validation; latest 14 days held out
          when sufficient history exists
        </caption>
        <thead>
          <tr>
            <th>Menu</th>
            <th>Expected portions</th>
            <th>Additional to bookings</th>
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
                {m.history_days} days · {m.confidence}
                {!m.recipe_complete ? " · recipe missing" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!menus.length && (
        <p>
          No active mapped menu with eligible sales history. Review recipes and
          sales status before using forecast quantities.
        </p>
      )}
      <KitchenForecastReplay menus={menus} />
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

function DecisionReviewBoard({ revision }) {
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
      <summary>Decision follow-up & recorded outcomes</summary>
      <p>
        Up to 20 signed snapshots are saved in this browser. Clearing browser
        storage removes them. Download copies for your showcase. Outcome notes
        are browser-held notes; signed baseline evidence is verified on the
        server.
      </p>
      <label>
        Restore a downloaded decision slip
        <input type="file" accept="application/json,.json" onChange={restore} />
      </label>
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
      <p>
        Recorded outcomes apply only to the snapshot batches and mapped menus.
        No waste records does not prove no waste. Calendar-day sales and
        recorded costs do not establish causal savings or marketing uplift.
      </p>
      <Link to="/admin/reports#costs">
        Record actual waste & costs in Sales
      </Link>
    </details>
  );
}
