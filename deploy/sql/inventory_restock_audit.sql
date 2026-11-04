-- READ ONLY: run the whole SELECT in Supabase SQL Editor.
-- Defaults: stock needed for 10 selling units of EACH active local-preorder menu
-- for a date seven days ahead. These are planning inputs, not sales forecasts.
-- Change target_units/target_day in params when reviewing another scenario.
-- No dates, quantities or stock holds are changed by this report.
WITH params AS (
    SELECT 10::numeric AS target_units,
           timezone('Asia/Kuala_Lumpur',CURRENT_TIMESTAMP)::date AS today,
           timezone('Asia/Kuala_Lumpur',CURRENT_TIMESTAMP)::date+7 AS target_day
), menus AS (
    SELECT p.id,p.name FROM django_app.myapp_product p
    WHERE p.selling_status='active' AND coalesce(p.selling_details->>'ordering_mode','local_preorder')='local_preorder'
), requirements AS (
    SELECT pi.raw_material_id,sum(pi.quantity_required*p.target_units) AS required,
           array_agg(DISTINCT m.name ORDER BY m.name) AS menus
    FROM menus m JOIN django_app.myapp_productingredient pi ON pi.product_id=m.id
    CROSS JOIN params p WHERE pi.quantity_required>0 GROUP BY pi.raw_material_id
), stock AS (
    SELECT i.raw_material_id,
           coalesce(sum(i.quantity) FILTER (WHERE i.quantity>0 AND NOT i.quarantined
               AND i.received_date<=p.today AND i.expiry_date>=p.target_day),0) AS eligible,
           coalesce(sum(i.quantity) FILTER (WHERE i.quantity>0),0) AS recorded,
           count(*) FILTER (WHERE i.quantity>0 AND i.expiry_date<p.target_day) AS batches_expiring_before_target,
           count(*) FILTER (WHERE i.quantity>0 AND i.quarantined) AS held_batches,
           jsonb_agg(jsonb_build_object('id',i.id,'code',i.batch_code,'quantity',i.quantity,
             'received',i.received_date,'deadline',i.expiry_date,'held',i.quarantined,
             'storage',i.storage_location,'storage_type',i.storage_type) ORDER BY i.id) AS batches
    FROM django_app.myapp_inventoryitem i CROSS JOIN params p GROUP BY i.raw_material_id
), packaging AS (
    SELECT k.id,k.name,k.quantity AS recorded,k.is_active,
        CASE WHEN k.is_active THEN k.quantity ELSE 0 END AS eligible,
        sum(pp.quantity_per_item*p.target_units) AS required
    FROM menus m JOIN django_app.myapp_productpackaging pp ON pp.product_id=m.id
    JOIN django_app.myapp_packagingitem k ON k.id=pp.packaging_item_id CROSS JOIN params p
    GROUP BY k.id
), report AS (
    SELECT r.id,r.name,r.unit,req.required,coalesce(s.eligible,0) AS eligible,
        greatest(req.required-coalesce(s.eligible,0),0) AS to_receive,
        coalesce(s.recorded,0) AS recorded,coalesce(s.batches_expiring_before_target,0) AS batches_expiring_before_target,
        coalesce(s.held_batches,0) AS held_batches,req.menus,
        coalesce(s.batches,'[]'::jsonb) AS batches,r.storage_guidance
    FROM requirements req JOIN django_app.myapp_rawmaterial r ON r.id=req.raw_material_id
    LEFT JOIN stock s ON s.raw_material_id=r.id
)
SELECT (SELECT today FROM params) AS checked_on,
       (SELECT target_day FROM params) AS stock_needed_through,
       (SELECT target_units FROM params) AS target_units_per_menu,
       (SELECT count(*) FROM menus) AS active_menus,
       (SELECT count(*) FROM report WHERE to_receive>0) AS ingredients_to_replenish,
       coalesce((SELECT jsonb_agg(to_jsonb(report) ORDER BY name) FROM report),'[]'::jsonb) AS ingredient_report,
       coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) ORDER BY m.id) FROM menus m
         WHERE NOT EXISTS (SELECT 1 FROM django_app.myapp_productingredient pi WHERE pi.product_id=m.id)),'[]'::jsonb) AS menus_without_recipes,
       coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'required',required,'eligible',eligible,
         'recorded',recorded,'active',is_active,'to_receive',greatest(required-eligible,0)) ORDER BY name) FROM packaging),'[]'::jsonb) AS packaging_report,
       coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) ORDER BY m.id) FROM menus m
         WHERE EXISTS (SELECT 1 FROM django_app.myapp_productingredient pi WHERE pi.product_id=m.id AND pi.quantity_required<=0)),'[]'::jsonb) AS menus_with_invalid_recipe_quantities;
