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
    v_data jsonb := $wb_catalogue${"version":1,"source":"Client menu poster and founder story supplied 5 November 2026","recipe_basis":"Owner-authorised editable estimates; confirm actual ingredients, allergens, yields and quantities with Ayu before real production. Rice quantities are dry weight; meat is raw trimmed weight. Dressing, sauces and mayonnaise are tracked as purchased ingredients; homemade versions need their own actual recipe.","stock_policy":"This catalogue import does not create received ingredient or packaging stock, alter shelf-life evidence, or modify existing stock quantities.","storefront":{"name":"Wrap & Bowl Kuch","tagline":"Made with passion, served with love.","story":"Fresh salad bowls and satisfying Wanpaku sandwiches from a home kitchen in Kuching, Sarawak. Thoughtfully prepared to make good food a convenient part of your busy day.","founder_name":"Ayu Shafinaz","founder_intro":"Hi, I’m Ayu Shafinaz, founder of Wrap & Bowl Kuch, a small home-based food business in Kuching, Sarawak. A love for cooking became a way to share good food and earn extra income.","founding_story":"My journey began with something simple — my love for cooking. What started as a hobby slowly turned into an opportunity to earn extra income while doing something I genuinely enjoy. I never imagined that something I loved doing in my free time could grow into a little business of my own.\nFor me, food is more than just something we eat. It brings comfort, happiness and a little joy to our everyday lives.\nRunning a small business comes with its own challenges, but every step of this journey has taught me something valuable. What started as a side income has grown into something close to my heart — a little dream that I’m slowly building with passion, patience and a lot of love.\nWith love and gratitude,\nAyu Shafinaz","food_philosophy":"Through Wrap & Bowl Kuch, I hope to share the joy of good food with delicious, convenient meals that make healthier eating easier and more enjoyable. Our meals are thoughtfully prepared for people balancing busy daily routines.","signature_food":"Fresh Salad Bowls, Wanpaku Sandwiches and Monday Sukiya Beef Rice Bowls","service_area":"Kuching and Samarahan, Sarawak. Delivery Monday–Friday, subject to area availability.","whatsapp_number":"601114007567","founder_image_url":"","social_url":"","contact_email":""},"raw_materials":[{"name":"Beef sukiyaki slices","unit":"g"},{"name":"Black pepper","unit":"g"},{"name":"Carrot","unit":"g"},{"name":"Cherry tomato","unit":"g"},{"name":"Chicken boneless trimmed","unit":"g"},{"name":"Cooking oil","unit":"ml"},{"name":"Cornflour","unit":"g"},{"name":"Cucumber","unit":"g"},{"name":"Egg","unit":"unit"},{"name":"Lemon","unit":"g"},{"name":"Lettuce","unit":"g"},{"name":"Mayonnaise","unit":"ml"},{"name":"Panko breadcrumbs","unit":"g"},{"name":"Plain flour","unit":"g"},{"name":"Red cabbage","unit":"g"},{"name":"Rice","unit":"g"},{"name":"Salad dressing","unit":"ml"},{"name":"Salmon fillet","unit":"g"},{"name":"Salt","unit":"g"},{"name":"Sandwich bread","unit":"g"},{"name":"Sesame seeds","unit":"g"},{"name":"Soy sauce","unit":"ml"},{"name":"Spring onion","unit":"g"},{"name":"Sweetcorn kernels","unit":"g"},{"name":"Teriyaki sauce","unit":"ml"}],"packaging_items":["Disposable fork","Disposable spoon","Dressing cup with lid (30 ml)","Food label","Greaseproof paper sheet","Rice bowl with lid (750 ml)","Salad bowl with lid (1000 ml)","Sandwich box (2 halves)","Sauce cup with lid (60 ml)"],"menus":[{"name":"Chicken Grilled Salad","price":"13.00","category":"Salad bowls","description":"Grilled chicken salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Chicken boneless trimmed":"130.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Chicken Popcorn Salad","price":"13.00","category":"Salad bowls","description":"Popcorn chicken salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Chicken boneless trimmed":"130.000","Cooking oil":"15.000","Salt":"1.000","Black pepper":"0.500","Plain flour":"15.000","Cornflour":"20.000","Egg":"0.250"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Eggsquisite Salad","price":"12.00","category":"Salad bowls","description":"Egg salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Egg":"2.000","Salt":"0.500","Black pepper":"0.300"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Beef Sukiya Salad","price":"18.00","category":"Salad bowls","description":"Sliced beef salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Beef sukiyaki slices":"120.000","Teriyaki sauce":"20.000","Soy sauce":"5.000","Cooking oil":"5.000"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Wanpaku Chicken Katsu","price":"12.00","category":"Wanpaku sandwiches","description":"Chicken katsu Wanpaku sandwich.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/sandwich.svg","selling_details":{"ordering_mode":"local_preorder","unit":"box","contents":"One sandwich, cut into two halves"},"ingredients":{"Sandwich bread":"80.000","Lettuce":"20.000","Red cabbage":"20.000","Carrot":"20.000","Cucumber":"20.000","Mayonnaise":"20.000","Chicken boneless trimmed":"110.000","Egg":"0.250","Plain flour":"15.000","Panko breadcrumbs":"20.000","Cooking oil":"10.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Sandwich box (2 halves)":1,"Greaseproof paper sheet":1,"Food label":1}},{"name":"Wanpaku Chicken Grilled","price":"12.00","category":"Wanpaku sandwiches","description":"Grilled chicken Wanpaku sandwich.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/sandwich.svg","selling_details":{"ordering_mode":"local_preorder","unit":"box","contents":"One sandwich, cut into two halves"},"ingredients":{"Sandwich bread":"80.000","Lettuce":"20.000","Red cabbage":"20.000","Carrot":"20.000","Cucumber":"20.000","Mayonnaise":"20.000","Chicken boneless trimmed":"110.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Sandwich box (2 halves)":1,"Greaseproof paper sheet":1,"Food label":1}},{"name":"Salmon Grilled Salad Bowl","price":"28.00","category":"Salad bowls","description":"Grilled salmon salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Salmon fillet":"150.000","Lemon":"15.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Sukiya Beef Rice Bowl","price":"20.00","category":"Rice bowls","description":"Sliced beef rice bowl. Available on Mondays only.","delivery_weekdays":[0],"image_url":"/static/client-menu/rice-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One rice bowl"},"ingredients":{"Beef sukiyaki slices":"120.000","Teriyaki sauce":"20.000","Soy sauce":"5.000","Cooking oil":"5.000","Rice":"80.000","Cucumber":"20.000","Spring onion":"5.000","Sesame seeds":"2.000"},"packaging":{"Rice bowl with lid (750 ml)":1,"Sauce cup with lid (60 ml)":1,"Disposable spoon":1,"Food label":1}}]}$wb_catalogue$::jsonb;
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

-- Reviewed replacement for the owner-confirmed fictional project dataset.
-- OWNER-AUTHORISED REPLACEMENT OF FICTIONAL PROJECT RECORDS ONLY.
-- All stock/order/history records were confirmed fictional by the project owner.
-- This file replaces operational data. Back up the database first; run the WHOLE file.
-- Private recovery snapshots are saved in existing OrderAmendment records.
-- Accounts, passkeys, receiving QR, bank instructions and ML artifacts are preserved.
-- No migrations, trigger disabling, RLS changes or outgoing bank/email requests.
SET CONSTRAINTS ALL IMMEDIATE;
CREATE TEMP TABLE IF NOT EXISTS wrap_bowl_refresh_result(payload jsonb) ON COMMIT DROP;
TRUNCATE pg_temp.wrap_bowl_refresh_result;
DO $wb_refresh$
DECLARE
 v_data jsonb := $wb_refresh_data${"version":1,"source":"Client menu poster and founder story supplied 5 November 2026","recipe_basis":"Owner-authorised editable estimates; confirm actual ingredients, allergens, yields and quantities with Ayu before real production. Rice quantities are dry weight; meat is raw trimmed weight. Dressing, sauces and mayonnaise are tracked as purchased ingredients; homemade versions need their own actual recipe.","stock_policy":"This catalogue import does not create received ingredient or packaging stock, alter shelf-life evidence, or modify existing stock quantities.","storefront":{"name":"Wrap & Bowl Kuch","tagline":"Made with passion, served with love.","story":"Fresh salad bowls and satisfying Wanpaku sandwiches from a home kitchen in Kuching, Sarawak. Thoughtfully prepared to make good food a convenient part of your busy day.","founder_name":"Ayu Shafinaz","founder_intro":"Hi, I’m Ayu Shafinaz, founder of Wrap & Bowl Kuch, a small home-based food business in Kuching, Sarawak. A love for cooking became a way to share good food and earn extra income.","founding_story":"My journey began with something simple — my love for cooking. What started as a hobby slowly turned into an opportunity to earn extra income while doing something I genuinely enjoy. I never imagined that something I loved doing in my free time could grow into a little business of my own.\nFor me, food is more than just something we eat. It brings comfort, happiness and a little joy to our everyday lives.\nRunning a small business comes with its own challenges, but every step of this journey has taught me something valuable. What started as a side income has grown into something close to my heart — a little dream that I’m slowly building with passion, patience and a lot of love.\nWith love and gratitude,\nAyu Shafinaz","food_philosophy":"Through Wrap & Bowl Kuch, I hope to share the joy of good food with delicious, convenient meals that make healthier eating easier and more enjoyable. Our meals are thoughtfully prepared for people balancing busy daily routines.","signature_food":"Fresh Salad Bowls, Wanpaku Sandwiches and Monday Sukiya Beef Rice Bowls","service_area":"Kuching and Samarahan, Sarawak. Delivery Monday–Friday, subject to area availability.","whatsapp_number":"601114007567","founder_image_url":"","social_url":"","contact_email":""},"raw_materials":[{"name":"Beef sukiyaki slices","unit":"g"},{"name":"Black pepper","unit":"g"},{"name":"Carrot","unit":"g"},{"name":"Cherry tomato","unit":"g"},{"name":"Chicken boneless trimmed","unit":"g"},{"name":"Cooking oil","unit":"ml"},{"name":"Cornflour","unit":"g"},{"name":"Cucumber","unit":"g"},{"name":"Egg","unit":"unit"},{"name":"Lemon","unit":"g"},{"name":"Lettuce","unit":"g"},{"name":"Mayonnaise","unit":"ml"},{"name":"Panko breadcrumbs","unit":"g"},{"name":"Plain flour","unit":"g"},{"name":"Red cabbage","unit":"g"},{"name":"Rice","unit":"g"},{"name":"Salad dressing","unit":"ml"},{"name":"Salmon fillet","unit":"g"},{"name":"Salt","unit":"g"},{"name":"Sandwich bread","unit":"g"},{"name":"Sesame seeds","unit":"g"},{"name":"Soy sauce","unit":"ml"},{"name":"Spring onion","unit":"g"},{"name":"Sweetcorn kernels","unit":"g"},{"name":"Teriyaki sauce","unit":"ml"}],"packaging_items":["Disposable fork","Disposable spoon","Dressing cup with lid (30 ml)","Food label","Greaseproof paper sheet","Rice bowl with lid (750 ml)","Salad bowl with lid (1000 ml)","Sandwich box (2 halves)","Sauce cup with lid (60 ml)"],"menus":[{"name":"Chicken Grilled Salad","price":"13.00","category":"Salad bowls","description":"Grilled chicken salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Chicken boneless trimmed":"130.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Chicken Popcorn Salad","price":"13.00","category":"Salad bowls","description":"Popcorn chicken salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Chicken boneless trimmed":"130.000","Cooking oil":"15.000","Salt":"1.000","Black pepper":"0.500","Plain flour":"15.000","Cornflour":"20.000","Egg":"0.250"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Eggsquisite Salad","price":"12.00","category":"Salad bowls","description":"Egg salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Egg":"2.000","Salt":"0.500","Black pepper":"0.300"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Beef Sukiya Salad","price":"18.00","category":"Salad bowls","description":"Sliced beef salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Beef sukiyaki slices":"120.000","Teriyaki sauce":"20.000","Soy sauce":"5.000","Cooking oil":"5.000"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Wanpaku Chicken Katsu","price":"12.00","category":"Wanpaku sandwiches","description":"Chicken katsu Wanpaku sandwich.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/sandwich.svg","selling_details":{"ordering_mode":"local_preorder","unit":"box","contents":"One sandwich, cut into two halves"},"ingredients":{"Sandwich bread":"80.000","Lettuce":"20.000","Red cabbage":"20.000","Carrot":"20.000","Cucumber":"20.000","Mayonnaise":"20.000","Chicken boneless trimmed":"110.000","Egg":"0.250","Plain flour":"15.000","Panko breadcrumbs":"20.000","Cooking oil":"10.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Sandwich box (2 halves)":1,"Greaseproof paper sheet":1,"Food label":1}},{"name":"Wanpaku Chicken Grilled","price":"12.00","category":"Wanpaku sandwiches","description":"Grilled chicken Wanpaku sandwich.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/sandwich.svg","selling_details":{"ordering_mode":"local_preorder","unit":"box","contents":"One sandwich, cut into two halves"},"ingredients":{"Sandwich bread":"80.000","Lettuce":"20.000","Red cabbage":"20.000","Carrot":"20.000","Cucumber":"20.000","Mayonnaise":"20.000","Chicken boneless trimmed":"110.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Sandwich box (2 halves)":1,"Greaseproof paper sheet":1,"Food label":1}},{"name":"Salmon Grilled Salad Bowl","price":"28.00","category":"Salad bowls","description":"Grilled salmon salad bowl.","delivery_weekdays":[0,1,2,3,4],"image_url":"/static/client-menu/salad-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One salad bowl"},"ingredients":{"Lettuce":"60.000","Red cabbage":"20.000","Carrot":"15.000","Cucumber":"30.000","Cherry tomato":"35.000","Sweetcorn kernels":"25.000","Salad dressing":"25.000","Salmon fillet":"150.000","Lemon":"15.000","Cooking oil":"5.000","Salt":"1.000","Black pepper":"0.500"},"packaging":{"Salad bowl with lid (1000 ml)":1,"Dressing cup with lid (30 ml)":1,"Disposable fork":1,"Food label":1}},{"name":"Sukiya Beef Rice Bowl","price":"20.00","category":"Rice bowls","description":"Sliced beef rice bowl. Available on Mondays only.","delivery_weekdays":[0],"image_url":"/static/client-menu/rice-bowl.svg","selling_details":{"ordering_mode":"local_preorder","unit":"portion","contents":"One rice bowl"},"ingredients":{"Beef sukiyaki slices":"120.000","Teriyaki sauce":"20.000","Soy sauce":"5.000","Cooking oil":"5.000","Rice":"80.000","Cucumber":"20.000","Spring onion":"5.000","Sesame seeds":"2.000"},"packaging":{"Rice bowl with lid (750 ml)":1,"Sauce cup with lid (60 ml)":1,"Disposable spoon":1,"Food label":1}}],"operations":{"operation_id":"wrap_bowl_operations_v1","owner_confirmed_all_records_fictional":true,"units_per_menu":10,"fee_basis":"Provisional kitchen-set prices for a Petra Jaya-area planning origin. These are editable project rates, not verified GrabExpress quotes. Confirm the actual collection point and route before real business use.","areas":[{"name":"Petra Jaya","fee":"8.00","street":"Jalan Pustaka","postcode":"93050"},{"name":"Samariang","fee":"10.00","street":"Jalan Sultan Tengah","postcode":"93050"},{"name":"Matang Jaya","fee":"12.00","street":"Jalan Matang","postcode":"93050"},{"name":"Satok","fee":"12.00","street":"Jalan Satok","postcode":"93400"},{"name":"Kuching city centre","fee":"12.00","street":"Jalan Padungan","postcode":"93100"},{"name":"Demak Laut","fee":"14.00","street":"Jalan Demak","postcode":"93050"},{"name":"Tabuan Jaya","fee":"15.00","street":"Jalan Wan Alwi","postcode":"93350"},{"name":"Stutong","fee":"15.00","street":"Jalan Stutong","postcode":"93350"},{"name":"Batu Kawa","fee":"16.00","street":"Jalan Batu Kawa","postcode":"93250"},{"name":"Kota Sentosa","fee":"18.00","street":"Jalan Penrissen","postcode":"93250"},{"name":"Desa Ilmu, Kota Samarahan","fee":"22.00","street":"Jalan Desa Ilmu","postcode":"94300"},{"name":"UNIMAS, Kota Samarahan","fee":"24.00","street":"Jalan Datuk Mohammad Musa","postcode":"94300"}],"stock_profiles":[{"name":"Beef sukiyaki slices","storage_type":"frozen","planning_days":90,"location":"Freezer A - Labelled ingredient containers"},{"name":"Black pepper","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Carrot","storage_type":"chilled","planning_days":14,"location":"Fridge A - Covered ingredient containers"},{"name":"Cherry tomato","storage_type":"chilled","planning_days":7,"location":"Fridge A - Covered ingredient containers"},{"name":"Chicken boneless trimmed","storage_type":"frozen","planning_days":90,"location":"Freezer A - Labelled ingredient containers"},{"name":"Cooking oil","storage_type":"ambient","planning_days":180,"location":"Pantry A - Dry goods shelf"},{"name":"Cornflour","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Cucumber","storage_type":"chilled","planning_days":7,"location":"Fridge A - Covered ingredient containers"},{"name":"Egg","storage_type":"chilled","planning_days":21,"location":"Fridge A - Covered ingredient containers"},{"name":"Lemon","storage_type":"chilled","planning_days":14,"location":"Fridge A - Covered ingredient containers"},{"name":"Lettuce","storage_type":"chilled","planning_days":7,"location":"Fridge A - Covered ingredient containers"},{"name":"Mayonnaise","storage_type":"chilled","planning_days":14,"location":"Fridge A - Covered ingredient containers"},{"name":"Panko breadcrumbs","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Plain flour","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Red cabbage","storage_type":"chilled","planning_days":14,"location":"Fridge A - Covered ingredient containers"},{"name":"Rice","storage_type":"ambient","planning_days":180,"location":"Pantry A - Dry goods shelf"},{"name":"Salad dressing","storage_type":"chilled","planning_days":7,"location":"Fridge A - Covered ingredient containers"},{"name":"Salmon fillet","storage_type":"frozen","planning_days":60,"location":"Freezer A - Labelled ingredient containers"},{"name":"Salt","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Sandwich bread","storage_type":"ambient","planning_days":5,"location":"Pantry A - Dry goods shelf"},{"name":"Sesame seeds","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Soy sauce","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"},{"name":"Spring onion","storage_type":"chilled","planning_days":7,"location":"Fridge A - Covered ingredient containers"},{"name":"Sweetcorn kernels","storage_type":"frozen","planning_days":90,"location":"Freezer A - Labelled ingredient containers"},{"name":"Teriyaki sauce","storage_type":"ambient","planning_days":90,"location":"Pantry A - Dry goods shelf"}],"stock_basis":"Owner-authorised project inventory replacement; quantities and planning dates are constructed records, not verified physical counts or shelf-life evidence.","validated_for_apply":true}}$wb_refresh_data$::jsonb;
 v_ops jsonb; v_store record; v_order record; v_line record; v_raw record; v_pack record;
 v_backup jsonb; v_before jsonb; v_target jsonb; v_ids bigint[]; v_raws bigint[]; v_packs bigint[];
 v_first bigint; v_pid bigint; v_batch bigint; v_accept bigint; v_n integer; v_rank integer:=0;
 v_today date:=timezone('Asia/Kuala_Lumpur',CURRENT_TIMESTAMP)::date;
 v_day date; v_received date; v_delivery timestamptz; v_created timestamptz;
 v_status text; v_method text; v_payment text; v_paid text; v_area jsonb; v_name text; v_phone text;
 v_food numeric; v_discount numeric; v_fee numeric; v_units integer; v_cents numeric;
 v_amount numeric; v_balance numeric; v_quantity numeric; v_days integer; v_code text; v_profile jsonb;
 v_original_count integer; v_areas jsonb; v_fees jsonb; v_latest bigint[];
BEGIN
 PERFORM set_config('lock_timeout','10s',true);
 v_ops:=v_data->'operations';
 IF coalesce((v_ops->>'validated_for_apply')::boolean,false) IS NOT TRUE THEN
  RAISE EXCEPTION 'This refresh is awaiting PostgreSQL verification. No operational records were changed. Do not remove this guard.';
 END IF;
 IF coalesce((v_ops->>'owner_confirmed_all_records_fictional')::boolean,false) IS NOT TRUE THEN
  RAISE EXCEPTION 'This replacement is only for owner-confirmed fictional project records.';
 END IF;
 SELECT * INTO v_store FROM django_app.myapp_storefront WHERE id=1 FOR UPDATE;
 IF NOT FOUND OR v_store.ordering_mode<>'simple' THEN RAISE EXCEPTION 'Apply the client catalogue in the intended simple-mode database first.'; END IF;
 IF EXISTS(SELECT 1 FROM django_app.myapp_orderamendment WHERE after->>'operation_id'=v_ops->>'operation_id') THEN
  INSERT INTO pg_temp.wrap_bowl_refresh_result VALUES(jsonb_build_object('status','already_applied','message','This replacement was already applied. Later orders and stock were not reset.')); RETURN;
 END IF;
 LOCK TABLE django_app.myapp_order,django_app.myapp_orderitem,django_app.myapp_orderingredient,
  django_app.myapp_ingredientconsumption,django_app.myapp_inventoryitem,django_app.myapp_inventorylog,
  django_app.myapp_wasterecord,django_app.myapp_packagingitem,django_app.myapp_productpackaging,
  django_app.myapp_orderpackaging,django_app.myapp_packagingmovement,django_app.myapp_paymentevent,
  django_app.myapp_product,django_app.myapp_productingredient,django_app.myapp_rawmaterial,
  django_app.myapp_category,django_app.myapp_cartitem,django_app.myapp_review,
  django_app.myapp_orderamendment,django_app.myapp_orderreminder,django_app.myapp_checkoutproof
  IN SHARE ROW EXCLUSIVE MODE;
 SELECT array_agg(p.id ORDER BY p.id) INTO v_ids FROM django_app.myapp_product p
  WHERE p.name IN (SELECT value->>'name' FROM jsonb_array_elements(v_data->'menus')) AND p.selling_status='active';
 IF cardinality(v_ids)<>8 OR v_ids IS NULL OR (SELECT count(*) FROM django_app.myapp_product WHERE selling_status='active')<>8
  THEN RAISE EXCEPTION 'Expected exactly the eight active client menus. Run batch 1 or review catalogue edits first.'; END IF;
 IF EXISTS(SELECT 1 FROM django_app.myapp_product p WHERE p.id=ANY(v_ids) AND
  (NOT EXISTS(SELECT 1 FROM django_app.myapp_productingredient WHERE product_id=p.id)
   OR NOT EXISTS(SELECT 1 FROM django_app.myapp_productpackaging WHERE product_id=p.id)))
  OR EXISTS(SELECT 1 FROM django_app.myapp_productingredient WHERE product_id=ANY(v_ids) AND quantity_required<=0)
  THEN RAISE EXCEPTION 'Complete the client recipes and packaging before replacing operational records.'; END IF;
 SELECT array_agg(DISTINCT raw_material_id) INTO v_raws FROM django_app.myapp_productingredient WHERE product_id=ANY(v_ids);
 SELECT array_agg(DISTINCT packaging_item_id) INTO v_packs FROM django_app.myapp_productpackaging WHERE product_id=ANY(v_ids);
 IF cardinality(v_raws)<>25 OR cardinality(v_packs)<>9 THEN RAISE EXCEPTION 'The reviewed refresh expects 25 ingredients and nine packaging types. Review any recipe edits first.'; END IF;
 IF EXISTS(SELECT 1 FROM django_app.myapp_rawmaterial r WHERE id=ANY(v_raws) AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(v_data->'raw_materials') s WHERE s->>'name'=r.name AND s->>'unit'=r.unit))
  THEN RAISE EXCEPTION 'Ingredient names or units differ from the reviewed client setup.'; END IF;
 SELECT min(id),count(*) INTO v_first,v_original_count FROM django_app.myapp_order;
 IF v_first IS NULL THEN RAISE EXCEPTION 'No order history exists to refresh. Use the ordinary opening-stock forms instead.'; END IF;
 SELECT array_agg(id) INTO v_latest FROM (SELECT id FROM django_app.myapp_order WHERE status<>'cancelled' ORDER BY id DESC LIMIT 2) x;
 -- Keep a durable PRIVATE recovery copy before removing dependent scenario rows.
 SELECT jsonb_build_object('storefront',to_jsonb(v_store),
  'materials',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_rawmaterial t),
  'batches',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_inventoryitem t),
  'stock_logs',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_inventorylog t),
  'waste',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_wasterecord t),
  'products',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_product t),
  'categories',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_category t),
  'recipes',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_productingredient t),
  'packaging',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_packagingitem t),
  'menu_packaging',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_productpackaging t),
  'packaging_movements',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_packagingmovement t),
  'earlier_changes',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_orderamendment t),
  'reminders',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_orderreminder t),
  'recommendation_events',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_recommendationevent t),
  'reviews',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_review t),
  'carts',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_cartitem t)) INTO v_backup;
 DELETE FROM django_app.myapp_orderamendment;
 FOR v_order IN SELECT * FROM django_app.myapp_order ORDER BY id LOOP
  SELECT jsonb_build_object('order',to_jsonb(v_order),
   'items',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_orderitem t WHERE order_id=v_order.id),
   'accepted_ingredients',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_orderingredient t WHERE order_item_id IN(SELECT id FROM django_app.myapp_orderitem WHERE order_id=v_order.id)),
   'consumption',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_ingredientconsumption t WHERE order_item_id IN(SELECT id FROM django_app.myapp_orderitem WHERE order_id=v_order.id)),
   'packaging',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_orderpackaging t WHERE order_item_id IN(SELECT id FROM django_app.myapp_orderitem WHERE order_id=v_order.id)),
   'payments',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM django_app.myapp_paymentevent t WHERE order_id=v_order.id),
   'proof_metadata',(SELECT coalesce(jsonb_agg(to_jsonb(t)-'content'),'[]'::jsonb) FROM django_app.myapp_checkoutproof t WHERE order_id=v_order.id)) INTO v_before;
  IF v_order.id=v_first THEN v_before:=v_before||jsonb_build_object('operational_backup',v_backup); END IF;
  INSERT INTO django_app.myapp_orderamendment(order_id,actor_id,before,after,created_at)
   VALUES(v_order.id,NULL,v_before,jsonb_build_object('kind','catalogue_refresh','operation_id',v_ops->>'operation_id','owner_confirmed_fictional',true),CURRENT_TIMESTAMP);
 END LOOP;
 UPDATE django_app.myapp_checkoutproof SET order_id=NULL WHERE order_id IS NOT NULL;
 UPDATE django_app.myapp_paymentevent SET resolves_id=NULL;
 DELETE FROM django_app.myapp_paymentevent;
 DELETE FROM django_app.myapp_orderreminder;
 DELETE FROM django_app.myapp_ingredientconsumption;
 DELETE FROM django_app.myapp_orderingredient;
 DELETE FROM django_app.myapp_packagingmovement;
 DELETE FROM django_app.myapp_orderpackaging;
 DELETE FROM django_app.myapp_inventorylog;
 DELETE FROM django_app.myapp_wasterecord;
 DELETE FROM django_app.myapp_inventoryitem;
 -- Bound each refreshed order to at most three lines, one to ten units per line.
 DELETE FROM django_app.myapp_orderitem WHERE id IN(SELECT id FROM(
  SELECT id,row_number() OVER(PARTITION BY order_id ORDER BY id) n FROM django_app.myapp_orderitem) x WHERE n>3);
 FOR v_order IN SELECT * FROM django_app.myapp_order ORDER BY id LOOP
  v_rank:=v_rank+1;
  IF NOT EXISTS(SELECT 1 FROM django_app.myapp_orderitem WHERE order_id=v_order.id) THEN
   INSERT INTO django_app.myapp_orderitem(order_id,product_id,product_name,unit_price,quantity,subtotal,recipe_source,preparation_snapshot,packaging_unit_cost)
    SELECT v_order.id,id,name,price,1,price,'accepted','{}'::jsonb,NULL FROM django_app.myapp_product WHERE id=v_ids[1];
  END IF;
  FOR v_line IN SELECT * FROM django_app.myapp_orderitem WHERE order_id=v_order.id ORDER BY id LOOP
   v_n:=1+mod(v_line.id,CASE WHEN v_order.id=ANY(v_latest) THEN 7 ELSE 8 END)::integer;
   SELECT value INTO v_target FROM jsonb_array_elements(v_data->'menus') WITH ORDINALITY s(value,n) WHERE n=v_n;
   SELECT id INTO v_pid FROM django_app.myapp_product WHERE name=v_target->>'name';
   UPDATE django_app.myapp_orderitem i SET product_id=p.id,product_name=p.name,unit_price=p.price,
    quantity=least(10,greatest(1,i.quantity)),subtotal=p.price*least(10,greatest(1,i.quantity)),recipe_source='accepted',packaging_unit_cost=NULL,
    preparation_snapshot=jsonb_build_object('lead_hours',p.lead_hours,'preparation_minutes',p.preparation_minutes,
      'preparation_tasks',p.preparation_tasks,'max_preparation_days',p.max_preparation_days,'batch_size',p.batch_size,
      'additional_batch_minutes',p.additional_batch_minutes,'packing_minutes_per_portion',p.packing_minutes_per_portion,
      'max_early_minutes',p.max_early_minutes,'daily_capacity',p.daily_capacity,'selling_details',p.selling_details)
    FROM django_app.myapp_product p WHERE i.id=v_line.id AND p.id=v_pid;
   INSERT INTO django_app.myapp_orderingredient(order_item_id,raw_material_id,material_name,unit,quantity_per_portion)
    SELECT v_line.id,r.id,r.name,r.unit,pi.quantity_required FROM django_app.myapp_productingredient pi
     JOIN django_app.myapp_rawmaterial r ON r.id=pi.raw_material_id WHERE pi.product_id=v_pid;
  END LOOP;
  v_status:=CASE WHEN v_order.status='cancelled' THEN 'cancelled' WHEN v_order.id=ANY(v_latest) THEN 'pending' ELSE 'delivered' END;
  v_day:=CASE WHEN v_status='pending' THEN v_today+2+mod(v_order.id,2)::integer ELSE v_today-greatest(1,ceil((v_original_count-v_rank+3)::numeric/2)::integer) END;
  WHILE extract(isodow FROM v_day)>5 OR (EXISTS(SELECT 1 FROM django_app.myapp_orderitem i JOIN django_app.myapp_product p ON p.id=i.product_id WHERE i.order_id=v_order.id AND p.name='Sukiya Beef Rice Bowl') AND extract(isodow FROM v_day)<>1) LOOP
   v_day:=v_day+CASE WHEN v_status='pending' THEN 1 ELSE -1 END;
  END LOOP;
  v_delivery:=(v_day+TIME '07:30'+make_interval(mins=>mod(v_order.id*17,181)::integer)) AT TIME ZONE 'Asia/Kuala_Lumpur';
  v_created:=CASE WHEN v_status='pending' THEN CURRENT_TIMESTAMP ELSE ((v_day-1)+TIME '16:00') AT TIME ZONE 'Asia/Kuala_Lumpur' END;
  v_method:=CASE WHEN v_status<>'pending' AND v_order.delivery_method='pickup' THEN 'pickup' ELSE 'standard' END;
  SELECT value INTO v_area FROM jsonb_array_elements(v_ops->'areas') WITH ORDINALITY s(value,n) WHERE n=1+mod(v_order.id,jsonb_array_length(v_ops->'areas'));
  SELECT coalesce(nullif(c.name,''),nullif(v_order.fulfilment_snapshot#>>'{customer,name}',''),nullif(v_order.delivery_address->>'recipient_name',''),'Customer '||v_order.user_id),
   coalesce(nullif(c.phone,''),nullif(v_order.fulfilment_snapshot#>>'{customer,phone}',''),nullif(v_order.delivery_address->>'phone',''),'+60123456789')
   INTO v_name,v_phone FROM (SELECT v_order.user_id AS user_id) u LEFT JOIN django_app.myapp_customeraccount c ON c.user_id=u.user_id;
  SELECT sum(subtotal),sum(quantity) INTO v_food,v_units FROM django_app.myapp_orderitem WHERE order_id=v_order.id;
  v_cents:=CASE WHEN v_units>=v_store.bulk_minimum THEN v_food*v_store.bulk_discount_percent ELSE 0 END;
  v_discount:=(CASE WHEN v_cents-floor(v_cents)=0.5 THEN floor(v_cents)+mod(floor(v_cents),2) ELSE round(v_cents) END)/100;
  v_fee:=CASE WHEN v_method='pickup' THEN 0 ELSE (v_area->>'fee')::numeric END;
  v_payment:=CASE WHEN v_method='pickup' OR (v_status<>'pending' AND v_order.payment_method NOT IN('cod','cash')) THEN 'manual' ELSE 'cod' END;
  v_paid:=CASE WHEN v_status='pending' THEN 'unpaid' WHEN v_status='cancelled' THEN CASE WHEN v_order.payment_status IN('paid','refunded') THEN 'refunded' ELSE 'unpaid' END ELSE 'paid' END;
  UPDATE django_app.myapp_order SET ordering_mode='simple',status=v_status,payment_method=v_payment,payment_status=v_paid,
   total_amount=v_food-v_discount,discount_amount=v_discount,shipping_fee=v_fee,delivery_method=v_method,delivery_at=v_delivery,
   created_at=v_created,updated_at=CURRENT_TIMESTAMP,address_id=NULL,preparation_at=NULL,preparation_end_at=NULL,stock_returned_at=NULL,
   inventory_deducted=v_status<>'cancelled',preparation_plan=jsonb_build_object('ordering_mode','simple','tasks','[]'::jsonb,'needs_review',false,'stock_deduction_stage','placement','delivery_buffer_minutes',0),
   delivery_address=CASE WHEN v_method='pickup' THEN '{}'::jsonb ELSE jsonb_build_object('recipient_name',v_name,'phone',v_phone,
    'line1','No. '||(1+mod(id,90))||', '||(v_area->>'street'),'line2',v_area->>'name','city',CASE WHEN (v_area->>'postcode')='94300' THEN 'Kota Samarahan' ELSE 'Kuching' END,'state','Sarawak','postal_code',v_area->>'postcode','country','Malaysia') END,
   fulfilment_snapshot=jsonb_build_object('method',v_method,'label',CASE WHEN v_method='pickup' THEN 'Self-collection' ELSE 'Delivery' END,
    'open_time','07:30:00','close_time','11:00:00','open_hour',7,'close_hour',11,'buffer_minutes',0,'arrival_window_minutes',0,
    'delivery_area',CASE WHEN v_method='pickup' THEN '' ELSE v_area->>'name' END,'pickup_location',CASE WHEN v_method='pickup' THEN 'Kuching, Sarawak — collection point by arrangement with the kitchen' ELSE '' END,
    'customer',jsonb_build_object('name',v_name,'phone',v_phone),'customer_reminder',jsonb_build_object('enabled',false,'email',''),
    'handover',jsonb_build_object('mode','in_person','contact_method','phone','contact_phone',v_phone,'notes','','location','')),
   payment_instructions=jsonb_build_object('catalogue_refresh_sample',jsonb_build_object('version','1','operation_id',v_ops->>'operation_id'),
    'instructions',v_store.bank_transfer_instructions,'qr_url',v_store.duitnow_qr_url)
   WHERE id=v_order.id;
  IF v_paid='refunded' THEN
   INSERT INTO django_app.myapp_paymentevent(order_id,request_id,kind,outcome,amount,method,reference,note,source,resolves_id,actor_id,created_at)
    VALUES(v_order.id,gen_random_uuid(),'receipt','completed',v_food-v_discount+v_fee,v_payment,'REC-'||v_order.id,
     'Record refreshed for the current catalogue','catalogue_refresh',NULL,NULL,v_created);
  END IF;
  IF v_paid IN('paid','refunded') THEN
   INSERT INTO django_app.myapp_paymentevent(order_id,request_id,kind,outcome,amount,method,reference,note,source,resolves_id,actor_id,created_at)
    VALUES(v_order.id,gen_random_uuid(),CASE WHEN v_paid='refunded' THEN 'refund' ELSE 'receipt' END,'completed',v_food-v_discount+v_fee,v_payment,
      CASE WHEN v_paid='refunded' THEN 'RFD-' ELSE 'REC-' END||lpad(v_order.id::text,greatest(5,length(v_order.id::text)),'0'),'Record refreshed for the current catalogue','catalogue_refresh',NULL,NULL,v_created);
  END IF;
 END LOOP;
 -- Cancelled historical records retain the current packaging terms without
 -- claiming that stock was allocated to them.
 INSERT INTO django_app.myapp_orderpackaging(order_item_id,packaging_item_id,packaging_name,quantity,unit_cost,allocated_at,released_at)
  SELECT i.id,pp.packaging_item_id,p.name,pp.quantity_per_item*i.quantity,NULL,NULL,NULL
  FROM django_app.myapp_orderitem i JOIN django_app.myapp_order o ON o.id=i.order_id
  JOIN django_app.myapp_productpackaging pp ON pp.product_id=i.product_id
  JOIN django_app.myapp_packagingitem p ON p.id=pp.packaging_item_id WHERE o.status='cancelled';
 -- Remove unrelated catalogue records only after all accepted references use new menus.
 DELETE FROM django_app.myapp_review WHERE product_id<>ALL(v_ids);
 DELETE FROM django_app.myapp_cartitem WHERE product_id<>ALL(v_ids);
 UPDATE django_app.myapp_recommendationevent SET product_id=NULL WHERE product_id<>ALL(v_ids);
 DELETE FROM django_app.myapp_productingredient WHERE product_id<>ALL(v_ids);
 DELETE FROM django_app.myapp_productpackaging WHERE product_id<>ALL(v_ids);
 DELETE FROM django_app.myapp_product WHERE id<>ALL(v_ids);
 DELETE FROM django_app.myapp_category WHERE id NOT IN(SELECT category_id FROM django_app.myapp_product WHERE category_id IS NOT NULL);
 DELETE FROM django_app.myapp_rawmaterial WHERE id<>ALL(v_raws);
 DELETE FROM django_app.myapp_packagingitem WHERE id<>ALL(v_packs);
 -- One current lot per ingredient; pending orders allocate from this receipt.
 FOR v_raw IN SELECT * FROM django_app.myapp_rawmaterial ORDER BY id LOOP
  SELECT value INTO v_profile FROM jsonb_array_elements(v_ops->'stock_profiles') WHERE value->>'name'=v_raw.name;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Missing stock profile for %',v_raw.name; END IF;
  SELECT sum(quantity_required)*(v_ops->>'units_per_menu')::numeric INTO v_quantity FROM django_app.myapp_productingredient WHERE raw_material_id=v_raw.id;
  SELECT coalesce(sum(oi.quantity_per_portion*i.quantity),0) INTO v_amount FROM django_app.myapp_orderingredient oi JOIN django_app.myapp_orderitem i ON i.id=oi.order_item_id JOIN django_app.myapp_order o ON o.id=i.order_id WHERE oi.raw_material_id=v_raw.id AND o.status='pending';
  v_quantity:=v_quantity+v_amount;v_days:=(v_profile->>'planning_days')::integer;
  INSERT INTO django_app.myapp_inventoryitem(raw_material_id,quantity,batch_code,storage_location,received_date,expiry_date,created_at,updated_at,
   expiry_basis,manufactured_date,shelf_life_days,storage_type,guidance_note,quarantined,unit_cost,supplier,source_type,label_date_type,original_expiry_date,opened_date,after_open_days,thawed_date,after_thaw_days,handling_history,handling_note)
  VALUES(v_raw.id,v_quantity,'',v_profile->>'location',v_today,v_today+v_days,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'storage',NULL,v_days,v_profile->>'storage_type',
    'Project planning deadline; not verified supplier or shelf-life evidence.',false,NULL,'','other','not_recorded',NULL,NULL,NULL,NULL,NULL,'not_recorded','') RETURNING id INTO v_batch;
  v_code:=(CASE WHEN upper(v_raw.name) LIKE 'CHICKEN%' THEN 'CHK' WHEN v_raw.name='Rice' THEN 'RCE' WHEN v_raw.name='Salt' THEN 'SLT' ELSE rpad(substr(regexp_replace(upper(v_raw.name),'[^A-Z]','','g'),1,3),3,'X') END)||'-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(v_batch::text,greatest(3,length(v_batch::text)),'0');
  UPDATE django_app.myapp_inventoryitem SET batch_code=v_code WHERE id=v_batch;
  INSERT INTO django_app.myapp_inventorylog(inventory_item_id,change,reason,reference,admin_id,created_at) VALUES(v_batch,v_quantity,'Stock received','Opening stock',NULL,CURRENT_TIMESTAMP);
 END LOOP;
 -- Packaging starts with enough for the refreshed history plus ten of each menu.
 FOR v_pack IN SELECT * FROM django_app.myapp_packagingitem ORDER BY id LOOP
  SELECT sum(quantity_per_item)*(v_ops->>'units_per_menu')::integer INTO v_quantity FROM django_app.myapp_productpackaging WHERE packaging_item_id=v_pack.id;
  SELECT coalesce(sum(pp.quantity_per_item*i.quantity),0) INTO v_amount FROM django_app.myapp_orderitem i JOIN django_app.myapp_order o ON o.id=i.order_id JOIN django_app.myapp_productpackaging pp ON pp.product_id=i.product_id WHERE pp.packaging_item_id=v_pack.id AND o.status<>'cancelled';
  v_quantity:=v_quantity+v_amount;
  UPDATE django_app.myapp_packagingitem SET quantity=v_quantity,is_active=true,unit_cost=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=v_pack.id;
  INSERT INTO django_app.myapp_packagingmovement(packaging_item_id,order_packaging_id,request_id,kind,change,balance_after,reason,actor_id,created_at)
   VALUES(v_pack.id,NULL,gen_random_uuid(),'opening',v_quantity,v_quantity,'Opening stock',NULL,(SELECT min(created_at)-interval '1 day' FROM django_app.myapp_order));
 END LOOP;
 FOR v_order IN SELECT * FROM django_app.myapp_order WHERE status<>'cancelled' ORDER BY delivery_at,id LOOP
  FOR v_line IN SELECT * FROM django_app.myapp_orderitem WHERE order_id=v_order.id ORDER BY id LOOP
   FOR v_raw IN SELECT oi.*,r.name FROM django_app.myapp_orderingredient oi JOIN django_app.myapp_rawmaterial r ON r.id=oi.raw_material_id WHERE order_item_id=v_line.id LOOP
    v_amount:=v_raw.quantity_per_portion*v_line.quantity;
    IF v_order.status='pending' THEN
     SELECT id INTO v_batch FROM django_app.myapp_inventoryitem WHERE raw_material_id=v_raw.raw_material_id AND received_date=v_today AND quantity>0 ORDER BY id LIMIT 1;
     UPDATE django_app.myapp_inventoryitem SET quantity=quantity-v_amount WHERE id=v_batch;
    ELSE
     v_received:=timezone('Asia/Kuala_Lumpur',v_order.delivery_at)::date-1;
     SELECT value INTO v_profile FROM jsonb_array_elements(v_ops->'stock_profiles') WHERE value->>'name'=v_raw.name;
     v_days:=(v_profile->>'planning_days')::integer;
     INSERT INTO django_app.myapp_inventoryitem(raw_material_id,quantity,batch_code,storage_location,received_date,expiry_date,created_at,updated_at,
      expiry_basis,manufactured_date,shelf_life_days,storage_type,guidance_note,quarantined,unit_cost,supplier,source_type,label_date_type,original_expiry_date,opened_date,after_open_days,thawed_date,after_thaw_days,handling_history,handling_note)
     VALUES(v_raw.raw_material_id,0,'',v_profile->>'location',v_received,v_received+v_days,v_order.created_at,CURRENT_TIMESTAMP,'storage',NULL,v_days,v_profile->>'storage_type',
       'Historical project allocation; not verified physical storage evidence.',false,NULL,'','other','not_recorded',NULL,NULL,NULL,NULL,NULL,'not_recorded','') RETURNING id INTO v_batch;
     v_code:=(CASE WHEN upper(v_raw.name) LIKE 'CHICKEN%' THEN 'CHK' WHEN v_raw.name='Rice' THEN 'RCE' WHEN v_raw.name='Salt' THEN 'SLT' ELSE rpad(substr(regexp_replace(upper(v_raw.name),'[^A-Z]','','g'),1,3),3,'X') END)||'-'||to_char(v_received,'YYYYMMDD')||'-'||lpad(v_batch::text,greatest(3,length(v_batch::text)),'0');
     UPDATE django_app.myapp_inventoryitem SET batch_code=v_code WHERE id=v_batch;
     INSERT INTO django_app.myapp_inventorylog(inventory_item_id,change,reason,reference,admin_id,created_at) VALUES(v_batch,v_amount,'Stock received','Opening stock',NULL,v_order.created_at);
    END IF;
    INSERT INTO django_app.myapp_ingredientconsumption(order_item_id,inventory_item_id,material_name,batch_code,unit,quantity,unit_cost,recorded_expiry,created_at,allocation_stage,returned_at)
     SELECT v_line.id,id,v_raw.material_name,batch_code,v_raw.unit,v_amount,NULL,expiry_date,v_order.created_at,'placement',NULL FROM django_app.myapp_inventoryitem WHERE id=v_batch;
    INSERT INTO django_app.myapp_inventorylog(inventory_item_id,change,reason,reference,admin_id,created_at) VALUES(v_batch,-v_amount,'Ingredients allocated','Order #'||v_order.id,NULL,v_order.created_at);
   END LOOP;
   FOR v_pack IN SELECT pp.*,p.name FROM django_app.myapp_productpackaging pp JOIN django_app.myapp_packagingitem p ON p.id=pp.packaging_item_id WHERE product_id=v_line.product_id LOOP
    v_amount:=v_pack.quantity_per_item*v_line.quantity;
    INSERT INTO django_app.myapp_orderpackaging(order_item_id,packaging_item_id,packaging_name,quantity,unit_cost,allocated_at,released_at)
     VALUES(v_line.id,v_pack.packaging_item_id,v_pack.name,v_amount,NULL,v_order.created_at,NULL) RETURNING id INTO v_accept;
    UPDATE django_app.myapp_packagingitem SET quantity=quantity-v_amount WHERE id=v_pack.packaging_item_id RETURNING quantity INTO v_balance;
    INSERT INTO django_app.myapp_packagingmovement(packaging_item_id,order_packaging_id,request_id,kind,change,balance_after,reason,actor_id,created_at)
     VALUES(v_pack.packaging_item_id,v_accept,NULL,'allocate',-v_amount,v_balance,'Allocated to order #'||v_order.id,NULL,v_order.created_at);
   END LOOP;
  END LOOP;
 END LOOP;
 SELECT jsonb_agg(value->>'name' ORDER BY n),jsonb_object_agg(value->>'name',value->>'fee') INTO v_areas,v_fees FROM jsonb_array_elements(v_ops->'areas') WITH ORDINALITY s(value,n);
 UPDATE django_app.myapp_storefront SET delivery_areas=v_areas,delivery_area_fees=v_fees,delivery_fee_myr=8,free_delivery_minimum_myr=NULL,
  delivery_start_time='07:30',delivery_end_time='11:00',pickup_start_time='07:30',pickup_end_time='11:00',delivery_enabled=true,
  pickup_location='Kuching, Sarawak — contact the kitchen to agree the collection point',service_area='Kuching and Kota Samarahan, Sarawak. Choose your delivery area at checkout.' WHERE id=1;
 IF EXISTS(SELECT 1 FROM django_app.myapp_orderitem i JOIN django_app.myapp_product p ON p.id=i.product_id JOIN django_app.myapp_order o ON o.id=i.order_id
  WHERE (jsonb_array_length(p.delivery_weekdays)>0 AND NOT(p.delivery_weekdays @> jsonb_build_array(extract(isodow FROM timezone('Asia/Kuala_Lumpur',o.delivery_at))::integer-1)))
    OR (jsonb_array_length(p.delivery_dates)>0 AND NOT(p.delivery_dates @> jsonb_build_array(timezone('Asia/Kuala_Lumpur',o.delivery_at)::date::text))))
  THEN RAISE EXCEPTION 'Offered dates differ from the reviewed poster. No replacement was saved; review the menu rules first.'; END IF;
 IF EXISTS(SELECT 1 FROM django_app.myapp_inventoryitem WHERE quantity<0) OR EXISTS(SELECT 1 FROM django_app.myapp_packagingitem WHERE quantity<0) THEN RAISE EXCEPTION 'Allocation reconciliation failed; all changes rolled back.'; END IF;
 INSERT INTO pg_temp.wrap_bowl_refresh_result VALUES(jsonb_build_object('status','refreshed','operation_id',v_ops->>'operation_id',
  'orders',v_original_count,'menus',8,'ingredients',cardinality(v_raws),'packaging_types',cardinality(v_packs),'units_per_menu_available',v_ops->'units_per_menu',
  'delivery_areas',v_areas,'private_backup_order_id',v_first,'message','Current catalogue, stock, allocations and order history were refreshed together. Accounts, passkeys and receiving payment settings were preserved.'));
END $wb_refresh$;
SELECT payload FROM pg_temp.wrap_bowl_refresh_result;
