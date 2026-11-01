-- Client-feedback batch 2. Back up the private database, then run this complete file.
-- Apply 0024_packaging_stock first. No order status, stock quantity or historical plan is rewritten.
DO $simple_0025$
BEGIN
    PERFORM set_config('lock_timeout', '10s', true);
    PERFORM set_config('search_path', 'django_app,pg_catalog', true);
    LOCK TABLE django_app.django_migrations IN EXCLUSIVE MODE;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0024_packaging_stock') THEN
        RAISE EXCEPTION 'Migration 0024_packaging_stock must be completed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0025_simple_ordering') THEN
        -- Retained database defaults also support inserts by the previous release
        -- during the interval between applying this migration and deploying the code.
        ALTER TABLE myapp_ingredientconsumption ADD COLUMN allocation_stage varchar(12) DEFAULT 'preparation' NOT NULL;
        ALTER TABLE myapp_ingredientconsumption ADD COLUMN returned_at timestamp with time zone NULL;
        ALTER TABLE myapp_order ADD COLUMN ordering_mode varchar(12) DEFAULT 'scheduled' NOT NULL;
        ALTER TABLE myapp_order ADD COLUMN stock_returned_at timestamp with time zone NULL;
        ALTER TABLE myapp_storefront ADD COLUMN ordering_mode varchar(12) DEFAULT 'simple' NOT NULL;
        INSERT INTO django_app.django_migrations (app,name,applied)
            VALUES ('myapp','0025_simple_ordering',CURRENT_TIMESTAMP);
    END IF;
    IF EXISTS (SELECT 1 FROM (VALUES
        ('myapp_ingredientconsumption','allocation_stage','preparation'),
        ('myapp_order','ordering_mode','scheduled'),
        ('myapp_storefront','ordering_mode','simple')) AS required(tbl,col,val)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema='django_app' AND c.table_name=required.tbl AND c.column_name=required.col
              AND c.data_type='character varying' AND c.character_maximum_length=12 AND c.is_nullable='NO'
              AND c.column_default=quote_literal(required.val)||'::character varying')) THEN
        RAISE EXCEPTION 'Ordering columns or retained defaults do not match 0025. Stop and review.';
    END IF;
    IF EXISTS (SELECT 1 FROM (VALUES ('myapp_ingredientconsumption','returned_at'),
        ('myapp_order','stock_returned_at')) AS required(tbl,col)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema='django_app' AND c.table_name=required.tbl AND c.column_name=required.col
              AND c.data_type='timestamp with time zone' AND c.is_nullable='YES')) THEN
        RAISE EXCEPTION 'Stock-return timestamp columns do not match 0025. Stop and review.';
    END IF;
END
$simple_0025$;
SELECT app,name,applied FROM django_app.django_migrations
WHERE app='myapp' AND name='0025_simple_ordering';
