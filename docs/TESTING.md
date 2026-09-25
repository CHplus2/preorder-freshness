# Testing and FYP evidence

Automated tests already exist. Whether they are compulsory depends on your university's rubric.
They support repeatable correctness evidence, while manual testing and user evaluation assess
usability and whether the system solves the intended business problem.

## Existing tests

Backend: backend/myapp/tests.py, test_planning.py, test_menu.py, test_freshness.py,
test_integrations.py and test_costs_freshness.py.
These exercise business rules such as scheduling, expiry evidence, stock deductions,
permissions, costs, reminders and payment-related behaviour.

Frontend: frontend/src/utils/planner.test.js and apiError.test.js.
These check utility behaviour; they are not end-to-end browser tests.

See README Verification for backend commands. Always set PYTHON_DOTENV_DISABLED=1,
a test-only SECRET_KEY and DATABASE_URL=sqlite:///:memory: in a separate test terminal.
Do not run test experiments using the live Supabase configuration.
From frontend, run npm test and npm run build. A build checks compilation, not usability.

## Evidence to include in the report

For each important requirement, record:
- Test ID and the requirement it verifies.
- Preconditions and input data.
- Expected result and actual result.
- Pass/fail outcome, run date and code commit.
- Relevant command output or screenshot, without credentials or customer information.

Cover valid inputs, invalid inputs, boundary cases, denied access, repeated submissions
and failure recovery. Explain any failed or untested cases rather than claiming complete coverage.

Useful demonstrations:
- Batch rounding and conflicting hands-on/equipment reservations.
- An unattended step allowing another menu's hands-on work.
- Expired or held stock excluded, and insufficient-stock cooking rolled back.
- A repeated cooking/waste request not deducting stock twice.
- Missing ingredient costs shown as unknown.
- Unauthorised users unable to access owner-only operations.

Do not claim that SQLite tests prove PostgreSQL concurrency behaviour or live email/bank integration.
Those need separate integration checks in a safe non-production environment.

## Manual UI and user testing

Inspect phone, tablet and desktop layouts, keyboard navigation, labels, contrast and error messages.
For Inventory specifically:
1. Refresh while signed in; loading content should retain page padding.
2. Slow the network; zero totals/empty tables should not flash before records arrive.
3. Simulate a failed inventory request; an understandable error and Try again should appear.
4. Retry after restoring connectivity; real records should replace the loading state.
5. Navigate away during loading; the abandoned request should be cancelled.

Also evaluate menu photo preview, checkout, order review and planning with representative users.
Record task completion and observed difficulties. Automated tests cannot prove a design is easy to use.

## Current limitations

There is no comprehensive automated browser/end-to-end suite. Unit/API tests and a successful
build do not verify every responsive layout, deployment, external provider or user journey.
Report the exact checks you ran rather than saying the whole app is fully tested.
