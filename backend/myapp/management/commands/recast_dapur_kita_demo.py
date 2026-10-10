import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import ValidationError
from scripts.import_dapur_kita import ImportErrorDetail
from myapp.services.demo_catalogue import apply_recast, plan_recast

ROOT = Path(__file__).resolve().parents[4]


class Command(BaseCommand):
    help = 'Plan or explicitly recast owner-confirmed fictional catalogue/orders; never a normal release step.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--source', default=str(ROOT / 'docs/DAPUR-KITA-STARTER-DATA.json'))
        parser.add_argument('--mapping', default=str(ROOT / 'docs/DAPUR-KITA-DEMO-ORDER-MAPPING.json'))

    def handle(self, *args, **options):
        try:
            source = json.loads(Path(options['source']).read_text())
            mapping = json.loads(Path(options['mapping']).read_text())
            if options['apply']:
                if not options['confirm_fictional'] or not options['expected_fingerprint']:
                    raise CommandError('Applying requires --confirm-fictional and --expected-fingerprint from the reviewed snapshot.')
                result = apply_recast(source, mapping, options['expected_fingerprint'])
            else:
                result = plan_recast(source, mapping)[0]
            self.stdout.write(json.dumps(result, indent=2))
        except (ValidationError, ImportErrorDetail, KeyError, ValueError, OSError) as exc:
            raise CommandError(str(exc)) from exc
