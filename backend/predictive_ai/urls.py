from django.urls import path
from myapp.views import predictive
from myapp.views.local_planning import local_planning, local_scenario

urlpatterns=[
    path('local-plan/', local_planning),
    path('local-scenario/', local_scenario),
    path('backtest/', predictive.backtest),
    path('metrics/',predictive.metrics),
    path('centers/',predictive.centers),
    path('forecast/',predictive.forecast),
    path('inventory-risk/',predictive.inventory_risk),
    path('what-if/',predictive.what_if),
]
