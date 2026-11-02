"""Bounded, all-or-nothing grouped confirmations of actual kitchen progress."""
from django.db import transaction
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, OrderIngredient
from ..services.order_progress import apply_progress, validate_progress


class SelectedOrder(serializers.Serializer):
    id = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
    version = serializers.DateTimeField()


class ProgressInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=('cooked', 'shipped', 'delivered'))
    orders = SelectedOrder(many=True, min_length=1, max_length=20)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def confirm_order_progress(request):
    if not isinstance(request.data, dict) or set(request.data) - {'status', 'orders'}:
        raise ValidationError('Submit only the selected orders and their actual progress. Record payments separately.')
    incoming = ProgressInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    selected = incoming.validated_data['orders']
    expected = {row['id']: row['version'] for row in selected}
    if len(expected) != len(selected):
        raise ValidationError('Select each order once.')
    target = incoming.validated_data['status']
    orders = list(Order.objects.select_for_update().filter(pk__in=expected).order_by('pk'))
    if len(orders) != len(expected):
        return Response({'detail': 'A selected order is unavailable. Refresh Planner; no selected orders were updated.'}, status=404)
    for order in orders:
        if order.updated_at != expected[order.pk]:
            return Response({'detail': f'Order #{order.pk} changed. Refresh Planner and review your selection; no selected orders were updated.'}, status=409)
        validate_progress(order, target)
    if target == 'cooked':
        # Acquire the union of stock rows in global material/expiry order before
        # deducting any selected recipe. Per-order acquisition can deadlock when
        # different groups contain recipes with opposite ingredient sequences.
        from .orders import usable_stock
        materials = OrderIngredient.objects.filter(order_item__order__in=[o.pk for o in orders if not o.inventory_deducted]).values('raw_material_id')
        list(usable_stock().filter(raw_material_id__in=materials).select_for_update()
             .order_by('raw_material_id', 'expiry_date', 'received_date', 'id'))
    for order in orders:
        try:
            apply_progress(order, target, request.user)
        except ValidationError as error:
            message = error.detail[0] if isinstance(error.detail, list) else str(error.detail)
            raise ValidationError(f'Order #{order.pk}: {message} No selected orders were updated.')
    return Response({'updated': [{'id': o.pk, 'status': o.status, 'updated_at': o.updated_at.isoformat()} for o in orders]})
