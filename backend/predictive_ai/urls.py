from django.urls import path
from myapp.views import predictive
from myapp.views.local_planning import local_planning

urlpatterns=[
    path('local-plan/', local_planning),
    path('metrics/',predictive.metrics),
    path('centers/',predictive.centers),
    path('forecast/',predictive.forecast),
    path('inventory-risk/',predictive.inventory_risk),
    path('what-if/',predictive.what_if),
]
