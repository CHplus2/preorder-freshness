from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from ..models import Storefront, Review, Product, OrderItem

class StoreSerializer(serializers.ModelSerializer):
    def validate_whatsapp_number(self, value):
        if value and (not value.isdigit() or not 8 <= len(value) <= 15):
            raise serializers.ValidationError('Use country code and digits only, for example 60 followed by your number.')
        return value

    class Meta:
        model = Storefront
        fields = '__all__'
        extra_kwargs = {'bulk_discount_percent': {'min_value': 0, 'max_value': 50}}

@api_view(['GET', 'PATCH'])
def storefront(request):
    store = Storefront.objects.filter(pk=1).first() or Storefront(pk=1)
    if request.method == 'PATCH':
        if not request.user.is_staff:
            raise PermissionDenied()
        serializer = StoreSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(StoreSerializer(store).data)

class ReviewSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'customer', 'created_at']
        extra_kwargs = {'rating': {'min_value': 1, 'max_value': 5}}

@api_view(['GET', 'POST'])
def reviews(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method == 'POST':
        if not request.user.is_authenticated:
            raise PermissionDenied('Please log in to review.')
        if not OrderItem.objects.filter(product=product, order__user=request.user, order__status='delivered').exists():
            raise PermissionDenied('Reviews are available after your order is delivered.')
        if Review.objects.filter(product=product, user=request.user).exists():
            raise ValidationError('You have already reviewed this menu.')
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(product=product, user=request.user)
    return Response(ReviewSerializer(product.reviews.order_by('-created_at'), many=True).data)
