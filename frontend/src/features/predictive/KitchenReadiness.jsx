import { Link, useSearchParams } from "react-router-dom";
import { kitchenReadiness } from "./kitchenDecision";
export default function KitchenReadiness({ plan }) {
  const [params] = useSearchParams();
  const counts = kitchenReadiness(plan.decision_support);
  return (
    <section
      className="pd-card local-readiness"
      aria-label="Kitchen forecast readiness"
    >
      <span className="pd-eyebrow">
        FORECAST EVIDENCE · SEPARATE FROM UPCOMING BOOKINGS
      </span>
      <h2>
        {counts.forecasted
          ? "Your kitchen forecast evidence is available"
          : "Your kitchen needs eligible sales history"}
      </h2>
      <div className="fc-facts">
        <div>
          <span>Active menus returned</span>
          <strong>{counts.menus}</strong>
        </div>
        <div>
          <span>Menus with forecast estimates</span>
          <strong>{counts.forecasted}</strong>
        </div>
        <div>
          <span>Menus with backtested, non-synthetic estimates</span>
          <strong>{counts.evaluated}</strong>
        </div>
      </div>
      <p>
        Historical sales require paid, delivered orders. Delivery dates are used
        when recorded; missing dates are explicitly marked creation-date
        estimates. Paying an upcoming order does not turn it into a completed
        historical sale.
      </p>
      <p>
        {plan.coverage.included_orders} upcoming orders qualify for stock
        allocation. This is a separate filter from sales history.
        {counts.missingRecipes
          ? ` ${counts.missingRecipes} menus need recipe review before their forecasts can drive ingredient planning.`
          : ""}
      </p>
      {plan.decision_support.synthetic_history_items>0 && <p>Synthetic history is included; generated-menu evaluations are excluded from the evaluated-confidence count.</p>}
      <Link to={{ pathname: "/admin/ai/forecast", search: `?${params}` }}>
        Inspect kitchen forecast evidence
      </Link>{" "}
      · <Link to="/admin/orders">Review order and payment records</Link>
    </section>
  );
}
