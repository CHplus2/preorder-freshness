# Operations and feature status

Verified against the repository on 25 September 2026. Configuration-dependent features are not automatically active just because code exists.

## Accounting: implemented, with limits

Sales > Costs, wastage and pricing provides:
- Per-ingredient estimated unit costs and per-portion packaging costs.
- Current recipe contribution = menu price - ingredient quantities x unit cost - packaging.
- Operating expenses by date/category, with voiding rather than deletion for corrections.
- Waste quantity and reason, atomic inventory deduction, and a cost snapshot from batch unit purchase cost.
- Date-range totals for expenses and known waste cost; unpriced waste stays unknown.
- Retry protection to avoid recording the same expense/waste submission twice.

Example: chicken RM12/kg should be recorded as RM0.012/g if inventory uses grams. A 150g portion costs RM1.80 for that ingredient. Do not enter RM12 per gram.

Ingredient estimated unit cost is used for menu pricing. A batch's actual unit cost is used for its waste valuation. These are separate values, not automatic weighted-average stock accounting.

Current menu contribution is not historical order profit or net profit. Missing recipe/ingredient/packaging costs produce unknown values rather than fabricated zero costs. Changing the report date range changes expense/waste totals, not the current menu-cost assumptions.

Not implemented: double-entry bookkeeping, balance sheets, tax reporting/e-Invoice integration, bank reconciliation, historical cost of goods sold per order, supplier payables, purchase-order accounting or automated stock valuation. Avoid counting purchases as overhead and also counting the same ingredients as consumption.

Code: backend/myapp/views/costs.py; frontend/src/components/CostPanel.jsx; backend/myapp/test_costs_freshness.py. Database additions are in migration 0014.

## Supplier management: proposed, not implemented

Implemented: a free-text supplier name on each inventory batch.
Not implemented: supplier directory, supplier login, purchase orders, supplier API integration, automated supplier messages or delivery receipt workflow.

Recommended future scope:
1. Save supplier contacts, materials, units, pack sizes, minimum quantities and lead times.
2. Turn shopping shortages into a draft purchase order.
3. Owner confirms and sends it through an agreed supplier channel.
4. Track expected arrivals separately from usable stock.
5. Record partial/full receipts, actual quantities/costs and batch evidence.
6. Only received goods increase inventory.

Do not imply that suppliers must join this app or that a marketplace provides a public integration API. Confirm supplier coverage and commercial terms separately.

## Menu photos

Implemented: public HTTP/HTTPS image URLs, with a labelled preview and a clear load-failure message in create/edit forms. The editor shows the full image; storefront cards may crop it. The URL must point to an image that loads without login. A webpage/TikTok post URL is not an image URL.

Direct file upload is NOT implemented. Product stores image_url, not a persistent uploaded file.

Recommended future UX: offer Upload photo as the primary method (especially on phones), with Use image link as a secondary option. Before adding uploads, configure persistent object storage, staff-only upload permission, size/type validation, generated filenames, resize/compression, progress/retry feedback and unused-image cleanup. Do not store production uploads on temporary function-local disk. No storage credentials belong in frontend code.

## Freshness: recorded shelf life, not a safety measurement

Batch inputs support:
- Printed packaging date and whether it is use-by or best-before.
- Manufacture date plus documented shelf-life days.
- Receipt date plus documented storage-duration days for unpackaged/market purchases.
- Storage type/location, supplier/source, handling evidence and hold state.
- Opening/thawing dates with their documented day limits.

Effective deadline is the earliest applicable base, opening and thawing deadline. Unknown handling or a known handling breach forces a hold. Changing storage type does not automatically grant a longer shelf life. There is no continuous time-temperature or microbiological model.

Wet-market goods require reliable handling information and appropriate documented guidance; receipt time alone cannot reveal how old the food was before purchase. AI/image recognition does not supply that missing evidence.

Customer inventory summary appears below the menu and can be expanded. Its percentage is equal-weight average recorded shelf-life remaining per eligible batch, not a lab freshness test or the guaranteed freshness of a future meal. Expired/held batches contribute zero; insufficient records are excluded and counted separately. A tiny batch and a large batch have equal weight. The current app uses dates, not hourly safety thresholds.

For a batch with sufficient records:
remaining percentage = clamp(100 x days from today to effective expiry / days from start to effective expiry, 0, 100).
Start is manufacture date for manufacture-based batches, otherwise receipt date.
Zero/negative duration is insufficient evidence. Empty and future-received batches are excluded.
The expiry date itself can show 0% remaining while still being within the recorded date; stock eligibility lasts through that date. Expired and held counts may overlap because a held batch can also be expired.

Code: backend/myapp/services/freshness.py; inventory serializer validation; frontend/src/components/ExpiryFields.jsx and InventoryFreshness.jsx.

## Integrations and limits

- Email reminders: implemented, but SMTP credentials, owner recipient and an external schedule must be configured. Settings readiness does not prove messages are being delivered.
- Manual DuitNow QR/bank transfer: owner-configured instructions, followed by owner verification of bank records. No automatic bank confirmation.
- Delivery: owner planning and external directions/express links; no automatic GrabExpress booking, live tracking or traffic-based ETA.
- Social promotion: owner-entered food-video/social links; no social publishing or campaign attribution.
- Recommendations: local purchase/category/popularity rules; no paid AI required.
- Forecast: historical-data baseline/trend comparison, not a guarantee of demand. Confirmed preorders should guide immediate production.
- Testnet escrow: see the separate escrow README and deployment guide; never represent demo/testnet money as real payment protection.
- Language: English UI; full Malay localisation remains future work.

## Maintenance and safe handover

Use README for setup, DEPLOYMENT for hosting, PREPARATION-PLANNING for scheduling.
Keep production credentials out of prompts, commits and screenshots.
Run database tests with the documented isolated SQLite environment; backend/.env may point at live Supabase.
After schema changes, review and apply migrations before deploying dependent code.
A successful build does not prove mobile layout or live third-party delivery; inspect those separately.
