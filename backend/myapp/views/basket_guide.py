"""Whole-order recommendations and one atomic, idempotent basket addition."""
import hashlib
import json
import uuid
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from ..models import CartItem, Product, RecommendationSession, Storefront
from ..services.auth_limits import limit
from ..services.basket_plans import mixed_additions, POOL_LIMIT, CAPACITY_CHECK_LIMIT
from ..services.discovery import candidate_item, owner_key, slots
from ..services.fulfilment import request_store
from ..services.preorder_windows import delivery_day_allowed, orders_open
from ..services.recommendation import rank_menu_choices
from ..services.selling import shipping_enquiry
from .discovery import recommendation_variant
from .shopping_assistant import basket, state, totals, fingerprint, proposed

VERSION='mixed-basket-guide-v1'
BASIS='whole_order_after_discount_and_delivery'


class Input(serializers.Serializer):
    date=serializers.DateField()
    quantity=serializers.IntegerField(min_value=1,max_value=100)
    menu_mode=serializers.ChoiceField(choices=['mixed','same'],default='mixed')
    budget=serializers.DecimalField(max_digits=10,decimal_places=2,min_value=Decimal('0.01'),required=False)
    budget_mode=serializers.ChoiceField(choices=['within','above','all'],default='within')
    category=serializers.IntegerField(min_value=1,required=False)
    delivery_method=serializers.ChoiceField(choices=['standard','express','pickup'],required=False)
    delivery_area=serializers.CharField(max_length=80,allow_blank=True,default='')

    def validate(self,data):
        if not timezone.localdate()<=data['date']<=timezone.localdate()+timedelta(days=90):
            raise serializers.ValidationError('Choose a date within the next 90 days.')
        if data['budget_mode']!='within' and 'budget' not in data:
            raise serializers.ValidationError('Enter a whole-order budget to compare totals.')
        return data


def quote(rows,store):
    return totals(rows,store) if rows else dict(subtotal='0.00',discount='0.00',shipping='0.00',total='0.00',quantity=0)


def usable(product,day,now):
    return product.selling_status=='active' and bool(product.ingredients.all()) and not shipping_enquiry(product) and delivery_day_allowed(product,day) and orders_open(product,day,now)


def candidate_rows(base,addition,products):
    rows=base
    for pk,quantity in sorted(addition.items()):rows=proposed(rows,products[pk],quantity)
    return rows


def matches(total,budget,mode):
    return budget is None or mode=='all' or (total<=budget)==(mode=='within')


