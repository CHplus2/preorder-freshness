import test from "node:test";
import assert from "node:assert/strict";
import { riskTradeoff } from "./riskTradeoff.js";
const baseline = { expiring_unused_kg: 18, shortfall_kg: 0 };
test("missing scenario is unavailable rather than zero-risk", () =>
  assert.equal(riskTradeoff(baseline, undefined), null));
test("less waste with more shortage exposes the tradeoff without declaring savings", () => {
  const result = riskTradeoff(baseline, {
    expiring_unused_kg: 8,
    shortfall_kg: 3,
  });
  assert.equal(result.waste, -10);
  assert.equal(result.shortage, 3);
  assert.match(result.summary, /decreases by 10 kg.*increases by 3 kg/);
  assert.match(result.caution, /more shortage/);
});
test("reverse tradeoff, unchanged and zero quantities retain their meaning", () => {
  assert.match(
    riskTradeoff(
      { expiring_unused_kg: 0, shortfall_kg: 10 },
      { expiring_unused_kg: 5, shortfall_kg: 0 },
    ).caution,
    /more potential waste/,
  );
  assert.match(
    riskTradeoff(baseline, baseline).summary,
    /unchanged.*unchanged/,
  );
  assert.match(
    riskTradeoff(baseline, { expiring_unused_kg: 0, shortfall_kg: 0 }).caution,
    /do not establish profit/,
  );
});
