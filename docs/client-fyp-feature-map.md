# Client changes mapped to the unchanged FYP objectives

Prepared 3 November 2026. Review baseline: `main` at `356ea0f`, plus the final
review fixes accompanying this document. This is a revision map, not an edited
FYP report or a claim that participant evaluation has been completed.

The earlier report cites application source `ab1a976`. Integration is frozen at
rollback `693e1ed`; its application code matches that baseline. The report branch
remains separate. Do not describe that earlier document's screenshots, diagrams
or test counts as evidence of the current client workflow.

## Objectives — retained verbatim

1. To design and develop a web application that supports flexible date-based food preordering and scheduling for home-based food entrepreneurs.
2. To implement a food stock freshness monitoring feature based on ingredient shelf life and storage duration.
3. To develop a personalised single-vendor storefront module that allows sellers to strengthen branding without direct competitor distraction.
4. To implement a sales analytics dashboard that supports data-driven business decision-making for home-based food operators.
5. To develop a menu recommendation system that reduces customer decision fatigue and improves purchase conversion rates.

## Implementation and evidence mapping

| Objective | Current implementation | Evidence to cite | Interpretation limits |
| --- | --- | --- | --- |
| 1 | Guest preorder with name/phone, dated delivery or collection, minute-based hours, menu weekdays/dates/cutoffs, area fees, accepted-term time changes, placement stock deductions, private QR proof or delivery cash, actual receipt recording | `backend/myapp/test_guest_checkout.py`, `test_simple_ordering.py`, `test_simple_ordering_postgres.py`, `test_client_journey.py`; final browser evidence | Scheduling now means dated fulfilment, not automatic cooking-task allocation. The client requested removal of Planner from the operational workflow. Availability depends on recorded eligible stock; future procurement is not counted as stock already received. No courier-event automation. |
| 2 | Recorded expiry evidence, actual storage, receipt/manufacture-based documented shelf life, optional raw-material guidance, opened/thawed limits, holds, date-derived indicators and FEFO allocation | `backend/myapp/services/freshness.py`, `test_freshness.py`, `test_expiry_evidence.py`, `test_storage_guidance.py`, `test_simple_ordering.py` | Rule-based monitoring of recorded remaining life and storage duration; not a sensor, spoilage detector or safety certification. General reference guidance needs matching ingredient/conditions. |
| 3 | Owner-controlled kitchen identity, story/contact, own menu/category/image uploads, delivery/collection terms and a single-vendor storefront | `frontend/src/pages/customer/BusinessPages.jsx`, `pages/admin/StoreSettingsPage.jsx`, `components/SimpleFulfilmentSettings.jsx`; guest checkout and earlier storefront/image tests | Branding controls are implemented; increased brand recognition requires evaluation. Guest contact details are order snapshots, not verified reusable identities. Staff authentication remains. |
| 4 | Daily order/menu-unit summary, individual print slips, date-range paid/received sales, net food/discount/delivery breakdown, CSV; historical costs/contribution and FreshCast retained separately | `backend/myapp/views/client_reports.py`, `test_client_reports.py`, `test_client_journey.py`; report and final browser evidence | Operational order value includes unpaid orders; sales require paid/received status. Profit and bank reconciliation are different. Demonstration credits/generated histories are excluded from the new business sales report. Forecast demonstration accuracy does not establish own-store accuracy. |
| 5 | Date-free recommendation cards plus an optional date/quantity/budget finder, single-menu or mixed alternatives, basket-aware pricing and recorded-stock checks, preference/history ranking where available, retained engagement metrics | `backend/myapp/views/discovery.py`, `views/basket_guide.py`, `services/discovery.py`; frontend `test:recommendations` and recommendation/guide backend tests | Functionality is implemented. Reduced decision fatigue or higher conversion is not proven by developer tests, ranking explanations, synthetic orders or a small observed example. Guest personalisation is limited to available session history/preferences; it does not recover someone by phone across devices. |

The source paths above refer to current `main`, not the frozen FYP baseline.
Full automated results include unrelated retained compatibility tests; they
should not all be described as tests of new client requirements.

## Requirement traceability for the client feedback

