"""A fresh session does not claim any existing customer's records."""
from uuid import uuid4
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from ..models import Storefront, GuestCustomer
from ..services.auth_limits import limit


@api_view(['POST'])
@permission_classes([AllowAny])
@transaction.atomic
def start(request):
    SessionAuthentication().enforce_csrf(request)
    if request.user.is_authenticated:
        return Response({'ready':True})  # Never replace a signed-in owner/customer.
    store=Storefront.objects.filter(pk=1).first() or Storefront()
    if store.ordering_mode != 'simple':
        raise ValidationError('Sign in to order from this kitchen.')
    if request.data:
        raise ValidationError('Start an order without supplying account credentials.')
    limit(request,'guest-session')
    user=User(username='guest-'+uuid4().hex)
    user.set_unusable_password();user.save()
    GuestCustomer.objects.create(user=user)
    login(request,user,backend='django.contrib.auth.backends.ModelBackend')
    request.session.set_expiry(60*60*24*30)
    return Response({'ready':True},status=201)
