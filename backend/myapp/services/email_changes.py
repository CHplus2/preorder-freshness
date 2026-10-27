"""Opt-in, one-use mailbox confirmation for a password-authorised email change.

AuthAttempt stores purpose-separated hashed challenge/receipt keys, never the
target address or token. Its existing one-day cleanup exceeds the 30-minute TTL.
User row locks serialize requests, cancellation and confirmation; the existing
kitchen lock serializes final email claims with signup and account edits.
"""
import logging
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.exceptions import ValidationError
from ..models import AuthAttempt
from .account_identity import email_address
from .reminders import customer_email_ready
from .recovery_email import reset_origin

SALT = 'account-email-change-v1'
TTL = 1800
logger = logging.getLogger(__name__)


def required():
    return settings.ACCOUNT_EMAIL_CONFIRMATION_REQUIRED


def ready():
    return required() and customer_email_ready()


def key(user):
    return salted_hmac('email-change-challenge', str(user.pk), algorithm='sha256').hexdigest()


def used_key(challenge_id):
    return salted_hmac('email-change-used', str(challenge_id), algorithm='sha256').hexdigest()


def state(user):
    # Do not put raw password hashes in a signed-but-readable link.
    return salted_hmac('email-change-account-state', user.password+'|'+user.email, algorithm='sha256').hexdigest()


def latest(user):
    return AuthAttempt.objects.filter(key=key(user), created_at__gte=timezone.now()-timedelta(seconds=TTL)).order_by('-pk').first()


def pending(user):
    challenge = latest(user)
    return bool(challenge and not AuthAttempt.objects.filter(key=used_key(challenge.pk)).exists())


def consume(challenge_id):
    AuthAttempt.objects.get_or_create(key=used_key(challenge_id))


def cancel(user):
    # A consumed newest challenge invalidates every earlier outstanding link.
    challenge = AuthAttempt.objects.create(key=key(user))
    consume(challenge.pk)


def issue(user, target):
    """Called under a user lock. Does not send or mutate the account email."""
    challenge = AuthAttempt.objects.create(key=key(user))
    token = signing.dumps(dict(user=user.pk, email=target, challenge=challenge.pk, state=state(user)), salt=SALT)
    return challenge.pk, token


def deliver(user_id, target, token):
    origin = reset_origin()
    if not ready() or not origin:
        return False
    try:
        count = send_mail('Confirm your kitchen account email change',
            f'An email change was requested for kitchen account #{user_id}.\n\n'
            f'Sign in to the same account and confirm within 30 minutes:\n{origin}/confirm-email#token={token}\n\n'
            'Your current email stays unchanged until you confirm. Opening this link does not save the change. '
            'If you did not request this, ignore the message and review your account security. '
            'This does not subscribe you to order reminders or marketing.',
            settings.DEFAULT_FROM_EMAIL, [target], fail_silently=False)
        return bool(count)
    except Exception:
        # Backend exceptions can contain recipient, link or SMTP credentials.
        logger.warning('Account email confirmation delivery failed; check mail configuration privately.')
        return False


def inspect(user, token):
    try:
        data = signing.loads(token, salt=SALT, max_age=TTL)
        if not isinstance(data, dict) or data.get('user') != user.pk:
            raise ValidationError('Sign in to the account that requested this email change.')
        target = email_address(data['email'])
        challenge = latest(user)
        if not challenge or data['challenge'] != challenge.pk:
            raise ValueError()
        used = AuthAttempt.objects.filter(key=used_key(challenge.pk)).exists()
        if used:
            if target == email_address(user.email):
                return target, challenge.pk, True
            raise ValueError()
        if not constant_time_compare(data['state'], state(user)):
            raise ValueError()
        return target, challenge.pk, False
    except ValidationError:
        raise
    except (signing.BadSignature, KeyError, TypeError, ValueError, AttributeError):
        raise ValidationError('This email confirmation link is invalid, expired, cancelled or replaced. Request a new link in Account settings.')
