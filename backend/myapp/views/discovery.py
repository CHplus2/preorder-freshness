from ..services.selling import shipping_enquiry
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from ..models import Product, Storefront, CartItem, RecommendationSession, RecommendationEvent
from ..services.discovery import slots, slot_search, next_basket_slots, candidate_item, owner_key
from ..services.recommendation import rank_menu_choices
from ..services.auth_limits import limit
from ..services.preorder_windows import delivery_day_allowed, orders_open
from ..services.fulfilment import request_store


class GuideInput(serializers.Serializer):
    delivery_method = serializers.ChoiceField(choices=['standard', 'express', 'pickup'], required=False)
    date = serializers.DateField()
    portions = serializers.IntegerField(min_value=1, max_value=100, default=1)
    budget = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), required=False)
    category = serializers.IntegerField(min_value=1, required=False)


class BasketSlotsInput(serializers.Serializer):
    arrival_window_minutes = serializers.ChoiceField(choices=[0,30,60], default=0)
    delivery_method = serializers.ChoiceField(choices=['standard', 'express', 'pickup'], required=False)
    date = serializers.DateField(required=False)
    find_next = serializers.BooleanField(default=False)

    def validate(self, data):
        if not data.get('find_next') and 'date' not in data:
            raise serializers.ValidationError({'date': 'Choose a date or find the next available day.'})
        return data


def recommendation_variant(request):
    if not settings.RECOMMENDATION_EXPERIMENT:
        return 'personalised'
    variant = request.session.get('discovery_variant') or secrets.choice(['popularity', 'personalised'])
    request.session['discovery_variant'] = variant
    return variant


@api_view(['POST'])
@permission_classes([AllowAny])
def menu_suggestions(request):
    """Small, date-free discovery set; it makes no stock or capacity promise."""
    limit(request, 'menu-suggestions')
    key = owner_key(request)
    variant = recommendation_variant(request)
    products = Product.objects.filter(selling_status='active').select_related('category').prefetch_related('ingredients').order_by('id')
    ranked = rank_menu_choices(products, request.user, personalised=variant == 'personalised')[:3]
    results = [{'id': p.pk, 'name': p.name, 'image_url': p.image_url, 'price': str(p.price), 'selling_details': p.selling_details,
                'reasons': reasons or ['Explore this menu from our kitchen']} for _, p, reasons in ranked]
    reasons = [reason for row in results for reason in row['reasons']]
    basis = ('history' if any(reason.startswith('You ') for reason in reasons)
             else 'popularity' if 'Popular recently' in reasons else 'menu')
    session = RecommendationSession.objects.create(id=uuid.uuid4(), owner_key=key, variant=variant,
        context={'version': 'instant-menu-v1', 'surface': 'menu_cards', 'experiment': settings.RECOMMENDATION_EXPERIMENT},
        products=[row['id'] for row in results])
    return Response({'session': str(session.pk), 'basis': basis, 'results': results})


