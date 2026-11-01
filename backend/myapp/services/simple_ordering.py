"""Delivery and dated-stock validation without cooking-time reservations.

All stock writes run in the checkout/order transaction. Historical scheduling
records remain separate; calendar time never marks an order received.
"""
from collections import defaultdict
from datetime import timedelta, time
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from ..models import InventoryItem, ProductIngredient, IngredientConsumption, InventoryLog, PackagingItem, OrderPackaging, OrderAmendment
from .preorder_windows import ordering_issue
from .fulfilment import hours


def simple(store):
    return getattr(store, 'ordering_mode', 'simple') == 'simple'


def validate_delivery(items, delivery_at, store, now=None, accepted=False):
    now = now or timezone.now()
    items = list(items)
    if not items:
        raise ValidationError('Your basket is empty.')
    if not delivery_at or timezone.is_naive(delivery_at) or not now < delivery_at <= now + timedelta(days=90):
        raise ValidationError('Choose a future delivery time within the next 90 days.')
    local = timezone.localtime(delivery_at)
    first, last = hours(store)
    if not time(first) <= local.time() <= time(last):
        raise ValidationError(f'Choose a time between {first:02d}:00 and {last:02d}:00 Malaysia time.')
    from .arrival_windows import validate_window
    validate_window(delivery_at, store, now)
    from .selling import require_local_preorder
    for item in items:
        product = item.product
        if not accepted:
            require_local_preorder(product)
            if product.selling_status != 'active':
                raise ValidationError(f'{product.name} is not accepting new orders.')
        issue = ordering_issue(product, local.date(), now)
        if issue:
            raise ValidationError(issue)
        weekdays = getattr(product, 'delivery_weekdays', [])
        if weekdays and local.weekday() not in weekdays:
            raise ValidationError(f'{product.name} is not offered on this day. Choose one of its delivery days.')
    # No kitchen hours, lead-before-preparation, equipment, wait, step duration,
    # daily preparation capacity or cooking plan is consulted in simple mode.
    return dict(start=None, end=None, tasks=[], needs_review=False, ordering_mode='simple',
        stock_deduction_stage='placement', delivery_buffer_minutes=0)


def eligible_stock(day):
    return InventoryItem.objects.filter(quantity__gt=0, received_date__lte=timezone.localdate(),
        expiry_date__gte=max(day, timezone.localdate()), quarantined=False)


def check_cart_ingredients(items, delivery_at):
    quantities = {i.product_id: i.quantity for i in items}
    names = {i.product_id: i.product.name for i in items}
    mapped, needed, labels = set(), defaultdict(Decimal), {}
    for row in ProductIngredient.objects.filter(product_id__in=quantities).select_related('raw_material'):
        if row.quantity_required <= 0:
            raise ValidationError(f'The kitchen needs to review the recipe for {names[row.product_id]}.')
        mapped.add(row.product_id)
        needed[row.raw_material_id] += row.quantity_required * quantities[row.product_id]
        labels[row.raw_material_id] = (row.raw_material.name, row.raw_material.unit)
    missing = set(quantities) - mapped
    if missing:
        raise ValidationError(f'The kitchen needs to complete the ingredient recipe for {names[min(missing)]} before accepting orders.')
    day = timezone.localtime(delivery_at).date()
    available = dict(eligible_stock(day).filter(raw_material_id__in=needed).values('raw_material_id')
        .annotate(total=Sum('quantity')).values_list('raw_material_id', 'total'))
    for key, quantity in needed.items():
        if available.get(key, Decimal('0')) < quantity:
            name, unit = labels[key]
            raise ValidationError(f'Not enough {name} for this delivery date. Choose fewer items or contact the kitchen. Only received, unheld stock within its recorded dates is counted.')


def deduct_at_placement(order, actor):
    from ..views.orders import deduct_order_inventory
    deduct_order_inventory(order, actor, deadline=timezone.localtime(order.delivery_at).date(), stage='placement')
    order.inventory_deducted = True
    order.save(update_fields=['inventory_deducted', 'updated_at'])


