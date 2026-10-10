import { useState } from "react";
import RiskMap from "./RiskMap";
import "./actionComparison.css";

const measures = [
  ["forecast_demand_kg", "Ingredient need", "kg"],
  ["expiring_unused_kg", "Potential waste", "kg"],
  ["shortfall_kg", "Shortage exposure", "kg"],
  ["potential_waste_cost_myr", "Waste cost exposure", "MYR"],
];
const number = (value) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(value);
export default function ActionComparison({ risk, scenarioRisk, isFixture }) {
  const [view, setView] = useState("baseline");
  const selected = view === "baseline" ? risk : scenarioRisk;
  return (
    <section className="fc-comparison" aria-label="Action comparison workspace">
      <header>
        <span className="pd-eyebrow">
          DECISION WORKBENCH ·{" "}
          {isFixture ? "FRONTEND FIXTURES" : "API EVIDENCE"}
        </span>
        <h3>What changes for {risk.ingredient_id}?</h3>
        <p>
          Inspect each outcome together. Less waste can still leave a shortage.
        </p>
      </header>
      <div
        className="fc-comparison-switch"
        role="group"
        aria-label="Inspect outcome"
      >
        <button
          aria-pressed={view === "baseline"}
          onClick={() => setView("baseline")}
        >
          Baseline plan
        </button>
        <button
          aria-pressed={view === "promotion"}
          onClick={() => setView("promotion")}
        >
          Promotion what-if{!scenarioRisk ? " · unavailable" : ""}
        </button>
      </div>
      <p role="status">
        {view === "baseline"
          ? "Baseline forecast with simulated operations."
          : scenarioRisk
            ? "Hypothetical promotion flags with simulated operations. Observational comparison; no causal benefit is established."
            : "No promotion result for this ingredient. Calculate the scenario below; missing ingredient evidence remains unavailable."}
      </p>
      <div className="fc-comparison-meters">
        {measures.map(([field, label, unit]) => {
          const value = selected?.[field];
          const before = risk[field];
          const delta = value != null && before != null ? value - before : null;
          const scale = Math.max(before ?? 0, scenarioRisk?.[field] ?? 0, 1);
          return (
            <article key={field}>
              <span>{label}</span>
              <strong>
                {value == null ? "Unavailable" : `${number(value)} ${unit}`}
              </strong>
              <div className="fc-comparison-track" aria-hidden="true">
                <i
                  style={{
                    width: `${value == null ? 0 : (value / scale) * 100}%`,
                  }}
                />
              </div>
              <small>
                {view === "baseline"
                  ? "Reference estimate"
                  : delta === null
                    ? "Difference unavailable"
                    : `${delta > 0 ? "+" : ""}${number(delta)} ${unit} versus baseline`}
              </small>
            </article>
          );
        })}
      </div>
      <p className="pd-note">
        Each bar uses its own baseline/scenario scale; compare the numbers
        across measures.
      </p>
      <RiskMap risk={risk} scenarioRisk={scenarioRisk} />
      <details>
        <summary>Which decisions can we evaluate?</summary>
        <ul>
          <li>
            <strong>Promotion flags:</strong> returned demand, waste and
            shortage can be compared. Discount spend, revenue and profit are
            unavailable.
          </li>
          <li>
            <strong>Purchasing:</strong> baseline guidance is “{risk.action}”.
            The API does not calculate an adjusted-purchase outcome or supplier
            cost.
          </li>
          <li>
            <strong>Menu priorities:</strong> a verified local recipe mapping
            and action outcome are unavailable.
          </li>
        </ul>
        <p>
          No action is applied. Keep the baseline recommendation until
          operational assumptions are verified.
        </p>
      </details>
    </section>
  );
}
