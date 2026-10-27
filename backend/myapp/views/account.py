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
    if request.method == 'PATCH':
        from ..services.auth_limits import limit
        limit(request, 'order-email', str(request.user.pk), maximum=5)
        incoming = OrderEmailInput(data=request.data)
        incoming.is_valid(raise_exception=True)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if not user.check_password(incoming.validated_data['current_password']):
                raise serializers.ValidationError({'current_password': 'Enter your current password to change your email.'})
            from ..services.account_identity import email_address, lock_account_writes, require_available_email
            email = email_address(incoming.validated_data['email'])
            from ..services.email_changes import required
            if required() and email and email != email_address(user.email):
                raise serializers.ValidationError({'email': 'Confirm this new address through the email-change link before it can replace your current email.'})
            lock_account_writes()
            if email != email_address(user.email):
                require_available_email(email, excluding=user.pk)
            previous_email = user.email
            user.email = email
            user.save(update_fields=['email'])
            if required() and previous_email != email:
                from ..services.email_changes import cancel
                cancel(user)
    else:
        user = request.user
    return Response(email_settings(user))


def email_settings(user):
    from ..services.reminders import customer_email_ready
    from ..services import email_changes
    return dict(email=user.email, available=customer_email_ready(),
        email_change_confirmation_required=email_changes.required(),
        email_change_available=email_changes.ready(),
        email_change_pending=email_changes.pending(user) if email_changes.required() else False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_email_change(request):
    from django.db import transaction
    from ..services import email_changes
    from ..services.auth_limits import limit
    from ..services.account_identity import email_address, lock_account_writes, require_available_email
    limit(request, 'email-change-request', str(request.user.pk), maximum=5)
    incoming = OrderEmailInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    target = email_address(incoming.validated_data['email'])
    if not target:
        raise serializers.ValidationError({'email': 'Enter the new address. Remove an email in Account settings instead.'})
    if not email_changes.ready():
        return Response({'detail': 'Email confirmation is not available yet. Your current email has not changed.'}, status=503)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if not user.is_active or not user.check_password(incoming.validated_data['current_password']):
            raise serializers.ValidationError({'current_password': 'Enter your current password to request an email change.'})
        if target == email_address(user.email):
            raise serializers.ValidationError({'email': 'Enter a different email address.'})
        lock_account_writes()
        require_available_email(target, excluding=user.pk)
        challenge_id, token = email_changes.issue(user, target)
    # Account and kitchen locks are released before SMTP. Sending never changes
    # the email; confirmation rechecks current state and email availability.
    if not email_changes.deliver(user.pk, target, token):
        with transaction.atomic():
            User.objects.select_for_update().get(pk=user.pk)
            email_changes.consume(challenge_id)
        return Response({'detail': 'The confirmation email could not be accepted for sending. Your current email has not changed. Check the address and try again later.'}, status=503)
    user.refresh_from_db()
    return Response(dict(email_settings(user), confirmation_sent=True,
        detail='Confirmation email accepted for sending. Open the newest link within 30 minutes while signed in to this account. Your current email stays unchanged until you confirm.'), status=202)


class EmailChangeTokenInput(serializers.Serializer):
    token = serializers.CharField(max_length=4096, trim_whitespace=False)
    action = serializers.ChoiceField(choices=['inspect', 'confirm'], default='inspect')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_email_change(request):
    from django.db import transaction
    from ..services import email_changes
    from ..services.auth_limits import limit
    from ..services.account_identity import lock_account_writes, require_available_email
    limit(request, 'email-change-confirm', str(request.user.pk), maximum=15)
    incoming = EmailChangeTokenInput(data=request.data)
    incoming.is_valid(raise_exception=True)
    if not email_changes.required():
        return Response({'detail': 'Email confirmation is not enabled. Review your current email in Account settings.'}, status=503)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        if not user.is_active:
            raise serializers.ValidationError('This account is unavailable.')
        target, challenge_id, already_applied = email_changes.inspect(user, incoming.validated_data['token'])
        if incoming.validated_data['action'] == 'inspect':
            return Response(dict(current_email=user.email, proposed_email=target, already_applied=already_applied))
        if not already_applied:
            lock_account_writes()
            require_available_email(target, excluding=user.pk)
            user.email = target
            user.save(update_fields=['email'])
            email_changes.consume(challenge_id)
        return Response(dict(email_settings(user), already_applied=already_applied,
            detail='Account email confirmed. Use it next time you sign in. Choose reminders again on existing orders if you want them sent to this address.'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_email_change(request):
    from django.db import transaction
    from ..services import email_changes
    from ..services.auth_limits import limit
    limit(request, 'email-change-cancel', str(request.user.pk), maximum=5)
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=request.user.pk)
        email_changes.cancel(user)
    return Response(dict(email_settings(user), detail='Outstanding email-change links cancelled. Your current email has not changed.'))
