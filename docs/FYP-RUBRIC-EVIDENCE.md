# Chapter 4 and 5 evidence guide

This guide interprets the rubric supplied by the student. The original formatted rubric and supervisor guidance take precedence. It is not a claim of a grade, complete coverage, or empirical business impact.

## Reproduce the verification
From the repository root on Windows, run:

```powershell
.\backend\venv\Scripts\python.exe scripts/verify_fyp.py
```

Use the existing virtual environment and installed frontend dependencies. The runner disables dotenv, overrides the database with in-memory SQLite and uses in-memory email. It never runs migrations against production. It writes a dated manifest, verbose logs and a backend test inventory under docs/evidence. An exit code of 1 means one or more checks failed; inspect each recorded exit code. Skips are visible in backend.log and are not passes. The manifest records the base commit and whether the working tree was modified. Do not label a modified-tree run as an exact clean-commit result.

## Objective 1: flexible preordering and scheduling
Implementation: services/scheduling.py, views/orders.py, views/rescheduling.py; checkout, date guidance and Planner UI.
Verification: test_planning.py tests resource/worker overlap, multiday dependencies, closures, stale previews, immutable accepted plans and query growth. test_rescheduling.py covers amendment eligibility. test_delivery_weekdays.py covers allowed/disallowed delivery days and old accepted terms. test_checkout_failures.py injects persistence failure after order creation and demo-wallet debit; it asserts rollback, retained basket and safe replay.
Interpretation: these establish tested rule behaviour, not that a home cook's entered recipe timings are accurate. Independent orders are not automatically merged into production batches. PostgreSQL locking needs the isolated test_postgres_commitments.py run; SQLite cannot establish it.

## Objective 2: ingredient freshness monitoring
Implementation: inventory models/serializers, FEFO consumption and freshness views.
Verification: tests.py, test_freshness.py, test_inventory_audit.py, test_costs_freshness.py and test_commitments.py cover recorded dates, earliest opened/thawed deadlines, held/expired stock, stock overdraw, immutable costs and rollback.
Interpretation: recorded shelf life is an estimate, not microbiological evidence. Food safety certification and measured waste reduction have not been established.

## Objective 3: personalised single-vendor storefront
Implementation: storefront settings and business pages; menu lifecycle and owner permissions.
Verification: tests.py contains business-story roundtrip, settings permission and public route tests; test_setup.py covers setup state; frontend ProductUx.test.js covers selected rendered states.
Remaining validation: real customer comprehension, brand recognition, keyboard workflows and responsive browser review. No multi-vendor marketplace was introduced.

## Objective 4: sales analytics
Implementation: outcomes/contribution, expense/waste, pricing and export modules.
Verification: test_contribution_export.py tests dashboard/export reconciliation, inclusion beyond the displayed limit, date cohorts and CSV formula escaping. test_costs_freshness.py and test_pricing.py test arithmetic and missing-cost handling.
Interpretation: contribution is not net profit. Known costs and unknown costs must remain distinct. Test fixtures do not prove commercial profitability.

## Objective 5: menu recommendations
Implementation: guided discovery and recommendation scoring with stored recommendation events.
Verification: test_commitments.py tests guided budget/capacity/date rules; tests.py covers cold starts; recommendationExport.test.js verifies exported measures.
Remaining validation: a comparative task study must measure decision time and completion; recorded analytics alone do not prove a causal conversion uplift. Do not call an untested algorithm novel or claim improved conversion from successful API tests.

## Chapter 4 structure
1. Architecture and responsibilities: React UI, Django API, PostgreSQL production persistence, optional SMTP; distinguish demo wallet from real funds.
2. Data and workflows: accepted recipe snapshots, ingredient units/batches, order stages, full-order payment records, immutable history.
3. Development decisions: explain constraints and tradeoffs using actual commits and the existing preparation-planning documentation.
4. Problems and solutions: broken settings anchors, incompatible menu weekdays, malformed API successes and write-failure rollback. Link exact regression tests and commit diffs.
5. Interface evidence: capture real desktop/mobile screenshots with preconditions and observed actions. Existing isolated component previews must be labelled as previews.
6. User manual: FYP-USER-MANUAL.md. Include actual troubleshooting and configuration prerequisites.

