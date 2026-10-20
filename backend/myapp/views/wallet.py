"""Fictional demo credits; serialized with checkout, never a real-money balance."""
import uuid
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.throttling import UserRateThrottle
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Wallet, WalletTransaction
from ..services.demo_wallet import MAX_BALANCE


class DemoCreditThrottle(UserRateThrottle):
    scope='demo_credit_mutations'
    rate='30/min'


def wallet_data(wallet):
    return {'id':wallet.pk, 'balance':float(wallet.balance), 'wallet_address':wallet.wallet_address}


class TopupInput(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), max_value=MAX_BALANCE)
    request_id = serializers.UUIDField(required=False)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    wallet = Wallet.objects.filter(user=request.user).first()
    if not wallet:return Response({'detail':'No wallet found'}, status=404)
    return Response(wallet_data(wallet))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([DemoCreditThrottle])
@transaction.atomic
def create_wallet(request):
    User.objects.select_for_update().get(pk=request.user.pk)
    wallet, created = Wallet.objects.get_or_create(user=request.user, defaults={
        'balance':0, 'wallet_address':f'TF-{uuid.uuid4().hex[:12].upper()}', 'is_external':False})
    return Response(wallet_data(wallet), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([DemoCreditThrottle])
@transaction.atomic
def topup_wallet(request):
    incoming = TopupInput(data=request.data);incoming.is_valid(raise_exception=True)
    data = incoming.validated_data
    # Checkout takes the same user-then-wallet locks. A top-up cannot overwrite a
    # debit, another top-up or an owner refund with a previously read balance.
    User.objects.select_for_update().get(pk=request.user.pk)
    wallet = Wallet.objects.select_for_update().filter(user=request.user).first()
    if not wallet:return Response({'detail':'No wallet found'}, status=404)
    reference = f'demo-topup:{data["request_id"]}' if 'request_id' in data else 'Manual demo top-up'
    if 'request_id' in data:
        previous = wallet.transactions.filter(type='deposit', reference=reference).first()
        if previous:
            if previous.amount != data['amount']:
                raise serializers.ValidationError('This top-up reference was already used for another amount.')
            return Response({'balance':float(wallet.balance), 'already_applied':True})
    if wallet.balance + data['amount'] > MAX_BALANCE:
        raise serializers.ValidationError('This top-up would exceed the demo credit balance limit.')
    wallet.balance += data['amount']
    wallet.save(update_fields=['balance','updated_at'])
    WalletTransaction.objects.create(wallet=wallet, amount=data['amount'], type='deposit', reference=reference)
    return Response({'balance':float(wallet.balance), 'already_applied':False, 'message':'Demo credits added. No real money was transferred.'})
