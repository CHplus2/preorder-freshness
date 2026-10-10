import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import { replayEvidence } from "./replayEvidence";
import { IngredientDrawing } from "./PantryScene";
import "./forecastReplay.css";
const steps = [
  "Demand arrives",
  "Inspect batches",
  "Reveal allocation",
  "Review the outcome",
];
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const money = (n) =>
  n === null
    ? "Unknown cost"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(n);
const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export default function ForecastReplay({ data, risk, isFixture }) {
  const [reduced, setReduced] = useState(reducedMotion);
  const [stage, setStage] = useState(() => (reducedMotion() ? 3 : 0));
  const [playing, setPlaying] = useState(false);
  const evidence = replayEvidence(data, risk.ingredient_id);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = (event) => {
      setReduced(event.matches);
      if (event.matches) {
        setPlaying(false);
        setStage(3);
      }
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!playing || reduced || stage >= steps.length - 1) return;
    const timer = window.setTimeout(() => {
      setStage(stage + 1);
      if (stage === steps.length - 2) setPlaying(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, stage]);
  function goTo(next) {
    setPlaying(false);
    setStage(next);
  }
  return (
    <section
      className={`fc-replay ${playing ? "is-playing" : ""}`}
      aria-label="Weekly forecast evidence replay"
    >
      <header className="fc-replay-heading">
        <div>
          <span className="pantry-kicker">WEEKLY EVIDENCE REPLAY</span>
          <h4>Watch the weekly stock story</h4>
          <p>
            {risk.ingredient_id} · week {data.week} ·{" "}
            {data.promotion_scenario ? "promotion what-if" : "baseline"} ·{" "}
            {isFixture
              ? "frontend fixtures, no model run"
              : "API demand with simulated operations"}
          </p>
        </div>
        <ClipboardCheck size={28} aria-hidden="true" />
      </header>
      <p className="pd-note">
        A staged explanation of results already returned by the API. Animation
        is illustrative, not a shift, transaction log, or new prediction.
      </p>
      <ol className="fc-replay-steps" aria-label="Replay stages">
        {steps.map((s, i) => (
          <li key={s}>
            <button
              aria-current={stage === i ? "step" : undefined}
              onClick={() => goTo(i)}
            >
              {i + 1} · {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="fc-replay-controls">
        <button
          disabled={reduced || stage === 3}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}{" "}
          {playing ? "Pause replay" : "Play replay"}
        </button>
        <button onClick={() => goTo(0)}>
          <RotateCcw size={18} /> Restart replay
        </button>
        <button disabled={stage === 3} onClick={() => goTo(stage + 1)}>
          Next replay stage <ArrowRight size={18} />
        </button>
      </div>
      {reduced && (
        <p className="pd-note">
          Reduced motion is enabled. Results are shown statically; use numbered
          stages or Next to inspect the explanation.
        </p>
      )}
      <div className="fc-replay-stage-heading" role="status">
        <strong>
          Stage {stage + 1} of 4 · {steps[stage]}
        </strong>
        <p>
          {stage === 0
            ? "Begin with the returned forecast for one week. Meal demand is center-wide, not a verified menu-to-ingredient mapping."
            : stage === 1
              ? "Inspect the returned batches in expiry order. Excluded batches remain excluded; expiry uses week buckets."
              : stage === 2
                ? "Reveal the backend's hypothetical consumption allocation. No allocation is recalculated in the browser."
                : "Read the returned risk outcome. Remaining stock is not automatically waste; the API reports expiring-unused stock separately."}
        </p>
      </div>
      <div className="fc-replay-theatre" aria-hidden="true">
        <div>
          <IngredientDrawing name={risk.ingredient_id} />
          <span>Returned stock</span>
        </div>
        <span
          className={`fc-replay-transfer ${stage >= 2 && evidence.allocatedKg > 0 ? "revealed" : ""}`}
        >
          <ArrowRight size={30} />
        </span>
        <div>
          <svg
            viewBox="0 0 160 130"
            className="fc-replay-bowl"
            aria-hidden="true"
          >
            <ellipse cx="80" cy="116" rx="47" ry="6" fill="#304b3c15" />
            <path
              d="M29 63h102q-6 44-51 44T29 63Z"
              fill="#e4ecdd"
              stroke="#466651"
              strokeWidth="3"
            />
            <ellipse
              cx="80"
              cy="63"
              rx="51"
              ry="14"
              fill="#fff9eb"
              stroke="#466651"
              strokeWidth="3"
            />
            <path
              d="M49 87q30 15 61 0"
              stroke="#93a989"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M62 41q-12-11 0-24m21 24q-12-11 0-24m20 24q-12-11 0-24"
              stroke="#93a989"
              strokeWidth="3"
              fill="none"
              className="fc-replay-steam"
            />
          </svg>
          <span>Hypothetical allocation</span>
        </div>
      </div>
      <div className="fc-replay-facts">
        <span>
          Center-wide weekly orders
          <strong>
            {evidence.weeklyOrders === null
              ? "Not returned"
              : qty(evidence.weeklyOrders)}
          </strong>
        </span>
        <span>
          Ingredient forecast need
          <strong>{qty(risk.forecast_demand_kg)} kg</strong>
        </span>
        <span>
          Eligible ingredient stock<strong>{qty(risk.available_kg)} kg</strong>
        </span>
      </div>
      {stage >= 1 && (
        <div className="fc-replay-batches">
          <h5>Returned batch trail · earliest expiry first</h5>
          {!evidence.batches.length ? (
            <p role="status">
              No batch allocations returned. Allocation is unavailable, not
              zero.
            </p>
          ) : (
            <ol>
              {evidence.batches.map((b) => {
                const total = b.consumed_kg + b.remaining_kg;
                return (
                  <li key={b.batch_id} className={b.eligible ? "" : "excluded"}>
                    <div>
                      <strong>{b.batch_id}</strong>
                      <span>
                        Expiry week {b.expiry_week} ·{" "}
                        {b.eligible
                          ? "Eligible"
                          : `Excluded: ${b.exclusion_reason}`}
                      </span>
                    </div>
                    {stage >= 2 ? (
                      <>
                        <div className="fc-replay-batch-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${total ? (b.consumed_kg / total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p>
                          {qty(b.consumed_kg)} kg allocated ·{" "}
                          {qty(b.remaining_kg)} kg remaining
                        </p>
                      </>
                    ) : (
                      <p>Allocation is revealed in the next stage.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
      {stage >= 2 && (
        <p className="fc-replay-allocated">
          Returned eligible-batch allocation:{" "}
          <strong>
            {evidence.allocatedKg === null
              ? "Unavailable"
              : `${qty(evidence.allocatedKg)} kg`}
          </strong>
          . This may differ from forecast need when stock cannot cover it.
        </p>
      )}
      {stage === 3 && (
        <div className="fc-replay-outcome">
          <h5>Returned outcome · {risk.ingredient_id}</h5>
          <div className="fc-replay-facts">
            <span>
              May expire unused
              <strong>{qty(risk.expiring_unused_kg)} kg</strong>
            </span>
            <span>
              Expected shortfall<strong>{qty(risk.shortfall_kg)} kg</strong>
            </span>
            <span>
              Potential waste cost
              <strong>{money(risk.potential_waste_cost_myr)}</strong>
            </span>
          </div>
          <p>{risk.explanation}</p>
          <p className="pd-note">
            These results are based on simulated stock and recipes. No action
            has been applied and no savings are claimed.
          </p>
        </div>
      )}
      <p className="pd-note">
        No daily demand, customer arrivals, sales revenue, profit, or
        food-safety deadline is inferred. Playback does not call the API or
        change stock.
      </p>
    </section>
  );
}
