# Assessment against the supplied Dormathon judging criteria

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

The current hosted interface is functional as a model-backed Genpact prototype.
The local planning backend is tested, but the hosted Decision Assistant's local
mode still needs UI integration and successful deployment. Reliable local
forecasting remains unestablished. Retraining a small demo history alone does
not close those gaps or establish business value.
