-- Back up the private database, then run this complete file in Supabase SQL Editor.
DO $menu_photo_0022$
BEGIN
    PERFORM set_config('lock_timeout', '10s', true);
    LOCK TABLE django_app.django_migrations IN EXCLUSIVE MODE;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0021_product_selling_details') THEN
        RAISE EXCEPTION 'Migration 0021 must be completed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM django_app.django_migrations
        WHERE app='myapp' AND name='0022_menu_photo') THEN
        CREATE TABLE django_app.myapp_menuphoto (
            digest varchar(64) PRIMARY KEY,
            content bytea NOT NULL,
            width integer NOT NULL CHECK (width >= 0),
            height integer NOT NULL CHECK (height >= 0),
            created_at timestamp with time zone NOT NULL
        );
        INSERT INTO django_app.django_migrations (app, name, applied)
            VALUES ('myapp', '0022_menu_photo', CURRENT_TIMESTAMP);
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='django_app' AND table_name='myapp_menuphoto'
            AND column_name='content' AND data_type='bytea' AND is_nullable='NO') THEN
        RAISE EXCEPTION 'Recorded migration does not match photo storage. Stop and review.';
    END IF;
END
$menu_photo_0022$;
SELECT app, name, applied FROM django_app.django_migrations
WHERE app='myapp' AND name='0022_menu_photo';
