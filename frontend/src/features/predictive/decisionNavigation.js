export const decisionSteps = [
  'Spot the problem',
  'Understand why',
  'Explore actions',
  'Compare tradeoffs',
  'Review recommendation',
];

export function selectedDecisionStep(value) {
  const step = Number(value || 0);
  return Number.isInteger(step) && step >= 0 && step < decisionSteps.length ? step : 0;
}

export function stockViewSelection(risks, params) {
  const filter = ['waste', 'shortage'].includes(params.get('stock_filter')) ? params.get('stock_filter') : 'all';
  const rows = risks.filter(risk => filter === 'all' || (filter === 'waste'
    ? risk.forecast_expiring_unused > 0 : risk.shortfall_quantity > 0 || risk.forecast_shortfall > 0));
  const selected = rows.find(risk => risk.ingredient_id === params.get('ingredient')) || rows[0];
  return {filter, rows, selected};
}

export function genpactCarriedStock(data, risk) {
  const batches = data.batch_allocations.filter(batch => batch.ingredient_id === risk.ingredient_id && batch.eligible);
  if (!batches.length && risk.available_kg > 0) return null;
  return batches.filter(batch => batch.expiry_week > data.week).reduce((sum, batch) => sum + batch.remaining_kg, 0);
}

export function shoppingContextRows(rows, params, showAll = false) {
  const id = params.get('material');
  if (showAll || params.get('from') !== 'freshcast' || !/^[1-9]\d*$/.test(id || '')) return rows;
  return rows.filter(row => String(row.material_id) === id);
}
