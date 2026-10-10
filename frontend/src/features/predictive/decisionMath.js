// Manager-entered worksheet assumptions, never model estimates or optimized decisions.
export function estimateTradeoff(wasteCost, actionCost, avoidedPercent) {
  if (wasteCost === null || actionCost === "" || avoidedPercent === "")
    return null;
  const cost = Number(actionCost),
    percent = Number(avoidedPercent);
  if (
    !Number.isFinite(wasteCost) ||
    wasteCost < 0 ||
    !Number.isFinite(cost) ||
    cost < 0 ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100
  )
    return null;
  const avoidedLoss = wasteCost * (percent / 100);
  return {
    actionCost: cost,
    avoidedLoss,
    remainingLoss: wasteCost - avoidedLoss,
    netBenefit: avoidedLoss - cost,
  };
}
