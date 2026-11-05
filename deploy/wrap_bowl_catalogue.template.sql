-- BATCH 1: Wrap & Bowl Kuch client catalogue and story.
-- After backing up the target database, run this WHOLE file in Supabase SQL Editor.
-- No migration, RLS/trigger change, stock receipt or payment/history rewrite.
-- Recipes are editable estimates authorised by the project owner, not verified
-- client recipes. Existing menus are ARCHIVED, never repurposed or deleted.
-- Existing raw materials/batches remain available for stock and historical audit.
-- New packaging counts start at zero; record actual opening stock before ordering.
-- Run once. Repeating with all eight names present returns already_configured;
-- partial/mismatched imports fail safely rather than overwrite owner recipe edits.
SET CONSTRAINTS ALL IMMEDIATE;
CREATE TEMP TABLE IF NOT EXISTS wrap_bowl_catalogue_result(payload jsonb) ON COMMIT DROP;
TRUNCATE pg_temp.wrap_bowl_catalogue_result;
DO $wb_import$
DECLARE
    v_data jsonb := $wb_catalogue$/*CATALOGUE_JSON*/$wb_catalogue$::jsonb;
    v_store jsonb;
    v_row jsonb;
    v_menu jsonb;
    v_entry record;
    v_id bigint;
    v_category bigint;
    v_product bigint;
    v_existing integer;
    v_raw_ids jsonb := '{}'::jsonb;
    v_pack_ids jsonb := '{}'::jsonb;
    v_created jsonb := '[]'::jsonb;
    v_old_store jsonb;
    v_archived jsonb;
