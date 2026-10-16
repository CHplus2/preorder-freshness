import { useId, useState } from "react";
import { ingredientPresentation } from "./ingredientPresentation";
const qty = (value) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 3 }).format(value);
export default function StockNeedInspection({ risk, local = false }) {
  const [selected, setSelected] = useState("stock");
  const insightId = useId();
  const view = ingredientPresentation(risk, local);
  const max = Math.max(1, view.stock, view.need);
  const items = [
    {
      id: "stock",
      label: "Eligible stock",
      value: view.stock,
      explanation: local
        ? "Recorded stock included by dated backend eligibility rules; held and excluded batches cannot cover these bookings."
        : "Simulated stock included by the backend’s eligibility rules.",
    },
    {
      id: "need",
      label: view.needLabel,
      value: view.need,
      explanation: local
        ? "Requirements from included confirmed paid orders and their accepted recipe snapshots. This is not additional predicted demand."
        : "Estimated need from forecast orders and simulated recipes.",
    },
  ];
  return (
    <figure
      className="fc-stock-need"
      aria-label={`Stock versus need for ${view.name}`}
    >
      <figcaption>
        Stock versus {local ? "confirmed" : "forecast"} need
      </figcaption>
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
            <strong>
              {qty(value)} {view.unit}
            </strong>
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
          Illustrated amounts share a {view.unit} scale. Containers are
          decorative. Waste and shortage use the backend’s separate results
          below.{" "}
          {local
            ? "Need comes from included paid bookings and accepted recipe snapshots, not a forecast of extra customers. Recorded inputs do not establish food safety."
            : "These amounts are not confirmed demand, verified local recipes or a food safety assessment."}
        </p>
      </details>
    </figure>
  );
}
