import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { rankRisks } from "./api";
import { estimateTradeoff } from "./decisionMath";
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
  expiry_surplus: "Potential ingredient waste",
  shortage: "Potential ingredient shortage",
  expiry_surplus_and_shortage: "Waste and shortage exposure",
};
const steps = [
  "Spot the problem",
  "Understand why",
  "Explore actions",
  "Compare tradeoffs",
  "Review recommendation",
];
export default function DecisionAssistant({ baseline, scenario, onPromotion }) {
  const risks = rankRisks(baseline.ingredient_risks).filter(
    (r) => r.risk_type !== "none",
  );
  const [params, setParams] = useSearchParams();
  const ingredient = params.get("ingredient") || "";
  function setIngredient(value) {
    const next = new URLSearchParams(params);
    next.set("ingredient", value);
    next.delete("step");
    next.delete("action");
    setParams(next, { replace: true });
  }
  const risk = risks.find((r) => r.ingredient_id === ingredient) || risks[0];
  if (!risk)
    return (
      <section className="pd-card" role="status">
        <h2>No ingredient problems reported</h2>
        <p>
          The calculation returned no waste or shortage issues for this center.
          Review the secondary analytics for evidence; this is not a food safety
          guarantee.
        </p>
      </section>
    );
  return (
    <section className="fc-assistant">
      <div className="fc-issue-picker">
        <label>
          Choose a problem to work through
          <select
            aria-label="Ingredient problem"
            value={risk.ingredient_id}
            onChange={(e) => setIngredient(e.target.value)}
          >
            {risks.map((r) => (
              <option key={r.ingredient_id} value={r.ingredient_id}>
                {r.ingredient_id} · {issues[r.risk_type]}
              </option>
            ))}
          </select>
        </label>
        <p>
          {risks.length} issues · ordered by the backend’s waste-cost, expiry
          and shortage rules. Unknown cost does not mean no risk.
        </p>
      </div>
      <DecisionJourney
        key={`${baseline.center_id}:${baseline.week}:${risk.ingredient_id}`}
        risk={risk}
        baseline={baseline}
        scenario={scenario}
        onPromotion={onPromotion}
      />
    </section>
  );
}
function DecisionJourney({ risk, baseline, scenario, onPromotion }) {
  const [params, setParams] = useSearchParams();
  const value = Number(params.get("step") || 0);
  const step = Number.isInteger(value) && value >= 0 && value < 5 ? value : 0;
  const action = ["purchasing", "menu", "promotion"].includes(
    params.get("action"),
  )
    ? params.get("action")
    : "purchasing";
  function setStep(nextStep) {
    const next = new URLSearchParams(params);
    next.set(
      "step",
      String(typeof nextStep === "function" ? nextStep(step) : nextStep),
    );
    setParams(next, { replace: true });
  }
  function setAction(value) {
    const next = new URLSearchParams(params);
    next.set("action", value);
    setParams(next, { replace: true });
  }
  const [cost, setCost] = useState("");
  const [percent, setPercent] = useState("");
  const scenarioRisk = scenario?.ingredient_risks.find(
    (r) => r.ingredient_id === risk.ingredient_id,
  );
  const estimate = estimateTradeoff(
    risk.potential_waste_cost_myr,
    cost,
    percent,
  );
  const actions = [
    {
      id: "purchasing",
      title: "Adjust purchasing",
      detail: risk.action,
      limit: `Backend illustrative reorder: ${qty(risk.illustrative_reorder_kg)} kg. Supplier prices and lead times remain unverified.`,
    },
    {
      id: "menu",
      title: "Review preparation and menu priorities",
      detail:
        "Review eligible batches in expiry order and identify meals that use this ingredient.",
      limit:
        "The API does not supply a verified ingredient-to-local-menu mapping or an outcome for this action. Confirm recipes and food safety before prioritizing meals.",
    },
    {
      id: "promotion",
      title: "Explore a promotion scenario",
      detail: "Compare the model response to hypothetical promotion flags.",
      limit:
        "Prices are assumed; response is observational, not causal uplift. No promotion is activated.",
    },
  ];
  return (
    <>
      <ol className="fc-steps" aria-label="Decision journey">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => setStep(i)}
              aria-current={step === i ? "step" : undefined}
            >
              <span>{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <section className="pd-card fc-problem" aria-live="polite">
        <span className="pd-eyebrow">
          STEP {step + 1} OF 5 · CENTER {baseline.center_id} · WEEK{" "}
          {baseline.week}
        </span>
        {step === 0 && (
          <>
            <h2>
              {issues[risk.risk_type]}: {risk.ingredient_id}
            </h2>
            <p>
              Here is the problem the forecast and simulated inventory
              calculation suggest you should review.
            </p>
            <div className="fc-facts">
              <div>
                <span>Expiring unused</span>
                <strong>{qty(risk.expiring_unused_kg)} kg</strong>
              </div>
              <div>
                <span>Expected shortfall</span>
                <strong>{qty(risk.shortfall_kg)} kg</strong>
              </div>
              <div>
                <span>Potential waste exposure</span>
                <strong>{money(risk.potential_waste_cost_myr)}</strong>
              </div>
            </div>
            <p className="pd-note">
              This is a predicted planning problem using simulated operational
              inputs, not observed waste or a local stock alert.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Why might this happen?</h2>
            <p className="fc-explanation">{risk.explanation}</p>
            <div className="fc-facts">
              <div>
                <span>Forecast ingredient need</span>
                <strong>{qty(risk.forecast_demand_kg)} kg</strong>
              </div>
              <div>
                <span>Eligible stock</span>
                <strong>{qty(risk.available_kg)} kg</strong>
              </div>
              <div>
                <span>External meal forecasts</span>
                <strong>{baseline.meal_forecasts.length} meals</strong>
              </div>
            </div>
            <p>{risk.risk_inputs_note}</p>
            <p className="pd-note">
              The backend derives ingredient need from model orders and
              simulated recipes. Weekly expiry is an inclusive bucket.
              Individual forecast uncertainty bounds are not available.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h2>What could you do?</h2>
            <p>
              Choose an action to explore. The backend purchasing guidance stays
              visible throughout; selecting an alternative does not make it an
              optimized recommendation.
            </p>
            <fieldset className="fc-actions">
              <legend>Possible actions</legend>
              {actions.map((a) => (
                <label key={a.id} className={action === a.id ? "selected" : ""}>
                  <input
                    type="radio"
                    name="decision-action"
                    value={a.id}
                    checked={action === a.id}
                    onChange={() => {
                      setAction(a.id);
                      setCost("");
                      setPercent("");
                    }}
                  />
                  <span>
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                    <small>{a.limit}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {action === "promotion" && (
              <button onClick={onPromotion}>
                {scenario
                  ? "Refresh promotion comparison"
                  : "Calculate promotion what-if"}
              </button>
            )}
            <p className="pd-note">
              No purchases, promotions, messages or inventory changes are
              executed.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Compare costs, benefits and risks</h2>
            <h3>API evidence · {risk.ingredient_id}</h3>
            <div className="pd-table-wrap">
              <table>
                <caption>
                  Same center and week · costs and stock are simulated
                </caption>
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Current baseline</th>
                    <th>Promotion what-if</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Ingredient demand</td>
                    <td>{qty(risk.forecast_demand_kg)} kg</td>
                    <td>
                      {scenarioRisk
                        ? `${qty(scenarioRisk.forecast_demand_kg)} kg`
                        : "Not calculated"}
                    </td>
                  </tr>
                  <tr>
                    <td>Expiring unused</td>
                    <td>{qty(risk.expiring_unused_kg)} kg</td>
                    <td>
                      {scenarioRisk
                        ? `${qty(scenarioRisk.expiring_unused_kg)} kg`
                        : "Not calculated"}
                    </td>
                  </tr>
                  <tr>
                    <td>Shortfall</td>
                    <td>{qty(risk.shortfall_kg)} kg</td>
                    <td>
                      {scenarioRisk
                        ? `${qty(scenarioRisk.shortfall_kg)} kg`
                        : "Not calculated"}
                    </td>
                  </tr>
                  <tr>
                    <td>Potential waste cost</td>
                    <td>{money(risk.potential_waste_cost_myr)}</td>
                    <td>
                      {scenarioRisk
                        ? money(scenarioRisk.potential_waste_cost_myr)
                        : "Not calculated"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!scenario && (
              <button onClick={onPromotion}>Calculate promotion what-if</button>
            )}
            <p>{actions.find((a) => a.id === action).limit}</p>
            <p className="pd-note">
              Purchasing and preparation action outcomes are not supplied by API
              v1. Promotion differences do not prove causal benefits. Both waste
              and shortage may persist.
            </p>
            <div className="fc-worksheet">
              <h3>Optional financial worksheet · hypothetical assumptions</h3>
              <p>
                For “{actions.find((a) => a.id === action).title}”, enter your
                own action cost and assumed avoided waste percentage. These
                values are not returned by the model and do not change its
                recommendation. This worksheet estimates waste-cost tradeoffs
                only; it excludes sales revenue, shortage recovery and other
                unspecified costs.
              </p>
              <div className="fc-assumption-inputs">
                <label>
                  Assumed total action cost (MYR)
                  <input
                    aria-label="Assumed total action cost (MYR)"
                    type="number"
                    min="0"
                    step="any"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Enter assumption"
                  />
                </label>
                <label>
                  Assumed waste avoided (%)
                  <input
                    aria-label="Assumed waste avoided (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    placeholder="0–100"
                  />
                </label>
              </div>
              {estimate ? (
                <div className="fc-facts" role="status">
                  <div>
                    <span>Hypothetical avoided waste cost</span>
                    <strong>{money(estimate.avoidedLoss)}</strong>
                  </div>
                  <div>
                    <span>Hypothetical remaining waste cost</span>
                    <strong>{money(estimate.remainingLoss)}</strong>
                  </div>
                  <div>
                    <span>Hypothetical net benefit</span>
                    <strong>{money(estimate.netBenefit)}</strong>
                  </div>
                </div>
              ) : (
                <p role="status">
                  {risk.potential_waste_cost_myr === null
                    ? "Cannot estimate financial benefits: baseline waste cost is unknown."
                    : "Enter a nonnegative action cost and a percentage from 0 to 100 to compare. No assumptions are prefilled."}
                </p>
              )}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Recommended action to review</h2>
            <div className="fc-recommendation">
              <span className="pd-eyebrow">
                BASELINE BACKEND GUIDANCE · SIMULATED OPERATIONS
              </span>
              <h3>{risk.action}</h3>
              <p>{risk.explanation}</p>
              <strong>
                Illustrative reorder: {qty(risk.illustrative_reorder_kg)} kg
              </strong>
            </div>
            <p>{risk.risk_inputs_note}</p>
            <p>
              Your explored alternative:{" "}
              <strong>{actions.find((a) => a.id === action).title}</strong>.
              This selection and any worksheet estimates do not replace the
              backend’s guidance.
            </p>
            <p className="pd-note">
              Before deciding: verify actual stock, expiry handling, recipe
              mappings, supplier lead times and prices. The API does not
              establish an optimal purchase, guaranteed savings or food safety.
              No action has been executed.
            </p>
            <button onClick={() => setStep(3)}>Revisit tradeoffs</button>
          </>
        )}
        <div className="fc-journey-controls">
          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          <span>{steps[step]}</span>
          {step < 4 && (
            <button
              className="admin-primary"
              onClick={() => setStep((s) => s + 1)}
            >
              {step === 3 ? "Review recommendation" : "Continue"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
