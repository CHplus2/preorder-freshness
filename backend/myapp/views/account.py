from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name']
        read_only_fields = ['username']


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def account_profile(request):
    serializer = ProfileSerializer(request.user)
    if request.method == 'PATCH':
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(serializer.data)


class OrderEmailInput(serializers.Serializer):
    email = serializers.EmailField(max_length=254, allow_blank=True)
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def order_email(request):
    from django.db import transaction
    from ..services.reminders import customer_email_ready
    if request.method == 'PATCH':
        from ..services.auth_limits import limit
        limit(request, 'order-email', str(request.user.pk), maximum=5)
        incoming = OrderEmailInput(data=request.data)
        incoming.is_valid(raise_exception=True)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.check_password(incoming.validated_data['current_password']):
                raise serializers.ValidationError({'current_password': 'Enter your current password to change your email.'})
            user.email = incoming.validated_data['email'].strip().lower()
            user.save(update_fields=['email'])
    else:
        user = request.user
    return Response({'email': user.email, 'available': customer_email_ready()})
