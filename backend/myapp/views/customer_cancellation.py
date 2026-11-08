"""Customer cancellation changes the order record, never stock or payment facts."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from ..models import Order, OrderAmendment
from ..serializers import OrderSerializer
from ..services.demo_provenance import generated_sales_summary
from .packaging import StrictInput, Conflict


class CustomerCancellationInput(StrictInput):
    version = serializers.DateTimeField()
    reason = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def customer_cancel_order(request, pk):
    incoming = CustomerCancellationInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    values = incoming.validated_data
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk, user=request.user)
    if order.ordering_mode != 'simple' or generated_sales_summary(order):
        raise ValidationError('Contact the kitchen to review this earlier order.')
    if order.status == 'cancelled':
        return Response(OrderSerializer(order, context={'request': request}).data)
    if order.updated_at != values['version']:
        raise Conflict('This order changed. Refresh My orders before cancelling it.')
    if order.status != 'pending':
        raise ValidationError('This order can no longer be cancelled here. Contact the kitchen about its progress.')
    previous = order.status
    order.status = 'cancelled'
    order.save(update_fields=['status', 'updated_at'])
    OrderAmendment.objects.create(order=order, actor=request.user, before={'status': previous},
        after={'status': 'cancelled', 'change_type': 'cancellation', 'cancelled_by': 'customer',
               'reason': values['reason'] or 'Cancelled by the customer in My orders.',
               'unused_stock_returned': False})
    return Response(OrderSerializer(order, context={'request': request}).data)
