"""Grounded suggestions and explicitly confirmed, idempotent basket additions."""
import hashlib
import json
import uuid
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.core import signing
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.db.models import Q
from rest_framework import serializers
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from ..models import Product,Storefront,CartItem,RecommendationSession
from ..services.shopping_assistant import local_extract,ai_extract,needs_owner,search_terms
from ..services.preorder_windows import delivery_day_allowed as menu_day_allowed, orders_open
from .help import HelpThrottle


class Draft(serializers.Serializer):
    portions=serializers.IntegerField(min_value=1,max_value=1000,required=False)
    budget=serializers.DecimalField(max_digits=8,decimal_places=2,min_value=Decimal('0.01'),required=False)
    date=serializers.DateField(required=False)
    search=serializers.CharField(max_length=80,allow_blank=True,required=False)
    def validate_date(self,value):
        if not timezone.localdate()<=value<=timezone.localdate()+timedelta(days=90):
            raise serializers.ValidationError('Choose a delivery date within the next 90 days.')
        return value


class ShopInput(serializers.Serializer):
    message=serializers.CharField(max_length=500,allow_blank=True,default='')
    draft=Draft(default=dict)
    use_ai=serializers.BooleanField(default=False)


class CartInput(serializers.Serializer):
    product_id=serializers.IntegerField(min_value=1)
    quantity=serializers.IntegerField(min_value=1,max_value=1000)
    budget=serializers.DecimalField(max_digits=8,decimal_places=2,min_value=Decimal('0.01'),required=False)


def basket(user):
    return list(CartItem.objects.filter(user=user).select_related('product').order_by('product_id')) if user.is_authenticated else []


def totals(items,store):
    subtotal=sum((item['price']*item['quantity'] for item in items),Decimal('0.00'))
    quantity=sum(item['quantity'] for item in items)
    discount=(subtotal*Decimal(store.bulk_discount_percent)/100).quantize(Decimal('0.01')) if quantity>=store.bulk_minimum else Decimal('0.00')
    shipping=Decimal('0.00') if subtotal>=50 else Decimal('5.00')
    return dict(subtotal=str(subtotal.quantize(Decimal('0.01'))),discount=str(discount),shipping=str(shipping),total=str((subtotal-discount+shipping).quantize(Decimal('0.01'))),quantity=quantity)


def state(items):
    return [dict(product_id=i.product_id,quantity=i.quantity,price=i.product.price,updated=i.product.updated_at.isoformat(),status=i.product.selling_status) for i in items]


def fingerprint(rows,store):
    return hashlib.sha256(json.dumps([rows,store.bulk_minimum,store.bulk_discount_percent],default=str,sort_keys=True).encode()).hexdigest()


def proposed(rows,product,quantity):
    rows=[dict(row) for row in rows];found=next((r for r in rows if r['product_id']==product.pk),None)
    if found:found['quantity']+=quantity
    else:rows.append(dict(product_id=product.pk,quantity=quantity,price=product.price,updated=product.updated_at.isoformat(),status=product.selling_status))
    rows.sort(key=lambda r:r['product_id'])
    if any(row['quantity']>10000 for row in rows):raise serializers.ValidationError('A basket item cannot exceed 10,000 menu units.')
    return rows


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([HelpThrottle])
def shop_suggestions(request):
    incoming=ShopInput(data=request.data);incoming.is_valid(raise_exception=True)
    data=incoming.validated_data;message=data['message'];draft=dict(data['draft'])
    if needs_owner(message) or needs_owner(draft.get('search','')):
        return Response({'draft':{},'mode':'owner_review','missing':[],'results':[],'basket_known':request.user.is_authenticated,'basket_total':None})
    products=Product.objects.filter(selling_status='active').order_by('price','pk')
    mode='guided'
    if message and data['use_ai']:
        extracted=ai_extract(message)
        validated=Draft(data=extracted) if extracted is not None else None
        valid=validated is not None and validated.is_valid()
        mode='ai' if valid else 'guided_fallback'
        if valid:draft.update(validated.validated_data)
    if message:draft.update(local_extract(message,products))
    checked=Draft(data=draft);checked.is_valid(raise_exception=True);draft=checked.validated_data
    serial=Draft(draft).data
    rows=state(basket(request.user));store=Storefront.objects.filter(pk=1).first() or Storefront()
    missing=[key for key in ['portions','date'] if key not in draft]
    results=[]
    if not missing:
        terms=search_terms(draft.get('search',''))
        if terms:
            query=Q()
            for term in terms:query|=Q(name__icontains=term)
            products=products.filter(query)
        for product in products[:100]:
            try:candidate=proposed(rows,product,draft['portions'])
            except serializers.ValidationError:continue
            total=totals(candidate,store)
            if draft.get('budget') is not None and Decimal(total['total'])>draft['budget']:continue
            current=next((row['quantity'] for row in candidate if row['product_id']==product.pk),0)
            if current>product.daily_capacity:continue
            results.append(dict(id=product.pk,name=product.name,price=str(product.price),quantity=draft['portions'],
                addition_subtotal=str(product.price*draft['portions']),basket_after=total,
                delivery_day_allowed=menu_day_allowed(product, draft['date']) and orders_open(product, draft['date'], timezone.now())))
            if len(results)==3:break
    return Response({'draft':serial,'mode':mode,'missing':missing,'results':results,'basket_known':request.user.is_authenticated,
        'basket_total':totals(rows,store) if rows else None})


