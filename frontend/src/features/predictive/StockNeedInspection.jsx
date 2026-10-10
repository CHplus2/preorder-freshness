import { useId, useState } from "react";
const qty = (value) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(value);
export default function StockNeedInspection({ risk }) {
  const [selected, setSelected] = useState("stock");
  const insightId = useId();
  const max = Math.max(1, risk.available_kg, risk.forecast_demand_kg);
  const items = [
    {
      id: "stock",
      label: "Eligible stock",
      value: risk.available_kg,
      explanation:
        "Simulated stock included by the backend’s eligibility rules.",
    },
    {
      id: "need",
      label: "Forecast need",
      value: risk.forecast_demand_kg,
      explanation: "Estimated need from forecast orders and simulated recipes.",
    },
  ];
  return (
    <figure
      className="fc-stock-need"
      aria-label={`Stock versus need for ${risk.ingredient_id}`}
    >
      <figcaption>Stock versus forecast need</figcaption>
      <div className="fc-stock-need-jars">
        {items.map(({ id, label, value }) => (
          <button
            key={id}
            aria-label={`Inspect ${label.toLowerCase()}`}
            aria-pressed={selected === id}
            aria-controls={insightId}
            onClick={() => setSelected(id)}
          >
            <svg viewBox="0 0 100 130" aria-hidden="true">
              <rect
                x="14"
                y="15"
                width="72"
                height="100"
                rx="12"
                fill="#ede4ce"
              />
              <rect
                x="18"
                y={111 - (value / max) * 90}
                width="64"
                height={(value / max) * 90}
                rx="7"
                fill={id === "stock" ? "#8ca982" : "#d2a56b"}
              />
              <path
                d="M14 38h10m-10 25h10m-10 25h10"
                stroke="#627763"
                strokeWidth="2"
              />
              <rect
                x="14"
                y="15"
                width="72"
                height="100"
                rx="12"
                fill="none"
                stroke="#627763"
                strokeWidth="3"
              />
              <rect x="9" y="9" width="82" height="14" rx="5" fill="#446c55" />
            </svg>
            <strong>{qty(value)} kg</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p id={insightId} role="status">
        {items.find((item) => item.id === selected).explanation}
      </p>
      <details>
        <summary>How to read this illustration</summary>
        <p className="pd-note">
          Illustrated amounts share a kilogram scale. Containers are decorative.
          Waste and shortage use the backend’s separate results below. These
          amounts are not confirmed demand, verified local recipes or a food
          safety assessment.
        </p>
      </details>
    </figure>
  );
}
