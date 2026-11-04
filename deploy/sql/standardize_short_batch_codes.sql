-- Run the COMPLETE statement in Supabase SQL Editor. No migration is required.
-- Correct only short CHK references such as chk-1 or CHK-5. Proper supplier,
-- historical and sample references are preserved. Quantities, dates, ingredient
-- IDs, allocation snapshots, costs, locations and holds do not change.
-- The suffix is the unchanged inventory row ID, padded to at least 3 digits.
-- Conflicting destination codes are skipped and returned for review.
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
    WHERE trim(i.batch_code) ~* '^CHK-[0-9]{1,6}$'
    FOR UPDATE OF i NOWAIT
), checked AS MATERIALIZED (
    SELECT c.*, EXISTS (SELECT 1 FROM django_app.myapp_inventoryitem other
        WHERE other.id<>c.id AND lower(other.batch_code)=lower(c.new_code)) AS conflict
    FROM candidates c
), changed AS (
    UPDATE django_app.myapp_inventoryitem i SET batch_code=c.new_code,updated_at=CURRENT_TIMESTAMP
    FROM checked c WHERE i.id=c.id AND i.batch_code=c.old_code AND NOT c.conflict
    RETURNING i.id,c.old_code,c.new_code
), audited AS (
    INSERT INTO django_app.myapp_inventorylog (inventory_item_id,change,reason,reference,admin_id,created_at)
    SELECT id,0,'Batch code changed from ' || old_code || ' to ' || new_code,
        'Batch reference correction',NULL,CURRENT_TIMESTAMP FROM changed
    RETURNING inventory_item_id
)
SELECT (SELECT count(*) FROM audited) AS corrected_batches,
       coalesce((SELECT jsonb_agg(jsonb_build_object('batch_id',id,'before',old_code,'after',new_code) ORDER BY id)
           FROM changed),'[]'::jsonb) AS corrections,
       coalesce((SELECT jsonb_agg(jsonb_build_object('batch_id',id,'current',old_code,'conflicting_code',new_code) ORDER BY id)
           FROM checked WHERE conflict),'[]'::jsonb) AS needs_review;
