# Wrap & Bowl operational refresh — completion record, 6 November 2026

The earlier Docker verification blocker was resolved. The complete workflow is
documented in [the rollout guide](wrap-bowl-client-batches.md). The owner confirmed
that all affected operational data are fictional FYP records and authorised their
replacement without “demo” UI titles.

The first actual PostgreSQL run passed 70 tests. The expanded regression run
passed 149 tests, including rollback, receipt privacy, checkout stock allocation,
reports, reminders and forecast provenance. The final default-script run (without
any test-only guard override) passed the focused SQL/stock tests. Local browser
verification and evidence are recorded [here](evidence/20261106-wrap-bowl-operations/README.md).

`validated_for_apply` is enabled in the reviewed configuration. This does not
execute the script. The owner must apply batch 1 and then the coordinated
operational refresh in Supabase SQL Editor; no live database was changed by these
local checks. No migration, bank transfer, courier booking, email send or model
training was performed. Main-only publication and the final commit are reported
in the delivery message. The frozen integration/report branches remain untouched.