## Chapter 5 structure
1. Test strategy: equivalence classes, boundaries, permissions, integration tests, failure injection and regression testing.
2. Environment and fixtures: test-only data, timezone, commit, dependency versions and database engine.
3. Results: report per-suite failures/skips and actual outcomes; include reproducible logs rather than a fabricated all-pass table.
4. User validation: follow FYP-USER-EVALUATION.md; mark activities not conducted as pending.
5. Objective assessment: distinguish implemented, verified automatically, validated by users and impact not yet measured.
6. Literature discussion: compare actual results with the student's cited studies and identify limitations. Candidate contribution is integrating single-vendor preordering, resource scheduling and traceable stock/cost commitments for this context; novelty requires literature comparison.

## Release criteria still to satisfy
No outstanding critical data-integrity/security defect; all required automated checks pass or have explicit assessed exceptions; production-like concurrency and authenticated browser recovery verified; representative users complete documented tasks; manual matches the released UI. A rubric is not fulfilled simply by adding more exception handlers or features.


## Recorded verification — 4 October 2026
Latest run: [manifest](evidence/20261004T103053Z/manifest.json). Backend: 173 tests ran, 172 passed and 1 PostgreSQL-only test skipped. Release harness: 4 tests passed. Frontend utility, UI rendering, checkout rendering, planner rendering and production build checks passed. Repository-wide lint failed with 21 errors and 7 warnings; the earlier run recorded 23 errors and 7 warnings. Both evidence runs remain available. Overall automated gate is FAILED until lint is resolved; this is not an all-pass report.

The run used a modified working tree based on commit 50efc7e. source-hashes.json identifies tested code files. The final commit also contains documentation and this evidence, so do not equate the base commit alone with the exact tested tree.

New regression evidence: CheckoutFailureTests verifies transaction rollback after a mocked item-write failure (including a prior demo-wallet debit), basket retention, private error sanitisation and successful idempotent retry. These are synthetic integration tests, not real bank/payment-provider tests.


## Follow-up verification — lint remediation
Latest run superseding the earlier failed gate: [20261004T104116Z manifest](evidence/20261004T104116Z/manifest.json). Every command passed, including repository-wide lint (zero errors/warnings), production build, frontend utility/rendering checks, release checks and backend tests. Backend remains 173 tests run, 172 passed and 1 PostgreSQL-only skip. This is a successful local automated gate, not completion of PostgreSQL concurrency, full browser validation or participant research.

Changes: shared contexts/hooks moved to dedicated modules with updated consumers; missing stable callback dependencies corrected; loading/error resets moved to refresh actions; reviews remount when their menu/authentication context changes; initial auth/cart requests use cancellation; unused error bindings removed without changing catch recovery. No lint rule was disabled. The earlier failed runs are retained as development/defect evidence. The new run records the modified tree based on 630fdbc plus file hashes.


## PostgreSQL concurrency verification — 4 October 2026
Successful run: [manifest](evidence/postgres-20261004T105044Z/manifest.json) and [test log](evidence/postgres-20261004T105044Z/concurrency.log). Both tests passed against a newly created local PostgreSQL cluster with synthetic data, separate connections and a synchronisation barrier:
- Two buyers racing for daily capacity of one: one HTTP 201, one HTTP 400, one order persisted.
- Two requests sharing a checkout reference and demo wallet: HTTP 201/200, same order ID, one debit of RM15 from RM100, one transaction, one receipt and an emptied basket.

This verifies these two row-locking/idempotency scenarios on PostgreSQL; it is not a stress test or proof of all possible interleavings. The first runner attempt encountered a Windows inherited-output-handle startup timeout. Its failed record is retained with manual-cleanup evidence. The runner now directs startup output to a file, and shuts down a cluster identified by its own temporary directory. The successful run records cluster_stopped=true. Production data, real payments and SMTP were not accessed.

Reproduce using installed PostgreSQL binaries and the backend virtual environment:

```powershell
.\backend\venv\Scripts\python.exe scripts/verify_postgres.py
```

Override the PostgreSQL executable directory with `--pg-bin` if needed. The runner creates a random-password cluster on a dynamically selected loopback port, forces dotenv off, sets an isolated Django test database and stops the server after testing. Local SSL is disabled only in this test process; production settings are unchanged. Temporary stopped cluster files remain in the OS temporary directory for troubleshooting. No credentials are included in the evidence.

The ordinary SQLite suite still skips PostgreSQL-only tests by design; use this separate run as the evidence for these concurrency cases.

## Authenticated browser walkthrough — 5 October 2026

[Browser evidence and limitations](evidence/browser-20261005/README.md) records synthetic customer checkout, an unpaid cash-on-delivery order, owner settings save and field navigation, and the customer-facing admin-access boundary. The walkthrough found and verified a fix for notifications leaking across account changes. Remaining browser scenarios and participant validation are explicitly pending; this is partial developer verification, not a completed user study.
