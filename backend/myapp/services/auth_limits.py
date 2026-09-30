"""Small shared-database limits; production edge limits should complement these."""
from datetime import timedelta
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.exceptions import Throttled
from ..models import AuthAttempt


def limit(request, scope, identity='', maximum=15):
    now = timezone.now()
    AuthAttempt.objects.filter(created_at__lt=now-timedelta(days=1)).delete()
    ip = request.META.get('REMOTE_ADDR', 'unknown')
    keys = [(salted_hmac('auth-limit', scope+':ip:'+ip).hexdigest(), 60)]
    if identity:
        keys.append((salted_hmac('auth-limit', scope+':account:'+identity.casefold()).hexdigest(), maximum))
    for key, cap in keys:
        if AuthAttempt.objects.filter(key=key, created_at__gte=now-timedelta(minutes=15)).count() >= cap:
            raise Throttled(wait=900, detail='Too many attempts. Please try again later.')
    AuthAttempt.objects.bulk_create([AuthAttempt(key=k) for k, _ in keys])
