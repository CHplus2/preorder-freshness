-- PRIVATE recovery data: download securely; do not paste into public issues.
-- This read-only export includes operational records as they were before refresh.
SELECT jsonb_agg(jsonb_build_object('order_id',order_id,'before',before,'after',after) ORDER BY order_id) AS recovery_archive
FROM django_app.myapp_orderamendment
WHERE after->>'operation_id'='wrap_bowl_operations_v1';
