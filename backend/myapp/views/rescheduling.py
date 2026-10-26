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
from ..services.initial_delivery import initial_delivery_plan
from ..services.fulfilment import order_store

SALT = 'order-delivery-change-v1'
CUTOFF_HOURS = 24


class ChangeInput(serializers.Serializer):
    delivery_at = serializers.DateTimeField()
    reason = serializers.CharField(max_length=300, trim_whitespace=True)


def unconfirmed_request(order):
    return (order.status == 'pending' and not order.inventory_deducted and bool(order.delivery_at)
        and order.preparation_plan.get('needs_review') is True
        and not order.preparation_at and not order.preparation_end_at
        and not order.preparation_plan.get('tasks'))


def eligibility(order, now, allow_initial=False):
    if order.preparation_plan.get('shared_batch'):
        return None, 'This order is in a shared cooking batch. Contact the kitchen to separate its preparation reservation before changing the delivery time.'
    anchor = order.delivery_at if order.preparation_plan.get('needs_review') else order.preparation_at
    cutoff = anchor - timedelta(hours=CUTOFF_HOURS) if anchor else None
    if order.status != 'pending' or order.inventory_deducted:
        return cutoff, 'Only orders awaiting preparation can be rescheduled.'
    if order.payment_status == 'refunded':
        return cutoff, 'A refunded order cannot be rescheduled. Contact the kitchen.'
    if allow_initial and order.delivery_at is None:
        if order.preparation_at or order.preparation_end_at or order.preparation_plan.get('tasks'):
            return cutoff, 'Existing preparation reservations need owner review before a delivery date can be assigned.'
        return None, ''
    if unconfirmed_request(order):
        # No accepted reservation exists to protect with a preparation cutoff.
        return None, ''
    if not cutoff or not order.delivery_at:
        return cutoff, 'This order needs its delivery and preparation times resolved by the kitchen.'
    if now >= cutoff:
        return cutoff, 'Online changes close 24 hours before preparation starts. Contact the kitchen.'
    return cutoff, ''


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reschedule_order(request, pk):
    # Read-only eligibility/history must not serialize the whole kitchen.
    if request.method == 'POST' and not isinstance(request.data, dict):
        raise serializers.ValidationError('Provide a delivery change object.')
    orders = Order.objects.all()
    if request.method == 'POST':
        # Same lock order as checkout/replanning: store, then order, then menus.
        Storefront.objects.get_or_create(pk=1)
        store = Storefront.objects.select_for_update().get(pk=1)
        orders = orders.select_for_update()
    if not request.user.is_staff:
        orders = orders.filter(user=request.user)
    order = get_object_or_404(orders, pk=pk)
    if request.method == 'POST':
        store = order_store(store, order)
    now = timezone.now()
    initial_delivery = bool(request.user.is_staff and order.delivery_at is None)
    editing_request = unconfirmed_request(order)
    cutoff, blocked = eligibility(order, now, allow_initial=initial_delivery)
    items = list(order.items.select_related('product'))
    if initial_delivery and not blocked:
        if not items or any(item.product_id is None for item in items):
            blocked = 'Menu links are missing. Review this request or close it if obsolete; a delivery date cannot restore removed menu references.'
        elif any(item.product.selling_status == 'archived' for item in items):
            blocked = 'This request contains archived menus. Review the items or close an obsolete request before assigning a new delivery date.'
    changes = order.amendments.filter(after__kind='delivery_change').order_by('-created_at', '-pk')
    if request.method == 'GET':
        return Response({'eligible': not bool(blocked), 'reason': blocked, 'cutoff': cutoff,
            'initial_delivery': initial_delivery,
            'unconfirmed_request': editing_request,
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
    from ..services.escrow import locked_delivery, EscrowError
    try:
        locked_delivery(order,target)
    except EscrowError as error:
        raise serializers.ValidationError(error.message)
    if target == order.delivery_at:
        raise serializers.ValidationError('Choose a different delivery time.')
    if previous and previous['version'] != order.updated_at.isoformat():
        return Response({'detail': 'This order changed. Reload it and preview again.'}, status=409)
    if any(i.product_id is None for i in items):
        raise serializers.ValidationError('An ordered menu was removed. Contact the kitchen to arrange this change.')
    list(Product.objects.select_for_update().filter(pk__in=[i.product_id for i in items]).order_by('pk'))
    items = list(order.items.select_related('product'))
    if initial_delivery and any(item.product.selling_status == 'archived' for item in items):
        raise serializers.ValidationError('A menu was archived. Reload this request before assigning a delivery date.')
    # A changed date needs fresh notice; no reuse of the original order's lead-time window.
    # A first date is an owner-recorded request, never retroactive fulfilment or recipe acceptance.
    # Missing accepted settings use current policies for request validation only; none are saved.
    if initial_delivery:
        plan = initial_delivery_plan(items, target, store, order.pk, now)
    else:
        plan = schedule_order([scheduled_item(i) for i in items], target, store,
                              now=now, exclude_order_id=order.pk,
                              allow_manual_review=bool(order.preparation_plan.get('needs_review')),
                              allow_request_exceptions=editing_request)
    change_anchor = plan['start'] or target
    if not editing_request and change_anchor <= now + timedelta(hours=CUTOFF_HOURS):
        raise serializers.ValidationError('The new preparation time must also be more than 24 hours away.')
    snapshot = {'kind': 'delivery_change', 'order': order.pk, 'actor': request.user.pk,
        'actor_role': 'owner' if request.user.is_staff else 'customer',
        'request_id': previous['request_id'] if previous else str(uuid.uuid4()),
        'version': order.updated_at.isoformat(), 'delivery_at': target.isoformat(),
        'reason': incoming.validated_data['reason'], 'preparation_at': plan['start'].isoformat() if plan['start'] else None,
        'preparation_end_at': plan['end'].isoformat() if plan['end'] else None, 'plan': plan_snapshot(plan)}
    if previous:
        if snapshot != previous:
            return Response({'detail': 'Kitchen availability changed. Preview the new time again.'}, status=409)
        before = {'delivery_at': order.delivery_at.isoformat() if order.delivery_at else None,
            'preparation_at': order.preparation_at.isoformat() if order.preparation_at else None, 'plan': order.preparation_plan}
        order.delivery_at = target
        order.preparation_at = plan['start']
        order.preparation_end_at = plan['end']
        order.preparation_plan = snapshot['plan']
        order.save(update_fields=['delivery_at', 'preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
        OrderAmendment.objects.create(order=order, actor=request.user, before=before, after=snapshot)
        return Response({'order': OrderSerializer(order).data, 'already_applied': False})
    return Response({'preview': {'previous_delivery': order.delivery_at, 'delivery_at': target,
        'reason': snapshot['reason'], 'change_closes_at': None if plan.get('needs_review') and editing_request else change_anchor-timedelta(hours=CUTOFF_HOURS),
        'unconfirmed_request': editing_request, 'needs_review': plan.get('needs_review',False)},
        'confirm': signing.dumps(snapshot, salt=SALT, compress=True)})
