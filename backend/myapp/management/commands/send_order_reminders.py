from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from myapp.models import Order, OrderReminder


class Command(BaseCommand):
    help = 'Preview upcoming owner reminders. --send delivers email using configured SMTP. Run one worker every 15 minutes.'

    def add_arguments(self, parser):
        parser.add_argument('--send', action='store_true')

    def handle(self, *args, **options):
        if options['send'] and (not settings.OWNER_NOTIFICATION_EMAIL or settings.EMAIL_BACKEND != 'django.core.mail.backends.smtp.EmailBackend'):
            raise CommandError('Configure OWNER_NOTIFICATION_EMAIL and SMTP EMAIL_BACKEND before sending.')
        now = timezone.now()
        for order in Order.objects.exclude(status__in=['cancelled','delivered']):
            for event in ('preparation_at', 'delivery_at'):
                when = getattr(order,event)
                if not when or when > now + timedelta(hours=24):
                    continue
                if event == 'preparation_at' and order.status not in ('pending','processing'):
                    continue
                if OrderReminder.objects.filter(order=order,event=event).exists():
                    continue
                message = f'Order #{order.id}: {event.replace("_at", "")} due {timezone.localtime(when):%d %b %Y %H:%M} Malaysia time. Open your kitchen planner to review.'
                if options['send']:
                    count = send_mail('Dapur Kita: upcoming order', message, settings.DEFAULT_FROM_EMAIL, [settings.OWNER_NOTIFICATION_EMAIL])
                    if count:
                        OrderReminder.objects.create(order=order,event=event)
                        self.stdout.write(f'Sent order #{order.id}: {event}')
                else:
                    self.stdout.write('PREVIEW: '+message)
