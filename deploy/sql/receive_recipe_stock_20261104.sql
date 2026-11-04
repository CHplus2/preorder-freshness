-- BATCH 2: owner-requested inventory simulation, using current saved recipes.
-- Run the COMPLETE file in Supabase SQL Editor (same django_app database).
-- Receipt: 4 Nov 2026. Owner-selected planning deadline: 31 Jan 2027.
-- These are planning records, not verified ingredient shelf-life evidence.
-- Adds only the shortfall for 10 units of each complete active local menu.
-- Existing batches, holds, dates, order allocations and payment records stay fixed.
-- Reusing the same receipt reference NEVER refills stock consumed afterwards.
-- No migration, policy, trigger or permanent table definition is changed.
SET CONSTRAINTS ALL IMMEDIATE;
CREATE TEMP TABLE IF NOT EXISTS recipe_stock_receipt_result (payload jsonb) ON COMMIT DROP;
TRUNCATE pg_temp.recipe_stock_receipt_result;

DO $receive_recipe_stock$
DECLARE
    -- Change these only for a genuinely different receipt; keep its reference unique.
    v_reference text := 'Inventory receipt 20261104-B2';
    v_received date := DATE '2026-11-04';
    v_deadline date := DATE '2027-01-31';
    v_units integer := 10;
    v_today date := timezone('Asia/Kuala_Lumpur',CURRENT_TIMESTAMP)::date;
    v_signature text;
    v_reason text;
    v_package_reason text;
    v_already boolean;
    v_row record;
    v_batch_id bigint;
    v_code text;
    v_prefix text;
    v_storage_type text;
    v_location text;
    v_balance integer;
    v_ingredients jsonb := '[]'::jsonb;
    v_packages jsonb := '[]'::jsonb;
    v_recipe_review jsonb;
    v_packaging_review jsonb;
