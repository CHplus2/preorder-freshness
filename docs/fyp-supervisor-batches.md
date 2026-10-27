# Supervisor feedback batches — 27 October 2026

## Batch 1: menu budget comparison

The date-based menu finder supports within, above, and both budget ranges. It
compares the full requested quantity of one menu, before discounts and excluding
delivery/existing basket items. Cards show unit price × quantity = food total
and the difference from the budget. The browser rejects inconsistent returned
totals or the wrong side of the selected budget. Clearing/changing preferences
invalidates old results; an explicit comparison action can recover from an empty
within-budget search. Date-free recommendations/catalogue browsing remain separate.

The regression reproducing RM35 × 3 with a RM100 budget **passed on the previous
backend**: that menu was excluded. No incorrect production response was available
for inspection. This batch removes ambiguous price presentation and adds explicit
above-budget exploration rather than claiming a reproduced arithmetic bug.

## Batch 2: inventory date modes and shelf-life guidance (pending)

Audit all existing printed-expiry, manufacture-plus-duration and receipt/storage-
duration modes, including edits, opened/thawed deadlines and handling history.
Show only the relevant date fields and distinguish receipt date from a supplier's
printed expiry. Existing date-based statuses and remaining-window percentages
are deterministic record calculations, not random values or laboratory safety
measurements; make those definitions clear to the owner.

Use documented, condition-specific general guidance for unlabelled ingredients.
The supplied FoodSafety.gov cold-food storage chart is a reference to review,
not an automatic guarantee for a wet-market batch with unknown prior handling.
Do not invent a manufacturing date. Storage conditions, ingredient state and
actual handling must match the selected guidance. Review source text before
seeding any reusable defaults.

Prefer optional reusable raw-material guidance with source and storage context,
while retaining documented custom input on each batch. A raw-material default
should not be mandatory before an owner can record a batch's own guidance.
Do not silently apply a frozen duration to chilled stock or replace a shorter
supplier/handling deadline with a longer generic rule. Any schema addition needs
a concrete tested migration/release script; no database password changes.

## Courier automation and reminder verification

Grouped progress and manual courier/WhatsApp contact actions are implemented.
Food-ready eligibility covers pending/processing orders with valid reviewed
preparation boundaries. Courier pickup and actual customer receipt remain
separate events; time passing does not update them.

GrabExpress booking/reference import/webhooks remain pending official regional
API access, as described in [courier readiness](courier-integration-readiness.md).
No sandbox connection is assumed. Email scheduler code/configuration workflow
has been fixed, but a successful scheduled worker execution and actual intended
inbox receipt still require live verification. These tasks are not completed by
this menu-budget batch.

Batch 1 validation: 63 backend recommendation/commitment/preorder tests pass,
including RM35 × 3 excluded from RM100 within-budget searches, strict above-
budget matching, the RM99.99 equality boundary, mixed-range selection, no invented
capacity and bounded scans. Frontend recommendation and checkout suites, lint
and production build pass. Eleven whole-page accessibility/overflow scans pass
at 1440, 768, 390 and 320 pixels. The real local API/browser journey covers all
three modes, empty-result recovery, wrong-total response rejection, clearing
stale results and explicitly adding three above-budget units. No order was placed,
no live worker was called and no real customer data/email/provider was used.
