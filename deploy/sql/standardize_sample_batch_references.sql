-- Verified on isolated PostgreSQL 16 on 5 November 2026.
-- No production database was accessed or changed during verification.
-- Optional correction of recognised older sample references, schema django_app.
-- First review preview_sample_batch_references.sql. Run this WHOLE script in
-- Supabase SQL Editor only for the already-authorised simulated inventory.
-- This is not a migration and does not add stock or attest physical quantities.
-- Supplier/other batch codes are untouched. Quantities, dates, holds, locations,
-- costs, ingredient IDs, allocations, payment and order histories stay fixed.
-- A zero-quantity log retains each original code and its sample provenance.
-- Busy rows fail safely (NOWAIT); collisions/missing received dates are skipped
-- and returned for review. Repeating the script makes no duplicate corrections.
-- No ALTER TABLE, RLS changes, migration edits or trigger disabling occurs.
-- SET CONSTRAINTS prevents deferred audit events from affecting later SQL runs.
SET CONSTRAINTS ALL IMMEDIATE;

WITH candidates AS MATERIALIZED (
    SELECT i.id, i.batch_code AS old_code,
           (CASE WHEN upper(trim(r.name)) LIKE 'CHICKEN%' THEN 'CHK'
                 WHEN upper(trim(r.name))='RICE' THEN 'RCE'
                 WHEN upper(trim(r.name))='SALT' THEN 'SLT'
                 ELSE rpad(left(regexp_replace(upper(r.name),'[^A-Z]','','g'),3),3,'X') END)
             || '-' || to_char(i.received_date,'YYYYMMDD') || '-'
             || CASE WHEN i.id<1000 THEN lpad(i.id::text,3,'0') ELSE i.id::text END AS new_code
    FROM django_app.myapp_inventoryitem i
    JOIN django_app.myapp_rawmaterial r ON r.id=i.raw_material_id
    WHERE (trim(i.batch_code) ~ '^DEMO-FC-INV-[0-9]+-(NEAR|RESERVE)$'
        OR trim(i.batch_code) ~ '^FRESHCAST-DEMO-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+$')
    FOR UPDATE OF i NOWAIT
), checked AS MATERIALIZED (
    SELECT c.*, EXISTS (SELECT 1 FROM django_app.myapp_inventoryitem other
        WHERE other.id<>c.id AND lower(other.batch_code)=lower(c.new_code)) AS conflict
    FROM candidates c
), changed AS (
    UPDATE django_app.myapp_inventoryitem i SET batch_code=c.new_code,updated_at=CURRENT_TIMESTAMP
    FROM checked c WHERE i.id=c.id AND i.batch_code=c.old_code AND NOT c.conflict AND c.new_code IS NOT NULL
    RETURNING i.id,c.old_code,c.new_code
), audited AS (
    INSERT INTO django_app.myapp_inventorylog (inventory_item_id,change,reason,reference,admin_id,created_at)
    SELECT id,0,'Batch code changed from ' || old_code || ' to ' || new_code,
        'Sample reference correction v2',NULL,CURRENT_TIMESTAMP FROM changed
    RETURNING inventory_item_id
)
SELECT (SELECT count(*) FROM audited) AS corrected_batches,
       coalesce((SELECT jsonb_agg(jsonb_build_object('batch_id',id,'before',old_code,'after',new_code) ORDER BY id)
           FROM changed),'[]'::jsonb) AS corrections,
       coalesce((SELECT jsonb_agg(jsonb_build_object('batch_id',id,'current',old_code,'conflicting_code',new_code) ORDER BY id)
           FROM checked WHERE conflict OR new_code IS NULL),'[]'::jsonb) AS needs_review;
