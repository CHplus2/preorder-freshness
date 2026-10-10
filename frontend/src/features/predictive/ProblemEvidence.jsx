import {
  ShoppingBasket,
  Package,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
export default function ProblemEvidence({ risk }) {
  const maximum = Math.max(
    1,
    risk.forecast_demand_kg,
    risk.available_kg,
    risk.expiring_unused_kg,
    risk.shortfall_kg,
  );
  const amounts = [
    {
      title: "1 · What meals may need",
      value: risk.forecast_demand_kg,
      description: "Forecast orders translated into ingredient need",
      icon: ShoppingBasket,
    },
    {
      title: "2 · What stock is eligible",
      value: risk.available_kg,
      description: "Stock included by the backend eligibility rules",
      icon: Package,
    },
  ];
  return (
    <figure className="fc-evidence">
      <figcaption>
        Follow the ingredient story · {risk.ingredient_id}
      </figcaption>
      <div className="fc-evidence-flow">
        {amounts.map(({ title, value, description, icon: Icon }) => (
          <div className="fc-evidence-node" key={title}>
            <Icon size={24} aria-hidden="true" />
            <h3>{title}</h3>
            <strong>{qty(value)} kg</strong>
            <div className="fc-evidence-bar" aria-hidden="true">
              <span style={{ width: `${(value / maximum) * 100}%` }} />
            </div>
            <p>{description}</p>
          </div>
        ))}
        <ArrowRight
          className="fc-evidence-arrow"
          size={24}
          aria-hidden="true"
        />
        <div className="fc-evidence-node fc-evidence-outcome">
          <AlertTriangle size={24} aria-hidden="true" />
          <h3>3 · What could happen</h3>
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
        </div>
      </div>
      <p className="pd-note">
        All quantities are returned by the API. Bars share a kilogram scale;
        they are not parts of one total. Expiry timing can cause waste and
        shortages at the same time. Stock and recipes are simulated.
      </p>
    </figure>
  );
}
