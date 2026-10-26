from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from ..models import Category, Product, OrderItem, CartItem
from django.db.models import Exists, OuterRef
from django.db import transaction, OperationalError
from django.shortcuts import get_object_or_404
from ..serializers import CategorySerializer, ProductSerializer
from ..services.recommendation import recommend_for_user

# ------------------------------------------
# GET PERMISSION
# ------------------------------------------

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


# ------------------------------------------
# CATEGORY 
# ------------------------------------------

class CategoryListCreate(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]


class CategoryDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]


# ------------------------------------------
# PRODUCT
# ------------------------------------------

class ProductListCreate(generics.ListCreateAPIView):
    queryset = Product.objects.select_related("category").prefetch_related("ingredients").annotate(
        used_in_orders=Exists(OrderItem.objects.filter(product_id=OuterRef('pk')))).order_by("-created_at")
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]


    def get_queryset(self):
        rows = super().get_queryset()
        return rows if self.request.user.is_staff else rows.filter(selling_status="active")


class ProductDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related("category").prefetch_related("ingredients").annotate(
        used_in_orders=Exists(OrderItem.objects.filter(product_id=OuterRef('pk'))))
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                # Avoid waiting in the opposite order to basket quantity edits.
                product = get_object_or_404(Product.objects.select_for_update(nowait=True), pk=kwargs['pk'])
                if product.orderitem_set.exists():
                    return Response({'code': 'menu_used_in_orders', 'detail': 'This menu is linked to orders. Archive it to remove it from sale while keeping order history and preparation records.'}, status=409)
                list(CartItem.objects.select_for_update(nowait=True).filter(product=product).order_by('pk'))
                product.delete()
        except OperationalError as error:
            if getattr(error.__cause__, 'pgcode', None) != '55P03':
                raise
            return Response({'code': 'menu_busy', 'detail': 'This menu or one of its baskets is being updated. Refresh menus and try deleting it again.'}, status=409)
        return Response(status=204)


# ------------------------------------------
# RECOMMENDATION
# ------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommend(request):
    return Response(recommend_for_user(user=request.user, exclude_bought=False), status=status.HTTP_200_OK)

# A bounded public listing; management and product detail keep their full records.
from rest_framework.pagination import PageNumberPagination
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

class MenuPagination(PageNumberPagination):
    page_size = 12

class MenuCardSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'image_url', 'category', 'category_name', 'selling_details',
                  'lead_hours', 'daily_capacity', 'social_url', 'delivery_weekdays',
                  'delivery_dates', 'order_cutoff_time', 'order_cutoff_days_before']

class MenuList(generics.ListAPIView):
    serializer_class = MenuCardSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = MenuPagination

    def get_queryset(self):
        rows = Product.objects.filter(selling_status='active').select_related('category').order_by('-created_at', '-id')
        search = self.request.query_params.get('search', '').strip()
        if search:
            rows = rows.filter(name__icontains=search[:200])
        category = self.request.query_params.get('category', '')
        if category:
            if not category.isascii() or not category.isdigit() or len(category) > 10:
                raise ValidationError({'category': 'Choose a valid menu category.'})
            rows = rows.filter(category_id=int(category))
        return rows


@api_view(['GET'])
@permission_classes([AllowAny])
def product_variants(request, pk):
    from django.shortcuts import get_object_or_404
    product = get_object_or_404(Product, pk=pk, selling_status='active')
    group = product.selling_details.get('variant_group', '')
    rows = Product.objects.filter(selling_status='active', selling_details__variant_group=group).select_related('category').order_by('price', 'id')[:20] if group else []
    return Response({'group': group, 'results': MenuCardSerializer(rows, many=True).data})
