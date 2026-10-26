from uuid import uuid4
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import Order, Storefront, Product, OrderAmendment
from ..services.shared_batches import build_plans, compatibility, digest
from ..services.scheduling import plan_snapshot, booked_tasks


class BatchInput(serializers.Serializer):
    order_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=2, max_length=10)
    mode = serializers.ChoiceField(choices=['combine', 'separate'], default='combine')
    confirm = serializers.CharField(max_length=10000, required=False)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
@transaction.atomic
def shared_batches(request):
    now = timezone.now()
    if request.method == 'GET':
        store = Storefront.objects.filter(pk=1).first() or Storefront()
        day = serializers.DateField().run_validation(request.query_params.get('date'))
        groups, shared = {}, {}
        orders = Order.objects.filter(status='pending', delivery_at__date=day, inventory_deducted=False).order_by('id')[:100]
        for order in orders:
            batch = order.preparation_plan.get('shared_batch')
            if batch:
                shared[batch['id']] = dict(batch, delivery_at=order.delivery_at, menu=order.items.first().product_name)
                continue
            if not order.preparation_at or order.preparation_at <= now or order.preparation_plan.get('needs_review'):
                continue
            try:
                key, item, _ = compatibility(order, store)
            except serializers.ValidationError:
                continue
            row = groups.setdefault(key, dict(order_ids=[], menu=item.product_name, delivery_at=order.delivery_at, quantity=0))
            row['order_ids'].append(order.pk); row['quantity'] += item.quantity
        return Response({'candidates': [row for row in groups.values() if 2 <= len(row['order_ids']) <= 10], 'shared': list(shared.values()), 'checked_limit': 100})
    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    now = timezone.now()
    incoming = BatchInput(data=request.data); incoming.is_valid(raise_exception=True)
    values = incoming.validated_data
    ids = sorted(set(values['order_ids']))
    if len(ids) != len(values['order_ids']):
        raise serializers.ValidationError('Choose distinct orders.')
    previous = None
    if values.get('confirm'):
        try:
            previous = signing.loads(values['confirm'], salt='shared-cooking-v1', max_age=600)
        except signing.BadSignature:
            raise serializers.ValidationError('This preview expired. Calculate the batch again.')
        if previous['actor'] != request.user.pk or previous['ids'] != ids or previous['mode'] != values['mode']:
            raise serializers.ValidationError('This preview belongs to another selection or owner.')
    orders = list(Order.objects.select_for_update().filter(pk__in=ids).order_by('pk'))
    if len(orders) != len(ids):
        raise serializers.ValidationError('An order is missing. Refresh the selection.')
    if previous and all(o.amendments.filter(after__shared_request_id=previous['request_id']).exists() for o in orders):
        return Response({'applied': True, 'already_applied': True})
    list(Product.objects.select_for_update().filter(pk__in=[i.product_id for o in orders for i in o.items.all()]).order_by('pk'))
    clock = parse_datetime(previous['clock']) if previous else now
    plans = build_plans(orders, store, clock, values['mode'])
    fingerprint = digest([[(o.pk, o.updated_at) for o in orders], plans])
    if previous:
        if fingerprint != previous['fingerprint'] or min(p['start'] for p in plans.values()) <= timezone.now():
            return Response({'detail': 'Orders or kitchen availability changed. Calculate a fresh preview.'}, status=409)
        batch = dict(id=previous['request_id'], order_ids=ids) if values['mode'] == 'combine' else None
        for order in orders:
            before = {'plan': order.preparation_plan, 'start': str(order.preparation_at), 'end': str(order.preparation_end_at)}
            plan = plans.get(order.pk)
            if plan:
                order.preparation_at, order.preparation_end_at = plan['start'], plan['end']
                order.preparation_plan = plan_snapshot(plan)
                if batch:
                    order.preparation_plan['shared_batch'] = batch
            else:
                order.preparation_plan = {k: v for k, v in order.preparation_plan.items() if k != 'shared_batch'}
            order.save(update_fields=['preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
            OrderAmendment.objects.create(order=order, actor=request.user, before=before,
                after={'kind': 'shared_cooking', 'mode': values['mode'], 'shared_request_id': previous['request_id'], 'plan': order.preparation_plan})
        return Response({'applied': True, 'already_applied': False})
    token = dict(actor=request.user.pk, ids=ids, mode=values['mode'], clock=clock.isoformat(), fingerprint=fingerprint, request_id=str(uuid4()))
    unique = list(plans.values())[:1] if values['mode'] == 'combine' else list(plans.values())
    prior_minutes = sum((t['end']-t['start']).total_seconds()/60 for t in booked_tasks(orders, store) if t['worker'] and t['end'] > t['start'])
    return Response({'preview': {'orders': ids, 'mode': values['mode'], 'previous_hands_on_minutes': prior_minutes,
        'hands_on_minutes': sum(p['hands_on_minutes'] for p in unique), 'tasks': [t for p in unique for t in p['tasks']],
        'plans': [dict(order_id=pk, start=p['start'], end=p['end'], task_count=len(p['tasks'])) for pk, p in plans.items()]},
        'confirm': signing.dumps(token, salt='shared-cooking-v1', compress=True)})
