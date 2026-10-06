# Contribution and cost response validation

6 October 2026. Isolated localhost:8023, temporary SQLite and synthetic owner session. Production untouched.

Implemented response validation before displaying cost and contribution reports. Checks cover totals, menu estimates, missing-cost arrays, wastage rows and ingredient-consumption traces. Zero, unknown costs (null) and negative contributions remain distinct. Ancillary material/batch/expense responses receive list-envelope validation. Old export errors clear when applying a fresh contribution request.

Validation:
- New costResponse.test.js passed: valid zero/unknown/negative data; malformed totals, lists, row counts and traces rejected.
- Frontend lint and production build passed.
- Browser loaded existing synthetic reports successfully under the validators.
- Stopped only the isolated server. Contribution Apply / refresh and cost period change showed connection errors; contribution export and cost totals were absent.
- Restarted server. Refresh cost records and Apply / refresh restored both reports and export, with zero alerts.
- Screenshot: recovered.png.

Limits: malformed payloads tested at validator level, not browser interception. This was not a full backend regression or CSV-content audit. Pricing-scenario response validation, detailed ancillary record validation, mobile coverage and deployed verification remain separate work. No new revenue/payment/waste records were created.
