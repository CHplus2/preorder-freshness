from django.urls import path
from myapp.views import predictive

urlpatterns=[
    path('metrics/',predictive.metrics),
    path('centers/',predictive.centers),
    path('forecast/',predictive.forecast),
    path('inventory-risk/',predictive.inventory_risk),
    path('what-if/',predictive.what_if),
]
