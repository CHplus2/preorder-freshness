from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, InventoryItem, IngredientConsumption

ZERO = Decimal('0')


def money(value):
    return str(value.quantize(Decimal('0.01'))) if value is not None else None


def contribution(order):
    ingredient_cost, packaging = ZERO, ZERO
    missing = []
    trace = []
    for item in order.items.all():
        consumed = list(item.consumption.all())
        recipe = list(item.accepted_ingredients.all())
        if not order.inventory_deducted or not consumed or not recipe:
            missing.append(f'{item.product_name}: actual ingredient consumption unavailable')
        elif any(sum((c.quantity for c in consumed if c.inventory_item.raw_material_id == r.raw_material_id), ZERO)
                 != r.quantity_per_portion*item.quantity for r in recipe):
            missing.append(f'{item.product_name}: consumption does not match accepted quantities')
        for row in consumed:
            if row.unit_cost is None:
                missing.append(f'{row.material_name}: batch purchase cost unknown')
            else:
                ingredient_cost += row.quantity*row.unit_cost
            trace.append({'menu': item.product_name, 'batch': row.inventory_item_id,
                'batch_code': row.batch_code, 'material': row.material_name, 'quantity': str(row.quantity),
                'unit': row.unit, 'unit_cost': str(row.unit_cost) if row.unit_cost is not None else None,
                'recorded_expiry': row.recorded_expiry, 'consumed_at': row.created_at})
        if item.packaging_unit_cost is None:
            missing.append(f'{item.product_name}: accepted packaging cost unknown')
        else:
            packaging += item.packaging_unit_cost*item.quantity
    if not order.items.all():
        missing.append('Order items unavailable')
    # Only realised outcomes: fulfilled orders or written-off cooked cancellations.
    realised = order.status in ('delivered', 'cancelled') and order.inventory_deducted
    food_revenue = order.total_amount if order.status == 'delivered' and order.payment_status == 'paid' else ZERO
    if order.status == 'delivered' and order.payment_status == 'unpaid':
        missing.append('Payment not recorded')
    value = food_revenue-ingredient_cost-packaging if realised and not missing else None
    return {'order': order.pk, 'status': order.status, 'payment_status': order.payment_status,
        'delivery_at': order.delivery_at, 'placed_at': order.created_at,
        'net_food_revenue': money(food_revenue), 'known_ingredient_cost': money(ingredient_cost),
        'accepted_packaging_cost': money(packaging), 'food_contribution': money(value),
        'realised': realised, 'missing': sorted(set(missing)), 'trace': trace}


@api_view(['GET'])
@permission_classes([IsAdminUser])
def contribution_report(request):
    field = serializers.DateField()
    today = timezone.localdate()
    start = field.run_validation(request.query_params.get('start', str(today-timedelta(days=27))))
    end = field.run_validation(request.query_params.get('end', str(today)))
    if start > end or (end-start).days > 366:
        raise serializers.ValidationError('Choose an ordered date range of at most 367 days.')
    orders = Order.objects.filter(created_at__date__range=(start,end)).prefetch_related(
        'items__accepted_ingredients', 'items__consumption__inventory_item').order_by('-created_at')
    count = orders.count()
    rows = [contribution(o) for o in orders[:200]]
    complete = [r for r in rows if r['food_contribution'] is not None]
    return Response({'start': start, 'end': end, 'order_count': count, 'shown': len(rows), 'rows': rows,
        'known_contribution': money(sum((Decimal(r['food_contribution']) for r in complete), ZERO)),
        'complete_orders': len(complete),
        'definition': 'Cohort: order placement dates; latest 200 orders. Totals cover shown orders only. Realised food contribution = paid, delivered food revenue after discounts (zero for full refunds or cooked cancellations), minus actual batch ingredient costs and packaging cost frozen at acceptance. Excludes delivery income/cost, payment fees, labour and overhead. Not net profit. Unknown costs stay unknown; packaging is an accepted estimate.'})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def batch_trace(request, pk):
    batch = get_object_or_404(InventoryItem, pk=pk)
    rows = IngredientConsumption.objects.filter(inventory_item=batch).select_related('order_item__order').order_by('-created_at')
    return Response({'batch': batch.pk, 'batch_code': batch.batch_code,
        'orders': [{'order': r.order_item.order_id, 'menu': r.order_item.product_name,
            'quantity': str(r.quantity), 'unit': r.unit, 'consumed_at': r.created_at,
            'status': r.order_item.order.status} for r in rows],
        'note': 'Structured records cover cooking after this feature was installed. Earlier text logs may need manual review.'})
