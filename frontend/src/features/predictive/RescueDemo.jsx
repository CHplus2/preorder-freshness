import { useEffect, useState, useRef } from "react";
import PlanningFridge, { KitchenKeeper } from "./PlanningFridge";
import { IngredientDrawing } from "./PantryScene";
import ServingScene from "./ServingScene";
import "./rescueDemo.css";
const choices = [
  {
    id: "original",
    name: "Keep original menu",
    sold: 11,
    price: 10,
    side: 0,
    setup: 0,
  },
  {
    id: "special",
    name: "20% chicken special",
    sold: 16,
    price: 8,
    side: 0,
    setup: 8,
  },
  {
    id: "bundle",
    name: "Chicken + side bundle",
    sold: 18,
    price: 12,
    side: 2,
    setup: 12,
  },
];
export default function RescueDemo() {
  const [open, setOpen] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [action, setAction] = useState("original");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const stageHeading = useRef(null);
  const selected = choices.find((item) => item.id === action);
  const sold = Math.floor((selected.sold * progress) / 4);
  const finished = progress === 4;
  const stage = !inspected ? 0 : finished ? 3 : showShift ? 2 : 1;
  useEffect(() => {
    if (open && stage > 0) {
      stageHeading.current?.focus({ preventScroll: true });
      stageHeading.current?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    }
  }, [open, stage]);
  useEffect(() => {
    if (!playing) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    function stopMotion(event) {
      if (event.matches) {
        setPlaying(false);
        setProgress(4);
      }
    }
    query.addEventListener("change", stopMotion);
    const timer = setTimeout(() => {
      if (progress >= 3) {
        setProgress(4);
        setPlaying(false);
      } else setProgress(progress + 1);
    }, 900);
    return () => {
      clearTimeout(timer);
      query.removeEventListener("change", stopMotion);
    };
  }, [playing, progress]);
  function reset() {
    setProgress(0);
    setPlaying(false);
  }
  return (
    <section
      className="fc-rescue-demo"
      aria-label="Illustrative chicken rescue demo"
    >
      <header>
        <span className="pd-eyebrow">
          ILLUSTRATIVE SIMULATION · NOT MODEL OUTPUT
        </span>
        <h2>Can you rescue tomorrow’s chicken?</h2>
        <p>
          A fictional restaurant shift. Open the fridge, choose a plan and watch
          its assumed outcome.
        </p>
        <button
          onClick={() => {
            setOpen(!open);
            setInspected(false);
            setShowShift(false);
            setAction("original");
            reset();
          }}
        >
          {open ? "Close illustrative demo" : "Enter illustrative rescue demo"}
        </button>
      </header>
      {open && (
        <>
          <ol className="fc-rescue-story" aria-label="Rescue story progress">
            {[
              "Inspect the fridge",
              "Choose a plan",
              "Watch the shift",
              "See the impact",
            ].map((label, i) => (
              <li key={label} aria-current={stage === i ? "step" : undefined}>
                <span>{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className={`fc-rescue-layout stage-${stage}`}>
            <div>
              <PlanningFridge count={1} initialOpen={false}>
                <button
                  className="fc-rescue-chicken"
                  onClick={() => setInspected(true)}
                  aria-pressed={inspected}
                >
                  <IngredientDrawing name="chicken" />
                  <strong>Chicken · expires tomorrow in this story</strong>
                  <span>20 fictional portions · tap to inspect</span>
                </button>
              </PlanningFridge>
            </div>
            <div className="fc-rescue-plan">
              <h3 ref={stageHeading} tabIndex={-1}>
                {
                  [
                    "Inspect the fridge",
                    "Choose your rescue plan",
                    "Watch the illustrative shift",
                    "Review the assumed impact",
                  ][stage]
                }
              </h3>
              {!inspected ? (
                <div className="fc-rescue-welcome">
                  <KitchenKeeper />
                  <h3>Welcome to your little kitchen</h3>
                  <p>
                    Open the fridge and select the chicken package to begin.
                    This story is separate from the API evidence below.
                  </p>
                </div>
              ) : (
                <>
                  <div className="fc-rescue-assistant">
                    <KitchenKeeper />
                    <div>
                      <h3>20 portions need to sell before expiry</h3>
                      <p>
                        Our fictional baseline sells 11. Which plan would you
                        explore?
                      </p>
                    </div>
                  </div>
                  {!showShift && (
                    <>
                      <fieldset>
                        <legend>Choose a fictional action</legend>
                        {choices.map((item) => (
                          <label key={item.id}>
                            <input
                              type="radio"
                              name="rescue-action"
                              checked={action === item.id}
                              onChange={() => {
                                setAction(item.id);
                                reset();
                              }}
                            />
                            {item.name}
                            {item.id === "bundle" && (
                              <small> · scenario’s suggested plan</small>
                            )}
                          </label>
                        ))}
                      </fieldset>
                      <p className="pd-note">
                        The bundle suggestion is authored for this
                        demonstration, not produced by the forecasting model.
                      </p>
                      <button
                        className="admin-primary"
                        onClick={() => setShowShift(true)}
                      >
                        Take this plan to the serving counter
                      </button>
                    </>
                  )}
                  {showShift && (
                    <>
                      <p className="fc-rescue-plan-label">
                        Selected fictional plan:{" "}
                        <strong>{selected.name}</strong>
                      </p>
                      <div
                        className={`fc-rescue-shift ${playing ? "is-playing" : ""}`}
                      >
                        <h3>
                          {finished
                            ? "Illustrative shift complete"
                            : "Your simulated serving counter"}
                        </h3>
                        <ServingScene sold={sold} playing={playing} />
                        <p role="status">
                          {sold} served in playback · {20 - sold} remaining
                          {finished
                            ? " (assumed unsold outcome)"
                            : " (shift not finished)"}
                        </p>
                      </div>
                      <div className="fc-rescue-controls">
                        <button
                          disabled={finished}
                          onClick={() => {
                            if (
                              window.matchMedia(
                                "(prefers-reduced-motion: reduce)",
                              ).matches
                            ) {
                              setProgress(4);
                              setPlaying(false);
                            } else setPlaying(!playing);
                          }}
                        >
                          {playing ? "Pause shift" : "Play illustrative shift"}
                        </button>
                        <button onClick={reset}>Restart shift</button>
                        <button
                          onClick={() => {
                            setProgress(4);
                            setPlaying(false);
                          }}
                        >
                          Show assumed outcome
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          reset();
                          setShowShift(false);
                        }}
                      >
                        Try another plan
                      </button>
                    </>
                  )}
                  {finished && (
                    <div className="fc-rescue-impact">
                      <div
                        className="fc-rescue-outcome-board"
                        aria-label="Illustrative baseline versus selected plan"
                      >
                        <div>
                          <span>Original menu</span>
                          <strong>11 sold / 9 unsold</strong>
                          <span className="fc-rescue-sales-meter">
                            <i style={{ width: "55%" }} />
                          </span>
                          <small>RM 110 revenue · RM 30 contribution</small>
                        </div>
                        <div>
                          <span>{selected.name}</span>
                          <strong>
                            {selected.sold} sold / {20 - selected.sold} unsold
                          </strong>
                          <span className="fc-rescue-sales-meter">
                            <i
                              style={{
                                width: `${(selected.sold / 20) * 100}%`,
                              }}
                            />
                          </span>
                          <small>
                            RM {selected.sold * selected.price} revenue · RM{" "}
                            {selected.sold * selected.price -
                              80 -
                              selected.sold * selected.side -
                              selected.setup}{" "}
                            contribution
                          </small>
                        </div>
                      </div>

                      <h3>What changed in this fictional scenario?</h3>
                      <p>
                        {selected.sold} sold · {20 - selected.sold} unsold.
                        Baseline: 11 sold · 9 unsold.
                      </p>
                      <p>
                        Illustrative revenue: RM{" "}
                        {selected.sold * selected.price}. Remaining-stock cost
                        exposure: RM {(20 - selected.sold) * 4}.
                      </p>
                      <p>
                        Contribution after all chicken stock, sides and setup:
                        RM{" "}
                        {selected.sold * selected.price -
                          80 -
                          selected.sold * selected.side -
                          selected.setup}{" "}
                        (baseline RM 30).
                      </p>
                      <p>
                        Why suggest the bundle here? Its assumed 18 sales leave
                        2 portions and RM 88 contribution. This follows the
                        example’s assumptions; it does not prove a real
                        promotion effect.
                      </p>
                    </div>
                  )}
                  <details>
                    <summary>Scenario assumptions and sensitivity</summary>
                    <p>
                      All 20 portions cost RM 4 each (RM 80 total). Original: 11
                      sales at RM 10. Special: 16 sales at RM 8, plus RM 8
                      setup. Bundle: 18 sales at RM 12, RM 2 side cost per sale
                      and RM 12 setup. No verified recipe, supplier price,
                      actual expiry date or API prediction is used.
                    </p>
                    <p>
                      Try interpreting sales ±2 portions:{" "}
                      {Math.max(0, selected.sold - 2)}–
                      {Math.min(20, selected.sold + 2)} sold;{" "}
                      {20 - Math.min(20, selected.sold + 2)}–
                      {20 - Math.max(0, selected.sold - 2)} unsold. This is an
                      illustrative sensitivity assumption, not a calibrated
                      uncertainty interval.
                    </p>
                    <p>
                      Contribution excludes labor, rent, tax and other overhead;
                      it is not net profit. Playback only reveals preset sales
                      totals, with no timed demand model, purchase, promotion or
                      stock write.
                    </p>
                  </details>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
