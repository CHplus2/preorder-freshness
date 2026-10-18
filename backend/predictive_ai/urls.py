from django.urls import path
from myapp.views import predictive
from myapp.views.local_planning import local_planning, local_scenario, local_forecast
from myapp.views.kitchen_reviews import local_reviews, review_outcome

urlpatterns=[
    path('model-backup/', predictive.model_backup, name='model-backup'),
    path('local-reviews/', local_reviews),
    path('local-review-outcomes/', review_outcome),
    path('local-decisions/', local_planning, name='local-decisions'),
    path('local-decision-scenario/', local_scenario, name='local-decision-scenario'),
    path('local-forecast/', local_forecast),
    path('local-plan/', local_planning),
    path('local-scenario/', local_scenario),
    path('backtest/', predictive.backtest),
    path('metrics/',predictive.metrics),
    path('centers/',predictive.centers),
    path('forecast/',predictive.forecast),
    path('inventory-risk/',predictive.inventory_risk),
    path('what-if/',predictive.what_if),
]
