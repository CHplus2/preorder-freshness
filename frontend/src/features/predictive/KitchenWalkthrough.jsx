import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { problemSummary } from "./problemSummary";
import StockNeedInspection from "./StockNeedInspection";
const spots = [
  [22, 34],
  [43, 24],
  [70, 31],
  [83, 47],
  [54, 65],
  [26, 61],
];
function KitchenRoom() {
  return (
    <svg viewBox="0 0 1000 650" className="fc-room-art" aria-hidden="true">
      <defs>
        <linearGradient id="fc-room-floor" x2="1" y2="1">
          <stop stopColor="#ead6b3" />
          <stop offset="1" stopColor="#c9ad84" />
        </linearGradient>
        <linearGradient id="fc-room-wall" x2="0" y2="1">
          <stop stopColor="#fff9eb" />
          <stop offset="1" stopColor="#e9dbc1" />
        </linearGradient>
      </defs>
      <ellipse cx="505" cy="560" rx="425" ry="55" fill="#304b3c15" />
      <path
        d="M75 350 500 170 925 350 500 590Z"
        fill="url(#fc-room-floor)"
        stroke="#bba17c"
        strokeWidth="3"
      />
      <path
        d="M75 350V105L500 30v140Z"
        fill="url(#fc-room-wall)"
        stroke="#c5b797"
        strokeWidth="3"
      />
      <path
        d="M500 30 925 105v245L500 170Z"
        fill="#e4ecdf"
        stroke="#aebba1"
        strokeWidth="3"
      />
      <path d="m75 350 425 180 425-180v25L500 613 75 375Z" fill="#a38a64" />
      <g stroke="#b69d75" strokeWidth="2" opacity=".45">
        <path d="m180 305 425 180m-320-225 425 180m-320-225 425 180M820 305 395 485m320-225L290 440m320-225L185 395" />
      </g>
      <g stroke="#6b805f" strokeWidth="4">
        <path d="m124 155 290-53v190l-290 91Z" fill="#97ad88" />
        <path
          d="m132 174 274-51v37l-274 58Zm0 72 274-67v37l-274 72Zm0 71 274-80v38l-274 87Z"
          fill="#eee3c8"
        />
      </g>
      <g fill="#c38c64">
        <path d="m150 151 33-6v28l-33 7Zm64-12 33-6v29l-33 7Zm67-12 33-6v27l-33 8Z" />
        <path d="m151 223 33-8v30l-33 9Zm131-32 33-7v29l-33 8Z" />
      </g>
      <g fill="#446c55">
        <path d="m216 208 32-8v29l-32 8Zm130-28 32-8v28l-32 9Z" />
        <path d="m150 298 33-10v30l-33 11Zm65-19 33-10v29l-33 11Zm132-37 31-9v29l-31 10Z" />
      </g>
      <path
        d="m585 110 127 23v196l-127-52Z"
        fill="#fbfcf5"
        stroke="#74907a"
        strokeWidth="4"
      />
      <path d="m712 133 28-10v191l-28 15Z" fill="#a8bcaa" />
      <path
        d="m585 174 127 30m-107-58v20m0 28v54"
        stroke="#74907a"
        strokeWidth="4"
      />
      <path
        d="m776 204 115 29v127l-115-47Z"
        fill="#a6b6a0"
        stroke="#6b805f"
        strokeWidth="3"
      />
      <path
        d="m760 197 116-39 35 65-119 40Z"
        fill="#f4f3e8"
        stroke="#6b805f"
        strokeWidth="3"
      />
      <ellipse cx="827" cy="208" rx="25" ry="10" fill="#446c55" />
      <ellipse cx="866" cy="218" rx="17" ry="8" fill="#446c55" />
      <path
        d="m309 393 234-91 153 60-234 111Z"
        fill="#fffcf2"
        stroke="#a88c64"
        strokeWidth="4"
      />
      <path d="m309 393 153 80v92l-153-88Z" fill="#b88e60" />
      <path d="m462 473 234-111v90L462 565Z" fill="#d4b183" />
      <path d="m500 473 157-74v41l-157 78Z" fill="#f6edda" />
      <path d="m412 361 93-35 61 24-92 40Z" fill="#98b284" />
      <path d="m422 361 73-27 48 19-73 30Z" fill="#bfd1aa" />
      <path d="m337 392 31-12 27 12-31 13Z" fill="#dd785b" />
      <path d="m563 360 37-15 29 11-37 17Z" fill="#446c55" />
      <path d="m188 428 87-35 63 34-87 39Z" fill="#e6bf79" />
      <path
        d="m188 428 63 38v53l-63-37Zm63 38 87-39v53l-87 39Z"
        fill="#be9256"
      />
      <g stroke="#6b805f" strokeWidth="3">
        <path d="m770 114 98 18v61l-98-24Z" fill="#cbdfe5" />
        <path d="m819 123v63m-48-46 97 18" fill="none" />
        <path d="m445 64 25-4v41l-25 5Z" fill="#ebaf83" />
        <path d="M456 63V47" fill="none" />
      </g>
      <path d="m798 411 38-16 40 21-38 17Z" fill="#719168" />
      <path d="m811 423 27 10 25-12-8 46-28 12Z" fill="#c38c64" />
    </svg>
  );
}
export default function KitchenWalkthrough({
  risks,
  selected,
  onSelect,
  renderIngredient,
}) {
  const [inspected, setInspected] = useState(selected);
  const [page, setPage] = useState(() =>
    Math.max(
      0,
      Math.floor(
        risks.findIndex((r) => r.ingredient_id === selected) / spots.length,
      ),
    ),
  );
  const pages = Math.max(1, Math.ceil(risks.length / spots.length));
  const currentPage = Math.min(page, pages - 1);
  const visible = risks.slice(
    currentPage * spots.length,
    (currentPage + 1) * spots.length,
  );
  const risk = visible.find((r) => r.ingredient_id === inspected) || visible[0];
  return (
    <section className="fc-walkthrough" aria-label="Kitchen hotspot explorer">
      <div className="fc-room">
        <KitchenRoom />
        <div className="fc-room-title">
          <strong>A little kitchen. Real planning questions.</strong>
          <span>Click an ingredient to take a closer look.</span>
        </div>
        {visible.map((r, i) => (
          <button
            key={r.ingredient_id}
            type="button"
            className={`fc-hotspot ${r.shortfall_kg > 0 ? "gap" : "waste"}`}
            style={{ left: `${spots[i][0]}%`, top: `${spots[i][1]}%` }}
            aria-label={`Inspect marker ${currentPage * spots.length + i + 1}: ${r.ingredient_id}`}
            aria-pressed={risk?.ingredient_id === r.ingredient_id}
            onClick={() => setInspected(r.ingredient_id)}
          >
            <span>{currentPage * spots.length + i + 1}</span>
            <span className="fc-hotspot-ingredient" aria-hidden="true">
              {renderIngredient?.(r.ingredient_id)}
            </span>
            <span className="fc-hotspot-label">
              {r.ingredient_id}
              <small>
                {r.expiring_unused_kg > 0 && r.shortfall_kg > 0
                  ? "Waste + shortage"
                  : r.shortfall_kg > 0
                    ? "Shortage risk"
                    : "Waste risk"}
              </small>
            </span>
          </button>
        ))}
        <span className="fc-room-caption">
          Illustrated planning scene · positions are decorative
        </span>
      </div>
      <aside className="fc-room-inspector" aria-label="Selected hotspot">
        <span className="pantry-kicker">INGREDIENT INSPECTION</span>
        {risk && (
          <div className="fc-inspector-package" aria-hidden="true">
            {renderIngredient?.(risk.ingredient_id)}
          </div>
        )}
        <div aria-live="polite">
          <h3>{risk?.ingredient_id || "No issues reported"}</h3>
          <p>
            {risk
              ? problemSummary(risk)
              : "The calculation returned no ingredient risks."}
          </p>
          {risk && <StockNeedInspection key={risk.ingredient_id} risk={risk} />}
          {risk && (
            <dl className="fc-inspector-quantities">
              <div>
                <dt>May expire unused</dt>
                <dd>
                  {new Intl.NumberFormat("en-MY", {
                    maximumFractionDigits: 2,
                  }).format(risk.expiring_unused_kg)}{" "}
                  kg
                </dd>
              </div>
              <div>
                <dt>Expected shortfall</dt>
                <dd>
                  {new Intl.NumberFormat("en-MY", {
                    maximumFractionDigits: 2,
                  }).format(risk.shortfall_kg)}{" "}
                  kg
                </dd>
              </div>
            </dl>
          )}
          {risk && (
            <p className="pd-note">
              {risk.potential_waste_cost_myr === null
                ? "Potential waste cost unknown"
                : new Intl.NumberFormat("en-MY", {
                    style: "currency",
                    currency: "MYR",
                  }).format(risk.potential_waste_cost_myr) +
                  " potential waste cost"}
            </p>
          )}
        </div>
        {risk && (
          <button
            className="pantry-review-case"
            onClick={() => onSelect(risk.ingredient_id)}
          >
            Explore this decision <ArrowUpRight size={16} />
          </button>
        )}
        <p className="pd-note">
          Stock and costs are simulated. This scene does not show actual storage
          locations.
        </p>
        {pages > 1 && (
          <div className="fc-room-pages">
            <button
              aria-label="Previous issues"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Issues {currentPage * 6 + 1}–
              {Math.min((currentPage + 1) * 6, risks.length)} of {risks.length}
            </span>
            <button
              aria-label="Next issues"
              disabled={currentPage === pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}
