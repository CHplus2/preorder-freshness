import { useState } from "react";
export default function RescueReceipt({ plan, outcome, baseline }) {
  const [selected, setSelected] = useState("stock");
  const sides = outcome.sales * plan.side;
  const expenses = 80 + sides + plan.setup;
  const scale = Math.max(outcome.revenue, expenses, 1);
  const rows = [
    {
      id: "stock",
      label: "All chicken stock",
      amount: 80,
      note: "All 20 fictional portions cost RM 4 each. This includes sold and unsold portions. Remaining-stock exposure is part of this RM 80, not an additional cost.",
    },
    {
      id: "sides",
      label: "Sides served",
      amount: sides,
      note: `${outcome.sales} assumed sales × RM ${plan.side} side cost. This authored cost applies only to the bundle; no real recipe or supplier price is used.`,
    },
    {
      id: "setup",
      label: "Action setup",
      amount: plan.setup,
      note: "A fixed authored setup assumption: original RM 0, special RM 8, bundle RM 12. It is not an API recommendation or actual campaign spend.",
    },
  ];
  const difference = outcome.contribution - baseline.contribution;
  return (
    <section
      className="fc-rescue-receipt"
      aria-label="Illustrative financial receipt"
    >
      <header>
        <span className="pd-eyebrow">FICTIONAL SHIFT RECEIPT</span>
        <h3>Where does the money go?</h3>
        <p>
          {plan.name} · {outcome.sales} assumed sales
        </p>
      </header>
      <div className="fc-receipt-bar">
        <span>Revenue · RM {outcome.revenue}</span>
        <i style={{ width: `${(outcome.revenue / scale) * 100}%` }} />
      </div>
      <div className="fc-receipt-bar expenses">
        <span>Stock + sides + setup · RM {expenses}</span>
        <i style={{ width: `${(expenses / scale) * 100}%` }} />
      </div>
      <div
        className="fc-receipt-costs"
        role="group"
        aria-label="Inspect fictional costs"
      >
        {rows.map((row) => (
          <button
            key={row.id}
            aria-label={`Inspect ${row.label.toLowerCase()} cost`}
            aria-pressed={selected === row.id}
            onClick={() => setSelected(row.id)}
          >
            <span>{row.label}</span>
            <strong>− RM {row.amount}</strong>
          </button>
        ))}
      </div>
      <p className="fc-receipt-explanation" role="status">
        {rows.find((row) => row.id === selected).note}
      </p>
      <div className="fc-receipt-total">
        <span>Illustrative contribution</span>
        <strong>RM {outcome.contribution}</strong>
      </div>
      <p>
        {difference > 0 ? "+" : ""}RM {difference} versus the same-demand
        baseline.{" "}
        {outcome.contribution < 0
          ? "These assumptions leave a loss before overhead."
          : "This is contribution before overhead, not net profit."}
      </p>
      <p className="pd-note">
        Revenue minus all chicken stock, sides and setup. Labor, rent, tax and
        other costs are excluded. No actual sales, savings or causal effects are
        established.
      </p>
    </section>
  );
}
