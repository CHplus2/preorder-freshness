"""Verified Sandbox capture notifications; no session, payer payload or new charge."""
import re
from django.conf import settings
from django.db import transaction
from rest_framework.decorators import api_view, authentication_classes, permission_classes, parser_classes, throttle_classes
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from ..models import Order
from ..services.paypal import SandboxClient, PayPalError, enabled, provider_id, notification_headers
from .paypal import check_existing_payment, record_check_error, save_intent


class NotificationThrottle(AnonRateThrottle):
    scope = 'paypal_notification'
    rate = '120/min'


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
@throttle_classes([NotificationThrottle])
def paypal_notification(request):
    if not enabled() or not re.fullmatch(r'[A-Za-z0-9-]{1,100}', settings.PAYPAL_SANDBOX_WEBHOOK_ID):
        return Response({'detail':'PayPal Sandbox notifications are not configured.'}, status=503)
    # Bound body/header processing before OAuth or verification network calls.
    if len(request.body) > 128_000:
        return Response({'detail':'Notification is too large.'}, status=413)
    headers = notification_headers(request.headers)
    event = request.data
    if (not headers or not isinstance(event, dict)
            or not isinstance(event.get('id'), str)
            or not re.fullmatch(r'[A-Za-z0-9-]{1,120}', event['id'])
            or not isinstance(event.get('event_type'), str)
            or len(event['event_type']) > 100):
        return Response({'detail':'Invalid notification.'}, status=400)
    try:
        client = SandboxClient()
        if not client.verify_notification(event, headers):
            return Response({'detail':'Notification signature could not be verified.'}, status=403)
    except PayPalError:
        # PayPal retries a non-2xx response. Never acknowledge a temporary outage.
        return Response({'detail':'Notification verification is temporarily unavailable.'}, status=503)
    if event['event_type'] != 'PAYMENT.CAPTURE.COMPLETED':
        return Response({'received':True, 'outcome':'unsupported_event'})
    resource = event.get('resource')
    related = resource.get('supplementary_data', {}).get('related_ids', {}) if isinstance(resource, dict) and isinstance(resource.get('supplementary_data', {}), dict) else {}
    provider_order = related.get('order_id') if isinstance(related, dict) else None
    capture = resource.get('id') if isinstance(resource, dict) else None
    if not provider_id(provider_order) or not provider_id(capture):
        return Response({'detail':'Capture notification has no valid order binding.'}, status=400)
    with transaction.atomic():
        matches = list(Order.objects.select_for_update().filter(payment_method='paypal',
            payment_instructions__paypal_sandbox__paypal_order_id=provider_order).order_by('pk')[:2])
        if len(matches) != 1:
            # Another app's event or ambiguous legacy binding cannot pay an order.
            return Response({'received':True, 'outcome':'unmatched_order'})
        order = matches[0]
        if order.payment_status == 'refunded':
            return Response({'received':True, 'outcome':'refund_record_preserved'})
        try:
            check_existing_payment(order, client, None, 'notification', expected_capture=capture)
            intent = dict(order.payment_instructions['paypal_sandbox'])
            intent['last_notification'] = {'id':event['id'], 'type':event['event_type'], 'received_at':intent['last_checked_at']}
            save_intent(order, intent)
        except PayPalError as error:
            record_check_error(order, error, 'notification')
            if error.code == 'verification_failed':
                return Response({'received':True, 'outcome':'review_required'})
            return Response({'detail':'Payment status is not ready. Retry this notification.'}, status=503)
    return Response({'received':True, 'outcome':'reconciled'})
