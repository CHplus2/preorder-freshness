-- Verified on isolated PostgreSQL 16 on 5 November 2026.
-- No production database was accessed or changed during verification.
-- Read-only preview. No row, date, quantity or audit entry is changed.
-- Exact known sample patterns only; supplier references remain untouched.
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
), checked AS MATERIALIZED (
    SELECT c.*, EXISTS (SELECT 1 FROM django_app.myapp_inventoryitem other
        WHERE other.id<>c.id AND lower(other.batch_code)=lower(c.new_code)) AS conflict
    FROM candidates c
 )
SELECT id AS batch_id,old_code AS before,new_code AS after,
       CASE WHEN new_code IS NULL THEN 'Received date needs review'
            WHEN conflict THEN 'Destination code already exists'
            ELSE 'Ready for reference correction' END AS review
FROM checked ORDER BY id;
