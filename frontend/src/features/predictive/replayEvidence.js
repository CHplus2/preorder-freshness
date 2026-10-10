// Organize returned evidence for presentation; never recalculate demand or FEFO.
export function replayEvidence(data, ingredient) {
  const batches = data.batch_allocations
    .filter((batch) => batch.ingredient_id === ingredient)
    .sort(
      (a, b) =>
        a.expiry_week - b.expiry_week || a.batch_id.localeCompare(b.batch_id),
    );
  return {
    batches,
    weeklyOrders: data.meal_forecasts.length
      ? data.meal_forecasts.reduce(
          (sum, meal) => sum + meal.predicted_orders,
          0,
        )
      : null,
    allocatedKg: batches.length
      ? batches
          .filter((batch) => batch.eligible)
          .reduce((sum, batch) => sum + batch.consumed_kg, 0)
      : null,
  };
}
