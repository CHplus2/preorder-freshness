import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Utensils, Package, ArrowRight } from "lucide-react";
import { rankRisks } from "./api";
import { problemSummary } from "./problemSummary";
import { IngredientDrawing } from "./PantryScene";
import "./evidenceExperiences.css";
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const money = (n) =>
  n === null
    ? "Cost unknown"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(n);

export function DemandExplorer({ rows, scenario, week, isFixture }) {
  const [inspected, setInspected] = useState(null);
  const [display, setDisplay] = useState("baseline");
  const selected = rows.find((r) => r.meal_id === inspected) || rows[0];
  const scenarioMeals = new Map(
    scenario?.meal_forecasts.map((r) => [r.meal_id, r.predicted_orders]) || [],
  );
  const promotion = display === "promotion" && !!scenario;
  const maximum = Math.max(
    1,
    ...rows.map((r) => r.predicted_orders),
    ...scenarioMeals.values(),
  );
  const valueFor = (r) =>
    promotion ? scenarioMeals.get(r.meal_id) : r.predicted_orders;
  if (!selected) return null;
  const alternate = scenarioMeals.get(selected.meal_id);
  return (
    <section
      className="fc-order-board"
      aria-label="Interactive forecast order board"
    >
      <div className="fc-board-heading">
        <div>
          <span className="pantry-kicker">THE WEEK AHEAD · WEEK {week}</span>
          <h3>Explore the forecast order board</h3>
          <p>Select a meal ticket to inspect its estimated demand.</p>
        </div>
        <Utensils size={32} aria-hidden="true" />
      </div>
      <div
        className="fc-board-switch"
        role="group"
        aria-label="Forecast board scenario"
      >
        <button
          aria-pressed={!promotion}
          onClick={() => setDisplay("baseline")}
        >
          Baseline forecast
        </button>
        <button
          aria-pressed={promotion}
          disabled={!scenario}
          onClick={() => setDisplay("promotion")}
        >
          Promotion what-if
        </button>
      </div>
      {!scenario && (
        <p className="pd-note">
          To compare a promotion, select the promotion scenario in Kitchen &
          data.
        </p>
      )}
      <div
        className="fc-order-tickets"
        role="group"
        aria-label="Meal forecast tickets"
      >
        {rows.map((r) => (
          <button
            key={r.meal_id}
            className="fc-order-ticket"
            aria-label={`Inspect forecast meal ${r.meal_id}`}
            aria-pressed={selected.meal_id === r.meal_id}
            onClick={() => setInspected(r.meal_id)}
          >
            <span className="fc-ticket-code">MEAL {r.meal_id}</span>
            <Utensils size={25} aria-hidden="true" />
            <strong>
              {valueFor(r) === undefined ? "Unavailable" : qty(valueFor(r))}
            </strong>
            <span>estimated orders</span>
            <span className="fc-ticket-bar" aria-hidden="true">
              <span
                style={{ width: `${((valueFor(r) ?? 0) / maximum) * 100}%` }}
              />
            </span>
            <span className="fc-ticket-footer">
              {promotion ? "Promotion scenario" : "Baseline forecast"}
            </span>
          </button>
        ))}
      </div>
      <div className="fc-ticket-inspector" aria-live="polite">
        <h3>Meal {selected.meal_id} · the demand story</h3>
        <p>
          {isFixture ? "Fixture estimate" : "Model estimate"}:{" "}
          <strong>{qty(selected.predicted_orders)} baseline orders</strong> for
          this week. This is expected demand, not confirmed bookings.
        </p>
        {scenario && (
          <p>
            {alternate === undefined ? (
              "This meal has no returned promotion estimate."
            ) : (
              <>
                Promotion what-if: <strong>{qty(alternate)} orders</strong> ·{" "}
                {qty(alternate - selected.predicted_orders)} orders difference
                from baseline. Scenario differences do not prove promotion
                uplift.
              </>
            )}
          </p>
        )}
        <p className="pd-note">
          External meal ID; no verified mapping to your menu. This API supplies
          one forecast week, with no historical series or uncertainty interval.
        </p>
      </div>
    </section>
  );
}

