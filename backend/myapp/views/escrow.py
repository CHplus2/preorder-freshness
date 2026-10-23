"""Authenticated order-bound escrow; only server RPC verification records payment."""
import secrets
from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from ..models import Order
from ..services.escrow import config,public_config,total,address,EscrowError,SepoliaClient,reconcile,record_check_error
from .paypal import unavailable_reason

class EscrowThrottle(UserRateThrottle):
    scope='escrow_order'
    rate='20/min'

class EscrowInput(serializers.Serializer):
    action=serializers.ChoiceField(choices=['create','verify','refresh'])
    buyer=serializers.RegexField(r'^0x[0-9a-fA-F]{40}$',required=False)
    transaction_hash=serializers.RegexField(r'^0x[0-9a-fA-F]{64}$',required=False)

def start_reason(order):
    reason=unavailable_reason(order)
    if reason:return reason
    cfg=config()
    if not cfg:return 'Sepolia escrow is not configured.'
    dispatch=int((order.delivery_at-timezone.timedelta(minutes=order.preparation_plan.get('delivery_buffer_minutes',90))).timestamp())
    if not int(timezone.now().timestamp())<dispatch<=int(timezone.now().timestamp())+7*86400:
        return 'Funding opens within seven days of dispatch. This saved order remains unpaid until funding is verified.'
    wei=Decimal(total(order))*cfg['wei_per_myr']
    if wei!=wei.to_integral_value() or not 0<wei<=10**16:return 'This order exceeds the configured Sepolia amount limits. Contact the kitchen.'
    return ''

def state_data(order):
    invoice=order.payment_instructions.get('escrow_sepolia')
    reason=start_reason(order)
    mismatch=bool(invoice and invoice['amount_myr']!=total(order))
    if mismatch:reason='The recorded order total changed. Do not fund this invoice; contact the kitchen.'
    return {'order_id':order.pk,'order_status':order.status,'payment_method':'escrow','payment_status':order.payment_status,
        'amount_myr':total(order),'config':public_config(),'invoice':invoice,
        'can_create':not invoice and not bool(reason),
        'can_fund':bool(invoice and not reason and invoice['dispatch_by']>int(timezone.now().timestamp()) and invoice['state'] in ['awaiting_funding','verification_failed','transaction_failed']),
        'reason':reason if mismatch else invoice.get('check_error','') if invoice and invoice.get('funding_hash') else reason}

@api_view(['GET'])
@permission_classes([AllowAny])
def escrow_config(request):
    response=Response(public_config());response['Cache-Control']='no-store';return response

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([EscrowThrottle])
def escrow_payment(request,pk):
    query=Order.objects.filter(payment_method='escrow')
    if not request.user.is_staff:query=query.filter(user=request.user)
    if request.method=='GET':
        order=get_object_or_404(query,pk=pk);state=state_data(order)
        if request.user.pk!=order.user_id and not state['invoice']:
            state.update(can_create=False,reason='The customer must start this payment and bind their funding wallet first.')
        response=Response(state);response['Cache-Control']='private, no-store';return response
    if not isinstance(request.data,dict) or set(request.data)-set(EscrowInput().fields):
        raise serializers.ValidationError('Use only documented escrow payment fields.')
    incoming=EscrowInput(data=request.data);incoming.is_valid(raise_exception=True);data=incoming.validated_data
    with transaction.atomic():
        order=get_object_or_404(query.select_for_update(),pk=pk)
        invoice=order.payment_instructions.get('escrow_sepolia')
        if data['action']=='create':
            if request.user.pk!=order.user_id:raise serializers.ValidationError('Only the customer can bind the funding wallet.')
            if invoice:
                if data.get('buyer','').lower()!=invoice['buyer']:raise serializers.ValidationError('This invoice already belongs to another funding wallet. Use its recorded wallet.')
                return Response(state_data(order))
            cfg=config()
            if not cfg:return Response({'detail':'Sepolia escrow is not configured.'},status=503)
            reason=unavailable_reason(order)
            if reason:raise serializers.ValidationError(reason)
            buyer=data.get('buyer','').lower()
            if not address(buyer) or buyer in [cfg['seller'],cfg['arbiter']]:raise serializers.ValidationError('Use a distinct buyer wallet.')
            dispatch=int((order.delivery_at-timezone.timedelta(minutes=order.preparation_plan.get('delivery_buffer_minutes',90))).timestamp())
            now=int(timezone.now().timestamp())
            if not now<dispatch<=now+7*86400:raise serializers.ValidationError('Start escrow payment when dispatch is within the next seven days.')
            wei=Decimal(total(order))*cfg['wei_per_myr']
            if wei!=wei.to_integral_value() or not 0<wei<=10**16:raise serializers.ValidationError('This order exceeds the configured Sepolia payment amount limits.')
            invoice={**cfg,'reference':'0x'+secrets.token_hex(32),'buyer':buyer,'amount_myr':total(order),
                'amount_wei':str(int(wei)),'dispatch_by':dispatch,'state':'awaiting_funding',
                'funding_hash':None,'created_at':timezone.now().isoformat()}
            order.payment_instructions={**order.payment_instructions,'escrow_sepolia':invoice}
            order.save(update_fields=['payment_instructions','updated_at'])
            return Response(state_data(order))
        if not invoice:raise serializers.ValidationError('Start escrow payment from this order first.')
        tx_hash=data.get('transaction_hash') or invoice.get('funding_hash')
        if not tx_hash:return Response(state_data(order))
        if invoice.get('funding_hash') and invoice['funding_hash']!=tx_hash.lower() and order.payment_status!='unpaid':
            raise serializers.ValidationError('A funding transaction is already recorded. Check its status before replacing the reference.')
        invoice=dict(invoice,funding_hash=tx_hash.lower())
        order.payment_instructions={**order.payment_instructions,'escrow_sepolia':invoice}
        order.save(update_fields=['payment_instructions','updated_at'])
        try:
            reconcile(order,request.user,SepoliaClient())
        except EscrowError as error:
            order.refresh_from_db()
            record_check_error(order,error)
            return Response({'detail':error.message,'code':error.code},status=409 if error.code in ['verification_failed','transaction_failed'] else 503)
        return Response(state_data(order))
