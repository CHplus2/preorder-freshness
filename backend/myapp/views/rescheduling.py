"""Preview and confirm a delivery change without rewriting accepted menu terms."""
import uuid
from datetime import timedelta
from django.core import signing
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Order, OrderAmendment, Product, Storefront
from ..serializers import OrderSerializer
from ..services.commitments import scheduled_item
from ..services.scheduling import schedule_order, plan_snapshot

SALT = 'order-delivery-change-v1'
CUTOFF_HOURS = 24


class ChangeInput(serializers.Serializer):
    delivery_at = serializers.DateTimeField()
    reason = serializers.CharField(max_length=300, trim_whitespace=True)


def eligibility(order, now):
    cutoff = order.preparation_at - timedelta(hours=CUTOFF_HOURS) if order.preparation_at else None
    if order.status != 'pending' or order.inventory_deducted:
        return cutoff, 'Only orders awaiting preparation can be rescheduled.'
    if order.payment_status == 'refunded':
        return cutoff, 'A refunded order cannot be rescheduled. Contact the kitchen.'
    if not cutoff or not order.delivery_at:
        return cutoff, 'This order needs its delivery and preparation times resolved by the kitchen.'
    if now >= cutoff:
        return cutoff, 'Online changes close 24 hours before preparation starts. Contact the kitchen.'
    return cutoff, ''


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reschedule_order(request, pk):
    # Same lock order as checkout/replanning: store, then order, then menus.
    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    orders = Order.objects.select_for_update()
    if not request.user.is_staff:
        orders = orders.filter(user=request.user)
    order = get_object_or_404(orders, pk=pk)
    now = timezone.now()
    cutoff, blocked = eligibility(order, now)
    changes = order.amendments.filter(after__kind='delivery_change').order_by('-created_at', '-pk')
    if request.method == 'GET':
        return Response({'eligible': not bool(blocked), 'reason': blocked, 'cutoff': cutoff,
            'cutoff_hours': CUTOFF_HOURS,
            'history': [{'id': a.pk, 'at': a.created_at, 'by': a.after['actor_role'],
                'previous_delivery': a.before['delivery_at'], 'delivery_at': a.after['delivery_at'],
                'reason': a.after['reason']} for a in changes[:20]]})

    token = request.data.get('confirm')
    previous = None
    if token is not None:
        if not isinstance(token, str) or len(token) > 30000:
            raise serializers.ValidationError('Invalid preview. Preview the change again.')
        try:
            previous = signing.loads(token, salt=SALT, max_age=600)
        except signing.BadSignature:
            raise serializers.ValidationError('This preview expired or is invalid. Preview the change again.')
        if previous['order'] != order.pk or previous['actor'] != request.user.pk:
            raise serializers.ValidationError('This preview belongs to another order or account.')
        if changes.filter(after__request_id=previous['request_id']).exists():
            return Response({'order': OrderSerializer(order).data, 'already_applied': True})
    if blocked:
        raise serializers.ValidationError(blocked)
    incoming = ChangeInput(data=previous if previous else request.data)
    incoming.is_valid(raise_exception=True)
    target = incoming.validated_data['delivery_at']
    if target == order.delivery_at:
        raise serializers.ValidationError('Choose a different delivery time.')
    if previous and previous['version'] != order.updated_at.isoformat():
        return Response({'detail': 'This order changed. Reload it and preview again.'}, status=409)
    items = list(order.items.select_related('product'))
    if any(i.product_id is None for i in items):
        raise serializers.ValidationError('An ordered menu was removed. Contact the kitchen to arrange this change.')
    list(Product.objects.select_for_update().filter(pk__in=[i.product_id for i in items]).order_by('pk'))
    items = list(order.items.select_related('product'))
    # A changed date needs fresh notice; no reuse of the original order's lead-time window.
    plan = schedule_order([scheduled_item(i) for i in items], target, store,
                          now=now, exclude_order_id=order.pk)
    if plan['start'] <= now + timedelta(hours=CUTOFF_HOURS):
        raise serializers.ValidationError('The new preparation time must also be more than 24 hours away.')
    snapshot = {'kind': 'delivery_change', 'order': order.pk, 'actor': request.user.pk,
        'actor_role': 'owner' if request.user.is_staff else 'customer',
        'request_id': previous['request_id'] if previous else str(uuid.uuid4()),
        'version': order.updated_at.isoformat(), 'delivery_at': target.isoformat(),
        'reason': incoming.validated_data['reason'], 'preparation_at': plan['start'].isoformat(),
        'preparation_end_at': plan['end'].isoformat(), 'plan': plan_snapshot(plan)}
    if previous:
        if snapshot != previous:
            return Response({'detail': 'Kitchen availability changed. Preview the new time again.'}, status=409)
        before = {'delivery_at': order.delivery_at.isoformat(),
            'preparation_at': order.preparation_at.isoformat(), 'plan': order.preparation_plan}
        order.delivery_at = target
        order.preparation_at = plan['start']
        order.preparation_end_at = plan['end']
        order.preparation_plan = snapshot['plan']
        order.save(update_fields=['delivery_at', 'preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
        OrderAmendment.objects.create(order=order, actor=request.user, before=before, after=snapshot)
        return Response({'order': OrderSerializer(order).data, 'already_applied': False})
    return Response({'preview': {'previous_delivery': order.delivery_at, 'delivery_at': target,
        'reason': snapshot['reason'], 'change_closes_at': plan['start']-timedelta(hours=CUTOFF_HOURS)},
        'confirm': signing.dumps(snapshot, salt=SALT, compress=True)})
