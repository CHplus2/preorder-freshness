"""Reviewed shared reservations for identical, not-yet-started commitments."""
from copy import deepcopy
from hashlib import sha256
import json
from types import SimpleNamespace
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from .commitments import scheduled_item
from .fulfilment import order_store
from .scheduling import AvailabilitySnapshot, booked_tasks, capacity_bookings, schedule_order
from ..models import Order, KitchenBlock


def guard_shared(order):
    if order.preparation_plan.get('shared_batch'):
        raise ValidationError('This order shares a cooking reservation. Open Shared cooking in Planner and separate the batch before changing individual preparation or delivery times.')


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, default=str, separators=(',', ':')).encode()).hexdigest()


def compatibility(order, store):
    items = list(order.items.select_related('product').prefetch_related('accepted_ingredients'))
    if len(items) != 1 or items[0].product_id is None or not items[0].preparation_snapshot:
        raise ValidationError('Only single-menu orders with accepted preparation and ingredient records can share a cooking reservation.')
    item = items[0]
    ingredients = sorted((r.raw_material_id, str(r.quantity_per_portion), r.unit) for r in item.accepted_ingredients.all())
    if not ingredients:
        raise ValidationError('Accepted ingredient records are needed before combining orders.')
    settings = order_store(store, order)
    key = digest([item.product_id, item.preparation_snapshot, ingredients, order.delivery_at, settings.delivery_buffer_minutes])
    return key, item, settings


def build_plans(orders, store, now, mode):
    active = [o for o in orders if o.status != 'cancelled']
    if not active:
        raise ValidationError('No active orders remain in this batch.')
    for order in active:
        if order.status != 'pending' or order.inventory_deducted or order.payment_status == 'refunded' or not order.delivery_at or order.delivery_at <= now:
            raise ValidationError('Use pending future orders that have not started cooking or had ingredients deducted.')
    checked = [compatibility(o, store) for o in active]
    if mode == 'combine':
        if any(o.preparation_plan.get('shared_batch') or o.preparation_plan.get('needs_review')
               or not o.preparation_plan.get('tasks') or not o.preparation_at or not o.preparation_end_at
               or o.preparation_at <= now or o.preparation_end_at <= o.preparation_at
               or o.preparation_end_at > o.delivery_at for o in active):
            raise ValidationError('Confirm future individual plans first; started, unconfirmed or already shared orders cannot be combined.')
        if len({key for key, _, _ in checked}) != 1 or len(active) != len(orders):
            raise ValidationError('Use the same menu, accepted recipe/settings, delivery time and dispatch buffer. Other orders keep independent plans.')
    else:
        shared = orders[0].preparation_plan.get('shared_batch')
        if not shared or sorted(shared['order_ids']) != sorted(o.pk for o in orders) or any(o.preparation_plan.get('shared_batch') != shared for o in orders):
            raise ValidationError('Select every original order in the same shared batch before separating it.')
        if any(o.preparation_at <= now for o in active):
            raise ValidationError('This batch’s preparation time has started. Confirm actual work before changing its reservation.')
    excluded = [o.pk for o in orders]
    # All other commitments remain immutable. Use the kitchen-wide lock in the caller.
    others = Order.objects.filter(status__in=['pending', 'processing'], inventory_deducted=False).exclude(pk__in=excluded)
    busy = booked_tasks(others, store)
    busy.extend(dict(start=b.start_at, end=b.end_at, resource='all', worker=True) for b in KitchenBlock.objects.all())
    work = [(active, checked[0][1], checked[0][2])] if mode == 'combine' else [([o], item, settings) for o, (_, item, settings) in zip(active, checked)]
    result = {}
    for members, item, settings in work:
        scheduled = scheduled_item(item)
        if mode == 'combine':
            scheduled = SimpleNamespace(product=scheduled.product, product_id=item.product_id, quantity=sum(o.items.get().quantity for o in members))
        order = members[0]
        from django.utils import timezone
        day = timezone.localtime(order.delivery_at).date()
        # Re-evaluate dates in the configured kitchen timezone, independent of server OS.
        booked = dict(capacity_bookings([item.product_id]).filter(order__delivery_at__date=day).exclude(order_id__in=[o.pk for o in members]).values('product_id').annotate(n=Sum('quantity')).values_list('product_id', 'n'))
        snapshot = AvailabilitySnapshot(day, frozenset([item.product_id]), booked, tuple(busy), order.pk)
        plan = schedule_order([scheduled], order.delivery_at, settings, now=now, exclude_order_id=order.pk,
            notice_from=max(o.created_at for o in members), availability=snapshot)
        for member in members:
            result[member.pk] = deepcopy(plan)
        from django.utils.dateparse import parse_datetime
        busy.extend(dict(t, start=parse_datetime(t['start']), end=parse_datetime(t['end'])) for t in plan['tasks'])
    return result
