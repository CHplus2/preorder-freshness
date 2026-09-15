from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, InventoryItem, OrderItem


@api_view(['GET'])
@permission_classes([IsAdminUser])
def planning(request):
    orders = Order.objects.exclude(status__in=['cancelled', 'delivered']).order_by('preparation_at', 'id')
    batches = list(InventoryItem.objects.filter(quantity__gt=0, quarantined=False,
        expiry_date__gte=timezone.localdate(), received_date__lte=timezone.localdate()).order_by('expiry_date','id'))
    remaining = {b.id: b.quantity for b in batches}
    shopping = []
    for order in orders:
        if order.inventory_deducted:
            continue
        day = timezone.localtime(order.preparation_at).date() if order.preparation_at else timezone.localdate()
        needs = defaultdict(Decimal)
        materials = {}
        for item in order.items.select_related('product'):
            if item.product:
                for ingredient in item.product.ingredients.select_related('raw_material'):
                    key = ingredient.raw_material_id
                    materials[key] = ingredient.raw_material
                    needs[key] += ingredient.quantity_required * item.quantity
        for key, need in needs.items():
            for batch in batches:
                if batch.raw_material_id == key and batch.expiry_date >= day:
                    used = min(remaining[batch.id], need)
                    remaining[batch.id] -= used
                    need -= used
            if need > 0:
                shopping.append({'order': order.id, 'material': materials[key].name,
                    'quantity': str(need), 'unit': materials[key].unit, 'needed_by': str(day)})
    since = timezone.now() - timedelta(days=28)
    history = OrderItem.objects.filter(order__payment_status='paid', order__created_at__gte=since).exclude(order__status='cancelled')
    units = history.aggregate(n=Sum('quantity'))['n'] or 0
    paid = Order.objects.filter(payment_status='paid', created_at__gte=since).exclude(status='cancelled')
    net = paid.aggregate(n=Sum('total_amount'))['n'] or Decimal('0')
    count = paid.count()
    trend = []
    for offset in range(6,-1,-1):
        day = timezone.localdate() - timedelta(days=offset)
        value = paid.filter(created_at__date=day).aggregate(n=Sum('total_amount'))['n'] or Decimal('0')
        trend.append({'date': str(day), 'sales': str(value)})
    return Response({'analytics': {'net_food_sales': str(net), 'paid_orders': count,
        'average_order_value': str(round(net/count,2) if count else 0), 'trend': trend}, 'shopping': shopping, 'forecast': {'next_7_days_portions': round(units / 4, 1),
        'observed_portions_28_days': units, 'method': '28-day average × 7 days; planning estimate, not a guarantee.'}})
