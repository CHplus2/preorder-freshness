-- One-time correction for the existing fictional inventory in schema django_app.
-- Run the whole statement in Supabase SQL Editor. No migration is required.
-- Only the two known placeholder locations on recognised sample batch IDs change.
-- Storage type, dates, quantities, costs, holds and provenance remain untouched.
-- A zero-quantity audit entry retains the old/new location for each changed row.
-- Busy batches cause a safe failure (NOWAIT); retry once editing/cooking finishes.
WITH candidates AS MATERIALIZED (
    SELECT i.id, i.batch_code, i.updated_at, r.name AS ingredient,
           i.storage_location AS old_location,
           CASE
             WHEN i.storage_type = 'frozen' AND lower(r.name) LIKE '%chicken%'
               THEN 'Freezer A - Lower basket - Poultry box'
             WHEN i.storage_type = 'frozen'
               THEN 'Freezer A - Upper basket - Ingredient box'
             WHEN i.storage_type = 'chilled' AND lower(r.name) LIKE '%chicken%'
               THEN 'Fridge A - Bottom shelf - Poultry box'
             WHEN i.storage_type = 'chilled' AND lower(r.name) ~ '(butter|milk|chocolate)'
               THEN 'Fridge A - Middle shelf - Chilled ingredients tray'
             WHEN i.storage_type = 'chilled' AND lower(r.name) IN ('egg', 'eggs')
               THEN 'Fridge A - Middle shelf - Egg tray'
             WHEN i.storage_type = 'chilled' AND lower(r.name) ~ '(cabbage|bean|carrot|cucumber|leaf|pandan|ginger)'
               THEN 'Fridge A - Vegetable drawer - Labelled box'
             WHEN i.storage_type = 'chilled'
               THEN 'Fridge A - Upper shelf - Sealed ingredient box'
             WHEN lower(r.name) LIKE '%chicken%'
               THEN 'Receiving area - Poultry box - Storage review'
             WHEN lower(r.name) IN ('onion', 'garlic')
               THEN 'Pantry A - Ventilated produce basket'
             WHEN lower(r.name) ~ '(oil|sauce)'
               THEN 'Pantry A - Middle shelf - Bottles tray'
             ELSE 'Pantry A - Dry goods shelf - Sealed container'
           END AS new_location
    FROM django_app.myapp_inventoryitem i
    JOIN django_app.myapp_rawmaterial r ON r.id = i.raw_material_id
    WHERE (i.batch_code ~ '^DEMO-FC-INV-[0-9]+-(NEAR|RESERVE)$'
           OR i.batch_code ~ '^FRESHCAST-DEMO-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+$')
      AND i.storage_location IN (
          'FICTIONAL DEMO stock - storage unverified',
          'Fictional demo stock — not a physical stock count'
      )
      AND i.storage_type IN ('chilled', 'frozen', 'ambient')
    FOR UPDATE OF i NOWAIT
), changed AS (
    UPDATE django_app.myapp_inventoryitem i
    SET storage_location = c.new_location, updated_at = CURRENT_TIMESTAMP
    FROM candidates c
    WHERE i.id = c.id AND i.updated_at = c.updated_at
      AND i.storage_location = c.old_location
    RETURNING i.id, c.batch_code, c.ingredient, c.old_location, c.new_location
), audited AS (
    INSERT INTO django_app.myapp_inventorylog
        (inventory_item_id, change, reason, reference, admin_id, created_at)
    SELECT id, 0,
           jsonb_build_object('storage_before', old_location, 'storage_after', new_location)::text,
           'Sample storage layout correction v1', NULL, CURRENT_TIMESTAMP
    FROM changed
    RETURNING inventory_item_id
)
SELECT count(*) AS updated_batches,
       coalesce(jsonb_agg(jsonb_build_object(
           'batch_id', c.id, 'batch', c.batch_code, 'ingredient', c.ingredient,
           'before', c.old_location, 'after', c.new_location
       ) ORDER BY c.id), '[]'::jsonb) AS location_changes
FROM changed c JOIN audited a ON a.inventory_item_id = c.id;
