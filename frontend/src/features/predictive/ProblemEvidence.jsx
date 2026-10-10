import { useState } from "react";
import {
  ShoppingBasket,
  Package,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
export default function ProblemEvidence({ risk }) {
  const [selected, setSelected] = useState("need");
  const insights = {
    need: `${qty(risk.forecast_demand_kg)} kg is the ingredient need calculated from forecast orders and simulated recipes. It is an estimate, not a confirmed order.`,
    stock: `${qty(risk.available_kg)} kg is included by the stock eligibility rules. Expiry timing matters: having enough stock overall does not guarantee it is usable when needed.`,
    outcome: `${qty(risk.expiring_unused_kg)} kg may expire unused; ${qty(risk.shortfall_kg)} kg of expected need may go uncovered. Both can happen when stock expires before later demand.`,
  };
  const maximum = Math.max(
    1,
    risk.forecast_demand_kg,
    risk.available_kg,
    risk.expiring_unused_kg,
    risk.shortfall_kg,
  );
  const amounts = [
    {
      id: "need",
      title: "1 · Meal need",
      value: risk.forecast_demand_kg,
      description: "Forecast orders translated into ingredient need",
      icon: ShoppingBasket,
    },
    {
      id: "stock",
      title: "2 · Usable stock",
      value: risk.available_kg,
      description: "Stock included by the backend eligibility rules",
      icon: Package,
    },
  ];
  return (
    <figure className="fc-evidence">
      <figcaption>Explore the forecast · {risk.ingredient_id}</figcaption>
      <div className="fc-evidence-flow">
        {amounts.map(({ id, title, value, description, icon: Icon }) => (
          <button
            type="button"
            className="fc-evidence-node"
            key={id}
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
            aria-controls="fc-evidence-insight"
          >
            <Icon size={24} aria-hidden="true" />
            <span className="fc-evidence-title">{title}</span>
            <strong>{qty(value)} kg</strong>
            <div className="fc-evidence-bar" aria-hidden="true">
              <span style={{ width: `${(value / maximum) * 100}%` }} />
            </div>
            <span className="fc-evidence-description">{description}</span>
          </button>
        ))}
        <ArrowRight
          className="fc-evidence-arrow"
          size={24}
          aria-hidden="true"
        />
        <button
          type="button"
          className="fc-evidence-node fc-evidence-outcome"
          aria-pressed={selected === "outcome"}
          onClick={() => setSelected("outcome")}
          aria-controls="fc-evidence-insight"
        >
          <AlertTriangle size={24} aria-hidden="true" />
          <span className="fc-evidence-title">3 · Possible outcome</span>
          <strong>{qty(risk.expiring_unused_kg)} kg</strong>
          <span>May expire unused</span>
          <div className="fc-evidence-bar" aria-hidden="true">
            <span
              style={{ width: `${(risk.expiring_unused_kg / maximum) * 100}%` }}
            />
          </div>
          <strong>{qty(risk.shortfall_kg)} kg</strong>
          <span>Expected need not covered</span>
          <div className="fc-evidence-bar" aria-hidden="true">
            <span
              style={{ width: `${(risk.shortfall_kg / maximum) * 100}%` }}
            />
          </div>
        </button>
      </div>
      <p
        id="fc-evidence-insight"
        className="fc-evidence-insight"
        aria-live="polite"
      >
        {insights[selected]}
      </p>
      <p className="pd-note">
        Select a card to understand it. Bars share a kilogram scale, not a
        total. Stock and recipes are simulated.
      </p>
    </figure>
  );
}
