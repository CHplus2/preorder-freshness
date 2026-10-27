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
from ..services.account_identity import email_address, lock_account_writes, require_available_email, login_account, recovery_account
from uuid import uuid4
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
    username = serializers.RegexField(r'^[\w.@+-]+$', max_length=150, required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    confirmPassword = serializers.CharField(max_length=128, trim_whitespace=False)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, default='')

@api_view(["POST"])
def signup_view(request):
    SessionAuthentication().enforce_csrf(request)
    limit(request, 'signup')
    data = SignupInput(data=request.data)
    data.is_valid(raise_exception=True)
    email = email_address(data.validated_data['email'])
    username = data.validated_data.get('username')
    if not username and not email:
        raise serializers.ValidationError({'email': 'Enter an email address to create your account.'})
    username = SignupInput().fields['username'].run_validation(User.normalize_username(username) if username else 'customer-'+uuid4().hex)
    first_name = data.validated_data['first_name']
    password = data.validated_data['password']
    confirm_password = data.validated_data['confirmPassword']

    if not username or not password or not confirm_password:
        return Response({"detail": "Missing fields"}, status=status.HTTP_400_BAD_REQUEST)

    if password != confirm_password:
        return Response({"detail": "Password mismatch"}, status=status.HTTP_400_BAD_REQUEST)

    user = User(username=username, email=email, first_name=first_name)
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({'password': exc.messages})
    user.set_password(password)
    try:
        with transaction.atomic():
            lock_account_writes()
            if User.objects.filter(username__iexact=username).exists() or User.objects.filter(email__iexact=username).exclude(email='').exists():
                raise serializers.ValidationError({'username': 'This sign-in name is unavailable. Try signing in or choose another.'})
            require_available_email(email)
            user.save()
    except IntegrityError:
        raise serializers.ValidationError('These sign-in details are unavailable. Try signing in or use another email.')
    login(request, user)

    return Response({"detail": "User created and logged in"}, status=status.HTTP_201_CREATED
)


class LoginInput(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, required=False)
    # Legacy clients can explicitly authenticate the exact Django username.
    username = serializers.CharField(max_length=150, required=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate(self, data):
        if ('identifier' in data) == ('username' in data):
            raise serializers.ValidationError('Enter your email or username and password.')
        return data


@api_view(["POST"])
def login_view(request):
    SessionAuthentication().enforce_csrf(request)
    incoming = LoginInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    values = incoming.validated_data
    identifier = values.get('identifier', values.get('username'))
    password = values['password']
    account = login_account(identifier, username_only='username' in values)
    # Email and username aliases share one account limit. Unknown or ambiguous
    # identifiers keep their own limit and the same public failure response.
    limit(request, 'login', account.username if account else identifier)
    if account:
        user = authenticate(request, username=account.username, password=password)
    else:
        User().set_password(password)  # Same expensive hash for an unknown identity.
        user = None
    if user:
        login(request, user)
        return Response({"detail": "Logged in"}, status=status.HTTP_200_OK)
    return Response({"detail": "Sign-in details were not accepted. Check your email or username and password. For a shared email, use your existing username."}, status=status.HTTP_401_UNAUTHORIZED)

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
    email = email_address(incoming.validated_data['email'])
    username = incoming.validated_data['username']
    user = recovery_account(email, username)
    limit(request, 'recovery', user.username if user else username or email, maximum=5)
    if user:
        from ..services.recovery_email import send_recovery_email
        send_recovery_email(user)
    return Response({'detail': 'If these details identify an eligible account, a reset link will be sent. If an older email is shared, include your username. Accounts without an email need help from the kitchen.'})


class RecoveryInput(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
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