export function InventoryExplorer({ data }) {
  const [filter, setFilter] = useState("all");
  const [inspected, setInspected] = useState(null);
  const [params] = useSearchParams();
  const filters = [
    { id: "all", label: "All ingredients" },
    { id: "waste", label: "Waste exposure" },
    { id: "shortage", label: "Stock gaps" },
  ];
  const rows = rankRisks(data.ingredient_risks).filter(
    (r) =>
      filter === "all" ||
      (filter === "waste" ? r.expiring_unused_kg > 0 : r.shortfall_kg > 0),
  );
  const selected = rows.find((r) => r.ingredient_id === inspected) || rows[0];
  const batches = data.batch_allocations
    .filter((r) => r.ingredient_id === selected?.ingredient_id)
    .toSorted(
      (a, b) =>
        a.expiry_week - b.expiry_week || a.batch_id.localeCompare(b.batch_id),
    );
  const decisionParams = new URLSearchParams(params);
  if (selected) decisionParams.set("ingredient", selected.ingredient_id);
  decisionParams.set("step", "0");
  decisionParams.delete("action");
  return (
    <section
      className="fc-stock-room"
      aria-label="Interactive ingredient stock shelf"
    >
      <div className="fc-board-heading">
        <div>
          <span className="pantry-kicker">
            INSIDE THE STOCK ROOM · SIMULATED OPERATIONS
          </span>
          <h3>Which stock needs a closer look?</h3>
          <p>Pick an ingredient, then follow its batches in expiry order.</p>
        </div>
        <Package size={32} aria-hidden="true" />
      </div>
      <div
        className="fc-board-switch"
        role="group"
        aria-label="Stock issue filter"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <p role="status" className="pd-empty">
          No ingredients match this view.
        </p>
      ) : (
        <>
          <div
            className="fc-stock-shelf"
            role="group"
            aria-label="Ingredient evidence cards"
          >
            {rows.map((r) => (
              <button
                key={r.ingredient_id}
                className="fc-stock-box"
                aria-label={`Inspect stock ${r.ingredient_id}`}
                aria-pressed={selected.ingredient_id === r.ingredient_id}
                onClick={() => setInspected(r.ingredient_id)}
              >
                <IngredientDrawing name={r.ingredient_id} />
                <strong>{r.ingredient_id}</strong>
                <span>
                  {r.expiring_unused_kg > 0
                    ? `${qty(r.expiring_unused_kg)} kg may expire`
                    : r.shortfall_kg > 0
                      ? `${qty(r.shortfall_kg)} kg shortfall`
                      : "No reported risk"}
                </span>
                {r.expiring_unused_kg > 0 && r.shortfall_kg > 0 && (
                  <span>{qty(r.shortfall_kg)} kg shortfall too</span>
                )}
                <small>
                  {money(r.potential_waste_cost_myr)} · potential waste
                </small>
              </button>
            ))}
          </div>
          <div className="fc-stock-inspector">
            <div aria-live="polite">
              <h3>{selected.ingredient_id} · stock story</h3>
              <p>{problemSummary(selected)}</p>
              <p>{selected.explanation}</p>
            </div>
            <div className="fc-stock-facts">
              <span>
                Forecast need{" "}
                <strong>{qty(selected.forecast_demand_kg)} kg</strong>
              </span>
              <span>
                Eligible stock <strong>{qty(selected.available_kg)} kg</strong>
              </span>
              <span>
                Waste exposure{" "}
                <strong>{money(selected.potential_waste_cost_myr)}</strong>
              </span>
            </div>
            <h4>Batch trail · earliest expiry first</h4>
            <p className="pd-note">
              Hypothetical FEFO allocation. Week buckets are not calendar
              deadlines or a food safety assessment.
            </p>
            {!batches.length ? (
              <p role="status">
                No batch allocations returned for this ingredient.
              </p>
            ) : (
              <ol className="fc-batch-trail">
                {batches.map((b) => {
                  const total = b.consumed_kg + b.remaining_kg;
                  return (
                    <li key={b.batch_id}>
                      <div>
                        <strong>{b.batch_id}</strong>
                        <span>
                          Expiry week {b.expiry_week} ·{" "}
                          {b.eligible
                            ? "Eligible"
                            : `Excluded: ${b.exclusion_reason}`}
                        </span>
                      </div>
                      <div className="fc-batch-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${total ? (b.consumed_kg / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p>
                        {qty(b.consumed_kg)} kg allocated ·{" "}
                        {qty(b.remaining_kg)} kg remaining ·{" "}
                        {money(b.potential_waste_cost_myr)} potential waste
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
            {selected.risk_type !== "none" && (
              <Link
                className="fc-open-decision"
                to={{
                  pathname: "/admin/ai/decisions",
                  search: `?${decisionParams}`,
                }}
              >
                {data.promotion_scenario
                  ? "Review baseline decision"
                  : "Explore this decision"}
                <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </>
      )}
      <p className="pd-note">
        Ingredient quantities are center-wide. Shelf positions are decorative;
        stock, recipes and costs are simulated.
      </p>
    </section>
  );
}
