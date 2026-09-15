"""Copy this app's local data to an EMPTY private Supabase schema.

Run locally after migrations. Credentials are read from the ignored .env file.
The local SQLite database is retained. This command never overwrites a populated
remote schema and never copies browser sessions.
"""
import io
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connections
from django.utils import timezone


class Command(BaseCommand):
    help = 'Back up local data and initialise the empty django_app Supabase schema.'

    def handle(self, *args, **options):
        import dj_database_url
        import psycopg2

        if connections['default'].vendor != 'sqlite':
            raise CommandError('Run using the local SQLite database; unset DATABASE_URL first.')
        url = os.getenv('SUPABASE_DATABASE_URL')
        if not url:
            raise CommandError('Set SUPABASE_DATABASE_URL in the private backend/.env file.')
        schema = 'django_app'
        # Connection errors must not echo a URI that may contain a password.
        try:
            remote = psycopg2.connect(url, sslmode='require', connect_timeout=10)
        except Exception as exc:
            raise CommandError(f'Supabase connection failed ({type(exc).__name__}).') from None
        try:
            with remote:
                with remote.cursor() as cursor:
                    cursor.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema=%s", [schema])
                    if cursor.fetchone()[0]:
                        raise CommandError('Remote django_app schema is populated. No data was changed.')
                    cursor.execute('CREATE SCHEMA IF NOT EXISTS django_app')
                    cursor.execute('REVOKE ALL ON SCHEMA django_app FROM PUBLIC, anon, authenticated')
        finally:
            remote.close()

        output = io.StringIO()
        call_command('dumpdata', 'auth.user', 'auth.group', 'myapp',
                     natural_foreign=True, stdout=output)
        data = json.loads(output.getvalue())
        # Do not publish the local QA account or its associated test records.
        qa_ids = {row['pk'] for row in data if row['model'] == 'auth.user'
                  and row['fields'].get('username') == 'ui-review-local'}
        data = [row for row in data if not (
            row['model'] == 'auth.user' and row['pk'] in qa_ids
            or row['fields'].get('user') == ['ui-review-local'])]
        backup_dir = Path(settings.BASE_DIR) / 'backups'
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / f'supabase-transfer-{timezone.now():%Y%m%d-%H%M%S}.json'
        backup.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        database = dj_database_url.parse(url, conn_max_age=0)
        database['OPTIONS'] = {'sslmode': 'require', 'connect_timeout': 10,
                               'options': '-c search_path=django_app'}
        database['DISABLE_SERVER_SIDE_CURSORS'] = True
        # Django requires these defaults for a dynamically added alias.
        for key, value in connections.databases['default'].items():
            database.setdefault(key, value)
        connections.databases['supabase_transfer'] = database
        try:
            call_command('migrate', database='supabase_transfer', interactive=False, verbosity=0)
            call_command('loaddata', str(backup), database='supabase_transfer', verbosity=0)
            with connections['supabase_transfer'].cursor() as cursor:
                cursor.execute('SELECT count(*) FROM myapp_product')
                count = cursor.fetchone()[0]
                cursor.execute("SELECT has_schema_privilege('anon', 'django_app', 'USAGE')")
                if cursor.fetchone()[0]:
                    raise CommandError('Unexpected anonymous schema access. Do not enable this database.')
            self.stdout.write(self.style.SUCCESS(f'Supabase initialised: {count} menu items. Local backup retained.'))
            self.stdout.write('Set DATABASE_URL to the pooler URL and DATABASE_SCHEMA=django_app to use it.')
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f'Transfer stopped ({type(exc).__name__}). Backup retained; inspect remote state before retrying.') from None
        finally:
            connections['supabase_transfer'].close()
