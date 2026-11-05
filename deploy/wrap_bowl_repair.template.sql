-- Repair the owner-authorised partial client setup before the operational refresh.
-- The generated complete_wrap_bowl_setup.sql includes BOTH operations; run that
-- WHOLE file in one SQL Editor submission after backing up the target database.
-- This repair reuses matching client menus and restores their reviewed estimates,
-- creates missing menus and archives unrelated menus. It snapshots the original
-- catalogue privately in OrderAmendment before making any changes.
-- All affected operational records were confirmed fictional by the owner.
-- A completed refresh makes subsequent submissions return already_applied.
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
    v_first bigint;
    v_backup jsonb;
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
    IF EXISTS(SELECT 1 FROM django_app.myapp_orderamendment
        WHERE after->>'operation_id' IN ('wrap_bowl_operations_v1','wrap_bowl_catalogue_repair_v1')) THEN
        INSERT INTO pg_temp.wrap_bowl_catalogue_result VALUES(jsonb_build_object('status','already_applied',
            'message','Setup was already repaired or refreshed. Later menu edits were not overwritten.'));
        RETURN;
    END IF;
    LOCK TABLE django_app.myapp_product, django_app.myapp_category, django_app.myapp_rawmaterial,
        django_app.myapp_productingredient, django_app.myapp_packagingitem, django_app.myapp_productpackaging,
        django_app.myapp_order, django_app.myapp_orderamendment
        IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (
        SELECT lower(btrim(p.name)) FROM django_app.myapp_product p
        WHERE lower(btrim(p.name)) IN (SELECT lower(value->>'name') FROM jsonb_array_elements(v_data->'menus'))
        GROUP BY lower(btrim(p.name)) HAVING count(*)>1
    ) THEN
        RAISE EXCEPTION 'Duplicate client menu names exist. No records changed; review those duplicates before repair.';
    END IF;
    SELECT min(id) INTO v_first FROM django_app.myapp_order;
    IF v_first IS NULL THEN RAISE EXCEPTION 'This historical-data repair requires existing project orders.'; END IF;
    SELECT jsonb_build_object('storefront',v_old_store,
        'products',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_product t),
        'categories',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_category t),
        'materials',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_rawmaterial t),
        'recipes',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_productingredient t),
        'packaging',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_packagingitem t),
        'menu_packaging',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_productpackaging t))
        INTO v_backup;
    INSERT INTO django_app.myapp_orderamendment(order_id,actor_id,before,after,created_at)
        VALUES(v_first,NULL,jsonb_build_object('catalogue_repair_backup',v_backup),
            jsonb_build_object('kind','catalogue_setup_repair','operation_id','wrap_bowl_catalogue_repair_v1',
                'owner_confirmed_fictional',true),CURRENT_TIMESTAMP);

    FOR v_row IN SELECT value FROM jsonb_array_elements(v_data->'raw_materials') LOOP
        IF (SELECT count(*) FROM django_app.myapp_rawmaterial WHERE lower(btrim(name))=lower(v_row->>'name'))>1 THEN
            RAISE EXCEPTION 'Ambiguous ingredient name: %',v_row->>'name';
        END IF;
        SELECT id INTO v_id FROM django_app.myapp_rawmaterial WHERE lower(btrim(name))=lower(v_row->>'name');
        IF v_id IS NULL THEN
            INSERT INTO django_app.myapp_rawmaterial(name,unit,storage_guidance,estimated_unit_cost,created_at)
                VALUES(v_row->>'name',v_row->>'unit','[]'::jsonb,NULL,CURRENT_TIMESTAMP) RETURNING id INTO v_id;
        ELSIF EXISTS(SELECT 1 FROM django_app.myapp_rawmaterial WHERE id=v_id AND unit<>v_row->>'unit') THEN
            RAISE EXCEPTION 'Ingredient % has another unit. Review it rather than convert existing stock silently.',v_row->>'name';
        END IF;
        UPDATE django_app.myapp_rawmaterial SET name=v_row->>'name' WHERE id=v_id;
        v_raw_ids := v_raw_ids || jsonb_build_object(v_row->>'name',v_id);
    END LOOP;
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_data->'packaging_items') LOOP
        IF (SELECT count(*) FROM django_app.myapp_packagingitem WHERE lower(btrim(name))=lower(v_row#>>'{}'))>1 THEN
            RAISE EXCEPTION 'Ambiguous packaging name: %',v_row#>>'{}';
        END IF;
        SELECT id INTO v_id FROM django_app.myapp_packagingitem WHERE lower(btrim(name))=lower(v_row#>>'{}');
        IF v_id IS NULL THEN
            INSERT INTO django_app.myapp_packagingitem(name,quantity,reorder_level,unit_cost,is_active,created_at,updated_at)
                VALUES(v_row#>>'{}',0,10,NULL,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id INTO v_id;
        END IF;
        UPDATE django_app.myapp_packagingitem SET name=v_row#>>'{}',is_active=true,updated_at=CURRENT_TIMESTAMP WHERE id=v_id;
        v_pack_ids := v_pack_ids || jsonb_build_object(v_row#>>'{}',v_id);
    END LOOP;
    FOR v_menu IN SELECT value FROM jsonb_array_elements(v_data->'menus') LOOP
        IF (SELECT count(*) FROM django_app.myapp_category WHERE lower(btrim(name))=lower(v_menu->>'category'))>1 THEN
            RAISE EXCEPTION 'Ambiguous category: %',v_menu->>'category';
        END IF;
        SELECT id INTO v_category FROM django_app.myapp_category WHERE lower(btrim(name))=lower(v_menu->>'category');
        IF v_category IS NULL THEN
            INSERT INTO django_app.myapp_category(name,created_at) VALUES(v_menu->>'category',CURRENT_TIMESTAMP) RETURNING id INTO v_category;
        END IF;
        UPDATE django_app.myapp_category SET name=v_menu->>'category' WHERE id=v_category;
        SELECT id INTO v_product FROM django_app.myapp_product WHERE lower(btrim(name))=lower(v_menu->>'name');
        IF v_product IS NULL THEN
            INSERT INTO django_app.myapp_product(name,description,ai_summary,category_id,price,image_url,created_at,updated_at,
                lead_hours,preparation_minutes,preparation_tasks,max_preparation_days,batch_size,additional_batch_minutes,
                packing_minutes_per_portion,max_early_minutes,daily_capacity,social_url,packaging_cost,selling_status,
                delivery_weekdays,delivery_dates,order_cutoff_time,order_cutoff_days_before,selling_details)
            VALUES(v_menu->>'name',v_menu->>'description','',v_category,(v_menu->>'price')::numeric,v_menu->>'image_url',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
                24,60,'[]'::jsonb,7,1,60,1,120,30,'',NULL,'active',v_menu->'delivery_weekdays','[]'::jsonb,NULL,1,v_menu->'selling_details')
            RETURNING id INTO v_product;
        ELSE
            UPDATE django_app.myapp_product SET name=v_menu->>'name',description=v_menu->>'description',
                ai_summary='',category_id=v_category,price=(v_menu->>'price')::numeric,
                image_url=CASE WHEN image_url='' THEN v_menu->>'image_url' ELSE image_url END,
                updated_at=CURRENT_TIMESTAMP,lead_hours=24,preparation_minutes=60,preparation_tasks='[]'::jsonb,
                max_preparation_days=7,batch_size=1,additional_batch_minutes=60,packing_minutes_per_portion=1,
                max_early_minutes=120,daily_capacity=30,selling_status='active',
                delivery_weekdays=v_menu->'delivery_weekdays',delivery_dates='[]'::jsonb,
                order_cutoff_time=NULL,order_cutoff_days_before=1,selling_details=v_menu->'selling_details'
                WHERE id=v_product;
            DELETE FROM django_app.myapp_productingredient WHERE product_id=v_product;
            DELETE FROM django_app.myapp_productpackaging WHERE product_id=v_product;
        END IF;
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
    INSERT INTO pg_temp.wrap_bowl_catalogue_result VALUES(jsonb_build_object('status','repaired','menus',v_created,
        'recipe_basis',v_data->>'recipe_basis','archived_menus',v_archived,'ingredient_ids',v_raw_ids,'packaging_ids',v_pack_ids,
        'previous_public_story',jsonb_build_object('name',v_old_store->>'name','tagline',v_old_store->>'tagline','story',v_old_store->>'story',
            'founder_name',v_old_store->>'founder_name','founder_intro',v_old_store->>'founder_intro','founding_story',v_old_store->>'founding_story',
            'food_philosophy',v_old_store->>'food_philosophy','signature_food',v_old_store->>'signature_food','service_area',v_old_store->>'service_area',
            'whatsapp_number',v_old_store->>'whatsapp_number','founder_image_url',v_old_store->>'founder_image_url',
            'social_url',v_old_store->>'social_url','contact_email',v_old_store->>'contact_email'),
        'bulk_minimum',v_old_store->'bulk_minimum','bulk_discount_percent',v_old_store->'bulk_discount_percent',
        'stock_message','Catalogue repaired; the following operational refresh completes the authorised stock and history replacement.'));
END $wb_import$;
SELECT payload FROM pg_temp.wrap_bowl_catalogue_result;
