"""Owner-reviewed future dates for fictional requests, not historical sales repair."""
import hashlib
import json
from collections import Counter
from datetime import datetime, time, timedelta
from uuid import uuid4

from django.core import signing
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ..models import Order, OrderAmendment, OrderItem, Product, Storefront
from ..services.commitments import scheduled_item
from ..services.initial_delivery import initial_delivery_plan
from ..services.scheduling import plan_snapshot
from .rescheduling import eligibility, CUTOFF_HOURS

SALT = 'fictional-missing-delivery-batch-v1'
REASON = 'Fictional demo request: future delivery date assigned from an owner-reviewed batch.'


def context(store, now):
    orders = list(Order.objects.filter(delivery_at__isnull=True, status__in=['pending', 'processing'])
        .prefetch_related('items__product', 'items__consumption').order_by('pk'))
    if len(orders) > 50:
        raise ValidationError('This demo repair supports up to 50 open requests at a time. Review the order list first.')
    product_ids = {item.product_id for order in orders for item in order.items.all() if item.product_id}
    bookings = list(OrderItem.objects.filter(order__delivery_at__gte=now,
        order__delivery_at__lte=now+timedelta(days=90)).exclude(order__status='cancelled')
        .annotate(day=TruncDate('order__delivery_at')).values('day', 'product_id')
        .annotate(quantity=Sum('quantity')).order_by('day', 'product_id'))
    source = {'store': list(Storefront.objects.filter(pk=store.pk).values()), 'orders': [],
              'products': list(Product.objects.filter(pk__in=product_ids).order_by('pk').values()),
              'bookings': bookings}
    for order in orders:
        source['orders'].append({
            'id': order.pk, 'updated_at': order.updated_at, 'status': order.status,
            'payment_status': order.payment_status, 'inventory_deducted': order.inventory_deducted,
            'preparation_at': order.preparation_at, 'preparation_end_at': order.preparation_end_at,
            'preparation_plan': order.preparation_plan,
            'items': [{'id': item.pk, 'product': item.product_id, 'name': item.product_name,
                       'quantity': item.quantity, 'preparation_snapshot': item.preparation_snapshot,
                       'consumption': [row.pk for row in item.consumption.all()]}
                      for item in order.items.all()]})
    fingerprint = hashlib.sha256(json.dumps(source, default=str, sort_keys=True).encode()).hexdigest()
    counts = Counter({(row['day'], row['product_id']): row['quantity'] for row in bookings})
    return orders, fingerprint, counts


def blocked_reason(order, items, now):
    _, blocked = eligibility(order, now, allow_initial=True)
    if blocked:
        return blocked
    if not items or any(item.product_id is None for item in items):
        return 'Menu references are missing. Review this order individually.'
    if any(item.product.selling_status == 'archived' for item in items):
        return 'This request contains archived menus; review it individually.'
    if any(item.consumption.all() for item in items):
        return 'Ingredient consumption is already recorded; review the existing work.'
    return ''