def check_accepted_stock(order, delivery_at):
    """A changed date cannot extend the deadline of already allocated lots."""
    day = timezone.localtime(delivery_at).date()
    for row in IngredientConsumption.objects.filter(order_item__order=order, returned_at__isnull=True).select_related('inventory_item'):
        if row.inventory_item.quarantined or day > min(row.recorded_expiry, row.inventory_item.expiry_date):
            raise ValidationError('Allocated ingredients do not cover that delivery date. Contact the kitchen to review stock before changing the time.')


def return_unused_stock(order, actor):
    """Explicit owner assertion only; never infer that cancelled food was unused."""
    if order.stock_returned_at:
        return
    if order.ordering_mode != 'simple' or order.status != 'pending' or not order.inventory_deducted:
        raise ValidationError('Only an unreceived order with placement allocations can return stock here. Record other stock corrections in Inventory.')
    rows = list(IngredientConsumption.objects.filter(order_item__order=order, allocation_stage='placement',
        returned_at__isnull=True).order_by('inventory_item__raw_material_id', 'recorded_expiry', 'inventory_item_id', 'pk'))
    if not rows:
        raise ValidationError('No recorded ingredient allocation is available to return.')
    # Match checkout's packaging -> ingredient lock order.
    packages = OrderPackaging.objects.filter(order_item__order=order, allocated_at__isnull=False, released_at__isnull=True)
    list(PackagingItem.objects.select_for_update().filter(pk__in=packages.values('packaging_item_id')).order_by('pk'))
    stock = {b.pk: b for b in InventoryItem.objects.select_for_update().filter(pk__in={r.inventory_item_id for r in rows})
        .order_by('raw_material_id', 'expiry_date', 'received_date', 'pk')}
    now = timezone.now()
    for row in rows:
        batch = stock[row.inventory_item_id]
        batch.quantity += row.quantity
        batch.save(update_fields=['quantity', 'updated_at'])
        row.returned_at = now
        row.save(update_fields=['returned_at'])
        InventoryLog.objects.create(inventory_item=batch, change=row.quantity,
            reason='Owner confirmed unused stock returned after cancellation', reference=f'Order #{order.pk}', admin=actor)
    from .packaging import release_packaging
    release_packaging(order, actor)
    order.stock_returned_at = now
    # inventory_deducted stays true: it is the historical deduction fact. The
    # return timestamp/ledger distinguishes reversal without allowing rededuction.


def simple_slots(items, day, store, limit=3, now=None, find_next=False):
    from datetime import datetime
    from .packaging import check_cart_packaging
    from .arrival_windows import window, duration
    now = now or timezone.now()
    today = timezone.localtime(now).date()
    first = max(day or today, today)
    if first > today + timedelta(days=90):
        raise ValidationError('Choose a date within the next 90 days.')
    last = min(first+timedelta(days=6 if find_next else 0), today+timedelta(days=90))
    items = list(items)
    if not items:
        raise ValidationError('Your basket is empty.')
    result = dict(slots=[], suggested_date=None, searched_from=first.isoformat(),
        searched_through=last.isoformat(), searched_days=(last-first).days+1,
        earliest_preparation_at=None, delivery_request_after=now.isoformat(), ordering_mode='simple',
        unavailable_code='', unavailable_reason='No suitable times were found. Check the offered dates and current stock.')
    opening, closing = hours(store)
    for offset in range((last-first).days+1):
        stock_checked = False
        selected_day = first+timedelta(days=offset)
        for hour in range(opening, closing+1):
            delivery = timezone.make_aware(datetime.combine(selected_day, time(hour)))
            try:
                validate_delivery(items, delivery, store, now=now)
                if not stock_checked:
                    check_cart_packaging(items)
                    check_cart_ingredients(items, delivery)
                    stock_checked = True
            except ValidationError as error:
                result['unavailable_reason'] = ' '.join(str(s) for s in error.detail)
                if delivery > now and ('Not enough' in result['unavailable_reason'] or 'recipe' in result['unavailable_reason']):
                    break
                continue
            result['slots'].append(dict(delivery_at=delivery.isoformat(), arrival_window=window(delivery,duration(store)),
                preparation_at=None, preparation_end_at=None, hands_on_minutes=0))
            if len(result['slots']) >= limit:
                break
        if result['slots']:
            result.update(suggested_date=selected_day.isoformat(), searched_through=selected_day.isoformat(),
                searched_days=offset+1, unavailable_reason='')
            return result
    return result
