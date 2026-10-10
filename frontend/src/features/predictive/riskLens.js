// Input is already in backend priority order. Stable ties preserve that order.
export function riskLens(rankedRisks, lens) {
  const field =
    lens === "waste"
      ? "expiring_unused_kg"
      : lens === "shortage"
        ? "shortfall_kg"
        : null;
  return field
    ? [...rankedRisks].sort((a, b) => b[field] - a[field])
    : [...rankedRisks];
}
