# Batch 3: backend extension request (proposal, not an agreed contract)

Inspected backend `ac967c2`: API v1 still supplies baseline and observational promotion-flag responses only. The frontend comparison workbench uses these existing fields without extending the adapter or changing backend code. Unknown costs and missing scenario ingredients remain unavailable; differences are signed arithmetic, not savings or causal uplift. The existing manually entered financial worksheet remains separate and explicitly hypothetical.

For the backend developer to agree before further integration:

- An action identifier and supported parameters/constraints for purchasing or menu prioritization, with read-only scenario evaluation. Reject unsupported parameters.
- Verified meal-to-local-product/ingredient mapping and quantity units before naming local dishes or proposing bundles.
- Same-center/week baseline and scenario ingredient waste, shortage and reorder quantities, plus purchasing/action cost when a verified or explicitly simulated price source exists.
- Revenue or profit only if the backend actually calculates them, with explicit included/excluded costs; unavailable values must be null.
- Provenance for operational inputs, assumptions, warnings, scenario identifier and any evaluated uncertainty. Explain observational promotion limitations; do not invent causal confidence.
- Preserve session/CSRF protections and no orders, stock writes or promotion activation. Update the canonical contract and endpoint tests together when agreed.

No new endpoint or JSON field names are assumed by the frontend. Existing baseline guidance remains authoritative; the workspace does not automatically select a winning action. Production integration and live API testing are still separate from fixture browser validation.

Validation for this frontend increment: all 18 predictive tests and existing frontend/UX/planner/checkout suites passed; production build and changed-file ESLint passed. Browser checks using intercepted contract fixtures covered baseline/scenario switching, absent promotion evidence, unknown costs, mobile overflow and the existing full decision journey. No live backend or Vercel deployment was verified.