BEGIN
    PERFORM set_config('lock_timeout','10s',true);
    IF v_reference IS NULL OR v_received IS NULL OR v_deadline IS NULL OR v_units IS NULL
       OR length(v_reference) NOT BETWEEN 1 AND 100 OR v_units NOT BETWEEN 1 AND 100
       OR v_received>v_today OR v_deadline<v_today OR v_deadline<=v_received
       OR v_deadline-v_received>3650 THEN
        RAISE EXCEPTION 'Review the receipt reference, dates and 1-100 units per menu before running this file.';
    END IF;
    -- Same kitchen lock used by checkout. Competing receipts cannot both apply.
    PERFORM id FROM django_app.myapp_storefront WHERE id=1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kitchen settings are missing. Complete setup first.'; END IF;
    v_signature := md5(jsonb_build_object('received',v_received,'deadline',v_deadline,'units',v_units,'version',1)::text);
    v_reason := 'Owner stock receipt; plan ' || v_signature;
    v_package_reason := v_reference || '; plan ' || v_signature;
    IF EXISTS (SELECT 1 FROM django_app.myapp_inventorylog WHERE reference=v_reference AND reason<>v_reason)
       OR EXISTS (SELECT 1 FROM django_app.myapp_packagingmovement
           WHERE left(reason,length(v_reference)+7)=v_reference || '; plan ' AND reason<>v_package_reason) THEN
        RAISE EXCEPTION 'This receipt reference already belongs to different settings. Review the saved receipt; do not reuse its reference.';
    END IF;
    SELECT EXISTS (SELECT 1 FROM django_app.myapp_inventorylog WHERE reference=v_reference)
        OR EXISTS (SELECT 1 FROM django_app.myapp_packagingmovement WHERE reason=v_package_reason)
        INTO v_already;
    IF v_already THEN
        INSERT INTO pg_temp.recipe_stock_receipt_result VALUES (jsonb_build_object(
            'status','already_recorded','receipt',v_reference,
            'message','This receipt was already recorded. No new stock was added or refilled.',
            'ingredient_batches',(SELECT count(*) FROM django_app.myapp_inventorylog WHERE reference=v_reference AND inventory_item_id IS NOT NULL AND change>0),
            'packaging_receipts',(SELECT count(*) FROM django_app.myapp_packagingmovement WHERE reason=v_package_reason)));
        RETURN;
    END IF;
    -- Finish active stock edits before taking the coverage snapshot. These are
    -- transaction locks, not trigger/security changes or a lasting schema edit.
    LOCK TABLE django_app.myapp_inventoryitem IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE django_app.myapp_packagingitem IN SHARE ROW EXCLUSIVE MODE;
    PERFORM id FROM django_app.myapp_product WHERE selling_status='active' ORDER BY id FOR SHARE;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) ORDER BY p.id),'[]'::jsonb)
      INTO v_recipe_review FROM django_app.myapp_product p
      WHERE p.selling_status='active' AND coalesce(p.selling_details->>'ordering_mode','local_preorder')='local_preorder'
        AND (NOT EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id)
             OR EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id AND i.quantity_required<=0));

    FOR v_row IN
        WITH menus AS (
            SELECT p.id FROM django_app.myapp_product p WHERE p.selling_status='active'
            AND coalesce(p.selling_details->>'ordering_mode','local_preorder')='local_preorder'
            AND EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id)
            AND NOT EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id AND i.quantity_required<=0)
        ), needed AS (
            SELECT i.raw_material_id,sum(i.quantity_required*v_units) AS required
            FROM menus m JOIN django_app.myapp_productingredient i ON i.product_id=m.id GROUP BY i.raw_material_id
        ), stock AS (
            SELECT raw_material_id,sum(quantity) AS eligible FROM django_app.myapp_inventoryitem
            WHERE quantity>0 AND NOT quarantined AND received_date<=v_today AND expiry_date>=v_deadline GROUP BY raw_material_id
        )
        SELECT r.id,r.name,r.unit,n.required,coalesce(s.eligible,0) AS eligible,
            n.required-coalesce(s.eligible,0) AS to_receive,
            latest.storage_type AS last_storage_type,latest.storage_location AS last_location
        FROM needed n JOIN django_app.myapp_rawmaterial r ON r.id=n.raw_material_id
        LEFT JOIN stock s ON s.raw_material_id=r.id
        LEFT JOIN LATERAL (SELECT storage_type,storage_location FROM django_app.myapp_inventoryitem
            WHERE raw_material_id=r.id AND NOT quarantined AND received_date<=v_today ORDER BY received_date DESC,id DESC LIMIT 1) latest ON true
        WHERE n.required>coalesce(s.eligible,0) ORDER BY r.id
    LOOP
        IF v_row.to_receive>999999999.999 THEN
            RAISE EXCEPTION 'The requested quantity exceeds the inventory limit for %. Review recipe units.',v_row.name;
        END IF;
        IF v_row.last_storage_type NOT IN ('ambient','chilled','frozen') OR v_row.last_storage_type IS NULL THEN
            RAISE EXCEPTION 'Record a storage type for % before this bulk receipt. No guessed storage has been applied.',v_row.name;
        END IF;
        v_storage_type := v_row.last_storage_type;
        v_location := v_row.last_location;
        IF v_location IS NULL OR length(trim(v_location))=0
           OR lower(v_location) LIKE '%demo%' OR lower(v_location) LIKE '%fictional%' THEN
            RAISE EXCEPTION 'Record an ordinary storage location for % before this bulk receipt.',v_row.name;
        END IF;
        INSERT INTO django_app.myapp_inventoryitem (
            raw_material_id,quantity,batch_code,storage_location,received_date,expiry_date,created_at,updated_at,
            supplier,source_type,label_date_type,expiry_basis,shelf_life_days,storage_type,guidance_note,
            quarantined,handling_history,handling_note,unit_cost)
        VALUES (v_row.id,v_row.to_receive,'',v_location,v_received,v_deadline,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
            '','other','not_recorded','storage',v_deadline-v_received,v_storage_type,
            'Owner-selected planning duration for simulated stock; not verified food shelf-life guidance.',
            false,'not_recorded','Storage description copied from the last unheld batch. No opening or thawing event is asserted.',NULL)
        RETURNING id INTO v_batch_id;
        v_prefix := CASE WHEN upper(trim(v_row.name)) LIKE 'CHICKEN%' THEN 'CHK'
            WHEN upper(trim(v_row.name))='RICE' THEN 'RCE' WHEN upper(trim(v_row.name))='SALT' THEN 'SLT'
            ELSE rpad(left(regexp_replace(upper(v_row.name),'[^A-Z]','','g'),3),3,'X') END;
        v_code := v_prefix || '-' || to_char(v_received,'YYYYMMDD') || '-'
            || CASE WHEN v_batch_id<1000 THEN lpad(v_batch_id::text,3,'0') ELSE v_batch_id::text END;
        IF EXISTS (SELECT 1 FROM django_app.myapp_inventoryitem WHERE id<>v_batch_id AND lower(batch_code)=lower(v_code)) THEN
            RAISE EXCEPTION 'Batch reference % is already in use. Review the reference before retrying.',v_code;
        END IF;
        UPDATE django_app.myapp_inventoryitem SET batch_code=v_code WHERE id=v_batch_id;
        INSERT INTO django_app.myapp_inventorylog (inventory_item_id,change,reason,reference,admin_id,created_at)
        VALUES (v_batch_id,v_row.to_receive,v_reason,v_reference,NULL,CURRENT_TIMESTAMP);
        v_ingredients := v_ingredients || jsonb_build_array(jsonb_build_object('batch_id',v_batch_id,
            'code',v_code,'ingredient',v_row.name,'unit',v_row.unit,'received_quantity',v_row.to_receive,
            'previous_eligible',v_row.eligible,'target_quantity',v_row.required,'storage',v_location,
            'storage_type',v_storage_type,'deadline',v_deadline));
    END LOOP;

    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',k.id,'name',k.name)),'[]'::jsonb)
      INTO v_packaging_review FROM django_app.myapp_productpackaging pp
      JOIN django_app.myapp_product p ON p.id=pp.product_id
      JOIN django_app.myapp_packagingitem k ON k.id=pp.packaging_item_id
      WHERE p.selling_status='active' AND coalesce(p.selling_details->>'ordering_mode','local_preorder')='local_preorder'
        AND NOT k.is_active;
    FOR v_row IN
        SELECT k.id,k.name,k.quantity,sum(pp.quantity_per_item*v_units)-k.quantity AS to_receive
        FROM django_app.myapp_product p JOIN django_app.myapp_productpackaging pp ON pp.product_id=p.id
        JOIN django_app.myapp_packagingitem k ON k.id=pp.packaging_item_id
        WHERE p.selling_status='active' AND coalesce(p.selling_details->>'ordering_mode','local_preorder')='local_preorder'
          AND k.is_active AND EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id)
          AND NOT EXISTS (SELECT 1 FROM django_app.myapp_productingredient i WHERE i.product_id=p.id AND i.quantity_required<=0)
        GROUP BY k.id HAVING sum(pp.quantity_per_item*v_units)>k.quantity ORDER BY k.id
    LOOP
        IF v_row.quantity+v_row.to_receive>2147483647 THEN RAISE EXCEPTION 'Packaging stock exceeds the supported quantity.'; END IF;
        UPDATE django_app.myapp_packagingitem SET quantity=quantity+v_row.to_receive,updated_at=CURRENT_TIMESTAMP
            WHERE id=v_row.id RETURNING quantity INTO v_balance;
        INSERT INTO django_app.myapp_packagingmovement
            (packaging_item_id,order_packaging_id,request_id,kind,change,balance_after,reason,actor_id,created_at)
        VALUES (v_row.id,NULL,md5(v_reference || ':packaging:' || v_row.id::text)::uuid,'receive',
            v_row.to_receive,v_balance,v_package_reason,NULL,CURRENT_TIMESTAMP);
        v_packages := v_packages || jsonb_build_array(jsonb_build_object('id',v_row.id,'name',v_row.name,
            'received_quantity',v_row.to_receive,'balance_after',v_balance));
    END LOOP;
    -- Record a completed zero-shortfall review too. A later retry of this same
    -- reference must not silently turn into a new receipt after stock is used.
    IF jsonb_array_length(v_ingredients)+jsonb_array_length(v_packages)=0 THEN
        INSERT INTO django_app.myapp_inventorylog (inventory_item_id,change,reason,reference,admin_id,created_at)
        VALUES (NULL,0,v_reason,v_reference,NULL,CURRENT_TIMESTAMP);
    END IF;
    INSERT INTO pg_temp.recipe_stock_receipt_result VALUES (jsonb_build_object(
        'status',CASE WHEN jsonb_array_length(v_ingredients)+jsonb_array_length(v_packages)>0 THEN 'recorded' ELSE 'nothing_to_receive' END,
        'receipt',v_reference,'received_on',v_received,'planning_deadline',v_deadline,'units_per_complete_menu',v_units,
        'ingredient_batches_added',jsonb_array_length(v_ingredients),'ingredients',v_ingredients,
        'packaging_receipts_added',jsonb_array_length(v_packages),'packaging',v_packages,
        'menus_needing_recipe_review',v_recipe_review,'inactive_packaging_needing_review',v_packaging_review,
        'purchase_costs','Unknown costs remain blank. No supplier payment or customer order was created.'));
END
$receive_recipe_stock$;

SELECT payload AS stock_receipt_result FROM pg_temp.recipe_stock_receipt_result;
