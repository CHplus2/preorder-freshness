import test from "node:test";
import assert from "node:assert/strict";
import { decisionBrief } from "./decisionBrief.js";
import { demoForecast } from "./mockData.js";
import { estimateTradeoff } from "./decisionMath.js";
const baseline = demoForecast({
  center_id: 13,
  week: 146,
  promotion_scenario: false,
});
test("downloaded briefing preserves provenance and baseline recommendation over an explored alternative", () => {
  const text = decisionBrief({
    baseline,
    risk: baseline.ingredient_risks[0],
    alternative: "Explore promotion",
    isFixture: true,
    estimate: null,
    percent: "",
  });
  assert.match(text, /Frontend fixtures — no model run/);
  assert.match(text, /BASELINE BACKEND GUIDANCE\nDefer replenishment/);
  assert.match(text, /Explored alternative: Explore promotion/);
  assert.match(text, /DRAFT FOR REVIEW — NO ACTION EXECUTED/);
  assert.match(text, /All values are frontend fixtures/);
  assert.doesNotMatch(text, /OPTIONAL WORKSHEET/);
});
test("unknown costs stay unknown and never export fictitious savings", () => {
  const text = decisionBrief({
    baseline,
    risk: baseline.ingredient_risks[1],
    alternative: "Review purchasing",
    isFixture: false,
    estimate: null,
    percent: "",
  });
  assert.match(text, /Potential waste cost: Unknown/);
  assert.match(text, /Expected shortfall: 17 kg/);
  assert.doesNotMatch(text, /Hypothetical net benefit/);
});
test("valid manager assumptions export their costs and negative benefit with explicit labels", () => {
  const text = decisionBrief({
    baseline,
    risk: baseline.ingredient_risks[0],
    alternative: "Review menu priorities",
    isFixture: true,
    estimate: estimateTradeoff(216, "150", "50"),
    percent: "50",
  });
  assert.match(text, /MANAGER ASSUMPTIONS, NOT MODEL OUTCOMES/);
  assert.match(text, /Assumed waste avoided: 50%/);
  assert.match(text, /Hypothetical net benefit: (?:-RM\s*|RM\s*-)42\.00/);
  assert.match(text, /Excludes sales revenue, shortage recovery/);
});
test("manual review notes remain self-reported and separate from backend guidance", () => {
  const text = decisionBrief({ baseline, risk: baseline.ingredient_risks[0], alternative: "Review purchasing", isFixture: true, reviewed: ["Supplier prices and delivery lead time"], handoffNote: "  Call supplier before ordering.  " });
  assert.match(text, /SELF-REPORTED, NOT SYSTEM VERIFICATION/);
  assert.match(text, /Marked reviewed: Supplier prices and delivery lead time/);
  assert.match(text, /Manager handoff note \(user-entered\):\nCall supplier before ordering\./);
  assert.match(text, /These notes do not approve or execute an action/);
  assert.match(text, /BASELINE BACKEND GUIDANCE\nDefer replenishment/);
});
test("unmarked review never implies verification or a prefilled handoff note", () => {
  const text = decisionBrief({baseline, risk: baseline.ingredient_risks[0], alternative:"Review purchasing", isFixture:true});
  assert.match(text, /No checks marked reviewed/);
  assert.doesNotMatch(text, /Manager handoff note \(user-entered\)/);
});
