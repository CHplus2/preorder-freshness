"""Authenticated Sandbox checkout/recovery using existing durable order records.

Intent IDs are committed before provider calls. Each mutation serializes on the
local order; provider retries reuse the same IDs. Only a verified completed
capture creates a receipt. No database migration or client payment claim needed.
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
import uuid
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from ..models import Order, PaymentEvent
from ..services.paypal import CURRENCY, SandboxClient, PayPalError, enabled, provider_id


class PayPalThrottle(UserRateThrottle):
    scope = 'paypal_sandbox'
    rate = '20/min'


class PaymentAction(serializers.Serializer):
    action = serializers.ChoiceField(choices=['create', 'capture', 'refresh'])
    paypal_order_id = serializers.RegexField(r'^[A-Za-z0-9]{1,100}$', required=False)


def amount(order):
    return str((order.total_amount+order.shipping_fee).quantize(Decimal('0.01')))


def unavailable_reason(order):
    if order.payment_status!='unpaid':
        return 'This order is already paid or refunded.'
    if order.status=='cancelled':
        return 'This order was cancelled. No new payment can be taken.'
    if not order.delivery_at or order.delivery_at<=timezone.now():
        return 'Review the delivery arrangement with the kitchen before paying.'
    if order.preparation_plan.get('needs_review') or not order.preparation_at or not order.preparation_end_at or order.preparation_end_at<=order.preparation_at or order.preparation_end_at>order.delivery_at:
        return 'The kitchen must confirm preparation before taking payment.'
    if order.total_amount+order.shipping_fee<=0:
        return 'The order amount needs owner review.'
    return ''


def state_data(order):
    intent = order.payment_instructions.get('paypal_sandbox', {})
    reason = unavailable_reason(order)
    if intent and intent.get('amount')!=amount(order):
        reason = 'The recorded amount changed. Contact the kitchen before paying.'
    expired = bool(intent and parse_datetime(intent['created_at']) < timezone.now()-timedelta(hours=5))
    if expired and not reason:
        reason = 'This payment session needs review. Check payment status; do not create another payment.'
    return {'order_id':order.pk, 'order_status':order.status, 'sandbox':True, 'currency':CURRENCY, 'amount':amount(order),
        'payment_status':order.payment_status, 'state':intent.get('state','not_started'),
        'paypal_order_id':intent.get('paypal_order_id'), 'capture_id':intent.get('capture_id'),
        'can_pay':bool(enabled() and not reason and intent.get('state') not in ['pending','review_required']),
        'reason':reason, 'configured':enabled()}


def save_intent(order, intent):
    order.payment_instructions = {**order.payment_instructions, 'paypal_sandbox':intent}
    order.save(update_fields=['payment_instructions','updated_at'])


def validate_order(data, intent):
    if not isinstance(data, dict) or data.get('id')!=intent.get('paypal_order_id') or data.get('intent')!='CAPTURE':
        raise PayPalError('The PayPal payment reference could not be verified. Contact the kitchen.', 'verification_failed')
    units = data.get('purchase_units')
    if not isinstance(units, list) or len(units)!=1:
        raise PayPalError(code='verification_failed')
    unit = units[0]
    if not isinstance(unit, dict):
        raise PayPalError(code='verification_failed')
    if unit.get('custom_id')!=intent['custom_id'] or unit.get('reference_id')!=intent['request_id']:
        raise PayPalError(code='verification_failed')
    try:
        if unit['amount']['currency_code']!=CURRENCY or Decimal(unit['amount']['value'])!=Decimal(intent['amount']):
            raise PayPalError(code='verification_failed')
    except (KeyError, TypeError, InvalidOperation):
        raise PayPalError(code='verification_failed') from None
    return unit


def reconcile(order, intent, data, user):
    unit = validate_order(data, intent)
    payments = unit.get('payments', {})
    if not isinstance(payments, dict):
        raise PayPalError(code='verification_failed')
    captures = payments.get('captures', [])
    intent['provider_status'] = data.get('status', '')
    if not captures:
        intent['state'] = 'approved' if data.get('status')=='APPROVED' else 'created'
        if data.get('status') not in ['CREATED','SAVED','PAYER_ACTION_REQUIRED','APPROVED']:
            intent['state'] = 'review_required'
        save_intent(order, intent)
        return False
    if not isinstance(captures, list) or len(captures)!=1 or not isinstance(captures[0], dict):
        raise PayPalError(code='verification_failed')
    capture = captures[0]
    if capture.get('status')=='PENDING':
        intent['state']='pending'
        save_intent(order, intent)
        return False
    try:
        verified = (data.get('status')=='COMPLETED' and capture.get('status')=='COMPLETED'
            and capture.get('final_capture') is True and provider_id(capture.get('id'))
            and capture['amount']['currency_code']==CURRENCY
            and Decimal(capture['amount']['value'])==Decimal(intent['amount']))
    except (KeyError, TypeError, InvalidOperation):
        verified = False
    if not verified:
        raise PayPalError('PayPal has not confirmed a matching completed capture. Contact the kitchen before paying again.', 'verification_failed')
    capture_id = capture['id']
    receipt_id = uuid.uuid5(uuid.NAMESPACE_URL, 'paypal-sandbox-capture:'+capture_id)
    previous = PaymentEvent.objects.filter(request_id=receipt_id).first()
    if previous and (previous.order_id!=order.pk or previous.amount!=Decimal(intent['amount']) or previous.source!='paypal_sandbox'):
        raise PayPalError(code='verification_failed')
    receipt, _ = PaymentEvent.objects.get_or_create(request_id=receipt_id, defaults=dict(order=order,kind='receipt',outcome='completed',
        amount=Decimal(intent['amount']),method='paypal',reference=capture_id,source='paypal_sandbox',actor=user,
        note='Verified PayPal Sandbox capture in MYR. Test transaction; no real funds.'))
    # Recheck the row returned after a concurrent unique-key conflict as well as
    # the earlier read: one capture can never pay two different local orders.
    if (receipt.order_id != order.pk or receipt.amount != Decimal(intent['amount'])
            or receipt.source != 'paypal_sandbox' or receipt.kind != 'receipt' or receipt.outcome != 'completed'):
        raise PayPalError(code='verification_failed')
    intent.update(state='completed',capture_id=capture_id)
    order.payment_status='paid'
    order.save(update_fields=['payment_status','updated_at'])
    save_intent(order, intent)
    return True


def check_existing_payment(order, client, actor, via, expected_capture=None):
    """Caller holds the order lock. This path can GET, never create or capture."""
    intent = dict(order.payment_instructions.get('paypal_sandbox', {}))
    if order.payment_status == 'refunded':
        raise PayPalError('This order has a refund record. Review its payment records.', 'refund_recorded')
    if not provider_id(intent.get('paypal_order_id')):
        raise PayPalError('The customer has not started a PayPal payment for this order.', 'not_started')
    if intent.get('amount') != amount(order):
        raise PayPalError('The recorded order amount changed. Review the payment with the kitchen.', 'verification_failed')
    data = client.get(intent['paypal_order_id'])
    unit = validate_order(data, intent)
    if expected_capture:
        captures = unit.get('payments', {}).get('captures', []) if isinstance(unit.get('payments', {}), dict) else []
        if not isinstance(captures, list) or len(captures) != 1 or not isinstance(captures[0], dict) or captures[0].get('id') != expected_capture:
            raise PayPalError('PayPal has not returned the notified capture yet. Check again shortly.', 'capture_not_ready')
    paid = reconcile(order, intent, data, actor)
    intent.update(last_checked_at=timezone.now().isoformat(), last_checked_via=via)
    intent.pop('last_check_error', None)
    save_intent(order, intent)
    if expected_capture and not paid:
        raise PayPalError('PayPal has not confirmed the notified capture yet. Check again shortly.', 'capture_not_ready')
    return paid


def record_check_error(order, error, via):
    intent = dict(order.payment_instructions.get('paypal_sandbox', {}))
    if not intent:
        return
    intent.update(last_check_error=error.code, last_check_attempt_at=timezone.now().isoformat(), last_check_attempt_via=via)
    if order.payment_status == 'unpaid' and not (intent.get('state') == 'pending' and error.code != 'verification_failed'):
        intent['state'] = 'review_required' if error.code == 'verification_failed' else 'uncertain'
    save_intent(order, intent)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@throttle_classes([PayPalThrottle])
@transaction.atomic
def paypal_owner_check(request, pk):
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk, payment_method='paypal')
    if order.payment_status == 'refunded':
        return Response({'detail':'This order has a refund record. Review its payment records.'}, status=409)
    if not provider_id(order.payment_instructions.get('paypal_sandbox', {}).get('paypal_order_id')):
        return Response({'detail':'The customer has not started a PayPal payment for this order.'}, status=409)
    if not enabled():
        return Response({'detail':'PayPal Sandbox is not configured. No payment check was made.'}, status=503)
    try:
        check_existing_payment(order, SandboxClient(), request.user, 'owner')
        return Response(state_data(order))
    except PayPalError as error:
        record_check_error(order, error, 'owner')
        return Response({'detail':error.message, 'code':error.code}, status=409 if error.code == 'verification_failed' else 503)


@api_view(['GET'])
@permission_classes([AllowAny])
def paypal_config(request):
    from django.conf import settings
    response = Response({'enabled':enabled(), 'sandbox':True, 'currency':CURRENCY,
        'client_id':settings.PAYPAL_SANDBOX_CLIENT_ID if enabled() else ''})
    response['Cache-Control']='no-store'
    return response


@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([PayPalThrottle])
def paypal_payment(request, pk):
    query = Order.objects.filter(user=request.user, payment_method='paypal')
    if request.method=='GET':
        order = get_object_or_404(query, pk=pk)
        response=Response(state_data(order));response['Cache-Control']='no-store';return response
    incoming = PaymentAction(data=request.data)
    incoming.is_valid(raise_exception=True)
    action = incoming.validated_data['action']
    # Commit stable identifiers BEFORE contacting PayPal, including before a
    # timeout or worker restart. A retry cannot create a second provider order.
    with transaction.atomic():
        order = get_object_or_404(query.select_for_update(), pk=pk)
        if order.payment_status=='paid':
            return Response(state_data(order))
        if order.payment_status=='refunded':
            return Response({'detail':'This order was refunded. No new capture is allowed.'},status=409)
        if not enabled():
            return Response({'detail':'PayPal Sandbox is not configured. Check your order before choosing another payment method.','code':'not_configured'},status=503)
        intent = order.payment_instructions.get('paypal_sandbox')
        if not intent:
            if action!='create':
                return Response(state_data(order)) if action=='refresh' else Response({'detail':'Start this payment from its order first.'},status=409)
            reason = unavailable_reason(order)
            if reason:
                return Response({'detail':reason},status=409)
            request_id = str(uuid.uuid4())
            intent = {'version':1,'request_id':request_id,'capture_request_id':str(uuid.uuid4()),
                'custom_id':f'dapur-kita:{order.pk}:{request_id}','amount':amount(order),'currency':CURRENCY,
                'created_at':timezone.now().isoformat(),'state':'creating'}
            save_intent(order,intent)
    # The lock serialises duplicate creates/captures and concurrent cancellation.
    # Provider errors are returned inside the block so recovery state is retained.
    with transaction.atomic():
        order = get_object_or_404(query.select_for_update(), pk=pk)
        intent = order.payment_instructions['paypal_sandbox']
        if order.payment_status=='refunded':
            return Response({'detail':'This order was refunded. No new capture is allowed.'},status=409)
        if order.payment_status=='paid':
            return Response(state_data(order))
        if intent['amount']!=amount(order):
            return Response({'detail':'The recorded order amount changed. Contact the kitchen before paying.'},status=409)
        supplied = incoming.validated_data.get('paypal_order_id')
        if action=='capture' and (not supplied or supplied!=intent.get('paypal_order_id')):
            return Response({'detail':'This PayPal reference does not belong to this order.'},status=409)
        if action in ['create','capture']:
            reason=unavailable_reason(order) or ('This payment session needs review. Check payment status before paying again.' if parse_datetime(intent['created_at'])<timezone.now()-timedelta(hours=5) else '')
            if reason:
                return Response({'detail':reason},status=409)
        try:
            client = SandboxClient()
            if not intent.get('paypal_order_id'):
                if action=='refresh':
                    return Response(state_data(order))
                created = client.create(intent)
                if not isinstance(created, dict) or not provider_id(created.get('id')):
                    raise PayPalError(code='verification_failed')
                intent['paypal_order_id']=created['id']
                # Server-to-server GET establishes the complete binding even if
                # create/capture returned a minimal response.
                save_intent(order,intent)
            data = client.get(intent['paypal_order_id'])
            paid = reconcile(order,intent,data,request.user)
            if action=='capture' and not paid and intent['state'] not in ['pending','review_required']:
                if data.get('status')!='APPROVED':
                    return Response({'detail':'Approve this payment in PayPal first.','code':'approval_required',**state_data(order)},status=409)
                try:
                    client.capture(intent['paypal_order_id'],intent['capture_request_id'])
                except PayPalError:
                    # A capture can succeed remotely while its response is lost.
                    # Re-read the SAME order before deciding its payment status.
                    data = client.get(intent['paypal_order_id'])
                    if not reconcile(order,intent,data,request.user):
                        raise
                else:
                    data = client.get(intent['paypal_order_id'])
                    reconcile(order,intent,data,request.user)
            return Response(state_data(order))
        except PayPalError as error:
            # Keep stable IDs and a safe state, never payer details or secrets.
            intent['state']='review_required' if error.code=='verification_failed' else 'uncertain'
            intent['last_error']=error.code
            save_intent(order,intent)
            return Response({'detail':error.message,'code':error.code,**state_data(order)},status=502 if error.code!='verification_failed' else 409)
