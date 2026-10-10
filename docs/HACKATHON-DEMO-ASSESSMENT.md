# Assessment against the supplied Dormathon judging criteria

## Final decision after reading the uploaded judging rubric (10 October 2026)

The uploaded `Dormathon_2026_Judging_Rubric.pdf` gives the Predictive Model Track
five equally weighted criteria: problem clarity/value, predictive rigor/data
robustness, decision support/actionability, explainability/trust, and live
execution/prototype/pitch. Its guiding question is: "Does your model help someone
make a better decision, and can you prove it?" It rewards sound forecasting,
noise/missing-value handling and concrete prioritized interventions. It does not
specify CatBoost, a maximum WAPE, mandatory proprietary customer data, or an
interactive arbitrary-input prediction form. Its scores are not an eligibility
rulebook; this PDF does not resolve whether pre-existing FYP code is permitted.
The earlier five-pillar summary below is historical context, not this track rubric.

**Keep the working evaluated Genpact CatBoost demonstration. Do not promote the
failed local/bakery CatBoost candidates.** This is a late-stage release decision,
not a claim that Genpact transfers to the owner's shop or that WAPE on different
datasets can be compared to rank models. On Genpact's own chronological holdout,
the saved model's freshly reproduced WAPE is 28.23494%, versus 34.80762% for the
previous observation: an 18.88288% relative error reduction on 32,821 rows. The
artifact was trained through week 135 and evaluated on weeks 136–145. No new
model fitting or hyperparameter selection was performed for this release.

The staff-only `backtest/?center_id=13&week=136` endpoint now lets a judge choose
a labelled held-out week and inspect actual quantities, model predictions,
baseline predictions and selected-slice WAPE/MAE. It runs the saved model with
past-only quantity features; changes to target/future quantities do not change
the selected prediction. Historical price/promotion inputs are assumed known.
This is a replay of an already evaluated holdout, not fresh independent evidence
or a stock-risk calculation. Week 146 remains the unlabelled future scenario.

Keep database-backed `local-plan/` as a distinct confirmed-order/recipe/stock
calculation, not a learned demand forecast. The React entry screen now defaults
to this connected mode; Genpact and simulated operations remain a selectable
external forecasting demonstration.
Do not claim current local accuracy, actual savings, zero false alarms, a coherent
fully connected local forecasting demo, or a guaranteed judging score. Stock and
recipes cannot repair the scarcity/relabelled provenance of original sales.

Quick presentation sequence: demonstrate the database kitchen's
Detect → Categorize → Prioritize → Explain → Decide journey and hypothetical
purchase, then show the Genpact held-out evidence and explain the boundary.
Lead with the specific kitchen decision
and finish with a pilot plan to collect stable menu/date history. A single coherent
public-bakery shop would require the unimplemented migration described in
`PUBLIC-BAKERY-DEMO-FEASIBILITY.md`; do not attempt a rushed catalogue/history rewrite
or claim that migration happened.

## Earlier general judging summary

The owner supplied five judging pillars and a summary saying functional products
are built from scratch during a continuous 24-hour sprint. The official reuse
rules have not been provided. This project uses an existing FYP repository;
verify whether that is allowed and document which components predate the sprint
and which were created during it. Do not present the whole FYP as new sprint work.

No rubric score or chance of winning can be determined from this summary alone.
The criteria do not explicitly require real customer history or locally trained
models. A clearly disclosed simulated demonstration can show functionality;
actual business impact and forecast accuracy require separate evidence.

| Pillar | Current evidence | Useful improvement |
| --- | --- | --- |
| Design & implementation | Hosted staff authentication, genuine CatBoost API inference, responsive FreshCast Decision Assistant and working navigation | Connect an explicit local kitchen mode to confirmed bookings, accepted recipes and database stock; current FreshCast still uses simulated operations |
| Innovation & novelty | A guided detect → categorize → prioritize → explain → decide workflow for small food businesses | Demonstrate a specific home-kitchen constraint and a clear operational decision the assistant helps make |
| Technical complexity | Evaluated model, chronological features, recipe conversion, FEFO exclusions, risk APIs, what-if scenarios and verified artifact provisioning | Present the model/data boundaries and limitations clearly; a tested complete flow is stronger evidence than tool names alone |
| Social impact | Food-waste prevention and avoiding ingredient shortages are relevant community problems; SDG 12 is a plausible alignment | Label waste exposure/savings as hypothetical; define measurable pilot outcomes rather than claiming already achieved reductions |
| Commercial viability | Home food businesses are a concrete potential customer group | Explain pilot recruitment, subscription/service pricing hypothesis, data collection, operating costs and how business value will be tested |

## Demonstration priorities

1. Establish reuse eligibility before relying on this FYP-based submission.
2. Rehearse an end-to-end kitchen case with database recipes, dated stock and
   reviewed confirmed orders: show both expiry surplus and purchasing shortfall.
   Label known bookings as known quantities, not ML forecasts.
3. Use the evaluated Genpact case to show genuine ML and chronological metrics,
   clearly separate from the kitchen case. Its meal IDs and simulated operations
   must not be described as the owner's own orders/stock.
4. Have the teammate's UI make source, assumptions and action consequences easy
   to understand. Backend response validation must accept any future local mode
   explicitly; the current frontend requires the Genpact/simulated source schema.
   A [local planning API and frontend handoff](LOCAL-KITCHEN-INTEGRATION.md) are now
   implemented, with confirmed booking requirements rather than model forecasts.
5. Present a realistic route to validated local forecasting after enough dated
   history and repeated menu observations exist. The executed local aggregate
   [booking experiment](LOCAL-BOOKING-EXPERIMENT.md) failed to beat the stronger
   baseline and should remain offline.

The integrated interface now supports database-based confirmed-order planning,
and preserves the model-backed Genpact prototype. Reliable additional-customer
forecasting for the owner's shop remains unestablished. Retraining a small demo
history alone does not establish real business value or predictive accuracy.
