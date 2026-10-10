import { ArrowRight, SlidersHorizontal } from "lucide-react";
const money = (n) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    n,
  );
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
export default function DecisionRehearsal({
  baselineCost,
  estimate,
  percent,
  onPercent,
}) {
  const total = estimate.avoidedLoss + estimate.remainingLoss;
  const breakEven =
    baselineCost > 0 ? (estimate.actionCost / baselineCost) * 100 : null;
  return (
    <section
      className="fc-rehearsal"
      aria-label="Hypothetical decision rehearsal"
    >
      <div className="fc-rehearsal-heading">
        <SlidersHorizontal aria-hidden="true" />
        <div>
          <span className="pantry-kicker">
            MANAGER ASSUMPTIONS · NOT A MODEL OUTCOME
          </span>
          <h3>Rehearse the tradeoff before you act</h3>
        </div>
      </div>
      <div className="fc-rehearsal-stage">
        <div className="fc-rehearsal-before">
          <span>Baseline waste exposure</span>
          <strong>{money(baselineCost)}</strong>
          <p>Potential waste cost from simulated stock</p>
        </div>
        <ArrowRight className="fc-rehearsal-arrow" aria-hidden="true" />
        <div className="fc-rehearsal-after">
          <span>Your hypothetical plan</span>
          <div className="fc-loss-split" aria-hidden="true">
            <span
              style={{
                width: `${total > 0 ? (estimate.avoidedLoss / total) * 100 : 0}%`,
              }}
            />
          </div>
          <p>
            <span className="fc-split-dot avoided" />{" "}
            {money(estimate.avoidedLoss)} assumed avoided
            <br />
            <span className="fc-split-dot remaining" />{" "}
            {money(estimate.remainingLoss)} remaining waste cost
          </p>
          <p>Plus {money(estimate.actionCost)} assumed action cost</p>
        </div>
      </div>
      <label className="fc-rehearsal-slider">
        Adjust assumed waste avoided: <strong>{qty(Number(percent))}%</strong>
        <input
          aria-label="Adjust assumed waste avoided"
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={percent}
          onChange={(e) => onPercent(e.target.value)}
        />
      </label>
      <div
        className={`fc-rehearsal-verdict ${estimate.netBenefit < 0 ? "negative" : ""}`}
        role="status"
      >
        <strong>{money(estimate.netBenefit)} hypothetical net benefit</strong>
        <p>
          {estimate.netBenefit < 0
            ? "Under these assumptions, the action costs more than the waste cost it avoids."
            : estimate.netBenefit === 0
              ? "Under these assumptions, the avoided waste cost equals the action cost."
              : "Under these assumptions, avoided waste cost exceeds the action cost."}
        </p>
      </div>
      <p className="pd-note">
        {breakEven === null
          ? "With zero baseline waste cost, this worksheet cannot estimate a benefit from waste avoidance."
          : breakEven > 100
            ? "Even 100% waste avoidance would not cover the entered action cost."
            : `Break-even: ${qty(breakEven)}% assumed waste avoidance (action cost ÷ baseline waste cost).`}
      </p>
      <p className="pd-note">
        Changing this slider changes your assumption only. It does not call the
        model, predict an action outcome, recover shortages, or replace the
        purchasing recommendation.
      </p>
    </section>
  );
}
