"""One-step agreed delivery-time changes, with accepted terms and version checks."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from ..models import Order, Storefront, OrderAmendment
from ..serializers import OrderSerializer
from ..services.simple_ordering import validate_delivery, check_accepted_stock
from ..services.commitments import scheduled_item
from ..services.fulfilment import order_store
from .packaging import StrictInput, Conflict


class TimeInput(StrictInput):
    delivery_at = serializers.DateTimeField()
    version = serializers.DateTimeField()
    reason = serializers.CharField(max_length=300)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def delivery_time(request, pk):
    rows = Order.objects.all()
    if not request.user.is_staff:
        rows = rows.filter(user=request.user)
    if request.method == 'PATCH':
        # Store -> order -> menu matches checkout. No cooking reservation is made.
        Storefront.objects.get_or_create(pk=1)
        store = Storefront.objects.select_for_update().get(pk=1)
        rows = rows.select_for_update()
    order = get_object_or_404(rows, pk=pk)
    eligible = order.status not in ('delivered','cancelled') and (request.user.is_staff or
        order.delivery_at and order.delivery_at > timezone.now())
    if request.method == 'GET':
        history = order.amendments.filter(after__change_type='delivery_time').order_by('-pk')[:20]
        return Response(dict(eligible=bool(eligible), version=order.updated_at,
            reason='' if eligible else 'Contact the kitchen about this order’s delivery record.',
            history=[dict(id=a.pk, at=a.created_at, previous_delivery=a.before.get('delivery_at'),
                delivery_at=a.after['delivery_at'], reason=a.after['reason']) for a in history]))
    if not eligible:
        raise ValidationError('This delivery record cannot be changed here. Contact the kitchen.')
    form = TimeInput(data=request.data)
    form.is_valid(raise_exception=True)
    v = form.validated_data
    if order.updated_at != v['version']:
        raise Conflict('This order changed. Refresh before choosing another delivery time.')
    selected = order_store(store, order)
    items = [scheduled_item(i) for i in order.items.select_related('product')]
    validate_delivery(items, v['delivery_at'], selected, accepted=True)
    check_accepted_stock(order, v['delivery_at'])
    previous = order.delivery_at.isoformat() if order.delivery_at else None
    order.delivery_at = v['delivery_at']
    from ..services.reminders import queue_time_notice
    queue_time_notice(order)
    order.save(update_fields=['delivery_at','fulfilment_snapshot','updated_at'])
    OrderAmendment.objects.create(order=order, actor=request.user,
        before=dict(delivery_at=previous), after=dict(delivery_at=order.delivery_at.isoformat(),
            change_type='delivery_time', reason=v['reason']))
    return Response(dict(order=OrderSerializer(order, context={'request': request}).data))
