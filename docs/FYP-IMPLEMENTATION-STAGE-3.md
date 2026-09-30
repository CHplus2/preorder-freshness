# Stage 3: owner setup checklist

Implemented 30 September 2026. Single-vendor scope is unchanged.

## Delivered

Settings now includes **Set up your kitchen**, a read-only checklist derived from saved records:

1. Kitchen name, introduction and owner name.
2. Service area plus an email or WhatsApp contact.
3. Positive ingredient quantities for every menu.
4. Explicit valid preparation tasks for every menu.
5. Ingredient cost estimates and packaging costs for every menu.

Each incomplete menu check shows the affected count and up to ten menu names, with a link to the relevant editing screen. Zero costs are valid explicit values; missing costs are not converted to zero. An empty catalogue cannot complete menu checks. Saving settings refreshes the checklist; a Refresh checks button updates it after other edits. Owner name is now in the main identity section.

Inventory follow-up displays non-empty received batches, those within recorded dates and not held, expired/held counts, and usable batches missing purchase costs. Future receipts and empty batches are excluded. Expired and held counts can overlap. No-stock kitchens are not prevented from taking future preorders requiring procurement.

The endpoint is staff-only and read-only. It does not create default store records, expose private setup details to customers, alter menu availability or block checkout. Completion means these recorded fields are present; it does not certify food safety, verify contact deliverability, enforce delivery zones, or prove production readiness. A full onboarding wizard, uploads, and pickup/delivery zones remain later work.

## Verification

- Full isolated SQLite suite: **133 discovered, 132 passed, 1 PostgreSQL-only test skipped**.
- Seven new tests cover permissions, empty setup, GET without mutation, complete setup with zero costs/no stock, changed records, bounded examples, invalid preparation tasks and stock eligibility.
- All 10 frontend utility tests passed; targeted ESLint passed for the new checklist component.
- Production frontend build passed. No new migrations were generated or required.
- Browser interaction has not been verified in this batch. Check Settings at phone and desktop widths, follow each editing link, save a setting and confirm the progress refreshes, then edit a menu and use Refresh checks.

Stage 1 migrations remain required before deploying the combined changes. No live database migration or manual deployment was performed.

## GitHub workflow

At the user's request, completed verified batches are committed and pushed to `https://github.com/CHplus2/preorder-freshness`. Stages 1 and 2 were pushed in commit `c9c087e`; this stage is a separate commit. A push is not evidence that a connected hosting deployment or its database migration succeeded.