@api_view(['POST'])
@permission_classes([AllowAny])
def basket_guide(request):
    limit(request,'mixed-basket-guide')
    incoming=Input(data=request.data);incoming.is_valid(raise_exception=True);data=incoming.validated_data
    now=timezone.now();key=owner_key(request);variant=recommendation_variant(request)
    store,method,area=request_store(Storefront.objects.filter(pk=1).first() or Storefront(),data)
    base=state(basket(request.user));existing={row['product_id']:row['quantity'] for row in base}
    replace_basket=data['menu_mode']=='same' and bool(base)
    search_base=[] if replace_basket else base
    search_existing={} if replace_basket else existing
    products=list(Product.objects.select_related('category').prefetch_related('ingredients__raw_material').order_by('pk'))
    by_id={product.pk:product for product in products};reason=None;budget=data.get('budget');mode=data['budget_mode']
    if sum(search_existing.values())>data['quantity']:reason='quantity_below_basket'
    elif any(pk not in by_id or not usable(by_id[pk],data['date'],now) or quantity>by_id[pk].daily_capacity for pk,quantity in search_existing.items()):reason='basket_needs_review'
    eligible=[p for p in products if usable(p,data['date'],now) and (not data.get('category') or p.category_id==data['category'])]
    ranked=rank_menu_choices(eligible,request.user,personalised=variant=='personalised')
    scores={p.pk:score for score,p,_ in ranked};reasons={p.pk:why for _,p,why in ranked}
    candidates=[]
    if reason is None:
        for addition in mixed_additions(ranked,search_existing,data['quantity'],data['menu_mode']):
            rows=candidate_rows(search_base,addition,by_id);cost=quote(rows,store)
            candidates.append(dict(addition=addition,rows=rows,totals=cost,
                rank=(-len(rows),-sum(scores.get(pk,0)*q for pk,q in addition.items()),tuple((r['product_id'],r['quantity']) for r in rows))))
    evidence=None
    if budget is not None:
        values=[Decimal(candidate['totals']['total']) for candidate in candidates]
        evidence=dict(scope='generated_combinations_before_capacity',considered_baskets=len(values),
            within_count=sum(value<=budget for value in values),above_count=sum(value>budget for value in values),
            minimum_order_total=str(min(values)) if values else None,maximum_order_total=str(max(values)) if values else None)
    ordered=sorted((c for c in candidates if matches(Decimal(c['totals']['total']),budget,mode)),key=lambda c:c['rank'])
    if mode=='all' and budget is not None:
        low=[c for c in ordered if Decimal(c['totals']['total'])<=budget];high=[c for c in ordered if Decimal(c['totals']['total'])>budget]
        ordered=[]
        for index in range(max(len(low),len(high))):
            if index<len(low):ordered.append(low[index])
            if index<len(high):ordered.append(high[index])
    selected=[];saved=[];checked=0
    for candidate in ordered[:CAPACITY_CHECK_LIMIT]:
        checked+=1
        items=[candidate_item(by_id[row['product_id']],row['quantity']) for row in candidate['rows']]
        available=slots(items,data['date'],store)
        if not available:continue
        plan_id='bp_'+hashlib.sha256(json.dumps(sorted(candidate['addition'].items())).encode()).hexdigest()[:16]
        relation=('within' if Decimal(candidate['totals']['total'])<=budget else 'above') if budget is not None else None
        rows=[]
        for row in candidate['rows']:
            p=by_id[row['product_id']];old=search_existing.get(p.pk,0)
            rows.append(dict(id=p.pk,name=p.name,image_url=p.image_url,price=str(p.price),selling_details=p.selling_details,
                quantity=row['quantity'],existing_quantity=old,add_quantity=row['quantity']-old,
                line_total=str(p.price*row['quantity']),reasons=reasons.get(p.pk) or (['Already in your basket'] if old else ['A menu to try from this kitchen'])))
        selected.append(dict(id=plan_id,items=rows,totals=candidate['totals'],budget_relation=relation,slots=available))
        saved.append(dict(id=plan_id,addition={str(pk):q for pk,q in candidate['addition'].items()},totals=candidate['totals'],
            after_fingerprint=fingerprint(candidate['rows'],store),slots=[slot['delivery_at'] for slot in available]))
        if len(selected)==3:break
    if not selected and reason is None:reason='no_price_match' if candidates and not ordered else 'no_kitchen_times' if ordered else 'no_menu_match'
    context=dict(version=VERSION,actor=request.user.pk if request.user.is_authenticated else None,date=data['date'].isoformat(),
        quantity=data['quantity'],menu_mode=data['menu_mode'],replace_basket=replace_basket,budget=str(budget) if budget is not None else '',budget_mode=mode,category=data.get('category'),
        method=method,area=area,before_fingerprint=fingerprint(base,store),options=saved,surface='basket_guide')
    session=RecommendationSession.objects.create(id=uuid.uuid4(),owner_key=key,variant=variant,context=context,
        products=sorted({row['id'] for plan in selected for row in plan['items']}))
    return Response(dict(session=str(session.pk),version=VERSION,date=data['date'].isoformat(),quantity=data['quantity'],
        menu_mode=data['menu_mode'],replaces_basket=replace_basket,delivery_method=method,basket_known=request.user.is_authenticated,current_quantity=sum(existing.values()),basket_before=quote(base,store),
        budget=dict(amount=str(budget),mode=mode,basis=BASIS) if budget is not None else None,
        plans=selected,empty_reason=reason if not selected else None,price_evidence=evidence,checked_baskets=checked,
        pool_limit=POOL_LIMIT,checked_limit=CAPACITY_CHECK_LIMIT,
        message='Allow a mix keeps existing basket items and completes the requested total item count. One menu only searches independent alternatives; replacing an existing basket requires explicit confirmation. Order totals include current bulk discounts and delivery. The bounded search uses up to 12 candidate menus and checks at most 30 complete baskets for kitchen times; other combinations may exist. Nothing is reserved until checkout.'))


