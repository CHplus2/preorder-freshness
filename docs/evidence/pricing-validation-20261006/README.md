# Pricing and supporting cost records

6 October 2026. Isolated local site, temporary SQLite, synthetic owner. No production or price/promotion mutations.

Added validation for pricing responses and the material, stock-batch and expense records used by the cost workspace. Missing structures or invalid numeric values produce the existing recoverable error. Legitimate negative contribution and null unknown costs remain supported.

Checks passed:
- Expanded costResponse.test.js, lint and production build.
- Eight backend pricing tests.
- Browser cost panel loaded existing fixture records through the new validators.
- Chicken rice at RM 1 showed the below-cost warning.
- Synthetic menu without recipe/packaging displayed contribution unavailable with the missing records listed.
- Stopped isolated server: Compare scenario displayed a connection error and removed the old comparison. Restart/retry restored results and cleared the error.

Screenshot: unknown-costs.png. Malformed response coverage is unit-level, not browser interception. No mobile verification or real business outcome measurement. Generic connection errors still contain the shared order-submission caution; contextual wording can be improved separately.
