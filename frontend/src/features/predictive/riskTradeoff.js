export function riskTradeoff(baseline, scenario) {
  if (!scenario) return null;
  const waste = scenario.expiring_unused_kg - baseline.expiring_unused_kg;
  const shortage = scenario.shortfall_kg - baseline.shortfall_kg;
  const describe = (change, name) =>
    change === 0
      ? `${name} is unchanged`
      : `${name} ${change < 0 ? "decreases" : "increases"} by ${new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(Math.abs(change))} kg`;
  return {
    waste,
    shortage,
    summary: `${describe(waste, "Potential waste")}; ${describe(shortage, "shortage exposure")}.`,
    caution:
      waste < 0 && shortage > 0
        ? "Less waste comes with more shortage exposure. Review both before choosing an action."
        : waste > 0 && shortage < 0
          ? "Less shortage comes with more potential waste. Review both before choosing an action."
          : "Quantity differences alone do not establish profit, savings or a causal promotion benefit.",
  };
}
