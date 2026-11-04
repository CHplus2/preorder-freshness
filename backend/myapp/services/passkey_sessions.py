"""Revoking a passkey also ends API sessions that were authenticated by that key."""
from django.contrib.auth import logout
from rest_framework.authentication import SessionAuthentication


class PasskeySessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        session = getattr(request._request, 'session', {})
        key = session.get('customer_passkey_id')
        user = getattr(request._request, 'user', None)
        if key and user and user.is_authenticated:
            from ..models import CustomerPasskey
            if not CustomerPasskey.objects.filter(pk=key, account__user=user).exists():
                logout(request._request)
                return None
        return super().authenticate(request)
