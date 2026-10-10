const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
const money = (n) =>
  n === null
    ? "Unknown"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
      }).format(n);
export function decisionBrief({
  baseline,
  risk,
  alternative,
  isFixture,
  estimate,
  percent,
  reviewed = [],
  handoffNote = "",
}) {
  return [
    "FRESHCAST — MANAGER DECISION SLIP",
    `Center ${baseline.center_id} | Forecast week ${baseline.week} | Ingredient: ${risk.ingredient_id}`,
    "DRAFT FOR REVIEW — NO ACTION EXECUTED",
    "",
    `Data mode: ${isFixture ? "Frontend fixtures — no model run" : "API response — source metadata reported by backend"}`,
    `Demand source: ${baseline.sources.demand}; operations: ${baseline.sources.operational}; product mapping: ${baseline.sources.product_mapping}`,
    "Stock, recipes and costs are simulated; external meal IDs are not verified local menu mappings.",
    "",
    "BASELINE ISSUE",
    `Forecast ingredient need: ${qty(risk.forecast_demand_kg)} kg`,
    `Eligible stock: ${qty(risk.available_kg)} kg`,
    `May expire unused: ${qty(risk.expiring_unused_kg)} kg`,
    `Expected shortfall: ${qty(risk.shortfall_kg)} kg`,
    `Potential waste cost: ${money(risk.potential_waste_cost_myr)}`,
    "",
    "BASELINE BACKEND GUIDANCE",
    risk.action,
    risk.explanation,
    `Illustrative reorder: ${qty(risk.illustrative_reorder_kg)} kg`,
    risk.risk_inputs_note,
    "",
    `Explored alternative: ${alternative}. This does not replace backend guidance.`,
    ...(estimate
      ? [
          "",
          "OPTIONAL WORKSHEET — MANAGER ASSUMPTIONS, NOT MODEL OUTCOMES",
          `Assumed action cost: ${money(estimate.actionCost)}`,
          `Assumed waste avoided: ${qty(Number(percent))}%`,
          `Hypothetical avoided waste cost: ${money(estimate.avoidedLoss)}`,
          `Hypothetical remaining waste cost: ${money(estimate.remainingLoss)}`,
          `Hypothetical net benefit: ${money(estimate.netBenefit)}`,
          "Excludes sales revenue, shortage recovery and unspecified costs.",
        ]
      : []),
    "",
    "BEFORE ACTING",
    "Confirm actual batches, handling and expiry.",
    "Check verified recipes and menu mappings.",
    "Confirm supplier prices and delivery lead time.",
    "No guaranteed savings, purchase execution, promotion activation or food safety assessment.",
    "",
    "MANUAL MANAGER REVIEW — SELF-REPORTED, NOT SYSTEM VERIFICATION",
    ...(reviewed.length
      ? reviewed.map((label) => `Marked reviewed: ${label}`)
      : ["No checks marked reviewed."]),
    "These notes do not approve or execute an action.",
    ...(handoffNote.trim()
      ? ["Manager handoff note (user-entered):", handoffNote.trim()]
      : []),
    "",
    "RESPONSE WARNINGS",
    ...baseline.warnings,
    "",
  ].join("\n");
}
