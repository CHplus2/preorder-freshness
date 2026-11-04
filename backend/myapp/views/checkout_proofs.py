"""No public URL, no original filename, no automatic paid status."""
from datetime import timedelta
from hashlib import sha256
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view,permission_classes,parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import CheckoutProof,Storefront,CartItem
from ..services.auth_limits import limit
from ..services.fulfilment import request_store
from ..services.simple_ordering import validate_delivery,check_cart_ingredients
from ..services.packaging import check_cart_packaging
from ..services.checkout_proofs import price_scope
from .menu_photos import sanitized_photo


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload(request):
    from ..services.guest_ordering import require_customer_account
    require_customer_account(request.user)
    limit(request,'checkout-proof',str(request.user.pk),maximum=10)
    return save_upload(request)


@transaction.atomic
def save_upload(request):
    from django.contrib.auth.models import User
    User.objects.select_for_update().get(pk=request.user.pk)
    store=Storefront.objects.filter(pk=1).first() or Storefront()
    if store.ordering_mode != 'simple' or not store.manual_payment_enabled or not store.duitnow_qr_url:
        raise serializers.ValidationError('QR payment is unavailable. Choose delivery cash if offered, or contact the kitchen.')
    store,method,area=request_store(store,request.data,require_area=True)
    delivery=serializers.DateTimeField().run_validation(request.data.get('delivery_at'))
    items=list(CartItem.objects.filter(user=request.user).select_related('product'))
    validate_delivery(items,delivery,store);check_cart_ingredients(items,delivery);check_cart_packaging(items)
    # Bound abandoned uploads per session, independently of the shared IP throttle.
    if CheckoutProof.objects.filter(user=request.user,order__isnull=True,created_at__gte=timezone.now()-timedelta(hours=24)).count()>=10:
        raise serializers.ValidationError('Too many unfinished receipt uploads. Contact the kitchen or try again tomorrow.')
    content,width,height=sanitized_photo(request.FILES.get('image'))
    digest=sha256(content).hexdigest()
    if CheckoutProof.objects.filter(digest=digest,order__isnull=False).exists():
        raise serializers.ValidationError('This receipt image has already been submitted. Check your orders or contact the kitchen.')
    amount,scope=price_scope(items,store,delivery,method,area)
    row=CheckoutProof.objects.create(user=request.user,content=content,digest=digest,scope_digest=scope,amount=amount)
    return Response(dict(id=str(row.pk),amount=str(row.amount),url=f'/api/checkout-proofs/{row.pk}/',
        message='Proof uploaded. The kitchen still needs to verify the payment.'),status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view(request,pk):
    rows=CheckoutProof.objects.all()
    if not request.user.is_staff:rows=rows.filter(user=request.user)
    row=get_object_or_404(rows,pk=pk)
    response=HttpResponse(bytes(row.content),content_type='image/webp')
    response['Cache-Control']='private, no-store'
    response['Content-Disposition']='inline; filename="payment-proof.webp"'
    response['X-Content-Type-Options']='nosniff'
    response['Content-Security-Policy']="default-src 'none'; sandbox"
    response['Referrer-Policy']='no-referrer'
    return response
