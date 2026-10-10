"""Staff-only local planning endpoint, independent of optional ML artifacts."""
import re

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import serializers
from datetime import timedelta
from decimal import Decimal

from ..services.local_planning import local_plan, planning_snapshot


@api_view(['GET'])
@permission_classes([IsAdminUser])
def local_planning(request):
    params = request.query_params
    value = params.get('horizon_days', '7')
    if (set(params) - {'horizon_days'} or any(len(params.getlist(k)) != 1 for k in params)
            or not re.fullmatch(r'[0-9]{1,2}', value) or not 1 <= int(value) <= 28):
        return Response({'code': 'invalid_parameters',
                         'detail': 'Use only horizon_days, an integer from 1 to 28.'}, status=400)
    response = Response(local_plan(int(value)))
    response['Cache-Control'] = 'private, no-store'
    return response


class PurchaseScenarioInput(serializers.Serializer):
    horizon_days = serializers.IntegerField(min_value=1, max_value=28, default=7)
    raw_material_id = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0.001'))
    unit_cost = serializers.DecimalField(max_digits=14, decimal_places=6, min_value=Decimal('0'), allow_null=True)
    arrival_date = serializers.DateField()
    expiry_date = serializers.DateField()


@api_view(['POST'])
@permission_classes([IsAdminUser])
def local_scenario(request):
    if not isinstance(request.data, dict) or set(request.data) - set(PurchaseScenarioInput().fields):
        return Response({'code': 'invalid_parameters', 'detail': 'Provide a JSON object with only documented purchase fields.'}, status=400)
    serializer = PurchaseScenarioInput(data=request.data)
    if not serializer.is_valid():
        return Response({'code': 'invalid_parameters', 'detail': 'Invalid purchase scenario.', 'errors': serializer.errors}, status=400)
    values = serializer.validated_data
    snapshot = planning_snapshot()
    today, materials, _, _ = snapshot
    end = today + timedelta(days=values['horizon_days'] - 1)
    if (values['raw_material_id'] not in materials or not today <= values['arrival_date'] <= end
            or values['expiry_date'] < values['arrival_date']):
        return Response({'code': 'invalid_parameters', 'detail': 'Choose an existing material, arrival within the planning window, and expiry on or after arrival.'}, status=400)
    baseline = local_plan(values['horizon_days'], snapshot=snapshot)
    scenario = local_plan(values['horizon_days'], hypothetical_purchase=values, snapshot=snapshot)
    purchase = {key: str(value) if key in ('quantity', 'unit_cost', 'arrival_date', 'expiry_date') and value is not None else value
                for key, value in values.items()}
    purchase['unit'] = materials[values['raw_material_id']].unit
    response = Response({'api_version': '1', 'mode': 'local_purchase_scenario', 'purchase': purchase,
                         'baseline': baseline, 'scenario': scenario,
                         'warnings': ['Hypothetical purchase only; no orders, payments, stock or purchasing records changed.']})
    response['Cache-Control'] = 'private, no-store'
    return response
