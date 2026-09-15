from rest_framework import viewsets, status, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Product, CartItem
from ..serializers import CartItemSerializer

class CartViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        items = CartItem.objects.filter(user=request.user)
        serializer = CartItemSerializer(items, many=True)
        return Response(serializer.data)

    def create(self, request):
        product_id = request.data.get("product_id")
        quantity = serializers.IntegerField(min_value=1, max_value=10000).run_validation(request.data.get("quantity", 1))

        if not product_id:
            return Response({"detail": "product_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        item, created = CartItem.objects.get_or_create(
            user=request.user,
            product=product,
            defaults={"quantity": quantity},   
        )

        if not created: 
            item.quantity += quantity
            item.save()

        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)
    
    def partial_update(self, request, pk=None):
        try:
            item = CartItem.objects.get(pk=pk, user=request.user)
        except CartItem.DoesNotExist:
            return Response({"detail": "Cart item not found"}, status=status.HTTP_404_NOT_FOUND)

        quantity = request.data.get("quantity")

        if quantity is None:
            return Response({"detail": "Quantity required"}, status=status.HTTP_400_BAD_REQUEST)

        quantity = serializers.IntegerField(min_value=0, max_value=10000).run_validation(quantity)

        if quantity <= 0:
            item.delete()
            return Response({"detail": "Item removed"}, status=status.HTTP_200_OK)

        item.quantity = quantity
        item.save()

        return Response(CartItemSerializer(item).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        try:
            item = CartItem.objects.get(pk=pk, user=request.user)
        except CartItem.DoesNotExist:
            return Response({"detail": "Cart item not found"}, status=status.HTTP_404_NOT_FOUND)

        item.delete()
        return Response({"detail": "Item removed"}, status=status.HTTP_200_OK)