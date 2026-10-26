from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from myapp.models import Order, OrderReminder
from myapp.services.reminders import email_ready, customer_email_ready, customer_due, dispatch_due, time_due, send_due_reminders

class Command(BaseCommand):
    help = 'Preview owner and opted-in customer reminders. --send attempts up to 3 emails in total.'

    def add_arguments(self, parser):
        parser.add_argument('--send', action='store_true')

    def handle(self, *args, **options):
        if options['send']:
            if not (email_ready() or customer_email_ready()):
                raise CommandError('Configure SMTP and an owner email or customer reminder origin.')
            self.stdout.write(str(send_due_reminders(include_owner=email_ready(), include_customer=customer_email_ready())))
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

        for order in customer_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer reminder for order #{order.pk} (recipient not displayed).')

        for order in dispatch_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer dispatch update for order #{order.pk} (recipient not displayed).')

        for order in time_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer time update for order #{order.pk} (recipient not displayed).')