class AddInput(serializers.Serializer):
    session=serializers.UUIDField()
    plan=serializers.RegexField(r'^bp_[0-9a-f]{16}$')
    delivery_at=serializers.DateTimeField(required=False)
    date_only=serializers.BooleanField(default=False)
    replace_basket=serializers.BooleanField(default=False)

    def validate(self,data):
        if set(self.initial_data)-set(self.fields):raise serializers.ValidationError('Use the returned basket option and time; do not submit prices or quantities.')
        if data['date_only'] and 'delivery_at' in data:raise serializers.ValidationError('Choose the delivery time later in your basket, or submit a returned time without date-only mode.')
        if not data['date_only'] and 'delivery_at' not in data:raise serializers.ValidationError('Choose a returned delivery time or request a date-only basket addition.')
        return data


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def add_basket_plan(request):
    limit(request,'mixed-basket-add',str(request.user.pk),maximum=30)
    incoming=AddInput(data=request.data);incoming.is_valid(raise_exception=True);data=incoming.validated_data
    User.objects.select_for_update().get(pk=request.user.pk)
    Storefront.objects.get_or_create(pk=1);original=Storefront.objects.select_for_update().get(pk=1)
    current=basket(request.user)
    session=get_object_or_404(RecommendationSession.objects.select_for_update(),pk=data['session'],owner_key=owner_key(request),created_at__gte=timezone.now()-timedelta(days=1))
    context=session.context
    if context.get('version')!=VERSION or context.get('actor')!=request.user.pk:
        raise serializers.ValidationError('Sign in and search again to include your current basket.')
    replace_basket=context.get('replace_basket',False)
    if data['replace_basket']!=replace_basket:
        raise serializers.ValidationError('Confirm replacement of the existing basket, or search again to keep its items.')
    option=next((o for o in context['options'] if o['id']==data['plan']),None)
    if not option:raise serializers.ValidationError('Choose a returned basket option.')
    store,_,_=request_store(original,dict(delivery_method=context['method'],delivery_area=context['area']))
    date_only=data['date_only'];requested=data.get('delivery_at')
    field=serializers.DateTimeField()
    if not date_only and not any(field.run_validation(value)==requested for value in option['slots']):
        raise serializers.ValidationError('Choose a time returned for this complete basket.')
    applied=context.get('applied')
    if applied:
        if applied['plan']!=data['plan'] or applied.get('date_only',False)!=date_only or (not date_only and field.run_validation(applied['delivery_at'])!=requested):
            return Response({'detail':'This suggestion was already used. Review your basket before choosing another option.'},status=409)
        result=dict(applied['result'],already_applied=True,basket_changed=fingerprint(state(current),store)!=option['after_fingerprint'])
        return Response(result)
    if session.created_at<timezone.now()-timedelta(minutes=15):
        raise serializers.ValidationError('This basket suggestion expired. Search again for current totals and times.')
    additions={int(pk):q for pk,q in option['addition'].items()}
    if not additions:raise serializers.ValidationError('Your basket already has the requested number of items. Review it at checkout.')
    ids=set(additions)|{item.product_id for item in current}
    products={p.pk:p for p in Product.objects.select_for_update().filter(pk__in=ids).prefetch_related('ingredients__raw_material').order_by('pk')}
    current=state(basket(request.user));day=field.run_validation(context['date']+'T12:00:00+08:00').date()
    required_ids=set(additions) if replace_basket else ids
    if any(pk not in products or not usable(products[pk],day,timezone.now()) for pk in required_ids):
        return Response({'detail':'A menu or its ordering rules changed. Search again before adding.'},status=409)
    updated=candidate_rows([] if replace_basket else current,additions,products);cost=quote(updated,store)
    if fingerprint(current,store)!=context['before_fingerprint'] or fingerprint(updated,store)!=option['after_fingerprint'] or cost!=option['totals']:
        return Response({'detail':'Your basket, menu prices or delivery/promotion terms changed. Search again for the whole-order total.'},status=409)
    from ..services.scheduling import schedule_order
    items=[candidate_item(products[row['product_id']],row['quantity']) for row in updated]
    try:
        if date_only:
            if not slots(items,day,store):raise serializers.ValidationError('No remaining times for this date.')
        else:schedule_order(items,requested,store,now=timezone.now())
    except serializers.ValidationError:
        return Response({'detail':'Kitchen availability changed. Search again for a workable time for the whole basket.'},status=409)
    if replace_basket:CartItem.objects.filter(user=request.user).delete()
    for row in updated:
        if row['product_id'] in additions:
            CartItem.objects.update_or_create(user=request.user,product_id=row['product_id'],defaults={'quantity':row['quantity']})
    result=dict(added=True,session=str(session.pk),plan=data['plan'],already_applied=False,basket_changed=False,
        quantity=context['quantity'],added_quantity=sum(additions.values()),replaced_basket=replace_basket,date_only=date_only,date=context['date'],delivery_at=None if date_only else requested.isoformat(),totals=cost)
    context['applied']=dict(plan=data['plan'],date_only=date_only,delivery_at=None if date_only else requested.isoformat(),result=result)
    session.context=context;session.save(update_fields=['context'])
    return Response(result)