BEGIN
    PERFORM set_config('lock_timeout','10s',true);
    SELECT to_jsonb(s) INTO v_old_store FROM django_app.myapp_storefront s WHERE id=1 FOR UPDATE;
    IF v_old_store IS NULL THEN RAISE EXCEPTION 'Kitchen settings are missing. Check the target database/schema.'; END IF;
    IF v_old_store->>'ordering_mode'<>'simple' THEN RAISE EXCEPTION 'This client catalogue requires the simple ordering workflow.'; END IF;
    LOCK TABLE django_app.myapp_product, django_app.myapp_category, django_app.myapp_rawmaterial,
        django_app.myapp_productingredient, django_app.myapp_packagingitem, django_app.myapp_productpackaging
        IN SHARE ROW EXCLUSIVE MODE;
    SELECT count(*) INTO v_existing FROM django_app.myapp_product p
        WHERE lower(p.name) IN (SELECT lower(value->>'name') FROM jsonb_array_elements(v_data->'menus'));
    IF v_existing=8 AND NOT EXISTS (
        SELECT lower(p.name) FROM django_app.myapp_product p
        WHERE lower(p.name) IN (SELECT lower(value->>'name') FROM jsonb_array_elements(v_data->'menus'))
        GROUP BY lower(p.name) HAVING count(*)<>1
    ) THEN
        INSERT INTO pg_temp.wrap_bowl_catalogue_result VALUES (jsonb_build_object('status','already_configured',
            'message','All eight client menus exist. No settings, recipes or stock were changed. Use the normal forms for later edits.'));
        RETURN;
    END IF;
    IF v_existing<>0 OR v_old_store->>'name'='Wrap & Bowl Kuch' OR v_old_store->>'founder_name'='Ayu Shafinaz' THEN
        RAISE EXCEPTION 'Some client setup already exists. Review it before importing; no records were changed.';
    END IF;

    FOR v_row IN SELECT value FROM jsonb_array_elements(v_data->'raw_materials') LOOP
        IF (SELECT count(*) FROM django_app.myapp_rawmaterial WHERE lower(name)=lower(v_row->>'name'))>1 THEN
            RAISE EXCEPTION 'Ambiguous ingredient name: %',v_row->>'name';
        END IF;
        SELECT id INTO v_id FROM django_app.myapp_rawmaterial WHERE lower(name)=lower(v_row->>'name');
        IF v_id IS NULL THEN
            INSERT INTO django_app.myapp_rawmaterial(name,unit,storage_guidance,estimated_unit_cost,created_at)
                VALUES(v_row->>'name',v_row->>'unit','[]'::jsonb,NULL,CURRENT_TIMESTAMP) RETURNING id INTO v_id;
        ELSIF EXISTS(SELECT 1 FROM django_app.myapp_rawmaterial WHERE id=v_id AND unit<>v_row->>'unit') THEN
            RAISE EXCEPTION 'Ingredient % has another unit. Review it rather than convert existing stock silently.',v_row->>'name';
        END IF;
        v_raw_ids := v_raw_ids || jsonb_build_object(v_row->>'name',v_id);
    END LOOP;
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_data->'packaging_items') LOOP
        SELECT id INTO v_id FROM django_app.myapp_packagingitem WHERE lower(name)=lower(v_row#>>'{}');
        IF v_id IS NULL THEN
            INSERT INTO django_app.myapp_packagingitem(name,quantity,reorder_level,unit_cost,is_active,created_at,updated_at)
                VALUES(v_row#>>'{}',0,10,NULL,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id INTO v_id;
        ELSIF EXISTS(SELECT 1 FROM django_app.myapp_packagingitem WHERE id=v_id AND NOT is_active) THEN
            RAISE EXCEPTION 'Packaging % is inactive. Review that item before importing.',v_row#>>'{}';
        END IF;
        v_pack_ids := v_pack_ids || jsonb_build_object(v_row#>>'{}',v_id);
    END LOOP;
    FOR v_menu IN SELECT value FROM jsonb_array_elements(v_data->'menus') LOOP
        IF (SELECT count(*) FROM django_app.myapp_category WHERE lower(name)=lower(v_menu->>'category'))>1 THEN
            RAISE EXCEPTION 'Ambiguous category: %',v_menu->>'category';
        END IF;
        SELECT id INTO v_category FROM django_app.myapp_category WHERE lower(name)=lower(v_menu->>'category');
        IF v_category IS NULL THEN
            INSERT INTO django_app.myapp_category(name,created_at) VALUES(v_menu->>'category',CURRENT_TIMESTAMP) RETURNING id INTO v_category;
        END IF;
        INSERT INTO django_app.myapp_product(name,description,ai_summary,category_id,price,image_url,created_at,updated_at,
            lead_hours,preparation_minutes,preparation_tasks,max_preparation_days,batch_size,additional_batch_minutes,
            packing_minutes_per_portion,max_early_minutes,daily_capacity,social_url,packaging_cost,selling_status,
            delivery_weekdays,delivery_dates,order_cutoff_time,order_cutoff_days_before,selling_details)
        VALUES(v_menu->>'name',v_menu->>'description','',v_category,(v_menu->>'price')::numeric,v_menu->>'image_url',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
            24,60,'[]'::jsonb,7,1,60,1,120,30,'',NULL,'active',v_menu->'delivery_weekdays','[]'::jsonb,NULL,1,v_menu->'selling_details')
        RETURNING id INTO v_product;
        FOR v_entry IN SELECT * FROM jsonb_each_text(v_menu->'ingredients') LOOP
            INSERT INTO django_app.myapp_productingredient(product_id,raw_material_id,quantity_required)
                VALUES(v_product,(v_raw_ids->>v_entry.key)::bigint,v_entry.value::numeric);
        END LOOP;
        FOR v_entry IN SELECT * FROM jsonb_each_text(v_menu->'packaging') LOOP
            INSERT INTO django_app.myapp_productpackaging(product_id,packaging_item_id,quantity_per_item)
                VALUES(v_product,(v_pack_ids->>v_entry.key)::bigint,v_entry.value::integer);
        END LOOP;
        v_created := v_created || jsonb_build_array(jsonb_build_object('id',v_product,'name',v_menu->>'name','price',v_menu->>'price',
            'weekdays',v_menu->'delivery_weekdays','recipe_lines',(SELECT count(*) FROM jsonb_object_keys(v_menu->'ingredients'))));
    END LOOP;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'previous_status',selling_status) ORDER BY id),'[]'::jsonb)
        INTO v_archived FROM django_app.myapp_product
        WHERE id NOT IN (SELECT (value->>'id')::bigint FROM jsonb_array_elements(v_created)) AND selling_status<>'archived';
    UPDATE django_app.myapp_product SET selling_status='archived',updated_at=CURRENT_TIMESTAMP
        WHERE id IN (SELECT (value->>'id')::bigint FROM jsonb_array_elements(v_archived));
    v_store := v_data->'storefront';
    UPDATE django_app.myapp_storefront SET name=v_store->>'name',tagline=v_store->>'tagline',story=v_store->>'story',
        founder_name=v_store->>'founder_name',founder_intro=v_store->>'founder_intro',founding_story=v_store->>'founding_story',
        food_philosophy=v_store->>'food_philosophy',signature_food=v_store->>'signature_food',service_area=v_store->>'service_area',
        whatsapp_number=v_store->>'whatsapp_number',founder_image_url=v_store->>'founder_image_url',
        social_url=v_store->>'social_url',contact_email=v_store->>'contact_email' WHERE id=1;
    INSERT INTO pg_temp.wrap_bowl_catalogue_result VALUES(jsonb_build_object('status','configured','menus',v_created,
        'recipe_basis',v_data->>'recipe_basis','archived_menus',v_archived,'ingredient_ids',v_raw_ids,'packaging_ids',v_pack_ids,
        'previous_public_story',jsonb_build_object('name',v_old_store->>'name','tagline',v_old_store->>'tagline','story',v_old_store->>'story',
            'founder_name',v_old_store->>'founder_name','founder_intro',v_old_store->>'founder_intro','founding_story',v_old_store->>'founding_story',
            'food_philosophy',v_old_store->>'food_philosophy','signature_food',v_old_store->>'signature_food','service_area',v_old_store->>'service_area',
            'whatsapp_number',v_old_store->>'whatsapp_number','founder_image_url',v_old_store->>'founder_image_url',
            'social_url',v_old_store->>'social_url','contact_email',v_old_store->>'contact_email'),
        'bulk_minimum',v_old_store->'bulk_minimum','bulk_discount_percent',v_old_store->'bulk_discount_percent',
        'stock_message','Stock counts and all order/payment records are unchanged. Record opening stock before accepting orders.'));
END $wb_import$;
SELECT payload FROM pg_temp.wrap_bowl_catalogue_result;
