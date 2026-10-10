import { Package, ShoppingBasket, Sparkles } from "lucide-react";
const options = [
  {
    id: "priority",
    title: "Backend priority",
    description: "Review the supplied priority order",
    Icon: Sparkles,
  },
  {
    id: "waste",
    title: "Waste first",
    description: "Largest expiring-unused quantities first",
    Icon: Package,
  },
  {
    id: "shortage",
    title: "Shortages first",
    description: "Largest uncovered quantities first",
    Icon: ShoppingBasket,
  },
];
export default function RiskLens({ risks, lens, onChange }) {
  return (
    <section className="fc-risk-lens" aria-label="Kitchen risk lens">
      <header>
        <span className="pd-eyebrow">CHOOSE YOUR KITCHEN FOCUS</span>
        <h2>What needs your attention?</h2>
      </header>
      <div
        className="fc-risk-lens-options"
        role="group"
        aria-label="Problem ordering"
      >
        {options.map(({ id, title, description, Icon }) => (
          <button
            key={id}
            aria-pressed={lens === id}
            onClick={() => onChange(id)}
          >
            <Icon size={24} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{description}</span>
            <small>
              {id === "priority"
                ? `${risks.length} planning issues`
                : `${risks.filter((r) => r[id === "waste" ? "expiring_unused_kg" : "shortfall_kg"] > 0).length} affected ingredients`}
            </small>
          </button>
        ))}
      </div>
      <p className="pd-note">
        Changing focus opens the first problem in that order. Every issue
        remains visible. Quantity ordering is your viewing preference; it does
        not change backend guidance or account for unknown financial costs.
      </p>
    </section>
  );
}
