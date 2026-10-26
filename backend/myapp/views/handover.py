from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Order, OrderAmendment
from ..serializers import OrderSerializer
from ..services.handover import HandoverInput


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def order_handover(request, pk):
    if not isinstance(request.data, dict):
        raise serializers.ValidationError('Submit handover details as an object.')
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk, user=request.user)
    if order.status not in ('pending', 'processing', 'cooked'):
        raise serializers.ValidationError('Contact the kitchen to change handover details after dispatch or closure.')
    version = serializers.DateTimeField().run_validation(request.data.get('version'))
    if order.updated_at != version:
        return Response({'detail': 'This order changed. Refresh My orders before changing handover details.'}, status=409)
    incoming = HandoverInput(data=request.data.get('handover'), context={'pickup': order.delivery_method == 'pickup'})
    incoming.is_valid(raise_exception=True)
    before = order.fulfilment_snapshot.get('handover', {})
    saved = dict(incoming.validated_data)
    order.fulfilment_snapshot = dict(order.fulfilment_snapshot, handover=saved)
    order.save(update_fields=['fulfilment_snapshot', 'updated_at'])
    OrderAmendment.objects.create(order=order, actor=request.user, before={'handover': before},
                                  after={'kind': 'handover_details', 'handover': saved})
    return Response({'order': OrderSerializer(order, context={'request': request}).data})
