import secrets
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from ..services.reminders import email_ready, customer_email_ready, customer_due, send_due_reminders

@api_view(['GET'])
@permission_classes([IsAdminUser])
def reminder_status(request):
    return Response({'email_configured': email_ready(),
                     'customer_email_configured': customer_email_ready(),
                     'scheduler_activity_verified': False,
                     'customer_reminders_due': customer_due().count(),
                     'scheduler_secret_configured': len(settings.CRON_SECRET) >= 32})

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def run_reminders(request):
    secret = settings.CRON_SECRET
    if len(secret) < 32 or not secrets.compare_digest(
            request.headers.get('Authorization', '').encode('utf-8'), ('Bearer '+secret).encode('utf-8')):
        return Response({'detail': 'Unauthorized.'}, status=401)
    if not (email_ready() or customer_email_ready()):
        return Response({'detail': 'Configure SMTP and an owner email or customer reminder origin before enabling reminders.'}, status=503)
    result = send_due_reminders(include_owner=email_ready(), include_customer=customer_email_ready())
    return Response(result, status=503 if result['failed'] else 200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customer_reminder(request, pk):
    from django.db import transaction
    from django.shortcuts import get_object_or_404
    from django.utils import timezone
    from django.core.exceptions import ValidationError as DjangoValidationError
    from rest_framework import serializers
    from ..models import Order
    from ..services.reminders import reminder_preference
    class Input(serializers.Serializer):
        enabled = serializers.BooleanField()
    incoming = Input(data=request.data)
    incoming.is_valid(raise_exception=True)
    enabled = incoming.validated_data['enabled']
    with transaction.atomic():
        order = get_object_or_404(Order.objects.select_for_update(), pk=pk, user=request.user)
        if enabled and (order.status in ('cancelled', 'delivered') or not order.delivery_at or order.delivery_at <= timezone.now()):
            raise serializers.ValidationError('Reminders apply to open orders with a future time.')
        try:
            preference = reminder_preference(request.user, enabled)
        except DjangoValidationError:
            raise serializers.ValidationError('Add a valid email in Account settings before enabling reminders.')
        order.fulfilment_snapshot = dict(order.fulfilment_snapshot, customer_reminder=preference)
        order.save(update_fields=['fulfilment_snapshot', 'updated_at'])
    return Response({'enabled': enabled, 'email': preference['email']})
