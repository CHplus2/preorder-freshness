# Stage 12: recommendation engagement report

Sales analytics now has a dedicated recommendation engagement panel with its own request, loading/error state and refresh action. Contribution reporting no longer depends on recommendation metrics loading successfully, and its date filter does not imply a change to the recommendation cohort.

The recommendation window remains the rolling last 28 days of recommendation requests with recorded rendered results. Each ranking variant displays exposure counts, clicked sessions, basket-add sessions, attributed order sessions and paid-order sessions. Basket additions use existing telemetry; distinct recommendation sessions prevent multiple additions from inflating the session count.

All percentages use exposed recommendation requests as their denominator, not unique customers. Counts are explicitly not a guaranteed sequential funnel. Attribution remains matching recommended products within 24 hours under the same browser session key. Pending COD orders do not count as paid; cancelled/refunded orders are excluded from paid outcomes. These are descriptive observations, not evidence of causal sales lift or reduced decision fatigue.

The panel distinguishes the currently configured experiment mode from historical requests in the window. No experiment was enabled or changed. No customer-identifying data or database migration was added.

Validation: all 23 commitment tests passed, including rendered exposure ownership, duplicate telemetry, distinct basket-add sessions and verified payment attribution. Targeted component lint, production build and diff checks passed. Browser layout remains unverified.
