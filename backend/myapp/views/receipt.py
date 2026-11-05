"""Simple receipt facts and explicit cancellation/stock-return confirmation."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, OrderAmendment
from ..serializers import OrderSerializer
from ..services.demo_provenance import generated_sales_summary
from .packaging import StrictInput, Conflict


class ReceiptRow(StrictInput):
    id = serializers.IntegerField(min_value=1)
    version = serializers.DateTimeField()


class ReceiptInput(StrictInput):
    received = serializers.BooleanField()
    reason = serializers.CharField(max_length=300, allow_blank=True, default='')
    orders = ReceiptRow(many=True, min_length=1, max_length=20)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def receipts(request):
    form = ReceiptInput(data=request.data)
    form.is_valid(raise_exception=True)
    v = form.validated_data
    versions = {row['id']: row['version'] for row in v['orders']}
    if len(versions) != len(v['orders']):
        raise ValidationError('Choose each order once.')
    orders = list(Order.objects.select_for_update().filter(pk__in=versions).order_by('pk'))
    if len(orders) != len(versions):
        raise ValidationError('A selected order is unavailable. Refresh the order list.')
    target = 'delivered' if v['received'] else 'pending'
    for order in orders:
        if generated_sales_summary(order):
            raise ValidationError('Generated sales summaries cannot be changed as customer receipts.')
        if order.updated_at != versions[order.pk]:
            raise Conflict('A selected order changed. Refresh the order list; nothing was updated.')
        if order.status == 'cancelled':
            raise ValidationError('Cancelled orders cannot be marked received.')
        if order.status == 'delivered' and not v['received'] and not v['reason'].strip():
            raise ValidationError('Add a reason when correcting a received order to not received.')
        if order.ordering_mode == 'simple' and v['received'] and not order.inventory_deducted:
            raise ValidationError('This order has no placement stock allocation. Review its inventory records first.')
    for order in orders:
        if order.status == target:
            continue
        before = dict(status=order.status, receipt_status='received' if order.status=='delivered' else 'not_received')
        order.status = target
        order.save(update_fields=['status', 'updated_at'])
        OrderAmendment.objects.create(order=order, actor=request.user, before=before,
            after=dict(status=target, receipt_status='received' if v['received'] else 'not_received',
                change_type='receipt', reason=v['reason']))
    return Response(dict(updated=[dict(id=o.pk, status=o.status, updated_at=o.updated_at) for o in orders]))


class CancelInput(StrictInput):
    version = serializers.DateTimeField()
    reason = serializers.CharField(max_length=300)
    return_unused_stock = serializers.BooleanField(default=False)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def cancel_order(request, pk):
    form = CancelInput(data=request.data)
    form.is_valid(raise_exception=True)
    v = form.validated_data
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
    if generated_sales_summary(order):
        raise ValidationError('Generated sales summaries cannot be cancelled as customer requests.')
    if order.status == 'cancelled':
        return Response(OrderSerializer(order, context={'request': request}).data)
    if order.updated_at != v['version']:
        raise Conflict('This order changed. Refresh before cancelling it.')
    if order.status == 'delivered':
        raise ValidationError('A received order must have its receipt record corrected before it can be cancelled.')
    before = dict(status=order.status)
    if v['return_unused_stock']:
        from ..services.simple_ordering import return_unused_stock
        return_unused_stock(order, request.user)
    order.status = 'cancelled'
    order.save(update_fields=['status', 'stock_returned_at', 'updated_at'])
    OrderAmendment.objects.create(order=order, actor=request.user, before=before,
        after=dict(status='cancelled', change_type='cancellation', reason=v['reason'],
            unused_stock_returned=v['return_unused_stock']))
    return Response(OrderSerializer(order, context={'request': request}).data)
