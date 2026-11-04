"""CSRF/session-bound, short-lived WebAuthn ceremonies. Never authenticate by phone."""
import json
import secrets
import uuid
from datetime import timedelta
from urllib.parse import urlsplit
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from webauthn import (generate_registration_options, generate_authentication_options,
    verify_registration_response, verify_authentication_response, options_to_json)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (AuthenticatorSelectionCriteria, ResidentKeyRequirement,
    UserVerificationRequirement, PublicKeyCredentialDescriptor)
from ..models import CustomerAccount, CustomerPasskey, PasskeyCeremony
from ..services.auth_limits import limit
from ..services.guest_ordering import CustomerInput

FAILURE = 'The passkey could not be verified. Try again using a saved passkey.'


def secure(request):
    SessionAuthentication().enforce_csrf(request)
    limit(request, 'passkey', str(request.user.pk) if request.user.is_authenticated else '', maximum=30)


def relying_party(request):
    origin = settings.PASSKEY_ORIGIN.rstrip('/')
    u = urlsplit(origin)
    if (not u.hostname or u.username or u.password or u.path or u.query or u.fragment
            or u.scheme not in ('https', 'http') or u.scheme != 'https' and u.hostname not in ('localhost','127.0.0.1')):
        raise ValidationError('Passkey sign-in is not configured for this website. Contact the kitchen.')
    if request.headers.get('Origin') not in (None, origin):
        raise PermissionDenied('Open the kitchen’s main website to use your passkey.')
    return origin, u.hostname


def session_digest(request):
    if not request.session.session_key:
        request.session.save()
    return salted_hmac('passkey-ceremony', request.session.session_key, algorithm='sha256').hexdigest()


def begin(request, action, context=None):
    origin, rp = relying_party(request)
    now = timezone.now()
    digest = session_digest(request)
    # One outstanding ceremony per browser. Expired challenges contain no keys.
    PasskeyCeremony.objects.filter(session_digest=digest, consumed_at__isnull=True).update(consumed_at=now)
    if cache.add('passkey-cleanup-v1',True,timeout=300):
        PasskeyCeremony.objects.filter(expires_at__lt=now-timedelta(days=1)).delete()
    return PasskeyCeremony.objects.create(session_digest=digest,
        user=request.user if request.user.is_authenticated else None, action=action,
        challenge=secrets.token_urlsafe(32), origin=origin, rp_id=rp,
        context=context or {}, expires_at=now+timedelta(minutes=5))


def consume(request, action):
    incoming = FinishInput(data=request.data); incoming.is_valid(raise_exception=True)
    data = incoming.validated_data
    with transaction.atomic():
        row = PasskeyCeremony.objects.select_for_update().filter(pk=data['ceremony_id'],
            session_digest=session_digest(request), action=action,
            user_id=request.user.pk if request.user.is_authenticated else None).first()
        if not row or row.consumed_at or row.expires_at <= timezone.now():
            raise ValidationError('This passkey request expired or was already used. Start again.')
        row.consumed_at = timezone.now(); row.save(update_fields=['consumed_at'])
    # This transaction has committed BEFORE crypto verification; failures cannot
    # roll back consumption and make an assertion/challenge reusable.
    return row, data['credential']


class FinishInput(serializers.Serializer):
    ceremony_id = serializers.UUIDField()
    credential = serializers.JSONField()

    def validate_credential(self, value):
        if (not isinstance(value, dict) or len(json.dumps(value)) > 25000
                or not isinstance(value.get('id'),str) or not isinstance(value.get('response'),dict)):
            raise serializers.ValidationError(FAILURE)
        return value


class EnrolInput(CustomerInput):
    label = serializers.CharField(max_length=80, required=False, default='My passkey')


def account_for(request):
    account = CustomerAccount.objects.filter(user=request.user).first()
    if not account or request.user.is_staff:
        raise PermissionDenied('Create your customer account first.')
    return account


def recent(request):
    stamp = request.session.get('passkey_verified_at', 0)
    if not isinstance(stamp, (int,float)) or not 0 <= timezone.now().timestamp()-stamp <= 300:
        raise PermissionDenied('Confirm your passkey before changing account security.')


