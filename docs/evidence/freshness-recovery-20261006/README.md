# Stock shortage recovery verification

6 October 2026. Automated tests only in this batch. Django used an in-memory SQLite test database with PYTHON_DOTENV_DISABLED=1; production was not accessed.

## Change

Cooking shortages now identify the missing quantity and unit and advise adding usable stock or reviewing batch records before retrying. The message explains that expired, held and not-yet-received batches are excluded.

## Validation

Command: backend/manage.py test myapp.tests myapp.test_freshness myapp.test_inventory_audit myapp.test_costs_freshness --verbosity 1

Result: 49 tests passed, zero system-check issues.

New regression scenarios:

- A recipe needs 100 g; only 40 g is usable. Large expired, held and future-received batches do not cover the shortfall. Response reports 60 g missing; order stays processing; stock, consumption and audit logs remain unchanged.
- Adding 60 g usable stock permits cooking. Repeating the cooked update consumes nothing extra. Excluded stock remains untouched.
- A shortage in the second ingredient rolls back consumption of the first ingredient and both audit/consumption records.

Existing tests in this run cover expiry calculation/guidance, opening/thawing deadlines, uncertain handling requiring hold, wastage retry/overdraw, stale stock edits and private inventory access.

Limits: no new browser stock-form/retry verification, no production verification and no PostgreSQL concurrency run in this batch. Date-based eligibility is not a guarantee of food safety.
