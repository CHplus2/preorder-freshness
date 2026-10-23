-- Batch 3: optional selling details. Safe to apply before publishing the new code.
-- Run this whole file in Supabase SQL Editor. No credentials are included.
DO $selling_details_0021$
BEGIN
    PERFORM set_config('lock_timeout', '10s', true);
    LOCK TABLE django_app.django_migrations IN EXCLUSIVE MODE;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0020_fulfilment_options') THEN
        RAISE EXCEPTION 'Migration 0020 must be completed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0021_product_selling_details') THEN
        ALTER TABLE django_app.myapp_product
            ADD COLUMN selling_details jsonb DEFAULT '{}'::jsonb NOT NULL;
        INSERT INTO django_app.django_migrations (app, name, applied)
            VALUES ('myapp', '0021_product_selling_details', CURRENT_TIMESTAMP);
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='django_app' AND table_name='myapp_product'
            AND column_name='selling_details' AND data_type='jsonb' AND is_nullable='NO') THEN
        RAISE EXCEPTION 'Recorded migration does not match the expected column. Stop and review.';
    END IF;
    -- Keep the database default so the previous app can still create menus
    -- during deployment. This also repairs an earlier copy that dropped it.
    ALTER TABLE django_app.myapp_product
        ALTER COLUMN selling_details SET DEFAULT '{}'::jsonb;
END
$selling_details_0021$;

SELECT app, name, applied FROM django_app.django_migrations
WHERE app='myapp' AND name='0021_product_selling_details';
