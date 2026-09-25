from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated, BasePermission, SAFE_METHODS
from ..models import RawMaterial, InventoryItem
from ..serializers import RawMaterialSerializer, InventoryItemSerializer


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


# ------------------------------------------
# RAW MATERIAL
# ------------------------------------------

class RawMaterialListCreate(generics.ListCreateAPIView):
    queryset = RawMaterial.objects.all().order_by("name")
    serializer_class = RawMaterialSerializer
    permission_classes = [IsAdminUser]


class RawMaterialDetail(generics.RetrieveUpdateDestroyAPIView):
    def perform_destroy(self, instance):
        if instance.inventory_items.exists() or instance.product_ingredients.exists():
            raise ValidationError('This ingredient is used by batches or recipes and cannot be deleted.')
        instance.delete()

    queryset = RawMaterial.objects.all()
    serializer_class = RawMaterialSerializer
    permission_classes = [IsAdminUser]


# ------------------------------------------
# INVENTORY ITEM
# ------------------------------------------

class InventoryItemListCreate(generics.ListCreateAPIView):
    queryset = InventoryItem.objects.all().order_by("expiry_date")
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminUser]


class InventoryItemDetail(generics.RetrieveUpdateDestroyAPIView):
    def perform_destroy(self, instance):
        if instance.wasterecord_set.exists():
            raise ValidationError("This batch has recorded wastage. Keep it for the accounting history.")
        instance.delete()

    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminUser]