-- Owner-requested correction of the accidental refund entered for order #159.
-- Run the WHOLE file in one Supabase SQL Editor submission.
-- Only the exact reported manual receipt/refund pair can match these guards.
-- Original records are saved privately in OrderAmendment before correction.
-- No payment, email, stock movement, refund transfer or schema change occurs.
CREATE TEMP TABLE IF NOT EXISTS order_159_refund_correction_result(payload jsonb) ON COMMIT DROP;
TRUNCATE pg_temp.order_159_refund_correction_result;
DO $correct_refund_159$
DECLARE
    v_order django_app.myapp_order%ROWTYPE;
    v_refund django_app.myapp_paymentevent%ROWTYPE;
    v_receipt django_app.myapp_paymentevent%ROWTYPE;
    v_operation text := 'correct_order_159_accidental_refund_v1';
BEGIN
    PERFORM set_config('lock_timeout','10s',true);
    SELECT * INTO v_order FROM django_app.myapp_order WHERE id=159 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order #159 does not exist in this database. No records changed.'; END IF;
    IF EXISTS(SELECT 1 FROM django_app.myapp_orderamendment WHERE order_id=159 AND after->>'operation_id'=v_operation) THEN
        INSERT INTO pg_temp.order_159_refund_correction_result VALUES(jsonb_build_object(
            'status','already_corrected','order_id',159,'payment_status',v_order.payment_status));
        RETURN;
    END IF;
    IF v_order.ordering_mode<>'simple' OR v_order.payment_method<>'manual'
        OR v_order.payment_status<>'refunded' OR v_order.total_amount+v_order.shipping_fee<>28.00 THEN
        RAISE EXCEPTION 'Order #159 no longer matches the reported RM28 manual-payment refund. No records changed.';
    END IF;
    PERFORM id FROM django_app.myapp_paymentevent WHERE order_id=159 ORDER BY id FOR UPDATE;
    IF (SELECT count(*) FROM django_app.myapp_paymentevent WHERE order_id=159)<>2 THEN
        RAISE EXCEPTION 'Order #159 has additional or missing payment entries. Review them before correcting; nothing changed.';
    END IF;
    SELECT * INTO v_receipt FROM django_app.myapp_paymentevent
        WHERE order_id=159 AND kind='receipt' AND outcome='completed' AND amount=28.00
        AND method='manual' AND reference='1' AND actor_id=2 AND source='owner_verified'
        AND resolves_id IS NULL
        AND created_at>=TIMESTAMPTZ '2026-11-06 09:18:49+08:00'
        AND created_at<TIMESTAMPTZ '2026-11-06 09:18:50+08:00';
    IF NOT FOUND THEN RAISE EXCEPTION 'The original RM28 receipt does not match the reported entry. No records changed.'; END IF;
    SELECT * INTO v_refund FROM django_app.myapp_paymentevent
        WHERE order_id=159 AND kind='refund' AND outcome='completed' AND amount=28.00
        AND method='manual' AND reference='1' AND actor_id=2 AND source='owner_verified'
        AND resolves_id IS NULL
        AND created_at>=TIMESTAMPTZ '2026-11-06 09:19:37+08:00'
        AND created_at<TIMESTAMPTZ '2026-11-06 09:19:38+08:00';
    IF NOT FOUND OR EXISTS(SELECT 1 FROM django_app.myapp_paymentevent WHERE resolves_id=v_refund.id) THEN
        RAISE EXCEPTION 'The accidental refund does not match, or another entry depends on it. No records changed.';
    END IF;
    INSERT INTO django_app.myapp_orderamendment(order_id,actor_id,before,after,created_at)
        VALUES(159,NULL,jsonb_build_object('payment_status',v_order.payment_status,
            'original_updated_at',v_order.updated_at,'removed_refund',to_jsonb(v_refund),'retained_receipt',to_jsonb(v_receipt)),
            jsonb_build_object('operation_id',v_operation,'change_type','payment_record_correction',
                'payment_status','paid','removed_refund_id',v_refund.id,
                'reason','Owner confirmed this refund was entered accidentally for testing; no refund was made.'),CURRENT_TIMESTAMP);
    DELETE FROM django_app.myapp_paymentevent WHERE id=v_refund.id AND order_id=159;
    UPDATE django_app.myapp_order SET payment_status='paid',updated_at=CURRENT_TIMESTAMP WHERE id=159;
    INSERT INTO pg_temp.order_159_refund_correction_result VALUES(jsonb_build_object(
        'status','corrected','order_id',159,'payment_status','paid','removed_refund_id',v_refund.id,
        'receipt_preserved',true,'amount','28.00','private_correction_history_saved',true));
END $correct_refund_159$;
SELECT payload FROM pg_temp.order_159_refund_correction_result;