| Client request | Current behaviour / location | Verification |
| --- | --- | --- |
| Packaging page and stock tracking | Packaging stock, menu mapping, movements, low stock and per-order allocation | Packaging stock/locking suites; final browser history and remaining pieces |
| Deduct ingredients on order placement | Atomic recipe/packaging snapshots and FEFO ingredient allocation; retry-safe; shortage rolls back | Simple ordering, guest, PostgreSQL locking and integrated journey suites |
| No customer password or email | Private guest session; name and phone at checkout; delivery address when needed; protected staff sign-in | Guest suite, browser UI and cross-session private-data checks |
| Daily order/item report and print | Sales daily summary; order print slips include accepted name/address/phone | Report suite and browser print/PDF evidence |
| Sales reporting | Dated paid/received sales and CSV; net food and delivery income separate | Report/journey tests reconcile payment and receipt facts |
| Delivery fees by area | Settings → Collection & delivery; server-priced fees snapshotted at placement | Guest tests and browser delivery total; pickup has no delivery fee |
| Delivery 7:30 am–11 am | Default minute-based delivery/collection settings; editable by owner | Guest boundary tests at 07:29, 07:30, 11:00, 11:01 |
| Remove cooking Planner/rules | New simple-mode orders have no cooking reservations; Planner URL redirects to Orders; recipes remain for stock | Simple ordering tests ignore preparation limits while enforcing sale-date and stock rules |
| Upload QR payment proof at checkout | Private sanitised image; stays unpaid until bank verification; changed details require matching proof | Guest proof/privacy/retry tests; browser time-change and existing-receipt re-upload |
| Delivery QR/cash; collection QR only | New checkout options and authoritative server validation | Guest policy tests and both browser checkout paths |
| Received / not received | Individual and grouped actual receipt; corrections with reason; cancellation separate | Receipt/simple-ordering tests and browser grouped receipt; payment stays separate |

## Necessary report revisions when the document is updated

**Chapters 1–3:** retain the five objectives and the already marked research
discussion. Change only statements contradicted by the agreed client scope:
customer identity, payment methods, kitchen task planning, fulfilment hours,
packaging and the operational data flow. Describe the change as client feedback,
not as a feature present in the original baseline. Literature and original
evaluation results must not be invented or retrospectively changed.

**Chapter 4:** explain the current implemented customer/owner flows using a
fresh, identified source revision. Replace affected implementation screenshots
after the deployed revision is verified. Distinguish ordinary viewport captures
from full-page captures. Do not reuse test fixtures as claims of real customers,
real bank transactions or real sales.

**Chapter 5:** distinguish requirement tests, regression tests, PostgreSQL locking
checks, developer browser walkthroughs and actual participant/client evaluation.
Use the real counts, skips, local test environment and limitations from the
evidence. Follow [the user evaluation protocol](FYP-USER-EVALUATION.md) for new
participant observations; none are supplied by this review.

**Chapter 6:** discuss client-fit tradeoffs and remaining limits: no-email guest
recovery, manual bank verification, immediate stock allocation, manual courier
coordination, no guarantee of punctual handover, and recommendation outcomes
requiring a genuine user study. Do not assert that all real-world delivery or
food-safety risks have been solved.

### Diagrams that need coordinated changes

- **Use cases:** one customer actor with public browsing and private guest
  ordering; one authenticated owner/staff actor. Remove cooking-plan review from
  the current acceptance flow; add packaging, QR-evidence review, receipt and
  order reporting/printing. Bank and courier interactions are external/manual,
  not implemented automatic system integrations.
- **Activity:** distinguish delivery QR/cash from pickup QR-only; show stock/date
  validation and rollback, pending payment verification, actual receipt and
  cancellation/unused-return as separate actions. Do not merge paid and received.
- **Sequence:** show CSRF/session handling, server pricing, private upload,
  checkout request identity and transactional packaging/ingredient deduction.
  Uploading a receipt or opening print preview must not mark payment or delivery.
  The banking app transfer happens outside this website.
- **Class diagram/ERD:** retain the actual `User` table: a guest is an opaque user
  with an unusable password plus `GuestCustomer`, not removal of authentication
  columns. Add/reconcile `PackagingItem`, `ProductPackaging`, `OrderPackaging`,
  `PackagingMovement`, `CheckoutProof`, accepted customer/address JSON snapshots,
  `IngredientConsumption` and `PaymentEvent`. Recipe, inventory and date-evidence
  entities remain. The database still has legacy order status values; Received /
  Not received is their current operational presentation, not a newly created
  two-value database enum.

Keep identifiers and associations aligned with
[`backend/myapp/models.py`](../backend/myapp/models.py) and migrations 0024–0026.
Historical preparation data and legacy payment records remain in storage for
compatibility; hiding Planner in the client interface did not delete these tables.

## Evidence boundary and remaining acceptance work

Developer verification is recorded in
[the final review evidence](evidence/20261103-client-review/README.md). It is not
client sign-off. The five implementation batches are complete, but the following
remain separate from a source-code review:

- Verify the `main` release is **Ready** in Vercel and shows the current source
  revision; this session has no Vercel deployment access.
- The owner checks the actual receiving QR, area prices, collection location,
  recipes and physical stock against their own records. No live bank payment,
  courier booking or production database edit was performed here.
- Conduct and record genuine client/customer acceptance tasks if required for
  assessment. Measure recommendation effort/conversion only with an appropriate
  study and actual observations.
- Update the report document and diagrams as a separate reviewed revision using
  this map. This batch does not replace DOCX/PDF content, modify objectives or
  write to the report/integration branches.
