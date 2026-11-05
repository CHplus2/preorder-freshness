from django.db import transaction
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from ..models import Storefront, Review, Product, OrderItem

from ..serializers import MenuImageReference

class StoreSerializer(serializers.ModelSerializer):
    duitnow_qr_url=MenuImageReference(max_length=200,allow_blank=True,required=False)
    def validate(self, attrs):
        enabled = attrs.get('manual_payment_enabled', getattr(self.instance, 'manual_payment_enabled', False))
        instructions = attrs.get('bank_transfer_instructions', getattr(self.instance, 'bank_transfer_instructions', ''))
        qr = attrs.get('duitnow_qr_url', getattr(self.instance, 'duitnow_qr_url', ''))
        if enabled and not (instructions.strip() or qr):
            raise serializers.ValidationError('Add bank transfer instructions or a DuitNow QR image before enabling manual payments.')
        opening = attrs.get('kitchen_open_hour', getattr(self.instance, 'kitchen_open_hour', 8))
        closing = attrs.get('kitchen_close_hour', getattr(self.instance, 'kitchen_close_hour', 20))
        if getattr(self.instance, 'ordering_mode', 'simple') == 'scheduled' and not 0 <= opening < closing <= 23:
            raise serializers.ValidationError('Kitchen hours must open before closing, between 00:00 and 23:00.')
        for kind in ('delivery', 'pickup'):
            first = attrs.get(f'{kind}_open_hour', getattr(self.instance, f'{kind}_open_hour', 9 if kind == 'delivery' else 8))
            last = attrs.get(f'{kind}_close_hour', getattr(self.instance, f'{kind}_close_hour', 21 if kind == 'delivery' else 20))
            if getattr(self.instance,'ordering_mode','simple') == 'scheduled' and not 0 <= first < last <= 23:
                raise serializers.ValidationError(f'{kind.title()} hours must open before closing, between 00:00 and 23:00.')
        if attrs.get('pickup_enabled', getattr(self.instance, 'pickup_enabled', False)) and not attrs.get('pickup_location', getattr(self.instance, 'pickup_location', '')).strip():
            raise serializers.ValidationError({'pickup_location': 'Add a collection location before enabling self-collection. It will be visible to customers.'})
        if getattr(self.instance,'ordering_mode','simple') == 'simple':
            from datetime import time
            for kind in ('delivery','pickup'):
                start=attrs.get(kind+'_start_time',getattr(self.instance,kind+'_start_time',time(7,30)))
                end=attrs.get(kind+'_end_time',getattr(self.instance,kind+'_end_time',time(11)))
                if not start < end or start.second or end.second or start.microsecond or end.microsecond:
                    raise serializers.ValidationError({kind+'_start_time':'Choose opening and closing times in minutes, with closing later on the same day.'})
        areas=attrs.get('delivery_areas',getattr(self.instance,'delivery_areas',[]))
        fees=attrs.get('delivery_area_fees',getattr(self.instance,'delivery_area_fees',{}))
        if set(fees)-set(areas):
            raise serializers.ValidationError({'delivery_area_fees':'Remove fees for areas that are no longer offered.'})
        return attrs

    def validate_delivery_area_fees(self, value):
        if not isinstance(value,dict) or len(value)>30:
            raise serializers.ValidationError('Use one fee for each of up to 30 delivery areas.')
        money=serializers.DecimalField(max_digits=8,decimal_places=2,min_value=0)
        cleaned={}
        for name,amount in value.items():
            if not isinstance(name,str) or not name.strip() or name!=name.strip() or len(name)>80:
                raise serializers.ValidationError('Use the delivery area name exactly as listed.')
            cleaned[name]=str(money.run_validation(amount))
        return cleaned

    def validate_delivery_areas(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Enter area names on separate lines.')
        if len(value) > 30:
            raise serializers.ValidationError('Keep up to 30 delivery areas. Put one area name on each line.')
        for index, name in enumerate(value):
            if not isinstance(name, str) or not name.strip():
                raise serializers.ValidationError('Enter a name for each delivery area, or leave the list empty.')
            if len(name.strip()) > 80:
                raise serializers.ValidationError(f'Area {index + 1}: use 80 characters or fewer.')
        names = [v.strip() for v in value]
        if len(set(v.casefold() for v in names)) != len(names):
            raise serializers.ValidationError('List each delivery area only once.')
        return names

    def validate_whatsapp_number(self, value):
        if value and (not value.isdigit() or not 8 <= len(value) <= 15):
            raise serializers.ValidationError('Use country code and digits only, for example 60 followed by your number.')
        return value

    class Meta:
        model = Storefront
        fields = '__all__'
        read_only_fields = ['ordering_mode']
        extra_kwargs = {'bulk_discount_percent': {'min_value': 0, 'max_value': 50}, 'delivery_buffer_minutes': {'min_value': 1, 'max_value': 1440}, 'bulk_minimum': {'min_value': 1, 'max_value': 10000}}

@api_view(['GET', 'PATCH'])
@transaction.atomic
def storefront(request):
    store = Storefront.objects.filter(pk=1).first() or Storefront(pk=1)
    if request.method == 'PATCH':
        if not request.user.is_staff:
            raise PermissionDenied()
        Storefront.objects.get_or_create(pk=1)
        store = Storefront.objects.select_for_update().get(pk=1)
        serializer = StoreSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    data = dict(StoreSerializer(store).data)
    if not request.user.is_staff and not store.pickup_enabled:
        data.update(pickup_location='', pickup_instructions='')
    return Response(data)

class ReviewSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'customer', 'created_at']
        extra_kwargs = {'rating': {'min_value': 1, 'max_value': 5}}

