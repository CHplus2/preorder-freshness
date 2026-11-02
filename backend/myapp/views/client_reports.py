"""Read-only client reports. Dates refer to handover in Malaysia, not placement."""
import csv
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import F, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ..models import Order, OrderItem, PaymentEvent, Storefront
from ..services.arrival_windows import duration, window
from .outcomes import csv_text

MY = ZoneInfo('Asia/Kuala_Lumpur')
ZERO = Decimal('0')
PAGE_SIZE = 50
MENU_LIMIT = 500


def money(value):
    return format((value or ZERO).quantize(Decimal('.01')), '.2f')


def operational_orders():
    # A subquery also includes rows where this JSON key is absent (SQL NULL).
    generated = Order.objects.filter(payment_instructions__freshcast_synthetic_history__version='1')
    return Order.objects.exclude(pk__in=generated.values('pk'))


def handover_dates(orders, start, end):
    lower = datetime.combine(start, time.min, MY)
    upper = datetime.combine(end + timedelta(days=1), time.min, MY)
    return orders.filter(delivery_at__gte=lower, delivery_at__lt=upper)


def menu_totals(orders):
    rows = list(OrderItem.objects.filter(order__in=orders).values('product_id', 'product_name')
                .annotate(units=Sum('quantity'), gross_food=Sum(F('quantity') * F('unit_price')))
                .order_by('product_name', 'product_id')[:MENU_LIMIT + 1])
    return [dict(product_id=row['product_id'], product_name=row['product_name'], quantity=row['units'],
                 gross_food=money(row['gross_food'])) for row in rows[:MENU_LIMIT]], len(rows) > MENU_LIMIT


def order_row(order):
    saved = order.fulfilment_snapshot
    customer = saved.get('customer', {})
    address = order.delivery_address or ({key: getattr(order.address, key) for key in
        ('recipient_name', 'phone', 'line1', 'line2', 'city', 'state', 'postal_code', 'country')}
        if order.address else {})
    return dict(id=order.pk, name=customer.get('name') or address.get('recipient_name') or order.user.username,
        delivery_at=order.delivery_at, arrival_window=window(order.delivery_at, duration(order)),
        delivery_method=order.delivery_method,
        receipt_status='cancelled' if order.status == 'cancelled' else 'received' if order.status == 'delivered' else 'not_received',
        payment_status=order.payment_status, payment_method=order.payment_method,
        food_total=money(order.total_amount), delivery_fee=money(order.shipping_fee),
        discount=money(order.discount_amount), total=money(order.total_amount + order.shipping_fee),
        items=[dict(id=item.pk, name=item.product_name, quantity=item.quantity,
                    unit_price=money(item.unit_price), food_total=money(item.unit_price * item.quantity))
               for item in order.items.all()])


class DailyInput(serializers.Serializer):
    date = serializers.DateField()
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def daily_orders(request):
    form = DailyInput(data=request.query_params)
    form.is_valid(raise_exception=True)
    day, page = form.validated_data['date'], form.validated_data['page']
    dated = handover_dates(operational_orders(), day, day)
    active = dated.exclude(status='cancelled')
    count = active.count()
    offset = (page - 1) * PAGE_SIZE
    rows = active.select_related('user', 'address').prefetch_related('items').order_by('delivery_at', 'pk')[offset:offset + PAGE_SIZE]
    menus, truncated = menu_totals(active)
    summary = active.aggregate(food=Sum('total_amount'), delivery=Sum('shipping_fee'))
    return Response(dict(date=day, page=page, page_size=PAGE_SIZE, count=count, has_more=offset + PAGE_SIZE < count,
        cancelled_count=dated.filter(status='cancelled').count(),
        received_count=active.filter(status='delivered').count(),
        quantity=OrderItem.objects.filter(order__in=active).aggregate(n=Sum('quantity'))['n'] or 0,
        food_total=money(summary['food']), delivery_fee=money(summary['delivery']),
        order_value=money((summary['food'] or ZERO) + (summary['delivery'] or ZERO)),
        menus=menus, menus_truncated=truncated, orders=[order_row(o) for o in rows]))


