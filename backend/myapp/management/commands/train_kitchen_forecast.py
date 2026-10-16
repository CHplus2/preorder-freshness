"""Export an evaluated, refitted local model and prepared aggregate training data."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.utils import timezone
from myapp.services.kitchen_forecast import kitchen_forecast, dated_orders, monday


class Command(BaseCommand):
    help = 'Train/evaluate local delivery-based forecasts and export JSON; no order or schedule writes.'

    def add_arguments(self, parser):
        parser.add_argument('--output', required=True, type=Path)

    def handle(self, *args, **options):
        report = kitchen_forecast()
        cutoff = monday(timezone.localdate())
        # Prepared training records always have a date and its provenance. Keep
        # customer/address/payment credentials out of the saved dataset.
        report['prepared_orders'] = [
            {'order_id': o.pk, 'preorder_date': str(timezone.localtime(o.created_at).date()),
             'sales_date': str(day), 'sales_date_basis': basis,
             'portions': sum(i.quantity for i in o.items.all())}
            for o, day, basis in dated_orders()
            if o.status == 'delivered' and o.payment_status == 'paid' and day < cutoff
            and timezone.localtime(o.created_at).date() <= day
            and sum(i.quantity for i in o.items.all()) > 0]
        path = options['output']
        path.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents overwriting an earlier experiment.
        with path.open('x') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        path.chmod(0o600)
        self.stdout.write(f"{report['status']}: {report['eligible_orders']} orders, {report['history_weeks']} weeks; {path}")
