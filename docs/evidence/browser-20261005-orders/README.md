# Delivery, fulfilment and owner feedback — 5 October 2026

Manual developer verification in the in-app browser on localhost:8023. Explicit temporary SQLite database, dotenv disabled, synthetic review accounts only. No live database, email or payment-provider activity.

## Executed checks

- Customer changed synthetic ORD-00002 from 8 November to 10 November 2026 at 15:00 Malaysia time using preview and confirmation. The order card updated, RM21 total remained unchanged, and payment remained unpaid.
- Stopped the isolated Django server, then opened ORD-00001 delivery history. A readable connection error and Try again button appeared. Restarted the server; retry displayed “No delivery changes recorded.”
- Owner updated ORD-00002 through Processing, Cooked, Shipped and Delivered using the edit dialog. Each update persisted. Customer re-login displayed Delivered, the completed progress steps and a review link. Payment stayed unpaid throughout. These were synthetic fulfilment actions, not a claim of actual cooking or delivery.
- After rebuilding with response validation, delivery history still rendered the prior/current delivery dates, reason and customer attribution correctly.
- Empty expense/wastage disclosures expanded and displayed record counts, scope and actionable empty-state text. Previously their bodies contained only mapped records, so empty arrays produced no visible content.
- Created synthetic ORD-00003 with a past delivery and no accepted ingredients to exercise both follow-up notices. Planner displayed the amber-accented recipe warning; Review affected orders focused planner-order-3. Orders displayed Delivery follow-up with clear next steps.
- Inspected desktop and 390px layouts for the ledger and overdue notice. Text wrapped, buttons remained separated and document width did not exceed viewport width. Viewport override was reset afterward.

## Changes

Delivery policy, preview and confirmation responses are checked before use. An unexpected confirmation is not accepted as success. A confirmed save is kept separate from subsequent refresh errors; the message explains that the change was saved if loading details fails. Confirmation tokens remain available for idempotent retries after network/server failures. History/policy reloads clear old policy first.

Empty ledgers now explain the absence of records. Expense scope remains latest 100 across all dates; wastage remains selected period, latest 100. No accounting scope changed. Two routine follow-up notices use a quiet amber side rule rather than a full red error box; genuine blocking errors retain their error treatment.

## Validation and limits

- Isolated Django `myapp.test_rescheduling`: **14 passed**.
- Frontend `npm test`: passed, including malformed delivery response cases and replayed-confirmation acceptance.
- ESLint and production build: passed, including after the ledger/notice edits.
- Browser checks above are manual developer observations. Save-success followed immediately by a refresh failure was code-reviewed, not injected at that exact boundary in the browser. Invalid API payloads were tested at the validator level. This is not exhaustive fault injection, a user study, or proof of all rubric marks.

Screenshots: [delivered customer order](delivered.png), [planner follow-up](planner-follow-up.png), [overdue order](order-follow-up.png), [mobile order](order-mobile.png), [empty ledgers](empty-ledgers.png), [mobile ledgers](ledgers-mobile.png). All contain synthetic data.