@api_view(['GET', 'POST'])
def reviews(request, pk):
    before = None
    if request.query_params:
        params = request.query_params
        value = params.get('before','')
        if (request.method != 'GET' or set(params) != {'before'} or len(params.getlist('before')) != 1
                or not value.isascii() or not value.isdigit() or not 1 <= len(value) <= 19
                or not 1 <= int(value) <= 9223372036854775807):
            raise ValidationError('Use only a valid before review ID for the next page.')
        before = int(value)
    product = get_object_or_404(Product, pk=pk)
    if request.method == 'POST':
        if not request.user.is_authenticated:
            raise PermissionDenied('Please log in to review.')
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            if not OrderItem.objects.filter(product=product, order__user=request.user, order__status='delivered').exists():
                raise PermissionDenied('Reviews are available after your order is delivered.')
            if Review.objects.filter(product=product, user=request.user).exists():
                raise ValidationError('You have already reviewed this menu.')
            serializer = ReviewSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(product=product, user=request.user)
    rows = product.reviews.select_related('user').order_by('-pk')
    if before is not None:rows = rows.filter(pk__lt=before)
    page = list(rows[:21])
    response = Response(ReviewSerializer(page[:20],many=True).data)
    if len(page) > 20:response['X-Next-Review-Before'] = str(page[19].pk)
    return response


@api_view(['GET'])
def review_access(request, pk):
    get_object_or_404(Product, pk=pk)
    if not request.user.is_authenticated:
        return Response({'eligible': False, 'reason': 'Sign in to see whether you can review this menu.'})
    if Review.objects.filter(product_id=pk, user=request.user).exists():
        return Response({'eligible': False, 'reason': 'Thank you — you have already reviewed this menu.'})
    eligible = OrderItem.objects.filter(product_id=pk, order__user=request.user, order__status='delivered').exists()
    return Response({'eligible': eligible, 'reason': '' if eligible else 'You can leave a review once an order containing this menu has been delivered.'})


@api_view(['GET'])
def inventory_freshness(request):
    from django.utils import timezone
    from ..models import InventoryItem
    from ..services.freshness import inventory_summary
    today = timezone.localdate()
    lots = InventoryItem.objects.filter(quantity__gt=0, received_date__lte=today).only(
        'quantity', 'received_date', 'expiry_date', 'expiry_basis',
        'manufactured_date', 'guidance_note', 'quarantined')
    return Response(inventory_summary(lots, today))
