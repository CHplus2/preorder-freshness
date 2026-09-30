from rest_framework import generics
from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
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
        if instance.inventory_items.exists() or instance.product_ingredients.exists() or instance.orderingredient_set.exists():
            raise ValidationError('This ingredient is used by batches or recipes and cannot be deleted.')
        instance.delete()

    queryset = RawMaterial.objects.all()
    serializer_class = RawMaterialSerializer
    permission_classes = [IsAdminUser]


# ------------------------------------------
# INVENTORY ITEM
# ------------------------------------------

class InventoryItemListCreate(generics.ListCreateAPIView):
    queryset = InventoryItem.objects.select_related("raw_material").order_by("expiry_date")
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminUser]


class InventoryItemDetail(generics.RetrieveUpdateDestroyAPIView):
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # Cooking and wastage also lock this row and advance updated_at.
        self.queryset = InventoryItem.objects.select_for_update()
        instance = self.get_object()
        try:
            version = parse_datetime(str(request.data.get("updated_at", "")))
        except (TypeError, ValueError):
            version = None
        if version != instance.updated_at:
            return Response({"detail": "This batch has changed or its version is missing. Reload the latest batch before saving to avoid overwriting stock changes."}, status=409)
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        old_quantity = instance.quantity
        new_quantity = serializer.validated_data.get('quantity', old_quantity)
        reason = request.data.get('adjustment_reason', '')
        if new_quantity != old_quantity and (not isinstance(reason, str) or not reason.strip() or len(reason) > 200):
            raise ValidationError('Give a stock adjustment reason (up to 200 characters). Use Record waste for discarded food.')
        if serializer.validated_data.get('raw_material', instance.raw_material).pk != instance.raw_material_id:
            raise ValidationError('A batch cannot be reassigned to another ingredient. Create a separate batch.')
        self.perform_update(serializer)
        if new_quantity != old_quantity:
            from ..models import InventoryLog
            InventoryLog.objects.create(inventory_item=instance, change=new_quantity-old_quantity,
                reason=reason.strip(), reference='Owner stock adjustment', admin=request.user)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        if instance.wasterecord_set.exists() or instance.logs.exists() or instance.consumption.exists():
            raise ValidationError("This batch has an audit history. Keep it for traceability; record an adjustment or wastage instead.")
        instance.delete()

    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminUser]
