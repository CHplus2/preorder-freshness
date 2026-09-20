from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Prefetch
from django.db.models.functions import TruncDate
from ..models import ProductIngredient
from ..serializers import OrderSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, InventoryItem, OrderItem, Storefront, Product, KitchenBlock


@api_view(['GET'])
@permission_classes([IsAdminUser])
def planning(request):
    orders = list(Order.objects.exclude(status__in=['cancelled', 'delivered']).select_related('user', 'address').prefetch_related('items__product', Prefetch('items__product__ingredients', queryset=ProductIngredient.objects.select_related('raw_material'))).order_by('preparation_at', 'id'))
    batches = list(InventoryItem.objects.filter(quantity__gt=0, quarantined=False,
        expiry_date__gte=timezone.localdate(), received_date__lte=timezone.localdate()).order_by('expiry_date','id'))
    by_material = defaultdict(list)
    for batch in batches:
        by_material[batch.raw_material_id].append(batch)
    remaining = {b.id: b.quantity for b in batches}
    shopping = []
    allocations = []
    for order in orders:
        if order.inventory_deducted:
            continue
        day = timezone.localtime(order.preparation_at).date() if order.preparation_at else timezone.localdate()
        use_by = timezone.localtime(order.preparation_end_at).date() if order.preparation_end_at else day
        needs = defaultdict(Decimal)
        materials = {}
        for item in order.items.all():
            if item.product:
                for ingredient in item.product.ingredients.all():
                    key = ingredient.raw_material_id
                    materials[key] = ingredient.raw_material
                    needs[key] += ingredient.quantity_required * item.quantity
        for key, need in needs.items():
            for batch in by_material[key]:
                if need <= 0:
                    break
                if batch.raw_material_id == key and batch.expiry_date >= use_by:
                    used = min(remaining[batch.id], need)
                    if used > 0:
                        allocations.append({'order':order.id,'batch':batch.id,'material':materials[key].name,'quantity':str(used),'unit':materials[key].unit,'expiry_date':str(batch.expiry_date)})
                    remaining[batch.id] -= used
                    need -= used
            if need > 0:
                shopping.append({'order': order.id, 'material': materials[key].name,
                    'quantity': str(need), 'unit': materials[key].unit, 'needed_by': str(day)})
    from ..services.forecast import estimate
    today = timezone.localdate()
    history_start = today-timedelta(days=84)
    daily_rows = list(OrderItem.objects.filter(order__payment_status='paid', order__created_at__date__gte=history_start,
        order__created_at__date__lt=today).exclude(order__status='cancelled')
        .annotate(day=TruncDate('order__created_at')).values('day').annotate(n=Sum('quantity')).order_by('day'))
    daily_map = {row['day']:row['n'] for row in daily_rows}
    first = daily_rows[0]['day'] if daily_rows else today
    forecast = estimate([daily_map.get(first+timedelta(days=i),0) for i in range((today-first).days)])
    since = timezone.now() - timedelta(days=28)
    history = OrderItem.objects.filter(order__payment_status='paid', order__created_at__gte=since).exclude(order__status='cancelled')
    units = history.aggregate(n=Sum('quantity'))['n'] or 0
    paid = Order.objects.filter(payment_status='paid', created_at__gte=since).exclude(status='cancelled')
    net = paid.aggregate(n=Sum('total_amount'))['n'] or Decimal('0')
    count = paid.count()
    by_day = {str(r["day"]): r["n"] for r in paid.annotate(day=TruncDate("created_at")).values("day").annotate(n=Sum("total_amount"))}
    trend = []
    for offset in range(6,-1,-1):
        day = timezone.localdate() - timedelta(days=offset)
        value = by_day.get(str(day), Decimal('0'))
        trend.append({'date': str(day), 'sales': str(value)})
    store = Storefront.objects.filter(pk=1).first() or Storefront()
    setup = list(Product.objects.filter(preparation_tasks=[]).values('id', 'name'))
    availability = dict(open_hour=store.kitchen_open_hour, close_hour=store.kitchen_close_hour, blocks=list(KitchenBlock.objects.values('start_at','end_at','reason')))
    return Response({'setup_menus': setup, 'availability': availability, 'allocations': allocations, 'orders': OrderSerializer(orders, many=True).data, 'analytics': {'net_food_sales': str(net), 'paid_orders': count,
        'average_order_value': str(round(net/count,2) if count else 0), 'trend': trend}, 'shopping': shopping, 'forecast': {**forecast, 'observed_portions_28_days': units}})
