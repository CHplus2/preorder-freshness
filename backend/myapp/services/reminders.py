from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ..models import Order, OrderReminder

def email_ready():
    return bool(settings.OWNER_NOTIFICATION_EMAIL and settings.EMAIL_HOST and
                settings.EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend')

def send_due_reminders(limit=3):
    """Bounded worker. Row locks prevent overlapping workers sending the same event."""
    now = timezone.now()
    lower, upper = now-timedelta(hours=24), now+timedelta(hours=24)
    due = Order.objects.exclude(status__in=['cancelled','delivered']).filter(
        Q(preparation_at__range=(lower, upper)) | Q(delivery_at__range=(lower, upper)))
    sent = failed = attempted = 0
    for pk in due.order_by('delivery_at').values_list('pk', flat=True):
        for event in ('preparation_at', 'delivery_at'):
            if attempted >= limit:
                return {'sent': sent, 'failed': failed}
            with transaction.atomic():
                order = Order.objects.select_for_update(skip_locked=True).filter(pk=pk).first()
                if not order or order.status in ('cancelled','delivered'):
                    continue
                when = getattr(order, event)
                if not when or not lower <= when <= upper:
                    continue
                if event == 'preparation_at' and order.status != 'pending':
                    continue
                if OrderReminder.objects.filter(order=order,event=event).exists():
                    continue
                attempted += 1
                message = f'Order #{order.pk}: {event.replace("_at", "")} due {timezone.localtime(when):%d %b %Y %H:%M} Malaysia time. Review your kitchen planner.'
                try:
                    count = send_mail('Kitchen order reminder', message, settings.DEFAULT_FROM_EMAIL,
                                      [settings.OWNER_NOTIFICATION_EMAIL])
                except Exception:
                    failed += 1
                    continue
                if count:
                    OrderReminder.objects.create(order=order,event=event)
                    sent += 1
                else:
                    failed += 1
    return {'sent': sent, 'failed': failed}
