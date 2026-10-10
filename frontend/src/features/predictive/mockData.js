// Synthetic demonstration fixtures. No trained model or live inventory is used.
export const mockOptions = {
  menu_items: [
    { id: "nasi-lemak", name: "Nasi lemak" },
    { id: "chicken-rice", name: "Chicken rice" },
  ],
  fulfillment_centers: [
    { id: "north", name: "North campus kitchen" },
    { id: "south", name: "South campus kitchen" },
  ],
};
export function mockDashboard({
  menu_item_id,
  fulfillment_center_id,
  scenario,
}) {
  const factor =
    (menu_item_id === "chicken-rice" ? 0.8 : 1) *
    (fulfillment_center_id === "south" ? 0.7 : 1);
  const promo = scenario === "promotion" ? 1.15 : 1;
  const scale = (n) => Math.round(n * factor);
  const forecast = [210, 238, 225, 260, 278, 294, 286, 310].map((n, i) => ({
    week_start: [
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ][i],
    actual_demand: i < 4 ? scale(n) : null,
    predicted_demand: i >= 3 ? scale(n * promo) : null,
    lower_bound: i >= 4 ? scale(n * promo * 0.82) : null,
    upper_bound: i >= 4 ? scale(n * promo * 1.22) : null,
  }));
  const inventory_risks = [
    {
      ingredient_id: "chicken",
      ingredient_name: "Fresh chicken",
      unit: "kg",
      expiry_date: "2026-10-12",
      days_to_expiry: 2,
      stock_quantity: scale(46),
      predicted_consumption: scale(28 * promo),
      surplus_quantity: scale(18 / promo),
      projected_loss: scale(216 / promo),
      urgency: "critical",
      issue_category: "expiry_surplus",
      reason:
        "Stock expires before the next replenishment cycle. Expected consumption is below available stock.",
    },
    {
      ingredient_id: "coconut",
      ingredient_name: "Coconut milk",
      unit: "L",
      expiry_date: "2026-10-13",
      days_to_expiry: 3,
      stock_quantity: scale(24),
      predicted_consumption: scale(17 * promo),
      surplus_quantity: scale(7 / promo),
      projected_loss: scale(56 / promo),
      urgency: "high",
      issue_category: "overstock",
      reason:
        "Current stock exceeds the forecast requirement within its usable period.",
    },
    {
      ingredient_id: "rice",
      ingredient_name: "Rice",
      unit: "kg",
      expiry_date: "2027-02-01",
      days_to_expiry: 114,
      stock_quantity: scale(18),
      predicted_consumption: scale(35 * promo),
      surplus_quantity: 0,
      projected_loss: 0,
      urgency: "medium",
      issue_category: "stockout",
      reason:
        "Expected consumption exceeds stock. Purchase planning is needed to maintain menu availability.",
    },
  ];
  const recommendations = [
    {
      id: "rec-chicken",
      ingredient_id: "chicken",
      ingredient_name: "Fresh chicken",
      priority: 1,
      unit: "kg",
      purchase_quantity: 0,
      action: "Defer the next purchase",
      reason: "Use existing batches in expiry order before replenishing.",
      projected_waste: scale(18 / promo),
      projected_loss: scale(216 / promo),
    },
    {
      id: "rec-coconut",
      ingredient_id: "coconut",
      ingredient_name: "Coconut milk",
      priority: 2,
      unit: "L",
      purchase_quantity: scale(2),
      action: "Reduce replenishment",
      reason:
        "A smaller order limits surplus while preserving forecast coverage.",
      projected_waste: scale(7 / promo),
      projected_loss: scale(56 / promo),
    },
    {
      id: "rec-rice",
      ingredient_id: "rice",
      ingredient_name: "Rice",
      priority: 3,
      unit: "kg",
      purchase_quantity: scale(17 * promo),
      action: "Replenish before next week",
      reason:
        "Close the expected stock gap; confirm supplier lead time before ordering.",
      projected_waste: 0,
      projected_loss: 0,
    },
  ];
  return {
    source: "mock",
    generated_at: "2026-10-10T00:00:00Z",
    as_of_date: "2026-10-10",
    currency: "MYR",
    menu_item_id,
    fulfillment_center_id,
    scenario,
    uncertainty_label:
      "Illustrative range; not a calibrated confidence interval",
    assumptions:
      scenario === "promotion"
        ? [
            "Illustrative 15% demand uplift; no causal promotion model.",
            "Discount cost and customer response are not estimated.",
          ]
        : [
            "Synthetic weekly demand and inventory; not operational advice.",
            "Quantities represent one selected menu and center.",
          ],
    forecast,
    inventory_risks,
    recommendations,
    comparison: {
      baseline: {
        purchase_cost: scale(820),
        projected_loss: scale(340 / promo),
      },
      recommended: {
        purchase_cost: scale(640),
        projected_loss: scale(272 / promo),
      },
    },
  };
}
