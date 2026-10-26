"""Owner-recorded courier references; no carrier event is inferred."""
from urllib.parse import urlsplit
import ipaddress
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, OrderAmendment
from ..serializers import OrderSerializer


class TrackingInput(serializers.Serializer):
    carrier = serializers.CharField(max_length=80)
    reference = serializers.CharField(max_length=100)
    url = serializers.URLField(max_length=500, allow_blank=True, default='')
    contact_phone = serializers.CharField(max_length=30, allow_blank=True, default='')
    version = serializers.DateTimeField()

    def validate_contact_phone(self, value):
        from ..services.handover import contact_number
        return contact_number(value)

    def validate_url(self, value):
        if not value:
            return value
        try:
            parsed = urlsplit(value)
            host = parsed.hostname or ''
            port = parsed.port
        except ValueError:
            raise serializers.ValidationError('Use a valid public HTTPS tracking link.')
        if parsed.scheme != 'https' or parsed.username or parsed.password or port not in (None, 443) or '.' not in host or host.endswith(('.local', '.localhost', '.internal')):
            raise serializers.ValidationError('Use the courier’s public HTTPS tracking page, without a sign-in token.')
        try:
            ipaddress.ip_address(host)
        except ValueError:
            return value
        raise serializers.ValidationError('Use a courier website name, not an IP address.')


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def courier_tracking(request, pk):
    incoming = TrackingInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    data = incoming.validated_data
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
    if order.delivery_method == 'pickup' or order.status == 'cancelled':
        raise serializers.ValidationError('Tracking applies to active delivery orders, not collection or cancelled orders.')
    if order.updated_at != data.pop('version'):
        return Response({'detail': 'This order changed. Refresh its records before saving tracking.'}, status=409)
    before = order.fulfilment_snapshot.get('courier', {})
    courier = dict(data, updated_at=timezone.now().isoformat())
    order.fulfilment_snapshot = dict(order.fulfilment_snapshot, courier=courier)
    order.save(update_fields=['fulfilment_snapshot', 'updated_at'])
    OrderAmendment.objects.create(order=order, actor=request.user, before={'courier': before}, after={'kind': 'courier_tracking', 'courier': courier})
    return Response({'order': OrderSerializer(order, context={'request': request}).data})