def ready_session(request, user, credential):
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session.set_expiry(60*60*24*30)
    request.session['customer_passkey_id'] = credential.pk
    request.session['passkey_verified_at'] = timezone.now().timestamp()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_options(request):
    secure(request)
    if request.user.is_staff:
        raise PermissionDenied('Kitchen accounts use the existing staff sign-in.')
    form = EnrolInput(data=request.data); form.is_valid(raise_exception=True)
    account = CustomerAccount.objects.filter(user=request.user).first()
    if account:
        recent(request)
        if account.passkeys.count() >= 5:
            raise ValidationError('This account already has five passkeys. Remove an unused one first.')
    elif not hasattr(request.user, 'guest_customer'):
        # A legacy account must have recently signed in with its existing secret.
        recent(request)
    handle = account.user_handle if account else uuid.uuid4()
    row = begin(request, 'register', dict(form.validated_data, handle=str(handle)))
    options = generate_registration_options(rp_id=row.rp_id, rp_name='Dapur Kita',
        user_name='customer-'+handle.hex, user_display_name=account.name if account else form.validated_data['name'],
        user_id=handle.bytes, challenge=base64url_to_bytes(row.challenge), timeout=300000,
        authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.REQUIRED,
            require_resident_key=True, user_verification=UserVerificationRequirement.REQUIRED),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(k.credential_id))
            for k in account.passkeys.all()] if account else [])
    return Response(dict(ceremony_id=str(row.pk), options=json.loads(options_to_json(options))))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_verify(request):
    secure(request)
    if request.user.is_staff:
        raise PermissionDenied('Kitchen accounts use the existing staff sign-in.')
    row, data = consume(request, 'register')
    try:
        verified = verify_registration_response(credential=data, expected_challenge=base64url_to_bytes(row.challenge),
            expected_rp_id=row.rp_id, expected_origin=row.origin, require_user_verification=True)
        if len(verified.credential_id) > 1024:
            raise ValidationError(FAILURE)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk, is_active=True)
            account = CustomerAccount.objects.filter(user=user).first()
            if account:
                recent(request)
                if str(account.user_handle) != row.context['handle'] or account.passkeys.count() >= 5:
                    raise ValidationError('Account details changed. Start again.')
            else:
                if not hasattr(user,'guest_customer'): recent(request)
                account = CustomerAccount.objects.create(user=user, user_handle=row.context['handle'],
                    name=row.context['name'],phone=row.context['phone'])
            key = CustomerPasskey.objects.create(account=account,
                credential_id=bytes_to_base64url(verified.credential_id),public_key=verified.credential_public_key,
                sign_count=verified.sign_count,label=row.context['label'],
                device_type=verified.credential_device_type.value,backed_up=verified.credential_backed_up)
    except (WebAuthnException, ValueError, KeyError, TypeError, IntegrityError, User.DoesNotExist):
        raise ValidationError(FAILURE)
    ready_session(request,user,key)
    return Response({'detail':'Passkey saved. Your basket and orders are linked to your account.'},status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def signin_options(request):
    secure(request)
    row = begin(request,'signin')
    options = generate_authentication_options(rp_id=row.rp_id,challenge=base64url_to_bytes(row.challenge),
        timeout=300000,user_verification=UserVerificationRequirement.REQUIRED)
    return Response(dict(ceremony_id=str(row.pk),options=json.loads(options_to_json(options))))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reauth_options(request):
    secure(request)
    account=account_for(request)
    row=begin(request,'reauth')
    options=generate_authentication_options(rp_id=row.rp_id,challenge=base64url_to_bytes(row.challenge),
        timeout=300000,user_verification=UserVerificationRequirement.REQUIRED,
        allow_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(k.credential_id)) for k in account.passkeys.all()])
    return Response(dict(ceremony_id=str(row.pk),options=json.loads(options_to_json(options))))


def finish_assertion(request,action):
    secure(request)
    row,data=consume(request,action)
    try:
        raw_id=base64url_to_bytes(data['id'])
        if len(raw_id)>1024: raise ValueError()
        with transaction.atomic():
            key=CustomerPasskey.objects.select_for_update(of=('self',)).select_related('account__user').get(credential_id=bytes_to_base64url(raw_id))
            user=key.account.user
            if not user.is_active or user.is_staff or (action=='reauth' and key.account.user_id!=request.user.pk):
                raise ValueError()
            handle=data['response'].get('userHandle')
            # Discoverable sign-in must identify its own random account handle.
            if action=='signin' and (not handle or base64url_to_bytes(handle)!=key.account.user_handle.bytes):
                raise ValueError()
            if handle and base64url_to_bytes(handle)!=key.account.user_handle.bytes: raise ValueError()
            verified=verify_authentication_response(credential=data,expected_challenge=base64url_to_bytes(row.challenge),
                expected_rp_id=row.rp_id,expected_origin=row.origin,credential_public_key=bytes(key.public_key),
                credential_current_sign_count=key.sign_count,require_user_verification=True)
            if verified.credential_device_type.value != key.device_type:
                raise ValueError()  # Backup eligibility cannot change after registration.
            key.sign_count=verified.new_sign_count;key.last_used_at=timezone.now()
            key.backed_up=verified.credential_backed_up
            key.save(update_fields=['sign_count','last_used_at','backed_up'])
    except (CustomerPasskey.DoesNotExist,WebAuthnException,KeyError,TypeError,ValueError):
        raise ValidationError(FAILURE)
    ready_session(request,user,key)
    return Response({'detail':'Passkey confirmed.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def signin_verify(request):
    return finish_assertion(request,'signin')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reauth_verify(request):
    return finish_assertion(request,'reauth')


@api_view(['GET','PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    account=account_for(request)
    if request.method=='PATCH':
        secure(request);recent(request)
        form=CustomerInput(data=request.data);form.is_valid(raise_exception=True)
        account.name=form.validated_data['name'];account.phone=form.validated_data['phone']
        account.save(update_fields=['name','phone','updated_at'])
    return Response(dict(name=account.name,phone=account.phone,passkeys=[dict(id=k.pk,label=k.label,
        created_at=k.created_at,last_used_at=k.last_used_at) for k in account.passkeys.order_by('id')]))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_key(request,pk):
    secure(request);recent(request)
    with transaction.atomic():
        account=CustomerAccount.objects.select_for_update().get(pk=account_for(request).pk)
        key=account.passkeys.filter(pk=pk).first()
        if not key: raise ValidationError('This passkey is unavailable.')
        if account.passkeys.count()<=1:
            raise ValidationError('Add another passkey before removing your last one.')
        key.delete()
    return Response(status=204)
