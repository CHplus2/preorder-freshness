"""Staff-only SMTP check. It never changes orders or reminder receipts."""
from datetime import timedelta
from email.utils import getaddresses
from smtplib import SMTPAuthenticationError, SMTPConnectError, SMTPDataError, SMTPRecipientsRefused, SMTPSenderRefused
from uuid import uuid4
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled
from ..models import AuthAttempt


def _address(value):
    if not isinstance(value,str) or len(value)>320 or any(c in value for c in '\r\n'):
        return None
    try:
        rows=getaddresses([value])
        if len(rows)!=1:return None
        address=rows[0][1]
        if len(address)>254:return None
        validate_email(address)
        if address.rsplit('@',1)[-1].lower()=='localhost':return None
        return address
    except (ValidationError,TypeError,ValueError):
        return None


def configuration():
    sender=_address(settings.DEFAULT_FROM_EMAIL)
    recipient=_address(settings.OWNER_NOTIFICATION_EMAIL)
    transport=bool(settings.EMAIL_HOST and settings.EMAIL_BACKEND=='django.core.mail.backends.smtp.EmailBackend')
    return dict(transport_ready=transport,sender_address=sender,owner_recipient=recipient,
                test_available=bool(transport and sender and recipient))


def send_check(user):
    config=configuration()
    if not config['test_available']:
        return None
    now=timezone.now()
    # Serialize this staff account's clicks, then release the lock before SMTP.
    # Only the configured owner address can be used; request data cannot choose
    # an address, subject or message. Keep this separate from worker history.
    key=f'owner-mail-check:v1:{user.pk}'
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        latest=AuthAttempt.objects.filter(key=key,created_at__gt=now-timedelta(minutes=5)).order_by('-created_at').first()
        if latest:
            wait=max(1,int((latest.created_at+timedelta(minutes=5)-now).total_seconds())+1)
            raise Throttled(wait=wait,detail='A test was requested recently. Check its inbox result before sending another.')
        AuthAttempt.objects.filter(key=key,created_at__lt=now-timedelta(days=1)).delete()
        AuthAttempt.objects.create(key=key)
    reference='FCMAIL-'+uuid4().hex[:12]
    result=dict(reference=reference,recipient=config['owner_recipient'],retry_after=300)
    try:
        count=send_mail(f'FreshCast email check {reference}',
            f'This is the email check you requested in kitchen Settings.\nReference: {reference}\n\n'
            'Receiving this message confirms delivery of this check only. It does not verify automatic scheduling or customer reminders.\n'
            'No order, payment, stock record or reminder receipt was changed.',
            settings.DEFAULT_FROM_EMAIL,[config['owner_recipient']],fail_silently=False)
    except (SMTPAuthenticationError,SMTPSenderRefused,SMTPRecipientsRefused,SMTPDataError,SMTPConnectError) as error:
        reason={SMTPAuthenticationError:'authentication',SMTPSenderRefused:'sender_rejected',
                SMTPRecipientsRefused:'recipient_rejected',SMTPDataError:'message_rejected',SMTPConnectError:'connection'}
        return dict(result,outcome='not_accepted',reason=next(value for cls,value in reason.items() if isinstance(error,cls)))
    except Exception:
        # Do not reveal SMTP responses: they can contain addresses/credentials.
        # A disconnect/timeout after DATA may occur after provider acceptance.
        return dict(result,outcome='unconfirmed',reason='unknown')
    if count==1:
        return dict(result,outcome='accepted',reason=None)
    if count==0:
        return dict(result,outcome='not_accepted',reason='no_acceptance')
    return dict(result,outcome='unconfirmed',reason='unknown')
