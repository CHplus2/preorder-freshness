"""Staff-only local planning endpoint, independent of optional ML artifacts."""
import re

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ..services.local_planning import local_plan


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
