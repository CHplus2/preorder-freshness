-- Back up the private database, then run this complete file in Supabase SQL Editor.
-- Additive only: existing ingredients start with no guidance; stock is unchanged.
DO $storage_guidance_0023$
BEGIN
    PERFORM set_config('lock_timeout', '10s', true);
    LOCK TABLE django_app.django_migrations IN EXCLUSIVE MODE;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0022_menu_photo') THEN
        RAISE EXCEPTION 'Migration 0022 must be completed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0023_raw_material_storage_guidance') THEN
        ALTER TABLE django_app.myapp_rawmaterial ADD COLUMN storage_guidance jsonb DEFAULT '[]'::jsonb NOT NULL;
        ALTER TABLE django_app.myapp_rawmaterial ALTER COLUMN storage_guidance DROP DEFAULT;
        INSERT INTO django_app.django_migrations (app, name, applied)
            VALUES ('myapp', '0023_raw_material_storage_guidance', CURRENT_TIMESTAMP);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='django_app' AND table_name='myapp_rawmaterial'
            AND column_name='storage_guidance' AND data_type='jsonb'
            AND is_nullable='NO' AND column_default IS NULL) THEN
        RAISE EXCEPTION 'Recorded migration does not match storage guidance. Stop and review.';
    END IF;
END
$storage_guidance_0023$;
SELECT app, name, applied FROM django_app.django_migrations
WHERE app='myapp' AND name='0023_raw_material_storage_guidance';
