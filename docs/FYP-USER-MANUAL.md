# Dapur Kita user manual

**Current behaviour:** see [the feature guide updated 9 October 2026](DAPUR-KITA-FEATURE-GUIDE.md)
for owner-review fallback, manual windows, step editing and email rules. Latest
automated results: [verification summary](LATEST-VERIFICATION-20261009.md).

Scope: single-vendor home-food preorder system. Screens can vary by role. Prices, dates and stock shown in screenshots must be labelled as test data when synthetic. Never share passwords or live customer details in the report.

## Customer: order food
1. Open Menu and browse or search. Read advance notice, delivery weekdays and the food description. Ask the owner about allergies; ingredient records do not certify suitability.
2. Add portions to the basket. Paused/archived menus cannot be newly ordered. Remove any unavailable items that were added earlier.
3. Open Checkout. Save a complete delivery address and choose a Malaysia-time delivery date/time. Any shared-weekday restriction is shown for the basket. Conflicting menus may need separate orders.
4. Check availability, or request suggested times. A successful quote is advisory: checkout checks capacity again. If automatic preparation cannot fit, submit an unpaid request for owner confirmation; valid delivery dates, notice, selling rules and daily capacity still apply. Ingredient procurement may still be needed.
5. Choose COD or the configured manual transfer option. Manual payment does not automatically mark the order paid. Demo wallet/testnet options are demonstrations, not real payment settlement.
6. Submit once. Open My orders to confirm the saved order and track its recorded stages. On a timeout, inspect My orders before retrying; an order may have been saved despite a lost response.
7. Use delivery-change controls when offered. Preview a proposed change and confirm it before its preview expires. Started orders and cutoff rules can prevent a change. A review is available only when the server considers the order eligible.

## Owner: configure the store
1. Sign in with an owner/staff account and open Settings.
2. Enter business identity, delivery area/contact, kitchen hours and realistic travel buffer. Save settings and look for confirmation. Existing accepted schedules are not automatically replanned.
3. Review setup checks. Identity/contact links focus those fields; menu links preserve the review task and guide the corresponding menu editor section.
4. Configure bank/DuitNow instructions only if offering manual payment. Verify receipts externally before recording payment. SMTP credentials belong in deployment environment variables, not public settings. Email also needs a configured provider and, for reminders, a scheduler.

## Owner: inventory and recipes
1. Create raw materials with consistent units. Convert costs to the same units as recipe quantities (e.g. cost per gram rather than per kilogram).
2. Record actual received batches, quantity, purchase cost and documented expiry/storage information. Unknown or breached handling needs a hold; never invent evidence to release stock.
3. Create a menu and enter ingredient quantities per portion, packaging cost, batch size, notice and capacity. Unknown cost is different from zero cost.
4. Add preparation steps, equipment, hands-on/unattended time and permitted waiting periods. Use real handling limits. An individual hands-on step is not split across nights automatically.
5. Leave delivery weekdays unrestricted unless the menu really has restricted delivery days. These days constrain delivery, not when customers may preorder or preparation may begin.
6. Pause a menu to stop new orders. Archive it to remove it from the current management list. Restore as paused before explicitly resuming. Existing accepted orders retain history.

## Owner: fulfil orders
1. Review pending orders and Planner. Check shortages, worker/equipment conflicts and closures. The planner uses the entered assumptions and needs owner oversight.
2. Purchase needed ingredients and record received stock. Inspect expiry and held records before preparation.
3. Follow available order-stage actions. Cooking consumes accepted recipe ingredients through eligible batches. A shortage should reject the update without partially deducting stock.
4. Review packing/dispatch information and update actual fulfilment stages. Do not mark a delivery complete before it happens.
5. Payment records confirm an external receipt/refund or a demo-wallet movement. A failed/pending refund is not a completed refund. Keep the transaction reference.

## Owner: interpret reports
Use Sales/Reports to select a period, inspect order outcomes, costs and contribution, and export evidence. Date filters and inclusion rules matter. Missing batch costs remain unknown. Contribution excludes costs outside the implemented calculation and is not a promise of net profit. Recommendation counts are observations, not proof that recommendations caused sales.

## Recovery and support
- Loading/error state: use the provided Retry/Reload control. Do not infer an empty business from an error screen.
- Sign-in/session error: sign in again after checking whether a submitted order was already saved.
- Storage error at checkout: check My orders first, then allow browser storage. Do not repeatedly clear references during an uncertain submission.
- Unavailable date: check common weekdays, notice, operating hours and kitchen capacity; contact the owner if needed.
- Save error: preserve the form, correct the indicated fields and retry. Success is based on server acknowledgement.
- Error reference: provide the reference, affected page, approximate time and order number to the maintainer. Do not send passwords or bank credentials.
- Email not configured: do not expect reminders/recovery messages to arrive. The maintainer must configure and verify delivery separately.

## Manual acceptance walkthrough (not yet recorded as passed)
Perform customer ordering/amendment and owner setup/inventory/planning/reporting on isolated test data, at phone and desktop widths. Record task outcome, expected/actual result, screenshot and any defect. Complete keyboard-only navigation and network-failure recovery. Do not claim these steps passed merely because this manual exists.