def owner(request):
    return salted_hmac('shopping-confirmation',str(request.user.pk)).hexdigest()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([HelpThrottle])
@transaction.atomic
def shop_cart(request):
    if not isinstance(request.data,dict):
        raise serializers.ValidationError('Provide a JSON object for the basket preview or confirmation.')
    # Same lock order as checkout: user, storefront, products.
    User.objects.select_for_update().get(pk=request.user.pk)
    Storefront.objects.get_or_create(pk=1)
    store=Storefront.objects.select_for_update().get(pk=1)
    token=request.data.get('confirm')
    if token is not None:
        try:
            if not isinstance(token,str) or len(token)>2000:raise signing.BadSignature()
            signed=signing.loads(token,salt='shopping-cart',max_age=600)
            if signed.get('actor')!=request.user.pk:raise signing.BadSignature()
        except (signing.BadSignature,AttributeError):
            raise serializers.ValidationError('This basket preview expired or belongs to another customer. Review the addition again.')
        session=get_object_or_404(RecommendationSession.objects.select_for_update(),pk=signed.get('session'),variant='chat',owner_key=owner(request))
        context=session.context
        if context.get('applied'):
            current=fingerprint(state(basket(request.user)),store)
            return Response({'added':True,'already_applied':True,'basket_changed':current!=context['after_fingerprint'],'result':context['result']})
        product_id=context['product_id'];quantity=context['quantity']
    else:
        serializer=CartInput(data=request.data);serializer.is_valid(raise_exception=True)
        product_id=serializer.validated_data['product_id'];quantity=serializer.validated_data['quantity']
        context={}
    current=basket(request.user)
    ids={i.product_id for i in current}|{product_id}
    list(Product.objects.select_for_update().filter(pk__in=ids).order_by('pk'))
    current=basket(request.user);rows=state(current)
    product=get_object_or_404(Product,pk=product_id,selling_status='active')
    if any(row['status']!='active' for row in rows):raise serializers.ValidationError('Review inactive items in your basket before adding this recommendation.')
    updated=proposed(rows,product,quantity)
    before=fingerprint(rows,store);after=fingerprint(updated,store)
    result={'product_id':product.pk,'menu':product.name,'quantity':quantity,
        'quantity_before':next((r['quantity'] for r in rows if r['product_id']==product.pk),0),
        'quantity_after':next(r['quantity'] for r in updated if r['product_id']==product.pk),
        'unit_price':str(product.price),'basket_before':totals(rows,store) if rows else None,'basket_after':totals(updated,store)}
    if token is None:
        budget=serializer.validated_data.get('budget')
        if budget is not None and Decimal(result['basket_after']['total'])>budget:
            raise serializers.ValidationError('The current basket total exceeds your budget. Review quantities or budget before adding.')
        context=dict(version='chat-cart-v1',actor=request.user.pk,product_id=product.pk,quantity=quantity,
            before_fingerprint=before,after_fingerprint=after,result=result,applied=False)
        session=RecommendationSession.objects.create(id=uuid.uuid4(),owner_key=owner(request),variant='chat',context=context,products=[product.pk])
        return Response({'preview':result,'confirm':signing.dumps({'session':str(session.pk),'actor':request.user.pk},salt='shopping-cart',compress=True)})
    if context['before_fingerprint']!=before or context['after_fingerprint']!=after or context['result']!=result:
        return Response({'detail':'Your basket, menu price or promotion changed. Review the addition again.'},status=409)
    CartItem.objects.update_or_create(user=request.user,product=product,defaults={'quantity':result['quantity_after']})
    context.update(applied=True,applied_at=timezone.now().isoformat())
    session.context=context;session.save(update_fields=['context'])
    return Response({'added':True,'already_applied':False,'basket_changed':False,'result':result})
