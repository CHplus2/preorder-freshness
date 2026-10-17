// Presentation of the backend ledger only; never rerun demand forecasting or FEFO.
const number = value => new Intl.NumberFormat('en-MY', {maximumFractionDigits: 3}).format(value);
export function stockQuantity(value, unit) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  if (unit === 'g' && Math.abs(value) >= 1000) return `${number(value / 1000)} kg`;
  if (unit === 'ml' && Math.abs(value) >= 1000) return `${number(value / 1000)} l`;
  return `${number(value)} ${unit}`;
}
export function stockStory(risk) {
  const flow = risk.stock_flow;
  if (!flow) return null;
  const expiring = flow.batches.filter(batch => batch.expires_in_window);
  const sum = field => expiring.reduce((total, batch) => total + batch[field], 0);
  const nearAvailable = sum('after_confirmed');
  const nearUsed = sum('forecast_consumed');
  return {
    need: risk.forecast_requirement,
    nearAvailable,
    laterAvailable: Math.max(0, flow.after_confirmed - nearAvailable),
    nearUsed,
    laterUsed: Math.max(0, flow.forecast_consumed - nearUsed),
    afterNear: Math.max(0, risk.forecast_requirement - nearUsed),
    gap: risk.forecast_shortfall,
    waste: risk.forecast_expiring_unused,
    carried: flow.projected_carried_stock,
    firstExpiry: expiring[0]?.expiry_date,
    firstGap: flow.demand_by_day?.find(day => day.forecast_requirement - day.forecast_consumed > 0.001)?.date,
  };
}
export function kitchenCase(risk) {
  const gap = risk.shortfall_quantity > 0 || risk.forecast_shortfall > 0;
  const waste = risk.forecast_expiring_unused > 0;
  if (gap && waste) return {kind: 'mixed', label: 'Waste & stock gap', title: 'Some stock expires before it is needed', action: 'Review expiry dates and replenishment together'};
  if (risk.shortfall_quantity > 0) return {kind: 'shortage', label: 'Booked orders need stock', title: 'Confirmed orders have an ingredient gap', action: 'Cover the confirmed gap first'};
  if (gap) return {kind: 'shortage', label: 'Forecast stock gap', title: 'Stock may run out', action: 'Check demand and compare a dated purchase'};
  if (waste) return {kind: 'waste', label: 'Expiry surplus', title: 'Some stock may expire unused', action: 'Use expiring stock before buying more'};
  return {kind: 'watch', label: 'Covered in this forecast', title: 'No expiry surplus or stock gap projected', action: 'Use the earliest-expiring stock first'};
}
export function caseQuantity(risk) {
  if (risk.shortfall_quantity > 0) return `${stockQuantity(risk.shortfall_quantity, risk.unit)} confirmed gap`;
  if (risk.forecast_shortfall > 0) return `${stockQuantity(risk.forecast_shortfall, risk.unit)} forecast gap`;
  return `${stockQuantity(risk.forecast_expiring_unused, risk.unit)} unused at expiry`;
}