def propose(orders, store, now, counts):
    proposed, skipped = [], []
    used_days = set()
    today = timezone.localdate(now)
    for order in orders:
        items = list(order.items.all())
        reason = blocked_reason(order, items, now)
        if reason:
            skipped.append({'order_id': order.pk, 'reason': reason})
            continue
        planning = [scheduled_item(item) if item.preparation_snapshot else item for item in items]
        quantities = Counter()
        capacities = {}
        for item in planning:
            quantities[item.product_id] += item.quantity
            capacities[item.product_id] = item.product.daily_capacity
        earliest = now + timedelta(hours=max(CUTOFF_HOURS, max(item.product.lead_hours for item in planning)),
                                   minutes=store.delivery_buffer_minutes)
        chosen = None
        for day_offset in range(1, 91):
            day = today + timedelta(days=day_offset)
            if day in used_days:
                continue
            candidate = timezone.make_aware(datetime.combine(day, time(18)), timezone.get_current_timezone())
            if candidate <= earliest or candidate > now+timedelta(days=90):
                continue
            if any(item.product.delivery_weekdays and day.weekday() not in item.product.delivery_weekdays for item in planning):
                continue
            if any(counts[(day, product_id)]+quantity > capacities[product_id] for product_id, quantity in quantities.items()):
                continue
            # Authoritative existing validation, including notice, window and current bookings.
            initial_delivery_plan(items, candidate, store, order.pk, now)
            chosen = candidate
            used_days.add(day)
            counts.update({(day, product_id): quantity for product_id, quantity in quantities.items()})
            break
        if chosen is None:
            skipped.append({'order_id': order.pk, 'reason': 'No compatible 18:00 delivery date within 90 days satisfies these menus, notice and daily limits.'})
            continue
        proposed.append({'order_id': order.pk, 'delivery_at': chosen.isoformat(),
                         'payment_status': order.payment_status,
                         'menus': [{'name': item.product_name, 'quantity': item.quantity} for item in items]})
    return proposed, skipped


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def missing_delivery_dates(request):
    store = Storefront.objects.select_for_update().filter(pk=1).first()
    if not store:
        raise ValidationError('Kitchen settings must exist before assigning delivery dates.')
    token = request.data.get('confirm')
    previous = None
    if token is not None:
        if request.data.get('confirm_fictional') is not True:
            raise ValidationError('Confirm that these are fictional demo requests before applying dates.')
        if not isinstance(token, str) or len(token) > 80000:
            raise ValidationError('Invalid date preview. Calculate it again.')
        try:
            previous = signing.loads(token, salt=SALT, max_age=600)
        except signing.BadSignature:
            raise ValidationError('This date preview expired or is invalid. Calculate it again.') from None
        if previous['actor'] != request.user.pk:
            raise ValidationError('This preview belongs to another owner account.')
        expected_ids = [row['order_id'] for row in previous['dates']]
        applied = OrderAmendment.objects.filter(actor=request.user, after__batch_request_id=previous['request_id'])
        if applied.exists():
            if set(applied.values_list('order_id', flat=True)) != set(expected_ids):
                return Response({'detail': 'Batch audit is incomplete. Review the order records before retrying.'}, status=409)
            return Response({'mode': 'applied', 'updated_order_ids': expected_ids, 'already_applied': True,
                             'remaining_missing_dates': Order.objects.filter(delivery_at__isnull=True, status__in=['pending', 'processing']).count()})
        # Match checkout lock order. All existing orders participate in capacity checks.
        list(Order.objects.select_for_update().order_by('pk'))
        list(Product.objects.select_for_update().order_by('pk'))
    now = timezone.now()
    orders, fingerprint, counts = context(store, now)
    if previous:
        if previous['fingerprint'] != fingerprint:
            return Response({'detail': 'Orders, menus or capacity changed. Calculate and review a new preview.'}, status=409)
        by_id = {order.pk: order for order in orders}
        for row in previous['dates']:
            order = by_id[row['order_id']]
            items = list(order.items.all())
            reason = blocked_reason(order, items, now)
            if reason:
                raise ValidationError(reason)
            target = parse_datetime(row['delivery_at'])
            if target <= now+timedelta(hours=CUTOFF_HOURS):
                raise ValidationError('A proposed date is now too close. Calculate a new preview.')
            plan = initial_delivery_plan(items, target, store, order.pk, now)
            before = {'delivery_at': None, 'preparation_at': order.preparation_at,
                      'preparation_end_at': order.preparation_end_at, 'plan': order.preparation_plan}
            order.delivery_at = target
            order.preparation_plan = dict(plan_snapshot(plan), maintenance_source='fictional_demo')
            order.save(update_fields=['delivery_at', 'preparation_plan', 'updated_at'])
            OrderAmendment.objects.create(order=order, actor=request.user, before=before,
                after={'kind': 'delivery_change', 'actor_role': 'owner', 'reason': REASON,
                       'delivery_at': target.isoformat(), 'maintenance_source': 'fictional_demo',
                       'request_id': str(uuid4()), 'batch_request_id': previous['request_id']})
        return Response({'mode': 'applied', 'updated_order_ids': [row['order_id'] for row in previous['dates']],
                         'already_applied': False,
                         'remaining_missing_dates': Order.objects.filter(delivery_at__isnull=True, status__in=['pending', 'processing']).count()})
    dates, skipped = propose(orders, store, now, counts)
    return Response({'mode': 'preview', 'proposed_dates': dates, 'skipped': skipped,
        'confirm': signing.dumps({'actor': request.user.pk, 'fingerprint': fingerprint,
                                  'request_id': str(uuid4()), 'dates': dates}, salt=SALT, compress=True),
        'note': 'Fictional demo dates at 18:00 Malaysia time, spread across different days. Payment and fulfilment stay unchanged. Preparation is not reserved and must still be reviewed.'})
