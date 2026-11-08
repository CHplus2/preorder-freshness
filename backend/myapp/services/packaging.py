"""Accepted packaging and retry-safe physical stock allocation.

Callers hold an atomic order/product lock. Stock rows are locked by ascending ID.
A review-only request has snapshots but no allocation. Historical orders without
snapshots remain unchanged. Payment verification is independent of allocation.
"""
from decimal import Decimal
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from ..models import OrderPackaging, PackagingItem, PackagingMovement, ProductPackaging


def capture_packaging(item):
    requirements = list(item.product.packaging_requirements.select_related('packaging_item').order_by('packaging_item_id'))
    if not requirements:
        return
    OrderPackaging.objects.bulk_create([
        OrderPackaging(order_item=item, packaging_item=row.packaging_item,
            packaging_name=row.packaging_item.name, quantity=row.quantity_per_item * item.quantity,
            unit_cost=row.packaging_item.unit_cost) for row in requirements
    ])
    # Tracked supplies replace the menu's estimated packaging cost in this new
    # accepted order only. Unknown supply costs stay unknown, never become zero.
    cost = (sum((row.quantity_per_item * row.packaging_item.unit_cost for row in requirements), Decimal('0'))
            if all(row.packaging_item.unit_cost is not None for row in requirements) else None)
    item.packaging_unit_cost = cost
    type(item).objects.filter(pk=item.pk).update(packaging_unit_cost=item.packaging_unit_cost)


def allocate_packaging(order, actor):
    rows = list(OrderPackaging.objects.filter(order_item__order=order, allocated_at__isnull=True,
        released_at__isnull=True).order_by('packaging_item_id', 'id'))
    if not rows:
        return
    stock = {p.pk: p for p in PackagingItem.objects.select_for_update().filter(
        pk__in={r.packaging_item_id for r in rows}).order_by('pk')}
    needed = {}
    for row in rows:
        needed[row.packaging_item_id] = needed.get(row.packaging_item_id, 0) + row.quantity
    assert_available(needed, stock)
    now = timezone.now()
    for row in rows:
        supply = stock[row.packaging_item_id]
        supply.quantity -= row.quantity
        supply.save(update_fields=['quantity', 'updated_at'])
        row.allocated_at = now
        row.save(update_fields=['allocated_at'])
        PackagingMovement.objects.create(packaging_item=supply, order_packaging=row,
            kind='allocate', change=-row.quantity, balance_after=supply.quantity,
            reason=f'Allocated to order #{order.pk}', actor=actor)


def release_packaging(order, actor, *, confirmed_unused=False):
    # Only unopened/not-yet-prepared packaging is automatically returned.
    if order.status not in ('pending', 'processing') and not (confirmed_unused
            and order.status == 'cancelled' and order.ordering_mode == 'simple' and actor.is_staff):
        return
    rows = list(OrderPackaging.objects.filter(order_item__order=order, allocated_at__isnull=False,
        released_at__isnull=True).order_by('packaging_item_id', 'id'))
    stock = {p.pk: p for p in PackagingItem.objects.select_for_update().filter(
        pk__in={r.packaging_item_id for r in rows}).order_by('pk')}
    for row in rows:
        supply = stock[row.packaging_item_id]
        supply.quantity += row.quantity
        supply.save(update_fields=['quantity', 'updated_at'])
        row.released_at = timezone.now()
        row.save(update_fields=['released_at'])
        PackagingMovement.objects.create(packaging_item=supply, order_packaging=row,
            kind='release', change=row.quantity, balance_after=supply.quantity,
            reason=('Owner confirmed unused packaging after cancellation' if confirmed_unused else
                f'Order #{order.pk} cancelled before food was ready'), actor=actor)


def assert_available(needed, stock):
    shortages = []
    for pk, quantity in needed.items():
        supply = stock[pk]
        if not supply.is_active:
            raise ValidationError(f'{supply.name} is archived. The kitchen must review this menu’s packaging before accepting the order.')
        if supply.quantity < quantity:
            shortages.append(dict(packaging_item_id=str(pk), name=supply.name, unit='pieces',
                required=str(quantity), available=str(supply.quantity), shortfall=str(quantity-supply.quantity)))
    if shortages:
        first = shortages[0]
        raise ValidationError({'code': 'packaging_stock_shortage',
            'detail': f'Not enough {first["name"]}: {first["required"]} needed, {first["available"]} available. '
                'Your basket has been kept. Contact the kitchen or reduce the quantity.',
            'shortages': shortages[:100], 'shortage_count': str(len(shortages))})


def check_cart_packaging(items):
    quantities = {row.product_id: row.quantity for row in items}
    needed, stock = {}, {}
    for row in ProductPackaging.objects.filter(product_id__in=quantities).select_related('packaging_item'):
        pk = row.packaging_item_id
        needed[pk] = needed.get(pk, 0) + row.quantity_per_item * quantities[row.product_id]
        stock[pk] = row.packaging_item
    assert_available(needed, stock)
