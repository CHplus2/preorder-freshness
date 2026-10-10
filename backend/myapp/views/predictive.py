"""Staff-only forecasting routes; optional ML dependencies load after permission checks."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from predictive_ai import service


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
