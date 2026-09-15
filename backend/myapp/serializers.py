from rest_framework import serializers
from decimal import Decimal
from django.contrib.auth.models import User
from .models import (
    Category, InventoryItem, ProductIngredient, Product, CartItem, Order, OrderItem, Address, RawMaterial
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class RecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductIngredient
        fields = ['raw_material', 'quantity_required']
        extra_kwargs = {'quantity_required': {'min_value': Decimal('0.001')}}


class ProductSerializer(serializers.ModelSerializer):
    ingredients = RecipeSerializer(many=True, required=False)
    stock = serializers.IntegerField(source='get_available_quantity', read_only=True)
    freshness = serializers.SerializerMethodField()

    def get_freshness(self, obj):
        if not obj.ingredients.exists():
            return 'Recipe not recorded'
        if obj.get_available_quantity() < 1:
            return 'Ingredients need restocking'
        return 'Within recorded shelf life — estimate, not a safety guarantee'

    def validate_ingredients(self, value):
        ids = [x['raw_material'].pk for x in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Each ingredient may appear only once.')
        return value

    category_name = serializers.CharField(source="category.name", read_only=True)
    
    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        from django.db import transaction
        recipe = validated_data.pop('ingredients', [])
        with transaction.atomic():
            product = super().create(validated_data)
            for ingredient in recipe:
                ProductIngredient.objects.create(product=product, **ingredient)
        return product

    def update(self, instance, validated_data):
        from django.db import transaction
        recipe = validated_data.pop('ingredients', None)
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if recipe is not None:
                instance.ingredients.all().delete()
                for ingredient in recipe:
                    ProductIngredient.objects.create(product=instance, **ingredient)
        return instance


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source="product",
        write_only=True
    )

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity", "added_at"]
        read_only_fields = ["id", "added_at"]


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = "__all__"
        read_only_fields = ["id", "user"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = "__all__"


class OrderSerializer(serializers.ModelSerializer):
    address = AddressSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = "__all__"

    def get_user(self, obj):
        return {"id": obj.user.id, "username": obj.user.username}

class RawMaterialSerializer(serializers.ModelSerializer):
    def validate_unit(self, value):
        if self.instance and value != self.instance.unit and (self.instance.inventory_items.exists() or self.instance.product_ingredients.exists()):
            raise serializers.ValidationError('Create a new material to change units once batches or recipes use this material.')
        return value

    unit_display = serializers.CharField(source="get_unit_display", read_only=True)

    class Meta:
        model = RawMaterial
        fields = "__all__"

class InventoryItemSerializer(serializers.ModelSerializer):
    expiry_date = serializers.DateField(required=False)
    days_remaining = serializers.SerializerMethodField()

    def get_days_remaining(self, obj):
        from django.utils import timezone
        return (obj.expiry_date - timezone.localdate()).days

    def validate(self, attrs):
        from datetime import timedelta
        from django.utils import timezone
        def value(key, default=None):
            return attrs.get(key, getattr(self.instance, key, default))
        received = value('received_date')
        if received and received > timezone.localdate():
            raise serializers.ValidationError('Received date cannot be in the future.')
        if value('quantity', 0) < 0:
            raise serializers.ValidationError('Quantity cannot be negative.')
        basis = value('expiry_basis', 'label')
        if basis != 'label':
            start = value('manufactured_date') if basis == 'manufactured' else received
            days = value('shelf_life_days')
            if not start or not days or not value('guidance_note'):
                raise serializers.ValidationError('Provide the start date, shelf-life days and source of guidance.')
            if basis == 'manufactured' and received and start > received:
                raise serializers.ValidationError('Manufacture date must not be after receipt.')
            attrs['expiry_date'] = start + timedelta(days=days)
        expiry = attrs.get('expiry_date', value('expiry_date'))
        if not expiry:
            raise serializers.ValidationError('An expiry date is required.')
        if received and expiry < received:
            raise serializers.ValidationError('Expiry must not be before receipt.')
        return attrs

    raw_material_name = serializers.CharField(source="raw_material.name", read_only=True)
    unit = serializers.CharField(source="raw_material.unit", read_only=True)

    class Meta:
        model = InventoryItem
        fields = "__all__"

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "is_staff", "is_active"]
        read_only_fields = ["id", "username"]