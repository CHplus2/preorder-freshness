"""Private, consistent logical backup of Django-managed kitchen records."""
import gzip
import hashlib
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil

from django import get_version
from django.apps import apps
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connection, transaction
from django.db.migrations.recorder import MigrationRecorder

ROOT = Path(__file__).resolve().parents[4]
EXCLUDED = ['contenttypes.contenttype', 'auth.permission', 'sessions.session']


class Command(BaseCommand):
    help = 'Export application records without changing the database. Private files must stay outside Git.'

    def add_arguments(self, parser):
        parser.add_argument('--output', required=True, type=Path, help='New directory outside the checkout.')

    def handle(self, *args, **options):
        output = options['output'].expanduser().resolve()
        if output.is_relative_to(ROOT):
            raise CommandError('Choose a backup directory outside the repository.')
        if output.exists():
            raise CommandError('Choose a new backup directory; existing backups are never overwritten.')
        output.mkdir(parents=True, mode=0o700)
        try:
            with transaction.atomic():
                if connection.vendor == 'postgresql':
                    with connection.cursor() as cursor:
                        cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
                migrations = sorted([list(pair) for pair in MigrationRecorder(connection).applied_migrations()])
                counts = {}
                for model in apps.get_models():
                    if model._meta.label_lower in EXCLUDED or model._meta.proxy:
                        continue
                    count = model._base_manager.count()
                    if count:counts[model._meta.label_lower] = count
                counts = dict(sorted(counts.items()))
                fixture = output / 'kitchen.json.gz'
                # All managers includes records hidden by custom default managers.
                with fixture.open('xb') as raw:
                    os.chmod(fixture, 0o600)
                    with gzip.GzipFile(fileobj=raw, mode='wb', mtime=0) as compressed:
                        with io.TextIOWrapper(compressed, encoding='utf-8') as stream:
                            call_command('dumpdata', use_base_manager=True, use_natural_foreign_keys=True,
                                exclude=EXCLUDED, indent=2, stdout=stream, verbosity=0)
            with fixture.open('rb') as stream:
                digest = hashlib.file_digest(stream,'sha256').hexdigest()
            manifest = {'format': 'freshcast-kitchen-logical-backup-v1',
                'created_at': datetime.now(timezone.utc).isoformat(),
                'django_version': get_version(), 'database_vendor': connection.vendor,
                'record_count': sum(counts.values()), 'model_counts': counts,
                'migrations': migrations, 'excluded_models': EXCLUDED,
                'files': {'kitchen.json.gz': {'sha256': digest, 'bytes': fixture.stat().st_size}},
                'scope': 'Django-managed records and relationships. Not a PostgreSQL physical or full Supabase project backup.',
                'limitations': ['Sessions are excluded; users must sign in again.',
                    'Content types and permissions are recreated by migrations.',
                    'Supabase auth/storage schemas, database roles, custom SQL, external media and environment secrets are not included.',
                    'Contains private user and business records, including password hashes. Keep outside Git and public storage.']}
            for name, content in [('manifest.json', json.dumps(manifest, indent=2)+'\n'),
                                  ('SHA256SUMS', digest+'  kitchen.json.gz\n')]:
                with (output/name).open('x', encoding='utf-8') as stream:
                    os.chmod(output/name, 0o600)
                    stream.write(content)
        except Exception:
            shutil.rmtree(output)
            raise CommandError('Kitchen backup failed; partial files were removed. Check database access and the Django schema. No database changes were requested.') from None
        self.stdout.write(json.dumps({'mode': 'backed_up', 'output': str(output),
            'record_count': sum(counts.values()), 'model_counts': counts, 'sha256': digest,
            'scope': manifest['scope']}))
