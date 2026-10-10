import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateTradeoff } from "./decisionMath.js";
test("hypothetical benefits subtract the entered action cost and retain remaining loss", () => {
  assert.deepEqual(estimateTradeoff(216, "30", "50"), {
    actionCost: 30,
    avoidedLoss: 108,
    remainingLoss: 108,
    netBenefit: 78,
  });
});
test("unknown or absent assumptions never become zero", () => {
  for (const args of [
    [null, "10", "50"],
    [216, "", "50"],
    [216, "10", ""],
  ])
    assert.equal(estimateTradeoff(...args), null);
});
test("invalid percentages/costs fail and costs exceeding benefit show a loss", () => {
  for (const args of [
    [216, "-1", "50"],
    [216, "20", "101"],
    [216, "20", "-1"],
    [216, "Infinity", "50"],
  ])
    assert.equal(estimateTradeoff(...args), null);
  assert.equal(estimateTradeoff(216, "200", "50").netBenefit, -92);
  assert.equal(estimateTradeoff(0, "0", "0").netBenefit, 0);
});
