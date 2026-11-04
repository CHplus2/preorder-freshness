from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q, Exists, OuterRef, F, Value, CharField, Case, When, BooleanField, IntegerField, DateTimeField, DurationField, ExpressionWrapper, Subquery, Count
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Concat, Lower, MD5, Substr, Coalesce
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .recovery_email import reset_origin
from django.utils import timezone
from ..models import Order, OrderReminder, OrderAmendment, Storefront

def confirmed_order():
    return (Q(ordering_mode='simple', inventory_deducted=True) |
        (Q(ordering_mode='scheduled', preparation_at__isnull=False, preparation_end_at__isnull=False) &
         (Q(preparation_plan__needs_review=False) | Q(preparation_plan__needs_review__isnull=True))))

def email_ready():
    return bool(settings.OWNER_NOTIFICATION_EMAIL and settings.EMAIL_HOST and
                settings.EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend')

def reminder_ordering_mode():
    # Reading reminder status must not create or modify kitchen settings.
    return Storefront.objects.filter(pk=1).values_list('ordering_mode', flat=True).first() or 'simple'


def owner_due(now=None, *, preparation_enabled=None):
    """One authoritative queue for preview, status and the locked sender."""
    now = now or timezone.now()
    if preparation_enabled is None:
        preparation_enabled = reminder_ordering_mode() == 'scheduled'
    lower, upper = now-timedelta(hours=24), now+timedelta(hours=24)
    notified = OrderReminder.objects.filter(order_id=OuterRef('pk'))
    changes = OrderAmendment.objects.filter(order_id=OuterRef('pk'), after__change_type='delivery_time').order_by('-created_at', '-pk')
    key = Concat(Value('od'), Substr(MD5(Cast('delivery_at', output_field=CharField())), 1, 18), output_field=CharField())
    rows = Order.objects.exclude(status__in=['cancelled', 'delivered']).annotate(
        owner_delivery_event=Case(When(ordering_mode='simple', then=key), default=Value('delivery_at'), output_field=CharField()),
        owner_time_changed=Coalesce(Subquery(changes.values('created_at')[:1]), F('created_at')))
    rows = rows.annotate(
        owner_prep_notified=Exists(notified.filter(event='preparation_at')),
        owner_delivery_notified=Exists(notified.filter(event=OuterRef('owner_delivery_event'))),
        # Preserve old successful receipts on upgrade. A later audited time
        # change can receive a reminder without deleting or rewriting history.
        owner_legacy_delivery_notified=Exists(notified.filter(event='delivery_at', sent_at__gte=OuterRef('owner_time_changed'))))
    rows = rows.annotate(
        owner_delivery_pending=Case(When(delivery_at__range=(lower, upper), owner_delivery_notified=False,
            owner_legacy_delivery_notified=False, then=Value(True)), default=Value(False), output_field=BooleanField()),
        owner_preparation_pending=Case(When(ordering_mode='scheduled', preparation_at__range=(lower, upper), status='pending',
            owner_prep_notified=False, then=Value(preparation_enabled)), default=Value(False), output_field=BooleanField()))
    return rows.filter(Q(owner_delivery_pending=True) | Q(owner_preparation_pending=True)).order_by('delivery_at', 'pk')


def owner_queue_counts(*, preparation_enabled=None):
    return owner_due(preparation_enabled=preparation_enabled).aggregate(
        delivery=Count('pk', filter=Q(owner_delivery_pending=True)),
        preparation=Count('pk', filter=Q(owner_preparation_pending=True)))


def owner_events(order):
    if order.owner_preparation_pending:
        yield 'preparation_at', 'preparation_at'
    if order.owner_delivery_pending:
        yield 'delivery_at', order.owner_delivery_event


def _send_owner_reminders(limit=3):
    """Bounded worker. Row locks prevent overlapping workers sending the same event."""
    preparation_enabled = reminder_ordering_mode() == 'scheduled'
    sent = failed = attempted = 0
    for pk in owner_due(preparation_enabled=preparation_enabled).values_list('pk', flat=True)[:limit]:
        with transaction.atomic():
            # Recheck eligibility after obtaining the order lock. Another worker,
            # an actual receipt or a changed delivery time may have won first.
            order = (owner_due(preparation_enabled=preparation_enabled)
                .select_for_update(skip_locked=True, of=('self',)).filter(pk=pk).first())
            if not order:
                continue
            for event, receipt in owner_events(order):
                if attempted >= limit:
                    return {'sent': sent, 'failed': failed}
                when = getattr(order, event)
                label = 'preparation' if event == 'preparation_at' else 'collection' if order.delivery_method == 'pickup' else 'delivery'
                message = (f'Order #{order.pk}: {label} due {timezone.localtime(when):%d %b %Y %I:%M %p} Malaysia time. '
                    'Review the order and coordinate the handover. This reminder does not mark payment or receipt.'
                    if event == 'delivery_at' else
                    f'Order #{order.pk}: preparation due {timezone.localtime(when):%d %b %Y %I:%M %p} Malaysia time. Review your kitchen orders.')
                origin = reset_origin()
                if origin:
                    message += f'\n{origin}/admin/orders?order={order.pk}'
                attempted += 1
                try:
                    count = send_mail(f'Kitchen {label} reminder — order #{order.pk}', message, settings.DEFAULT_FROM_EMAIL,
                                      [settings.OWNER_NOTIFICATION_EMAIL])
                except Exception:
                    failed += 1
                    continue
                if count:
                    OrderReminder.objects.create(order=order, event=receipt)
                    sent += 1
                else:
                    failed += 1
    return {'sent': sent, 'failed': failed}


def customer_email_ready():
    return bool(settings.EMAIL_HOST and reset_origin() and
                settings.EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend')


def reminder_preference(user, enabled, *, dispatch_updates=False, time_updates=False):
    """Only an account's own registered address may receive its order reminders."""
    email = (user.email or '').strip().lower()
    if enabled:
        validate_email(email)
    saved = {'enabled': enabled, 'email': email if enabled else ''}
    if enabled and dispatch_updates:
        saved['dispatch_updates'] = True
    if enabled and time_updates:
        saved['time_updates'] = True
    return saved


def customer_due(now=None):
    now = now or timezone.now()
    # Use a dated recipient key, rather than a permanent order-level flag, so a
    # changed delivery time gets its own receipt. MD5 here identifies an event;
    # it is not an authentication credential or a cryptographic signature.
    legacy_key = Concat(Value('ce'), Substr(MD5(Concat(
        Cast('delivery_at', output_field=CharField()), Value('|'), Lower('user__email'),
        output_field=CharField())), 1, 18), output_field=CharField())
    minutes = Coalesce(Cast(KeyTextTransform('arrival_window_minutes', 'fulfilment_snapshot'), output_field=IntegerField()), Value(0))
    key = Case(When(fulfilment_snapshot__arrival_window_minutes__gt=0,
        then=Concat(Value('ce'), Substr(MD5(Concat(Cast('delivery_at', output_field=CharField()), Value('|'),
            Lower('user__email'), Value('|'), Cast(minutes, output_field=CharField()), output_field=CharField())), 1, 18), output_field=CharField())),
        default=legacy_key, output_field=CharField())
    reminder_at = ExpressionWrapper(F('delivery_at')-ExpressionWrapper(minutes*Value(timedelta(minutes=1)), output_field=DurationField()), output_field=DateTimeField())
    receipts = OrderReminder.objects.filter(order_id=OuterRef('pk'), event=OuterRef('customer_event'))
    return (Order.objects.filter(status__in=['pending', 'processing', 'cooked', 'shipped'],
            delivery_at__gt=now, user__is_active=True,
            fulfilment_snapshot__customer_reminder__enabled=True)
        .filter(confirmed_order())
        .exclude(user__email='')
        .annotate(reminder_at=reminder_at, customer_event=key, current_email=Lower('user__email'),
                  reminder_email=KeyTextTransform('email', 'fulfilment_snapshot__customer_reminder'),
                  dispatch_email=KeyTextTransform('email', 'fulfilment_snapshot__dispatch_notice'),
                  dispatch_key=KeyTextTransform('key', 'fulfilment_snapshot__dispatch_notice'))
        .alias(dispatch_applies=Case(When(status='shipped', fulfilment_snapshot__customer_reminder__dispatch_updates=True,
                    dispatch_email=F('current_email'), dispatch_key__isnull=False, then=Value(True)),
                    default=Value(False), output_field=BooleanField()))
        .filter(reminder_email=F('current_email'), dispatch_applies=False, reminder_at__gt=now, reminder_at__lte=now+timedelta(hours=2))
        .annotate(customer_notified=Exists(receipts)).filter(customer_notified=False)
        .order_by('delivery_at', 'pk'))


def _send_customer_reminders(limit):
    sent = failed = 0
    now = timezone.now()
    for pk in customer_due(now).values_list('pk', flat=True)[:limit]:
        with transaction.atomic():
            # Lock only the order: joined users are not locked, avoiding a lock
            # order inversion with checkout's user -> kitchen -> order sequence.
            order = (customer_due().select_for_update(skip_locked=True, of=('self',))
                     .filter(pk=pk).select_related('user').first())
            if not order:
                continue
            email = order.fulfilment_snapshot['customer_reminder']['email']
            try:
                validate_email(email)
            except ValidationError:
                continue
            pickup = order.delivery_method == 'pickup'
            label = 'collection' if pickup else 'delivery'
            from .arrival_windows import label as arrival_label
            when = arrival_label(order)
            message = (f'Your order #{order.pk} is scheduled for {label} on {when}.\n\n'
                + ('Please be ready to collect your order.' if pickup else
                   'Please arrange for someone to receive your food. This is the agreed time, not live courier arrival information.')
                + f'\nCheck your order or contact the kitchen if arrangements need to change:\n{reset_origin()}/orders\n\n'
                  'This reminder does not change your order or payment. You can turn off reminders in My orders.')
            try:
                count = send_mail(f'Your food {label} reminder — order #{order.pk}', message,
                                  settings.DEFAULT_FROM_EMAIL, [email])
            except Exception:
                failed += 1
                continue
            if count:
                OrderReminder.objects.create(order=order, event=order.customer_event)
                sent += 1
            else:
                failed += 1
    return {'sent': sent, 'failed': failed}


def send_due_reminders(limit=3, *, include_owner=True, include_customer=None):
    """Share a bounded SMTP budget; reserve room for owner work when both are due."""
    if limit < 1:
        return {'sent': 0, 'failed': 0}
    include_customer = customer_email_ready() if include_customer is None else include_customer
    result = {'sent': 0, 'failed': 0}
    def run(worker, budget):
        counts = worker(budget)
        for name in result:
            result[name] += counts[name]
        return sum(counts.values())
    customer_attempts = run(_send_customer_messages, min(2, limit)) if include_customer else 0
    remaining = limit-customer_attempts
    if include_owner and remaining:
        remaining -= run(_send_owner_reminders, remaining)
    # Fill idle owner capacity, but do not retry failed customer mail in the same run.
    if include_customer and remaining and customer_attempts and not result['failed']:
        run(_send_customer_messages, remaining)
    return result


def queue_dispatch_notice(order):
    """Called under the status-change transaction, without making a network call."""
    from uuid import uuid4
    preference = order.fulfilment_snapshot.get('customer_reminder', {})
    if preference.get('enabled') is not True or preference.get('dispatch_updates') is not True:
        return
    order.fulfilment_snapshot = dict(order.fulfilment_snapshot, dispatch_notice={
        'key': 'ds'+uuid4().hex[:18], 'created_at': timezone.now().isoformat(),
        'email': preference.get('email', ''), 'delivery_at': order.delivery_at.isoformat() if order.delivery_at else None})


def dispatch_due(now=None):
    now = now or timezone.now()
    receipts = OrderReminder.objects.filter(order_id=OuterRef('pk'), event=OuterRef('dispatch_event'))
    return (Order.objects.filter(status='shipped', user__is_active=True,
            fulfilment_snapshot__customer_reminder__enabled=True,
            fulfilment_snapshot__customer_reminder__dispatch_updates=True)
        .exclude(delivery_method='pickup').exclude(user__email='')
        .annotate(current_email=Lower('user__email'),
                  reminder_email=KeyTextTransform('email', 'fulfilment_snapshot__customer_reminder'),
                  notice_email=KeyTextTransform('email', 'fulfilment_snapshot__dispatch_notice'),
                  dispatch_event=KeyTextTransform('key', 'fulfilment_snapshot__dispatch_notice'),
                  notice_created=Cast(KeyTextTransform('created_at', 'fulfilment_snapshot__dispatch_notice'), output_field=CharField()))
        .filter(reminder_email=F('current_email'), notice_email=F('current_email'),
                notice_created__gte=(now-timedelta(hours=24)).isoformat(), notice_created__lte=now.isoformat())
        .annotate(dispatch_notified=Exists(receipts)).filter(dispatch_notified=False)
        .order_by('notice_created', 'pk'))


def _send_dispatch_notices(limit):
    sent = failed = 0
    for pk in dispatch_due().values_list('pk', flat=True)[:limit]:
        with transaction.atomic():
            order = dispatch_due().select_for_update(skip_locked=True, of=('self',)).filter(pk=pk).first()
            if not order:
                continue
            email = order.fulfilment_snapshot['dispatch_notice']['email']
            try:
                validate_email(email)
            except ValidationError:
                continue
            from django.utils.dateparse import parse_datetime
            recorded = parse_datetime(order.fulfilment_snapshot['dispatch_notice']['created_at'])
            stamp = timezone.localtime(recorded).strftime('%d %b %Y, %I:%M %p')
            message = (f'The kitchen marked order #{order.pk} out for delivery at {stamp} Malaysia time.\n\n'
                'Please arrange for someone to receive your food. Check the kitchen-entered tracking link, if available, in My orders. '
                'The courier may contact you; this message does not provide a live arrival estimate.\n'
                f'{reset_origin()}/orders\n\n'
                'Contact the kitchen if you cannot receive the order. You can turn off dispatch emails in My orders.')
            try:
                count = send_mail(f'Your food is out for delivery — order #{order.pk}', message,
                                  settings.DEFAULT_FROM_EMAIL, [email])
            except Exception:
                failed += 1
                continue
            if count:
                OrderReminder.objects.create(order=order, event=order.dispatch_event)
                sent += 1
            else:
                failed += 1
    return {'sent': sent, 'failed': failed}


def _send_customer_messages(limit):
    result = _send_dispatch_notices(limit)
    remaining = limit-sum(result.values())
    if remaining:
        times = _send_time_notices(remaining)
        for key in result:
            result[key] += times[key]
        remaining -= sum(times.values())
    if remaining:
        reminders = _send_customer_reminders(remaining)
        for key in result:
            result[key] += reminders[key]
    return result


def queue_time_notice(order):
    from uuid import uuid4
    preference = order.fulfilment_snapshot.get('customer_reminder', {})
    if (preference.get('enabled') is not True or preference.get('time_updates') is not True
            or not (order.ordering_mode == 'simple' and order.inventory_deducted or
                    order.ordering_mode == 'scheduled' and not order.preparation_plan.get('needs_review') and order.preparation_end_at)):
        return
    order.fulfilment_snapshot = dict(order.fulfilment_snapshot, time_notice={
        'key': 'tc'+uuid4().hex[:18], 'created_at': timezone.now().isoformat(), 'email': preference.get('email', '')})


def time_due(now=None):
    now = now or timezone.now()
    receipts = OrderReminder.objects.filter(order_id=OuterRef('pk'), event=OuterRef('time_event'))
    return (Order.objects.filter(status__in=['pending','processing','cooked'], user__is_active=True,
            delivery_at__gt=now,
            fulfilment_snapshot__customer_reminder__enabled=True, fulfilment_snapshot__customer_reminder__time_updates=True)
        .filter(confirmed_order())
        .annotate(current_email=Lower('user__email'),
                  reminder_email=KeyTextTransform('email', 'fulfilment_snapshot__customer_reminder'),
                  notice_email=KeyTextTransform('email', 'fulfilment_snapshot__time_notice'),
                  time_event=KeyTextTransform('key', 'fulfilment_snapshot__time_notice'),
                  notice_created=Cast(KeyTextTransform('created_at', 'fulfilment_snapshot__time_notice'), output_field=CharField()))
        .filter(reminder_email=F('current_email'), notice_email=F('current_email'),
                notice_created__gte=(now-timedelta(hours=24)).isoformat(), notice_created__lte=now.isoformat())
        .annotate(time_notified=Exists(receipts)).filter(time_notified=False).order_by('notice_created','pk'))


def _send_time_notices(limit):
    sent = failed = 0
    for pk in time_due().values_list('pk', flat=True)[:limit]:
        with transaction.atomic():
            order = time_due().select_for_update(skip_locked=True, of=('self',)).filter(pk=pk).first()
            if not order:
                continue
            email = order.fulfilment_snapshot['time_notice']['email']
            try:
                validate_email(email)
            except ValidationError:
                continue
            from .arrival_windows import label
            text = (f'The kitchen has recorded an updated confirmed time for order #{order.pk}.\n\n'
                f'Current {"collection" if order.delivery_method == "pickup" else "delivery"}: {label(order)}.\n'
                'Please check the latest details and change history in My orders. Contact the kitchen if this arrangement does not work for you.\n'
                f'{reset_origin()}/orders\n\nThis message does not change payment or confirm a live courier arrival estimate.')
            try:
                count = send_mail(f'Updated order time — order #{order.pk}', text, settings.DEFAULT_FROM_EMAIL, [email])
            except Exception:
                failed += 1
                continue
            if count:
                OrderReminder.objects.create(order=order, event=order.time_event)
                sent += 1
            else:
                failed += 1
    return {'sent':sent,'failed':failed}
