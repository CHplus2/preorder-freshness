"""Owner reconciliation records. External transfers are never executed here."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, PaymentEvent, Wallet, WalletTransaction


class PaymentInput(serializers.Serializer):
    request_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=['receipt', 'refund'])
    outcome = serializers.ChoiceField(choices=['completed', 'pending', 'failed'])
    reference = serializers.CharField(max_length=200)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    resolves = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)


def event_data(row):
    return dict(id=row.pk, kind=row.kind, outcome=row.outcome, amount=str(row.amount),
        method=row.method, reference=row.reference, note=row.note, source=row.source,
        actor=row.actor_id, created_at=row.created_at, resolves=row.resolves_id)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def payments(request, pk):
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
    if request.method == 'POST':
        serializer = PaymentInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        old = PaymentEvent.objects.filter(request_id=data['request_id']).first()
        if old:
            if old.order_id != order.pk or any(getattr(old, k if k != 'resolves' else 'resolves_id') != v
                for k, v in data.items() if k != 'request_id'):
                raise serializers.ValidationError('This request was already used with different details.')
            return Response(event_data(old))
        kind, outcome = data['kind'], data['outcome']
        if kind == 'receipt' and outcome != 'completed':
            raise serializers.ValidationError('Record receipts only after verifying the full payment.')
        if kind == 'receipt' and (order.payment_status != 'unpaid' or order.status == 'cancelled'):
            raise serializers.ValidationError('This order is already paid, refunded, or cancelled.')
        if kind == 'refund' and order.payment_status != 'paid':
            raise serializers.ValidationError('Only a paid order can be refunded.')
        pending = order.payment_events.filter(kind='refund', outcome='pending', resolution__isnull=True).first()
        resolves = data['resolves']
        if resolves:
            if not pending or pending.pk != resolves or outcome == 'pending' or kind != 'refund':
                raise serializers.ValidationError('Choose the unresolved refund attempt and its final outcome.')
        elif pending:
            raise serializers.ValidationError('Resolve the pending refund before recording another attempt.')
        if order.payment_method == 'wallet' and kind == 'receipt':
            raise serializers.ValidationError('Demo wallet receipts are created by checkout, not manually.')
        amount = order.total_amount + order.shipping_fee
        source = 'owner_verified'
        if order.payment_method == 'wallet' and kind == 'refund' and outcome == 'completed':
            wallet = get_object_or_404(Wallet.objects.select_for_update(), user=order.user)
            wallet.balance += amount
            wallet.save(update_fields=['balance', 'updated_at'])
            WalletTransaction.objects.create(wallet=wallet, amount=amount, type='refund', reference=f'Order #{order.pk}')
            source = 'demo_wallet'
        row = PaymentEvent.objects.create(order=order, request_id=data['request_id'],
            kind=kind, outcome=outcome, amount=amount, method=order.payment_method or 'legacy',
            reference=data['reference'], note=data['note'], resolves_id=resolves,
            actor=request.user, source=source)
        if outcome == 'completed':
            order.payment_status = 'paid' if kind == 'receipt' else 'refunded'
            order.save(update_fields=['payment_status', 'updated_at'])
        return Response(event_data(row), status=201)
    rows = list(order.payment_events.order_by('created_at', 'pk'))
    return Response({'events': [event_data(r) for r in rows],
        'payment_status': order.payment_status,
        'unresolved_refund': next((r.pk for r in rows if r.kind == 'refund' and r.outcome == 'pending'
            and not any(x.resolves_id == r.pk for x in rows)), None),
        'amount': str(order.total_amount + order.shipping_fee),
        'policy': 'Full-order receipts and refunds only. Bank/COD records confirm an external action; they do not transfer money. Completed demo-wallet refunds return demo credits.'})
