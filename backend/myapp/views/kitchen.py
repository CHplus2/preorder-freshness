from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import KitchenBlock, Storefront, Order
from ..services.scheduling import booked_tasks

class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitchenBlock
        fields = ['id','start_at','end_at','reason']
    def validate(self, attrs):
        if attrs['end_at'] <= attrs['start_at']:
            raise serializers.ValidationError('End time must be after start time.')
        return attrs

@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def kitchen_blocks(request):
    if request.method == 'GET':
        return Response(BlockSerializer(KitchenBlock.objects.all(),many=True).data)
    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    serializer = BlockSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    start,end = serializer.validated_data['start_at'],serializer.validated_data['end_at']
    orders = Order.objects.filter(status__in=['pending','processing'],inventory_deducted=False,preparation_at__lt=end,delivery_at__gt=start)
    if any(t['start'] < end and t['end'] > start for t in booked_tasks(orders, store)):
        raise serializers.ValidationError('This period overlaps a booked preparation step. Resolve that customer commitment before blocking the kitchen.')
    serializer.save()
    return Response(serializer.data,status=201)

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
@transaction.atomic
def kitchen_block_detail(request, pk):
    Storefront.objects.get_or_create(pk=1)
    Storefront.objects.select_for_update().get(pk=1)
    get_object_or_404(KitchenBlock, pk=pk).delete()
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def review_order_plan(request, pk):
    from django.core import signing
    from ..services.scheduling import schedule_order, plan_snapshot
    from ..serializers import OrderSerializer
    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
    if order.status != 'pending' or order.inventory_deducted:
        raise serializers.ValidationError('Only orders that have not started preparation can be replanned.')
    if not order.delivery_at:
        raise serializers.ValidationError('This order has no delivery date. Resolve its delivery arrangement first.')
    items = list(order.items.select_related('product'))
    if any(not item.product for item in items):
        raise serializers.ValidationError('An ordered menu was removed. Resolve its recipe before planning.')
    missing = [item.product.name for item in items if not item.product.preparation_tasks]
    if missing:
        raise serializers.ValidationError('Add preparation steps in Menus first: '+', '.join(missing)+'.')
    plan = schedule_order(items, order.delivery_at, store, exclude_order_id=order.pk, notice_from=order.created_at)
    snapshot = dict(order=order.pk,start=plan['start'].isoformat(),end=plan['end'].isoformat(),plan=plan_snapshot(plan))
    token = request.data.get('confirm')
    if token:
        try:
            previous = signing.loads(token, salt='kitchen-plan-review', max_age=600)
        except (signing.BadSignature, TypeError):
            raise serializers.ValidationError('This preview has expired. Preview the plan again before saving.')
        if previous != snapshot:
            return Response({'detail':'Availability or menu timings changed. Preview again to review the updated plan.'},status=409)
        order.preparation_at=plan['start'];order.preparation_end_at=plan['end'];order.preparation_plan=plan_snapshot(plan)
        order.save(update_fields=['preparation_at','preparation_end_at','preparation_plan'])
        return Response({'order':OrderSerializer(order).data})
    return Response({'preview':snapshot,'confirm':signing.dumps(snapshot,salt='kitchen-plan-review',compress=True)})
