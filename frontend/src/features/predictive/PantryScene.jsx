import {
  ArrowUpRight,
  PackageCheck,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import "./pantry.css";
import { problemSummary } from "./problemSummary";
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const money = (n) =>
  n === null
    ? "Cost unknown"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        maximumFractionDigits: 2,
      }).format(n);
const labels = {
  expiry_surplus: "Waste exposure",
  shortage: "Stock gap",
  expiry_surplus_and_shortage: "Waste + stock gap",
};
// Decorative packaging only. This does not infer a recipe, unit or product mapping.
function IngredientDrawing({ name }) {
  const grain = /rice|flour|grain/i.test(name),
    bottle = /milk|oil|sauce/i.test(name),
    vegetable = /tomato|onion|carrot|vegetable/i.test(name);
  return (
    <svg
      viewBox="0 0 160 130"
      aria-hidden="true"
      className="pantry-ingredient-art"
    >
      <ellipse cx="80" cy="116" rx="46" ry="7" fill="#302d2015" />
      {grain ? (
        <>
          <path
            d="M54 24h52l-7 18 17 61q-36 20-72 0l17-61Z"
            fill="#efe2b8"
            stroke="#725b36"
            strokeWidth="2.5"
          />
          <path
            d="M54 24q25-9 52 0M59 42h41"
            fill="none"
            stroke="#725b36"
            strokeWidth="2.5"
          />
          <rect x="60" y="58" width="42" height="35" rx="3" fill="#fbf8ed" />
          <path
            d="M80 86V64m0 8-9-6m9 12 9-6m-9 12-9-6"
            stroke="#799461"
            strokeWidth="3"
          />
        </>
      ) : bottle ? (
        <>
          <rect x="65" y="17" width="30" height="12" rx="3" fill="#466651" />
          <path
            d="M65 29v12l-15 15v51q30 16 60 0V56L95 41V29"
            fill="#e7ecd8"
            stroke="#466651"
            strokeWidth="2.5"
          />
          <rect x="54" y="62" width="52" height="29" fill="#fff9eb" />
          <path d="M72 79q12-21 22-6-12 16-22 6" fill="#6e8d56" />
        </>
      ) : vegetable ? (
        <>
          <path
            d="m50 70-9-27 20 11-3-30 22 24 19-28 2 34 19-9-11 28"
            fill="#68825c"
            stroke="#466651"
            strokeWidth="2"
          />
          <ellipse cx="65" cy="86" rx="28" ry="28" fill="#dd785b" />
          <ellipse cx="96" cy="89" rx="27" ry="25" fill="#e6a259" />
          <path
            d="m58 70 8-9 10 9m16 3 7-10 7 10"
            stroke="#466651"
            strokeWidth="3"
            fill="none"
          />
        </>
      ) : (
        <>
          <rect
            x="38"
            y="40"
            width="84"
            height="67"
            rx="12"
            fill="#ece4cf"
            stroke="#68816b"
            strokeWidth="2.5"
          />
          <rect x="42" y="32" width="76" height="17" rx="5" fill="#466651" />
          <rect x="49" y="60" width="62" height="31" rx="4" fill="#fff9eb" />
          <path d="M68 75q10-17 24 0-12 17-24 0" fill="#d49b68" />
          <path d="M52 98h57" stroke="#b7ae94" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
function StoreIllustration() {
  return (
    <svg
      className="pantry-store-art"
      viewBox="0 0 1000 440"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="1000" height="440" fill="#f4ead5" />
      <path d="M0 80h1000v360H0" fill="#f7efdF" />
      <path d="M0 110h1000M0 360h1000" stroke="#deceb1" strokeWidth="3" />
      <path
        d="M70 152h150v148H70zM780 152h150v148H780z"
        fill="#d7e2d2"
        stroke="#8b9675"
        strokeWidth="8"
      />
      <path
        d="M145 152v148M70 226h150M855 152v148M780 226h150"
        stroke="#8b9675"
        strokeWidth="6"
      />
      <rect
        x="310"
        y="170"
        width="380"
        height="154"
        rx="6"
        fill="#e9dabc"
        stroke="#ad916d"
        strokeWidth="4"
      />
      <path d="M314 240h373M314 309h373" stroke="#ae906b" strokeWidth="12" />
      <g fill="#819a79">
        <rect x="350" y="196" width="35" height="37" rx="7" />
        <rect x="400" y="195" width="35" height="38" rx="7" />
        <rect x="570" y="195" width="35" height="38" rx="7" />
      </g>
      <g fill="#c38960">
        <rect x="470" y="204" width="27" height="29" rx="5" />
        <rect x="513" y="203" width="27" height="30" rx="5" />
        <rect x="625" y="204" width="27" height="29" rx="5" />
      </g>
      <path d="M0 0h1000v65H0z" fill="#446c55" />
      <g fill="#f8f0dc">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <path key={i} d={`M${i * 100 + 8} 0h44v65q-22 30-44 0Z`} />
        ))}
      </g>
      <path d="M250 390h500l65 50H185z" fill="#d2b894" />
      <path
        d="M95 315v64m-20-27q-8-28 20-40 31 12 21 40"
        fill="#547955"
        stroke="#547955"
        strokeWidth="7"
      />
      <path d="m65 362 9 47h41l10-47Z" fill="#c38c64" />
      <path
        d="M890 332v35m-12-25q-9-21 12-32 23 11 13 32"
        fill="#6c8b62"
        stroke="#6c8b62"
        strokeWidth="7"
      />
      <path d="m864 355 7 44h37l8-44Z" fill="#b47c55" />
    </svg>
  );
}
export default function PantryScene({
  risks,
  selected,
  onSelect,
  center,
  week,
}) {
  const selectedRisk = risks.find((r) => r.ingredient_id === selected);
  return (
    <section className="pantry-scene" aria-label="Interactive FreshCast pantry">
      <div className="pantry-storefront">
        <StoreIllustration />
        <div className="pantry-sign">
          <span>THE LITTLE KITCHEN PLANNING SHOP</span>
          <h2>FreshCast Pantry</h2>
          <p>A little foresight. A fresher kitchen.</p>
        </div>
        <div className="pantry-window-label">
          <ShoppingBasket size={16} /> Center {center} · Week {week}
        </div>
        <div className="pantry-open-tag">
          DECISION SUPPORT
          <br />
          <small>No actions executed</small>
        </div>
      </div>
      <div className="pantry-counter">
        <div className="pantry-counter-heading">
          <div>
            <span className="pantry-kicker">YOUR NEXT KITCHEN DECISION</span>
            <h3>
              {risks.length
                ? "Pick a crate. Explore a better plan."
                : "Nothing needs a decision right now."}
            </h3>
          </div>
          <span className="pantry-count">
            <PackageCheck size={16} />
            {risks.length} planning issues
          </span>
        </div>
        <p className="pantry-how-to">
          Start here: select a crate → understand the problem → compare actions
          → leave with a plan.
        </p>
        <div className="pantry-floor">
          <div
            className="pantry-crates"
            role="group"
            aria-label="Ingredient planning issues"
          >
            {risks.map((r, i) => (
              <button
                key={r.ingredient_id}
                className={`pantry-crate ${selected === r.ingredient_id ? "is-selected" : ""}`}
                aria-pressed={selected === r.ingredient_id}
                aria-label={`Inspect ${r.ingredient_id}: ${labels[r.risk_type]}`}
                onClick={() => onSelect(r.ingredient_id)}
              >
                <span
                  className={`pantry-risk-tag ${r.shortfall_kg > 0 ? "gap" : "waste"}`}
                >
                  {labels[r.risk_type]}
                </span>
                <IngredientDrawing name={r.ingredient_id} />
                <span className="pantry-crate-label">
                  <strong>{r.ingredient_id}</strong>
                  <span>
                    {r.expiring_unused_kg > 0
                      ? `${qty(r.expiring_unused_kg)} kg expiring unused`
                      : `${qty(r.shortfall_kg)} kg shortfall`}
                  </span>
                  <small>
                    {money(r.potential_waste_cost_myr)} · potential waste
                  </small>
                </span>
                <span className="pantry-crate-footer">
                  <span>CASE {String(i + 1).padStart(2, "0")}</span>
                  <span>
                    {selected === r.ingredient_id
                      ? "At the planning counter"
                      : "Inspect crate"}{" "}
                    <ArrowUpRight size={14} />
                  </span>
                </span>
              </button>
            ))}
          </div>
          <aside className="pantry-order-slip">
            <div className="pantry-slip-top">
              <Sparkles size={18} />
              <span>MANAGER’S NOTE</span>
            </div>
            <h3>
              {selectedRisk
                ? `Let’s look at ${selectedRisk.ingredient_id}.`
                : "Your pantry briefing"}
            </h3>
            <p>
              {selectedRisk
                ? problemSummary(selectedRisk)
                : "A successful calculation returned no ingredient issues. This does not establish food safety."}
            </p>
            {selectedRisk && (
              <button
                className="pantry-review-case"
                onClick={() => onSelect(selectedRisk.ingredient_id)}
              >
                Review this case <ArrowUpRight size={16} />
              </button>
            )}
            <span className="pantry-slip-stamp">
              FORECAST → EXPLAIN → DECIDE
            </span>
            <p className="pantry-slip-disclaimer">
              Model evidence powers the decisions. This illustrated shop is a
              visual planning metaphor; it is not a live inventory map.
            </p>
          </aside>
        </div>
        <p className="pantry-scene-note">
          Crates follow backend risk priority. Artwork is decorative; quantities
          and explanations come from the selected response. Operational stock
          and costs remain simulated.
        </p>
      </div>
    </section>
  );
}
