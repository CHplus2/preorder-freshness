"""Choose payment once, after a review request has a confirmed preparation plan."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Order, Storefront
from .paypal import unavailable_reason


class PaymentChoice(serializers.Serializer):
    request_id = serializers.UUIDField()
    payment = serializers.ChoiceField(choices=['paypal', 'manual', 'cod', 'escrow'])


def options_for(order, store):
    from ..services.paypal import enabled
    from ..services.escrow import config
    options = []
    if order.delivery_method == 'pickup':
        options.append(dict(id='cod', label='Cash at collection', note='Pay when you collect your order.'))
    if enabled():
        options.append(dict(id='paypal', label='PayPal', note='Test payment. No real money is transferred.'))
    if store.manual_payment_enabled and (store.bank_transfer_instructions.strip() or store.duitnow_qr_url):
        options.append(dict(id='manual', label='DuitNow QR / bank transfer', note='The kitchen confirms receipt.'))
    if order.delivery_method != 'pickup' and config():
        options.append(dict(id='escrow', label='Escrow payment', note='Sepolia test ETH; server-verified funding.'))
    return options


def selected_data(order):
    return dict(order_id=order.pk, payment_method=order.payment_method, payment_status=order.payment_status)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def order_payment_choice(request, pk):
    query = Order.objects.select_for_update() if request.method == 'POST' else Order.objects.all()
    order = get_object_or_404(query, pk=pk, user=request.user)
    data = None
    if request.method == 'POST':
        incoming = PaymentChoice(data=request.data)
        incoming.is_valid(raise_exception=True)
        data = incoming.validated_data
        old = order.payment_instructions.get('payment_selection', {})
        if old.get('request_id') == str(data['request_id']) and old.get('method') == data['payment']:
            return Response(selected_data(order))
    if order.payment_method != 'deferred':
        raise serializers.ValidationError('Payment has already been chosen. Refresh My orders to continue with the saved method.')
    reason = unavailable_reason(order)
    if request.method == 'POST' and reason:
        raise serializers.ValidationError(reason)
    # Selection snapshots the current instructions, just as checkout does.
    store = Storefront.objects.filter(pk=1).first()
    options = options_for(order, store) if store and not reason else []
    if request.method == 'GET':
        return Response(dict(order_id=order.pk, options=options, reason=reason))
    method = data['payment']
    if method not in [option['id'] for option in options]:
        raise serializers.ValidationError('This payment method is unavailable. Refresh payment choices and try again.')
    if order.payment_events.exists():
        raise serializers.ValidationError('This order has payment records. Contact the kitchen before choosing another method.')
    order.payment_method = method
    order.payment_instructions = dict(payment_selection=dict(request_id=str(data['request_id']),
        method=method, selected_at=timezone.now().isoformat()))
    if method == 'manual':
        order.payment_instructions.update(instructions=store.bank_transfer_instructions, qr_url=store.duitnow_qr_url)
    order.save(update_fields=['payment_method', 'payment_instructions', 'updated_at'])
    return Response(selected_data(order))
