import {stockQuantity} from './kitchenPresentation.js';
const kg = value => stockQuantity(value, 'kg');

export function problemSummary(risk) {
  const waste =
    risk.expiring_unused_kg > 0
      ? `${kg(risk.expiring_unused_kg)} may expire unused`
      : "";
  const shortage =
    risk.shortfall_kg > 0
      ? `${kg(risk.shortfall_kg)} of expected need may go uncovered`
      : "";
  return `${risk.ingredient_id}: ${[waste, shortage].filter(Boolean).join("; ") || "review the reported planning risk"}.`;
}
