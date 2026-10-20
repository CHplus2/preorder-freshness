"""Recovery mail must not expose reset credentials in console/error logs."""
import logging
from urllib.parse import urlsplit
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

logger = logging.getLogger(__name__)


def reset_origin():
    value = settings.PUBLIC_APP_URL
    if not value:return None
    try:
        URLValidator(schemes=['https','http'])(value)
        parsed = urlsplit(value)
        if (parsed.username is not None or parsed.password is not None or '?' in value or '#' in value
                or parsed.path not in ('','/') or any(ord(c) < 33 for c in value)):
            return None
        if parsed.scheme == 'http' and (getattr(settings,'IS_VERCEL',False)
                or parsed.hostname not in ('localhost','127.0.0.1','::1')):
            return None
        return value.rstrip('/')
    except (ValidationError,TypeError,ValueError):
        return None


def send_recovery_email(user):
    origin = reset_origin()
    if not origin or settings.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
        return
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from django.core.mail import send_mail
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    url = f'{origin}/recover#uid={uid}&token={token}'
    try:
        send_mail('Reset your kitchen account password',
            f'Open this link to choose a new password (valid for one hour):\n{url}\nIf you did not request this, ignore this email.',
            settings.DEFAULT_FROM_EMAIL,[user.email],fail_silently=False)
    except Exception:
        # Do not log exceptions: mail backend errors can contain addresses,
        # reset links or connection configuration. Keep the public result generic.
        logger.warning('Recovery email delivery failed; check mail configuration privately.')
