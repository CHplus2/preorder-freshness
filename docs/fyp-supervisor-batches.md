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

## Batch 2A: inventory date modes and deadline evidence (completed)

The form now shows the fields needed for printed expiry, manufacture plus
documented duration, or receipt plus documented storage life. Receipt means when
the batch reached the owner; it is not the manufacture date or printed expiry.
Unlabelled batches can use custom documented storage life without an invented
manufacturing date or a raw-material preset. A preview shows the date arithmetic.

Saving preserves the earliest calculated, printed, opened or thawed deadline.
Previously a separately recorded printed limit could be ignored in calculated
modes. Switching a legacy labelled batch to a calculation retains its old printed
deadline when omitted; switching back does not invent a printed date from a
calculation. Unknown handling or a storage breach visibly holds the batch.
Existing stored records are not rewritten: review their evidence on edit.

Recorded status uses Malaysia's date: before today is expired, today through
three days ahead needs attention, and later dates are within the recorded
deadline. A hold overrides these statuses. These are deterministic planning
rules, not random values or physical freshness/safety measurements. No database
migration, production data edit or forecast/model change is needed for 2A.

Use documented, condition-specific general guidance for unlabelled ingredients.
The supplied FoodSafety.gov cold-food storage chart is a reference to review,
not an automatic guarantee for a wet-market batch with unknown prior handling.
Do not invent a manufacturing date. Storage conditions, ingredient state and
actual handling must match the selected guidance. Review source text before
seeding any reusable defaults.

Batch 2A validation: all 745 application tests pass (20 platform-specific skips),
including seven new expiry-evidence regressions; 90 focused PostgreSQL tests
also pass. Frontend lint, UX/recommendation tests and production build pass.
Eleven full-page accessibility/overflow checks at desktop and 390/320 pixels
cover unlabelled receipt-based creation, handling holds, printed/opened limits,
edits and mode switching against a disposable local PostgreSQL database. No
production records or real emails/courier requests were used.

## Batch 2B: optional reusable raw-material guidance (released)

The ingredient directory supports up to one receipt-based reference for each
storage type: chilled, frozen or ambient. Days, a source/document reference and
applicable ingredient state/storage conditions are required for an entry; an
empty list remains valid. No duration is preseeded or claimed to be verified.

A batch offers only the reference matching its actual storage. An explicit
action copies days and evidence into received-date mode, keeping printed caps,
opened/thawed limits and holds. Custom evidence remains editable. Switching the
ingredient clears borrowed date evidence instead of carrying guidance for a
different ingredient. Existing saved batches are not changed by reference edits.

Migration `0023_raw_material_storage_guidance` adds a JSON field defaulting to an
empty list for existing ingredients. The tested Supabase SQL equivalent is in
`deploy/sql/0023_raw_material_storage_guidance.sql`. Follow the
[release instructions](freshcast-storage-guidance-release.md) before publishing
to production; no database password changes are needed. The owner confirmed the
target migration result on 27 October 2026, allowing main and integration to
advance together. This confirmation is owner-reported; live Vercel deployment
health is separate from the completed local release checks.

All 751 application tests pass (20 platform-specific skips). Validation includes
six new API tests for optional guidance, storage separation,
strict input validation, access control, snapshots and source limits, plus 58
focused PostgreSQL tests. Frontend lint, UX/unit suites and production build
pass. Eleven full-page accessibility/overflow checks at 1440, 390 and 320 pixels
exercise UI creation/error recovery, matching-storage copy, printed caps,
multi-storage edits, custom values and ingredient switching. The SQL script was
run twice on an isolated pre-migration PostgreSQL fixture and preserves existing
ingredient rows. No production records, emails or courier requests were used.

## Inventory form follow-up: simpler primary path

The date form now leads with package date, received-date calculation or
manufacture-date calculation. Receipt-based guidance is offered only in the
relevant mode; manual documented input remains available without a preset.
Supplier/cost and opened/thawed/handling fields are collapsed, with recorded
limits indicated and holds visible. Unchanged quantities do not ask for an
adjustment reason. Edit displays one ingredient identity rather than the whole
disabled directory. Best-before wording distinguishes quality from measured
spoilage, while retaining the conservative allocation cutoff.

Changing storage clears old calculation days/source so a frozen reference is not
silently reused for chilled stock. Earlier printed and event limits/holds remain.
The change has no migration or backend rule/model modifications. Validation:
45 focused inventory/reminder tests pass (one PostgreSQL-only skip), frontend
lint, unit/UX suites and production build pass, and ten full-page accessibility/
overflow checks pass at 1440, 390 and 320 pixels. The browser uses local fixture
records for printed, manual/saved receipt, manufacture, stock-adjustment and
earlier-limit paths. No live worker, real email or production record was used.

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
