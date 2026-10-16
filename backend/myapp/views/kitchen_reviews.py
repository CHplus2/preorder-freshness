"""Signed browser-held decision snapshots and read-only recorded outcomes."""
from datetime import date, datetime
from decimal import Decimal
from django.core import signing
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from ..models import WasteRecord, OrderItem
from ..services.local_planning import local_plan
from ..services.kitchen_decisions import decision_support

SALT = 'freshcast-kitchen-decision-v1'
DEFINITION = 'Recorded outcomes for the snapshot batches and mapped menus; missing waste records do not prove no waste. Sales are observed over local calendar days. No causal savings or avoided-waste claim is inferred.'

class ReviewInput(serializers.Serializer):
    request_id = serializers.UUIDField()
    raw_material_id = serializers.IntegerField(min_value=1)
    horizon_days = serializers.IntegerField(min_value=1, max_value=28, default=7)
    action = serializers.ChoiceField(choices=['purchasing', 'menu', 'marketing', 'wait'])
    note = serializers.CharField(max_length=1000, allow_blank=True, default='')
    action_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), allow_null=True, default=None)
    assumed_avoided_percent = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal('0'), max_value=Decimal('100'), allow_null=True, default=None)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def local_reviews(request):
    if not isinstance(request.data, dict) or set(request.data)-set(ReviewInput().fields):
        raise serializers.ValidationError('Use only documented decision-review fields.')
    serializer = ReviewInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    plan = local_plan(values['horizon_days'])
    evidence = decision_support(plan)
    risk = next((r for r in evidence['ingredient_risks'] if r['raw_material_id'] == values['raw_material_id']), None)
    if risk is None:
        raise serializers.ValidationError('No current evidence for this ingredient. Refresh the kitchen decisions.')
    snapshot = {'id': str(values['request_id']), 'created_at': timezone.now().isoformat(),
        'raw_material_id': risk['raw_material_id'], 'ingredient_name': risk['ingredient_name'], 'unit': risk['unit'],
        'review_by': risk['urgent_by'] or plan['window']['end_date'], 'action': values['action'], 'note': values['note'],
        'baseline': risk, 'horizon_days': values['horizon_days'],
        'forecast_evaluation': [{'product_id': m['product_id'], 'method': m['method'], 'evaluation': m['evaluation']}
            for m in evidence['menus'] if m['product_id'] in {p['product_id'] for p in risk['menus']}],
        'assumptions': {k: str(values[k]) if values[k] is not None else None for k in ('action_cost', 'assumed_avoided_percent')},
        'batch_ids': [b['batch_id'] for b in plan['batches'] if b['raw_material_id'] == risk['raw_material_id']],
        'menu_ids': [m['product_id'] for m in risk['menus']]}
    response = Response({'id': snapshot['id'], 'snapshot': snapshot,
        'token': signing.dumps(snapshot, salt=SALT, compress=True),
        'detail': 'Signed evidence ready to save in this browser. No operational action executed.'}, status=201)
    response['Cache-Control'] = 'private, no-store'
    return response

@api_view(['POST'])
@permission_classes([IsAdminUser])
def review_outcome(request):
    if not isinstance(request.data, dict) or set(request.data) != {'token'}:
        raise serializers.ValidationError('Provide a signed decision token only.')
    token = serializers.CharField(max_length=100000).run_validation(request.data['token'])
    try:
        row = signing.loads(token, salt=SALT, max_age=365*86400)
    except signing.BadSignature:
        raise serializers.ValidationError('The saved decision is invalid or older than one year. Start a fresh review.')
    start = timezone.localtime(datetime.fromisoformat(row['created_at'])).date()
    deadline = date.fromisoformat(row['review_by'])
    end = min(timezone.localdate(), deadline)
    waste = list(WasteRecord.objects.filter(inventory_item_id__in=row['batch_ids'],
        created_at__gte=row['created_at'], created_at__date__lte=end))
    sales = OrderItem.objects.filter(product_id__in=row['menu_ids'], order__status='delivered', order__payment_status='paid').annotate(
        day=Coalesce('order__delivery_at','order__created_at')).filter(day__date__range=(start, end))
    response = Response({'api_version': '1', 'row': {**row,
        'observed_menu_portions': sales.aggregate(n=Sum('quantity'))['n'] or 0,
        'recorded_waste_quantity': float(sum((w.quantity for w in waste), Decimal('0'))),
        'known_waste_cost': float(sum((w.estimated_cost for w in waste if w.estimated_cost is not None), Decimal('0'))),
        'unpriced_waste_records': sum(w.estimated_cost is None for w in waste), 'recorded_waste_records': len(waste),
        'outcome_status': 'window_complete' if timezone.localdate() > deadline else 'in_progress'}, 'definition': DEFINITION})
    response['Cache-Control'] = 'private, no-store'
    return response
