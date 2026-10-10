const qty = (n) =>
  new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(n);
export function problemSummary(risk) {
  const waste =
    risk.expiring_unused_kg > 0
      ? `${qty(risk.expiring_unused_kg)} kg may expire unused`
      : "";
  const shortage =
    risk.shortfall_kg > 0
      ? `${qty(risk.shortfall_kg)} kg of expected need may go uncovered`
      : "";
  return `${risk.ingredient_id}: ${[waste, shortage].filter(Boolean).join("; ") || "review the reported planning risk"}.`;
}
