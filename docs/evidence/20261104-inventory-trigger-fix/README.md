# Inventory correction SQL: pending trigger fix — 4 November 2026

The reported SQLSTATE 55006 was reproduced on ephemeral PostgreSQL 16 with an
inventory audit foreign key declared DEFERRABLE INITIALLY DEFERRED. The earlier
correction inserts an audit record; a following ALTER TABLE ... ENABLE ROW LEVEL
SECURITY in the same transaction then fails with pending trigger events. The
shipped correction itself contains no ALTER TABLE, so the presence/source of the
following ALTER in production has not been independently verified.

The full correction files now begin with SET CONSTRAINTS ALL IMMEDIATE. The
foreign keys remain enforced and are checked at statement end, so the following
RLS operation can run without pending deferred checks. The statement belongs to
the same complete SQL Editor request as the correction, not a separate earlier
Run. No policy, constraint or table definition is changed by the correction.

- 13 real PostgreSQL tests passed: deliberate old failure/atomic rollback for
  both correction files, successful following RLS operation with the fix, repeat
  safety, generated references, former-code history, stable stock values and
  collision/version/access checks.
- The unchanged complete batch-code file was also exercised through a single
  multi-statement execution in both driver transaction and autocommit modes;
  old version reproduced 55006 and fixed version passed, with no duplicate audit.
- RLS operations in regression tests occur only on disposable test tables; those
  transactions are rolled back, including test security-setting changes.
- No production database read/write, live stock receipt, new migration, model or
  dashboard change was performed. Only main is published. Live deployment and
  the user's exact SQL Editor execution remain unobserved.
