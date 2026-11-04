from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from myapp.services.reminders import email_ready, customer_email_ready, customer_due, dispatch_due, time_due, send_due_reminders, owner_due, owner_events

class Command(BaseCommand):
    help = 'Preview kitchen reminders and saved customer email subscriptions. --send attempts up to 3 emails in total.'

    def add_arguments(self, parser):
        parser.add_argument('--send', action='store_true')

    def handle(self, *args, **options):
        if options['send']:
            if not (email_ready() or customer_email_ready()):
                raise CommandError('Configure SMTP and an owner email or customer reminder origin.')
            self.stdout.write(str(send_due_reminders(include_owner=email_ready(), include_customer=customer_email_ready())))
            return
        now = timezone.now()
        for order in owner_due(now)[:100]:
            for field, _receipt in owner_events(order):
                label = 'preparation' if field == 'preparation_at' else 'collection' if order.delivery_method == 'pickup' else 'delivery'
                self.stdout.write(f'PREVIEW: Order #{order.pk}: {label} due {timezone.localtime(getattr(order,field)):%d %b %Y %I:%M %p} Malaysia time.')

        for order in customer_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer reminder for order #{order.pk} (recipient not displayed).')

        for order in dispatch_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer dispatch update for order #{order.pk} (recipient not displayed).')

        for order in time_due(now)[:100]:
            self.stdout.write(f'PREVIEW: Customer time update for order #{order.pk} (recipient not displayed).')
