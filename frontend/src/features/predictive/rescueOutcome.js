// Arithmetic on authored demo assumptions, never a demand predictor.
export function rescueOutcome(plan, demandOffset = 0) {
  const sales = Math.max(0, Math.min(20, plan.sold + demandOffset));
  return {
    sales,
    unsold: 20 - sales,
    revenue: sales * plan.price,
    exposure: (20 - sales) * 4,
    contribution: sales * plan.price - 80 - sales * plan.side - plan.setup,
  };
}
