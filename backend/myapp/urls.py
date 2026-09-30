from .views.help import KitchenHelp
from .views.rescheduling import reschedule_order
from .views.payments import payments
from .views.outcomes import contribution_report, batch_trace
from .views.discovery import guided_menu, basket_slots, recommendation_event, recommendation_metrics
from .views.auth import recovery_request, recovery_confirm
from .views.costs import expenses, void_expense, record_waste, cost_report
from .views.reminders import reminder_status, run_reminders
from .views.kitchen import kitchen_blocks, kitchen_block_detail, review_order_plan, accepted_recipe
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views.storefront import storefront, reviews, review_access, inventory_freshness
from .views.planning import planning, sales_analytics
from .views.auth import signup_view, login_view, logout_view, check_auth
from .views.products import CategoryListCreate, CategoryDetail, ProductListCreate, ProductDetail, recommend, MenuList
from .views.cart import CartViewSet
from .views.orders import OrderList, place_order, AddressListCreate, saved_address, preparation_quote
from .views.wallet import get_wallet, create_wallet, topup_wallet
from .views.admin import admin_order_list, admin_order_detail, product_sales_report, AdminCustomerViewSet
from .views.inventory import (
    RawMaterialListCreate, RawMaterialDetail,
    InventoryItemListCreate, InventoryItemDetail,
)

router = DefaultRouter()
router.register("cart", CartViewSet, basename="cart")
router.register("admin/customers", AdminCustomerViewSet, basename="admin-customers")

urlpatterns = [
    path('orders/<int:pk>/reschedule/', reschedule_order),
    path('auth/recovery/', recovery_request),
    path('auth/recovery/confirm/', recovery_confirm),
    path('menu/guide/', guided_menu),
    path('orders/slots/', basket_slots),
    path('recommendation/events/', recommendation_event),
    path('admin/recommendation-metrics/', recommendation_metrics),
    path('admin/contribution/', contribution_report),
    path('admin/inventory-items/<int:pk>/trace/', batch_trace),
    path('admin/orders/<int:pk>/payments/', payments),
    path('admin/orders/<int:pk>/accepted-recipe/', accepted_recipe),
    path("help/", KitchenHelp.as_view()),
    path("admin/costs/", cost_report),
    path("admin/expenses/", expenses),
    path("admin/expenses/<int:pk>/void/", void_expense),
    path("admin/waste/", record_waste),
    path("admin/reminder-status/", reminder_status),
    path("reminders/run/", run_reminders),
    path("menu/", MenuList.as_view()),
    path("inventory-freshness/", inventory_freshness),
    path("admin/orders/<int:pk>/preparation-plan/", review_order_plan),
    path("admin/kitchen-blocks/", kitchen_blocks),
    path("admin/kitchen-blocks/<int:pk>/", kitchen_block_detail),
    path("address/", saved_address),
    path("orders/quote/", preparation_quote),
    path("products/<int:pk>/review-access/", review_access),
    path("storefront/", storefront),
    path("products/<int:pk>/reviews/", reviews),
    path("admin/planning/", planning),
    path("admin/analytics/", sales_analytics),
    # Categories
    path("categories/", CategoryListCreate.as_view()),
    path("categories/<int:pk>/", CategoryDetail.as_view()),

    # Products
    path("products/", ProductListCreate.as_view()),
    path("products/<int:pk>/", ProductDetail.as_view()),

    # Address
    path("addresses/", AddressListCreate.as_view()),

    # Orders
    path("orders/", OrderList.as_view()),
    path("orders/place/", place_order),

    # Recommendation
    path("recommendation/", recommend),

    # Admin 
    path("admin/products/add/", ProductListCreate.as_view()),
    path("admin/products/<int:pk>/", ProductDetail.as_view()),
    path("", include(router.urls)),
    path("admin/orders/", admin_order_list, name="admin-order-list"),
    path("admin/orders/<int:pk>/", admin_order_detail, name="admin-order-detail"),
    path("admin/reports/sales/", product_sales_report, name="product-sales-report"),
    path("admin/raw-materials/", RawMaterialListCreate.as_view()),
    path("admin/raw-materials/<int:pk>/", RawMaterialDetail.as_view()),
    path("admin/inventory-items/", InventoryItemListCreate.as_view()),
    path("admin/inventory-items/<int:pk>/", InventoryItemDetail.as_view()),

    # Wallet
    path("wallet/", get_wallet),
    path("wallet/create/", create_wallet),
    path("wallet/topup/", topup_wallet),

    # Auth
    path("signup/", signup_view),
    path("login/", login_view),
    path("logout/", logout_view),
    path("check-auth/", check_auth),
    
] 
