"""Staff-only forecasting routes; optional ML dependencies load after permission checks."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from predictive_ai import service
from django.views.decorators.cache import cache_control


@cache_control(private=True, no_store=True)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def model_backup(request):
    """Owner download using the existing staff session; no database export."""
    if request.query_params:
        return Response({'detail':'This download does not accept parameters.'},status=400)
    from predictive_ai.bundle_export import verified_bundle_response
    return verified_bundle_response()


def dispatch(request, operation):
    try:
        if operation in ('forecast','inventory-risk','what-if'):
            values=request.data if operation=='what-if' else request.query_params
            if not isinstance(values,dict) and not hasattr(values,'getlist'):
                raise service.PredictiveError('invalid_parameters','Expected a JSON object.',400)
            if hasattr(values,'getlist') and any(len(values.getlist(k))!=1 for k in values):
                raise service.PredictiveError('invalid_parameters','Repeated query parameters are not supported.',400)
            result=service.forecast(values,scenario=operation=='what-if')
        else:
            if request.query_params:
                raise service.PredictiveError('invalid_parameters','This endpoint takes no query parameters.',400)
            history,_,metrics,centers=service.bundle()
            if operation=='metrics':
                result=dict(api_version='1',model_status='ready',metrics=metrics,warnings=[metrics.get('warning','')])
            else:
                result=dict(api_version='1',forecast_week=int(history.week.max())+1,
                    centers=centers[['center_id','center_type','op_area']].to_dict('records'),
                    warnings=['Simulated operational inputs may only cover one center.'])
        return Response(result)
    except service.PredictiveError as exc:
        return Response(dict(code=exc.code,detail=exc.detail),status=exc.status)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def metrics(request): return dispatch(request,'metrics')

@api_view(['GET'])
@permission_classes([IsAdminUser])
def centers(request): return dispatch(request,'centers')

@api_view(['GET'])
@permission_classes([IsAdminUser])
def forecast(request): return dispatch(request,'forecast')

@api_view(['GET'])
@permission_classes([IsAdminUser])
def inventory_risk(request): return dispatch(request,'inventory-risk')

@api_view(['POST'])
@permission_classes([IsAdminUser])
def what_if(request): return dispatch(request,'what-if')


@api_view(['GET'])
@permission_classes([IsAdminUser])
def backtest(request):
    from predictive_ai.backtest import backtest as replay
    try:
        values = request.query_params
        if any(len(values.getlist(k)) != 1 for k in values):
            raise service.PredictiveError('invalid_parameters', 'Repeated query parameters are not supported.', 400)
        response = Response(replay(values))
    except service.PredictiveError as exc:
        response = Response(dict(code=exc.code, detail=exc.detail), status=exc.status)
    response['Cache-Control'] = 'no-store'
    return response
