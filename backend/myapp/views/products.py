from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from rest_framework.response import Response
from ..models import Category, Product
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
    queryset = Product.objects.select_related("category").prefetch_related("ingredients").order_by("-created_at")
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related("category").prefetch_related("ingredients")
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]


# ------------------------------------------
# RECOMMENDATION
# ------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommend(request):
    return Response(recommend_for_user(user=request.user, exclude_bought=False), status=status.HTTP_200_OK)