class PeriodInput(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()

    def validate(self, values):
        if not 0 <= (values['end'] - values['start']).days <= 365:
            raise serializers.ValidationError('Choose a date range of 1–366 days, with the end on or after the start.')
        return values


def sales_data(request):
    form = PeriodInput(data=request.query_params)
    form.is_valid(raise_exception=True)
    start, end = form.validated_data['start'], form.validated_data['end']
    dated = handover_dates(operational_orders(), start, end)
    # Sandbox captures/test-network receipts are not real business revenue.
    test_ids = PaymentEvent.objects.filter(source__in=['paypal_sandbox', 'escrow_sepolia'],
        kind='receipt', outcome='completed').values('order_id')
    eligible = dated.filter(status='delivered', payment_status='paid')
    excluded_test = eligible.filter(pk__in=test_ids).count()
    paid = eligible.exclude(pk__in=test_ids)
    totals = paid.aggregate(food=Sum('total_amount'), delivery=Sum('shipping_fee'), discount=Sum('discount_amount'))
    days = list(paid.annotate(date=TruncDate('delivery_at', tzinfo=MY)).values('date')
                .annotate(food=Sum('total_amount'), delivery=Sum('shipping_fee')).order_by('date'))
    menus, truncated = menu_totals(paid)
    return dict(start=start, end=end, paid_received_orders=paid.count(),
        net_food_sales=money(totals['food']), delivery_income=money(totals['delivery']),
        discounts=money(totals['discount']),
        total_sales=money((totals['food'] or ZERO) + (totals['delivery'] or ZERO)),
        excluded_test_orders=excluded_test,
        unpaid_received_orders=dated.filter(status='delivered', payment_status='unpaid').count(),
        unscheduled_orders=operational_orders().filter(delivery_at__isnull=True, status='delivered', payment_status='paid').count(),
        days=[dict(date=row['date'], net_food_sales=money(row['food']), delivery_income=money(row['delivery']),
                   total_sales=money((row['food'] or ZERO) + (row['delivery'] or ZERO))) for row in days],
        menus=menus, menus_truncated=truncated)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def period_sales(request):
    return Response(sales_data(request))


@api_view(['GET'])
@permission_classes([IsAdminUser])
def period_sales_csv(request):
    data = sales_data(request)
    if data['menus_truncated']:
        raise serializers.ValidationError('Choose a shorter range to export all menus (at most 500).')
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="sales-{data["start"]}-to-{data["end"]}.csv"'
    response['Cache-Control'] = 'private, no-store'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(['Paid and received orders; Malaysia handover dates; generated history and test payments excluded'])
    writer.writerow(['Start', data['start'], 'End', data['end'], 'Currency', 'MYR'])
    writer.writerow(['Orders', data['paid_received_orders'], 'Discounts', data['discounts']])
    writer.writerow(['Date', 'Net food sales', 'Delivery income', 'Total sales'])
    for row in data['days']:
        writer.writerow([row['date'], row['net_food_sales'], row['delivery_income'], row['total_sales']])
    writer.writerow(['Total', data['net_food_sales'], data['delivery_income'], data['total_sales']])
    writer.writerow([])
    writer.writerow(['Menu (accepted name)', 'Selling units', 'Gross food before order discounts'])
    for row in data['menus']:
        writer.writerow([csv_text(row['product_name']), row['quantity'], row['gross_food']])
    return response


@api_view(['GET'])
@permission_classes([IsAdminUser])
def order_slip(request, pk):
    order = get_object_or_404(operational_orders().select_related('user', 'address').prefetch_related('items'), pk=pk)
    row = order_row(order)
    saved = order.fulfilment_snapshot
    address = order.delivery_address or ({key: getattr(order.address, key) for key in
        ('recipient_name', 'phone', 'line1', 'line2', 'city', 'state', 'postal_code', 'country')}
        if order.address else {})
    handover = saved.get('handover', {})
    row.update(phone=saved.get('customer', {}).get('phone') or handover.get('contact_phone') or address.get('phone', ''),
        address_lines=[address.get(key) for key in ('line1', 'line2', 'city', 'state', 'postal_code', 'country') if address.get(key)]
            if order.delivery_method != 'pickup' else [],
        pickup_location=saved.get('pickup_location', ''),
        handover_notes=handover.get('notes', ''),
        handover_location=handover.get('location', '') if handover.get('mode') == 'agreed_place' else '',
        kitchen=Storefront.objects.filter(pk=1).values_list('name', flat=True).first() or 'Kitchen',
        printed_at=timezone.now())
    return Response(row)
