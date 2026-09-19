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
