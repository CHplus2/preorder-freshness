from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import KitchenBlock, Storefront, Order
from ..services.scheduling import booked_tasks

class ManualPlanInput(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def manual_order_plan(request, pk):
    """Preview an owner-defined whole-kitchen reservation, then confirm its version."""
    from datetime import timedelta
    from django.core import signing
    from django.utils import timezone
    from ..models import OrderAmendment
    from ..serializers import OrderSerializer
    import uuid

    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
    if request.method == 'GET':
        return Response({'history': [{'id': a.pk, 'at': a.created_at, 'actor': a.actor_id, 'before': a.before, 'after': a.after}
            for a in order.amendments.order_by('-created_at','-pk')[:20]]})
    token = request.data.get('confirm')
    previous = None
    if token is not None:
        if not isinstance(token, str) or len(token) > 30000:
            raise serializers.ValidationError('Invalid preview. Preview the preparation times again.')
        try:
            previous = signing.loads(token, salt='manual-kitchen-plan', max_age=600)
        except signing.BadSignature:
            raise serializers.ValidationError('Preview expired. Preview the preparation times again.')
        if previous['order'] != order.pk or previous['actor'] != request.user.pk:
            raise serializers.ValidationError('This preview belongs to another order or owner.')
        if order.amendments.filter(after__manual_request_id=previous['request_id']).exists():
            return Response({'order': OrderSerializer(order).data, 'already_applied': True})
    if order.status != 'pending' or order.inventory_deducted:
        raise serializers.ValidationError('Only orders awaiting preparation can have their plan edited.')
    if not order.delivery_at:
        raise serializers.ValidationError('Set a requested delivery time first.')
    incoming = ManualPlanInput(data=previous or request.data)
    incoming.is_valid(raise_exception=True)
    start, end = incoming.validated_data['start'], incoming.validated_data['end']
    if start <= timezone.now() or end <= start:
        raise serializers.ValidationError('Choose a future start and an end after the start.')
    if end > order.delivery_at - timedelta(minutes=store.delivery_buffer_minutes):
        raise serializers.ValidationError('Finish preparation before the delivery buffer begins. Change the delivery request first if needed.')
    if end-start > timedelta(days=30):
        raise serializers.ValidationError('Use a preparation window of at most 30 days.')
    warnings = []
    a, b = timezone.localtime(start), timezone.localtime(end)
    if a.date() != b.date() or a.hour < store.kitchen_open_hour or (b.hour, b.minute, b.second) > (store.kitchen_close_hour, 0, 0):
        warnings.append('This window spans days or includes time outside kitchen hours. The entire window will be reserved, including overnight gaps.')
    others = Order.objects.filter(status__in=['pending','processing'], inventory_deducted=False,
        preparation_at__lt=end, delivery_at__gt=start).exclude(pk=order.pk)
    overlaps = [o.pk for o in others if any(t['start'] < end and t['end'] > start for t in booked_tasks([o], store))]
    if overlaps:
        warnings.append('Overlaps preparation for orders: '+', '.join(str(pk) for pk in overlaps)+'. Existing plans will not be moved.')
    if KitchenBlock.objects.filter(start_at__lt=end, end_at__gt=start).exists():
        warnings.append('Overlaps a blocked kitchen period.')
    warnings.append('This is an overall time reservation. Check recipe durations, ingredient freshness, storage and gaps between steps yourself; individual steps will not be retained in the active plan.')
    snapshot = dict(order=order.pk, actor=request.user.pk, version=order.updated_at.isoformat(),
        start=start.isoformat(), end=end.isoformat(), reason=incoming.validated_data['reason'], warnings=warnings,
        delivery=order.delivery_at.isoformat(), buffer=store.delivery_buffer_minutes,
        request_id=previous['request_id'] if previous else str(uuid.uuid4()))
    if previous:
        if previous != snapshot:
            return Response({'detail': 'The order or kitchen availability changed. Preview again.'}, status=409)
        minutes = (end-start).total_seconds()/60
        before = {'plan': order.preparation_plan, 'start': order.preparation_at.isoformat() if order.preparation_at else None,
            'end': order.preparation_end_at.isoformat() if order.preparation_end_at else None}
        order.preparation_at, order.preparation_end_at = start, end
        order.preparation_plan = dict(mode='manual_window', needs_review=False,
            manually_confirmed_by=request.user.pk, manually_confirmed_at=timezone.now().isoformat(),
            reason=snapshot['reason'], warnings=warnings, minutes=minutes, hands_on_minutes=minutes,
            tasks=[dict(name='Manual preparation window', menu='Owner-arranged preparation', start=start.isoformat(),
                end=end.isoformat(), minutes=minutes, resource='all', worker=True)])
        order.save(update_fields=['preparation_at','preparation_end_at','preparation_plan','updated_at'])
        OrderAmendment.objects.create(order=order, actor=request.user, before=before,
            after={'manual_request_id': snapshot['request_id'], 'plan': order.preparation_plan})
        return Response({'order': OrderSerializer(order).data, 'already_applied': False})
    return Response({'preview': snapshot, 'confirm': signing.dumps(snapshot, salt='manual-kitchen-plan', compress=True)})

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
    from ..services.commitments import scheduled_item, preparation_snapshot
    from ..models import OrderIngredient, Product
    adopt_current = serializers.BooleanField(default=False).run_validation(request.data.get('adopt_current', False))
    list(Product.objects.select_for_update().filter(pk__in=[i.product_id for i in items]).order_by('pk'))
    # Reload after locks so an editor and this approval cannot cross.
    items = list(order.items.select_related('product').prefetch_related('accepted_ingredients'))
    scheduled = items if adopt_current else [scheduled_item(i) for i in items]
    missing = [item.product.name for item in scheduled if not item.product.preparation_tasks]
    if missing:
        raise serializers.ValidationError('Add preparation steps in Menus first: '+', '.join(missing)+'.')
    plan = schedule_order(scheduled, order.delivery_at, store, exclude_order_id=order.pk, notice_from=order.created_at)
    snapshot = dict(order=order.pk,start=plan['start'].isoformat(),end=plan['end'].isoformat(),plan=plan_snapshot(plan))
    snapshot['adopt_current'] = adopt_current
    snapshot['recipes'] = [{'item': i.pk, 'menu': i.product_name,
        'ingredients': [{'raw_material': r.raw_material_id, 'name': r.raw_material.name,
            'unit': r.raw_material.unit, 'quantity': str(r.quantity_required)}
            for r in i.product.ingredients.select_related('raw_material')],
        'preparation': preparation_snapshot(i.product),
        'packaging': str(i.product.packaging_cost) if i.product.packaging_cost is not None else None}
        for i in items] if adopt_current else []
    snapshot['order_version'] = order.updated_at.isoformat()
    token = request.data.get('confirm')
    if token:
        try:
            previous = signing.loads(token, salt='kitchen-plan-review', max_age=600)
        except (signing.BadSignature, TypeError):
            raise serializers.ValidationError('This preview has expired. Preview the plan again before saving.')
        if previous != snapshot:
            return Response({'detail':'Availability or menu timings changed. Preview again to review the updated plan.'},status=409)
        from ..models import OrderAmendment
        before = {'plan': order.preparation_plan, 'items': [
            {'id': i.pk, 'recipe_source': i.recipe_source, 'preparation': i.preparation_snapshot,
             'packaging': str(i.packaging_unit_cost) if i.packaging_unit_cost is not None else None,
             'ingredients': [{'material': r.material_name, 'raw_material': r.raw_material_id,
                'unit': r.unit, 'quantity': str(r.quantity_per_portion)} for r in i.accepted_ingredients.all()]}
            for i in items]}
        if adopt_current:
            for item, row in zip(items, snapshot['recipes']):
                item.accepted_ingredients.all().delete()
                OrderIngredient.objects.bulk_create([OrderIngredient(order_item=item,
                    raw_material_id=r['raw_material'], material_name=r['name'], unit=r['unit'],
                    quantity_per_portion=r['quantity']) for r in row['ingredients']])
                item.preparation_snapshot = row['preparation']
                item.recipe_source = 'owner_amended'
                item.packaging_unit_cost = row['packaging']
                item.save(update_fields=['preparation_snapshot', 'recipe_source', 'packaging_unit_cost'])
        order.preparation_at=plan['start'];order.preparation_end_at=plan['end'];order.preparation_plan=plan_snapshot(plan)
        order.save(update_fields=['preparation_at','preparation_end_at','preparation_plan','updated_at'])
        OrderAmendment.objects.create(order=order, actor=request.user, before=before, after=snapshot)
        return Response({'order':OrderSerializer(order).data})
    return Response({'preview':snapshot,'confirm':signing.dumps(snapshot,salt='kitchen-plan-review',compress=True)})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def accepted_recipe(request, pk):
    order = get_object_or_404(Order.objects.prefetch_related('items__accepted_ingredients', 'amendments'), pk=pk)
    return Response({'items': [{'menu': i.product_name, 'portions': i.quantity, 'source': i.recipe_source,
        'packaging_per_portion': str(i.packaging_unit_cost) if i.packaging_unit_cost is not None else None,
        'ingredients': [{'name': r.material_name, 'unit': r.unit, 'per_portion': str(r.quantity_per_portion),
            'total': str(r.quantity_per_portion*i.quantity)} for r in i.accepted_ingredients.all()]}
        for i in order.items.all()],
        'amendments': [{'id': a.pk, 'actor': a.actor_id, 'at': a.created_at,
            'before': a.before, 'after': a.after} for a in order.amendments.filter(before__items__isnull=False).order_by('-created_at')[:20]]})
