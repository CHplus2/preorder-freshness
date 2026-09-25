from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from myapp.models import Order, OrderReminder
from myapp.services.reminders import email_ready, send_due_reminders

class Command(BaseCommand):
    help = 'Preview owner reminders. --send attempts up to 3 emails using configured SMTP.'

    def add_arguments(self, parser):
        parser.add_argument('--send', action='store_true')

    def handle(self, *args, **options):
        if options['send']:
            if not email_ready():
                raise CommandError('Configure SMTP host, SMTP backend and owner email.')
            self.stdout.write(str(send_due_reminders()))
            return
        now = timezone.now()
        for order in Order.objects.exclude(status__in=['cancelled','delivered']):
            for event in ('preparation_at', 'delivery_at'):
                when = getattr(order,event)
                if not when or not now-timedelta(hours=24) <= when <= now+timedelta(hours=24):
                    continue
                if event == 'preparation_at' and order.status != 'pending':
                    continue
                if OrderReminder.objects.filter(order=order,event=event).exists():
                    continue
                self.stdout.write(f'PREVIEW: Order #{order.pk}: {event} due {timezone.localtime(when):%d %b %Y %H:%M} Malaysia time.')
