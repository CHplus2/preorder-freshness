from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from ..services.auth_limits import limit
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_post_parameters


@sensitive_post_parameters('password')
@csrf_protect
@never_cache
def admin_login(request, extra_context=None):
    """Keep Django's staff login inside the same database-backed login limits."""
    from django.contrib import admin
    from django.http import HttpResponse
    from rest_framework.exceptions import Throttled
    if request.method == 'POST':
        # LoginView validates the full form; bound the throttle key beforehand.
        username = request.POST.get('username', '')[:150]
        try:
            limit(request, 'login', username)
        except Throttled:
            response = HttpResponse('Too many sign-in attempts. Please try again later.', status=429, content_type='text/plain')
            response['Retry-After'] = '900'
            return response
    return admin.site.login(request, extra_context)


class SignupInput(serializers.Serializer):
    username = serializers.RegexField(r'^[\w.@+-]+$', max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    confirmPassword = serializers.CharField(max_length=128, trim_whitespace=False)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, default='')

@api_view(["POST"])
def signup_view(request):
    SessionAuthentication().enforce_csrf(request)
    limit(request, 'signup')
    data = SignupInput(data=request.data)
    data.is_valid(raise_exception=True)
    username = data.validated_data['username']
    password = data.validated_data['password']
    confirm_password = data.validated_data['confirmPassword']

    if not username or not password or not confirm_password:
        return Response({"detail": "Missing fields"}, status=status.HTTP_400_BAD_REQUEST)

    if password != confirm_password:
        return Response({"detail": "Password mismatch"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username taken"}, status=status.HTTP_409_CONFLICT)

    user = User(username=username, email=data.validated_data['email'])
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({'password': exc.messages})
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password, email=user.email)
    except IntegrityError:
        raise serializers.ValidationError('Username is unavailable.')
    login(request, user)

    return Response({"detail": "User created and logged in"}, status=status.HTTP_201_CREATED
)


@api_view(["POST"])
def login_view(request):
    SessionAuthentication().enforce_csrf(request)
    username = serializers.CharField(max_length=150).run_validation(request.data.get('username'))
    password = serializers.CharField(max_length=128, trim_whitespace=False).run_validation(request.data.get('password'))
    limit(request, 'login', username)

    user = authenticate(request, username=username, password=password)
    if user:
        login(request, user)
        return Response({"detail": "Logged in"}, status=status.HTTP_200_OK)
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response({"detail": "Logged out"}, status=status.HTTP_200_OK)

@api_view(["GET"])
def check_auth(request):
    get_token(request)
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user_id": request.user.pk,
            "username": request.user.username,
            "is_admin": request.user.is_staff  
        }, status=status.HTTP_200_OK)
    return Response({"authenticated": False}, status=status.HTTP_200_OK)


@api_view(['POST'])
def recovery_request(request):
    SessionAuthentication().enforce_csrf(request)
    incoming = RecoveryInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    username,email = incoming.validated_data['username'],incoming.validated_data['email']
    limit(request, 'recovery', username, maximum=5)
    user = User.objects.filter(username=username, email__iexact=email, is_active=True).first()
    if user and user.has_usable_password():
        from ..services.recovery_email import send_recovery_email
        send_recovery_email(user)
    return Response({'detail': 'If the account and recovery email match, a reset link will be sent. For an older account without an email, contact the kitchen owner.'})


class RecoveryInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)


class ResetInput(serializers.Serializer):
    uid = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128,trim_whitespace=False)


@api_view(['POST'])
def recovery_confirm(request):
    SessionAuthentication().enforce_csrf(request)
    limit(request, 'recovery-confirm')
    incoming = ResetInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    return apply_password_reset(**incoming.validated_data)


@transaction.atomic
def apply_password_reset(uid, token, password):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode
    try:
        user = User.objects.select_for_update().get(pk=urlsafe_base64_decode(uid).decode(), is_active=True)
    except (ValueError, UnicodeError, User.DoesNotExist, OverflowError):
        raise serializers.ValidationError('This reset link is invalid or expired.')
    if not default_token_generator.check_token(user, token):
        raise serializers.ValidationError('This reset link is invalid or expired.')
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({'password': exc.messages})
    user.set_password(password)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password updated. Sign in with your new password.'})
