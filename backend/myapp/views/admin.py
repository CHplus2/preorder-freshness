from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.db.models import Sum, F
from django.db import transaction
from rest_framework.exceptions import ValidationError
from .orders import deduct_inventory
from django.contrib.auth.models import User
from ..models import Order, OrderItem
from ..serializers import OrderSerializer, UserSerializer

@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_order_list(request):
    orders = Order.objects.select_related("user", "address").prefetch_related("items").order_by("-created_at")
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["PATCH"])
@permission_classes([IsAdminUser])
@transaction.atomic
def admin_order_detail(request, pk):
    try:
        order = Order.objects.select_for_update().get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get("status")
    new_payment_status = request.data.get("payment_status")

    transitions = {
        'pending': {'pending', 'processing', 'cancelled'},
        'processing': {'processing', 'cooked', 'cancelled'},
        'cooked': {'cooked', 'shipped', 'cancelled'},
        'shipped': {'shipped', 'delivered'},
        'delivered': {'delivered'}, 'cancelled': {'cancelled'},
    }
    if new_status:
        if new_status not in transitions.get(order.status, set()):
            raise ValidationError('Follow pending, processing, cooked, shipped, delivered. Cancellation is allowed before dispatch.')
        if new_status == 'cooked' and not order.inventory_deducted:
            for item in order.items.select_related('product'):
                if not item.product:
                    raise ValidationError('An ordered menu was deleted; resolve its recipe before cooking.')
                deduct_inventory(item.product, item.quantity, request.user, order)
            order.inventory_deducted = True
        order.status = new_status
    if new_payment_status:
        if new_payment_status not in dict(Order.PAYMENT_STATUS):
            raise ValidationError('Invalid payment status.')
        order.payment_status = new_payment_status
    order.save()

    return Response({"detail": "Order updated", "order": OrderSerializer(order).data}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def product_sales_report(request):
    """
    Returns total quantity sold and total revenue per product.
    """
    sales = (
        OrderItem.objects
        .filter(order__payment_status="paid").exclude(order__status="cancelled")
        .values("product__id", "product_name")
        .annotate(
            total_quantity=Sum("quantity"),
            total_revenue=Sum(F("quantity") * F("unit_price"))
        )
        .order_by("-total_revenue")
    )
    return Response(sales, status=status.HTTP_200_OK)

class AdminCustomerViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]

@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_customers_list(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(["PUT"])
@permission_classes([IsAdminUser])
def admin_customer_update(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserSerializer(user, data=request.data, partial=True)  # partial=True allows partial updates
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)