@api_view(['POST'])
@permission_classes([AllowAny])
def guided_menu(request):
    limit(request, 'guided-menu')
    serializer = GuideInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if not timezone.localdate() <= data['date'] <= timezone.localdate()+timedelta(days=90):
        raise serializers.ValidationError('Choose a date within the next 90 days.')
    key = owner_key(request)
    variant = recommendation_variant(request)
    products = Product.objects.filter(selling_status='active').select_related('category').prefetch_related('ingredients__raw_material').order_by('id')
    if data.get('category'):
        products = products.filter(category_id=data['category'])
    category_available = not data.get('category') or products.filter(ingredients__isnull=False).exists()
    if data.get('budget'):
        products = products.filter(price__lte=data['budget']/data['portions'])
    # Both discovery surfaces use the same ranking; dates additionally constrain it.
    products = list(products)
    shipping_only = bool(products) and all(shipping_enquiry(p) for p in products)
    candidates = rank_menu_choices(
        (p for p in products if not shipping_enquiry(p) and delivery_day_allowed(p, data['date']) and orders_open(p, data['date'], timezone.now())),
        request.user, personalised=variant == 'personalised')
    store = Storefront.objects.filter(pk=1).first() or Storefront()
    store, method, _ = request_store(store, data)
    results = []
    for score, p, reasons in candidates[:30]:
        item = candidate_item(p, data['portions'])
        available = slots([item], data['date'], store)
        if not available:
            continue
        results.append({'id': p.pk, 'name': p.name, 'image_url': p.image_url,
            'price': str(p.price), 'selling_details': p.selling_details, 'food_total': str(p.price*data['portions']),
            'portions': data['portions'], 'slots': available,
            'reasons': [f'Kitchen time available for {data["portions"]} selling units'] +
                ([f'Within your RM {data["budget"]} food budget'] if data.get('budget') else []) + reasons})
        if len(results) == 3:
            break
    session = RecommendationSession.objects.create(id=uuid.uuid4(), owner_key=key, variant=variant,
        context={'date': data['date'].isoformat(), 'portions': data['portions'],
            'budget': str(data.get('budget', '')), 'category': data.get('category'),
            'version': 'date-guide-v1', 'surface': 'date_guide', 'experiment': settings.RECOMMENDATION_EXPERIMENT},
        products=[r['id'] for r in results])
    return Response({'session': str(session.pk), 'results': results,
        'empty_reason': None if results else 'shipping_enquiry' if shipping_only else 'category_unavailable' if not category_available else 'no_kitchen_times' if candidates else 'no_menu_match',
        'checked_limit': 30, 'message': 'Hourly suggestions use kitchen capacity, not current stock. The owner may need to purchase ingredients. Food totals exclude discounts and delivery; checkout rechecks the whole basket.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def basket_slots(request):
    data = BasketSlotsInput(data=request.data)
    data.is_valid(raise_exception=True)
    items = list(CartItem.objects.filter(user=request.user).select_related('product'))
    if not items:
        raise serializers.ValidationError('Your basket is empty.')
    store = Storefront.objects.filter(pk=1).first() or Storefront()
    store, method, _ = request_store(store, data.validated_data)
    if data.validated_data['find_next']:
        result = next_basket_slots(items, data.validated_data.get('date'), store)
    else:
        result = slot_search(items, data.validated_data['date'], store, limit=24)
    result['arrival_window_minutes'] = data.validated_data['arrival_window_minutes']
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def recommendation_event(request):
    sid = serializers.UUIDField().run_validation(request.data.get('session'))
    rid = serializers.UUIDField().run_validation(request.data.get('request_id'))
    event = serializers.ChoiceField(choices=['impression', 'click', 'added']).run_validation(request.data.get('event'))
    session = RecommendationSession.objects.filter(pk=sid, owner_key=owner_key(request), created_at__gte=timezone.now()-timedelta(hours=24)).first()
    if not session:
        raise serializers.ValidationError('This recommendation session has expired.')
    product = serializers.IntegerField(min_value=1, allow_null=True).run_validation(request.data.get('product'))
    if product is not None and product not in session.products:
        raise serializers.ValidationError('This product was not shown in this recommendation.')
    if event != 'impression' and product is None:
        raise serializers.ValidationError('Choose a recommended product.')
    if not session.products:
        return Response({'recorded': False})
    existing = RecommendationEvent.objects.filter(request_id=rid).first()
    if existing:
        if (existing.session_id, existing.event, existing.product_id) != (sid, event, product):
            raise serializers.ValidationError('Event reference already used.')
        return Response({'recorded': True})
    # One event of each kind per product/session bounds anonymous telemetry growth.
    if not session.events.filter(event=event, product_id=product).exists():
        RecommendationEvent.objects.create(session=session, event=event, product_id=product, request_id=rid)
    return Response({'recorded': True})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def recommendation_metrics(request):
    generated_at = timezone.now()
    since = generated_at-timedelta(days=28)
    rows = []
    for variant in ['popularity', 'personalised']:
        sessions = RecommendationSession.objects.filter(created_at__gte=since, created_at__lte=generated_at, variant=variant, events__event='impression').distinct()
        exposed = sessions.count()
        if not exposed:
            continue
        clicked = sessions.filter(events__event='click').distinct().count()
        added = sessions.filter(events__event='added').distinct().count()
        ordered = sessions.filter(events__event='order', events__order__status__in=['pending','processing','cooked','shipped','delivered']).distinct().count()
        paid = sessions.filter(events__event='order', events__order__payment_status='paid',
            events__order__status__in=['pending','processing','cooked','shipped','delivered']).distinct().count()
        rows.append({'variant': variant, 'exposed_sessions': exposed, 'clicked_sessions': clicked,
            'added_sessions': added, 'ordered_sessions': ordered, 'paid_sessions': paid, 'paid_percent': round(100*paid/exposed, 1)})
    return Response({'days': 28, 'rows': rows, 'experiment_enabled': settings.RECOMMENDATION_EXPERIMENT,
        'window_start': since.isoformat(), 'window_end': generated_at.isoformat(), 'generated_at': generated_at.isoformat(),
        'definition': 'Denominator: recommendation requests with rendered results (one exposure per request). Purchase attribution: submitted recommendation session with a matching product within 24 hours, same browser session key. The storefront submits the most recently selected recommendation session. Cards and date guidance are combined. Paid excludes cancelled/refunded orders. Repeat visitors may create multiple sessions. These are observed outcomes, not proof of causal conversion lift.'})
