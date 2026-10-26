"""Date-aware menu discovery using the same scheduler as checkout."""
from .selling import shipping_enquiry
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from types import SimpleNamespace
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from ..models import InventoryItem, Order, RecommendationSession, RecommendationEvent
from .preorder_windows import common_specific_dates, delivery_day_allowed, orders_open
from .fulfilment import hours


def owner_key(request):
    key = request.session.get('discovery_key')
    if not key:
        key = uuid.uuid4().hex
        request.session['discovery_key'] = key
    return key


def candidate_item(product, portions):
    return SimpleNamespace(product=product, product_id=product.pk, quantity=portions)


def slot_search(items, day, store, limit=3, now=None):
    from .scheduling import schedule_order, availability_snapshot
    now = now or timezone.now()
    today = timezone.localtime(now).date()
    if day < today or day > today + timedelta(days=90):
        raise ValidationError('Choose today or a future date within 90 days.')
    items = list(items)
    advance = now+timedelta(hours=max(item.product.lead_hours for item in items))
    request_after = advance+timedelta(minutes=store.delivery_buffer_minutes)
    snapshot = availability_snapshot(items, day, store)
    found = []
    if any(shipping_enquiry(item.product) for item in items):
        return dict(slots=[], unavailable_code='shipping_enquiry', unavailable_reason='This offer needs a shipping enquiry. Contact the kitchen to agree courier, fees and arrival estimates; dispatch dates are not local delivery slots.', suggested_date=None, searched_from=day.isoformat(), searched_through=day.isoformat(), searched_days=1, earliest_preparation_at=advance.isoformat(), delivery_request_after=request_after.isoformat())
    last_reason = ''
    last_code = ''
    opening, closing = hours(store)
    for hour in range(opening, closing+1):
        delivery = timezone.make_aware(datetime.combine(day, time(hour)))
        try:
            plan = schedule_order(items, delivery, store, now=now, availability=snapshot)
        except ValidationError as exc:
            last_reason = ' '.join(str(part) for part in exc.detail)
            codes = exc.get_codes()
            last_code = 'daily_capacity' if isinstance(codes, list) and codes and all(code == 'daily_capacity' for code in codes) else ''
            continue
        from .arrival_windows import window, duration
        found.append({'arrival_window': window(delivery, duration(store)), 'delivery_at': delivery.isoformat(), 'preparation_at': plan['start'].isoformat(),
            'preparation_end_at': plan['end'].isoformat(), 'hands_on_minutes': plan['hands_on_minutes']})
        if len(found) >= limit:
            break
    return {'slots': found, 'unavailable_reason': last_reason if not found else '',
        'unavailable_code': last_code if not found else '',
        'earliest_preparation_at': advance.isoformat(), 'delivery_request_after': request_after.isoformat(),
        'suggested_date': day.isoformat() if found else None,
        'searched_from': day.isoformat(), 'searched_through': day.isoformat(), 'searched_days': 1}


def next_basket_slots(items, day, store):
    """Bounded seven-day search; suggestions never reserve capacity or stock."""
    items = list(items)
    now = timezone.now()
    today = timezone.localtime(now).date()
    latest = today+timedelta(days=90)
    if day is not None and day > latest:
        raise ValidationError('Choose a date within the next 90 days.')
    advance = now+timedelta(hours=max(item.product.lead_hours for item in items))
    request_after = advance+timedelta(minutes=store.delivery_buffer_minutes)
    empty = dict(slots=[], earliest_preparation_at=advance.isoformat(),
        delivery_request_after=request_after.isoformat(), suggested_date=None,
        searched_from=None, searched_through=None, searched_days=0)
    if any(shipping_enquiry(item.product) for item in items):
        return dict(empty, unavailable_code='shipping_enquiry', unavailable_reason='This offer needs a shipping enquiry. Contact the kitchen about courier, fees and arrival estimates.')
    # Changing dates cannot solve a basket that exceeds a menu's own limit or
    # contains menus with no shared delivery weekday. Avoid 91 futile checks.
    from collections import Counter
    quantities = Counter()
    weekdays = set(range(7))
    for item in items:
        quantities[item.product_id] += item.quantity
        if item.product.delivery_weekdays:
            weekdays.intersection_update(item.product.delivery_weekdays)
    for item in items:
        if quantities[item.product_id] > item.product.daily_capacity:
            return dict(empty, unavailable_code='quantity_limit',
                unavailable_reason=f'{item.product.name}: {quantities[item.product_id]} requested; daily limit {item.product.daily_capacity}. Reduce the quantity or ask the kitchen about separate deliveries.')
    if not weekdays:
        return dict(empty, unavailable_code='no_common_weekday',
            unavailable_reason='These menus have no delivery weekday in common. Order them separately or change your basket.')
    first = max(day or today, today, timezone.localtime(request_after).date())
    specific = common_specific_dates(items)
    if specific is not None:
        candidates = sorted(date.fromisoformat(d) for d in specific if first.isoformat() <= d <= latest.isoformat())
        candidates = [d for d in candidates if all(delivery_day_allowed(i.product, d) and orders_open(i.product, d, now) for i in items)]
        if not candidates:
            return dict(empty, unavailable_code='no_common_date', unavailable_reason=
                'These items have no shared offered date still open for ordering within the booking window. Check the menu dates and cutoffs, choose an earlier search date, or order items separately.')
        # Jump directly to the next seasonal sale, rather than scanning weeks
        # in which the owner has not offered any dates.
        first = candidates[0]
    last = min(first+timedelta(days=6), latest)
    if first > latest or request_after >= now+timedelta(days=90):
        return {'slots': [], 'unavailable_reason': 'This basket needs more advance notice than the 90-day booking window allows. Contact the kitchen.',
            'earliest_preparation_at': advance.isoformat(), 'delivery_request_after': request_after.isoformat(),
            'suggested_date': None, 'searched_from': None, 'searched_through': None, 'searched_days': 0}
    for offset in range((last-first).days+1):
        search_day = first+timedelta(days=offset)
        result = slot_search(items, search_day, store, limit=24, now=now)
        result.update(searched_from=first.isoformat(), searched_days=offset+1)
        if result['slots']:
            return result
    return result


def slots(items, day, store, limit=3):
    return slot_search(items, day, store, limit)['slots']


def shopping_preview(items, preparation_at, preparation_end_at):
    """Allocate existing bookings first, then the candidate. No stock reservation."""
    lots = list(InventoryItem.objects.filter(quantity__gt=0, quarantined=False,
        received_date__lte=timezone.localdate(), expiry_date__gte=timezone.localdate()).order_by('expiry_date', 'id'))
    remaining = {lot.pk: lot.quantity for lot in lots}

    def allocate(needs, use_by):
        missing = []
        for material, row in needs.items():
            quantity = row['quantity']
            for lot in lots:
                if lot.raw_material_id != material or lot.expiry_date < use_by:
                    continue
                used = min(remaining[lot.pk], quantity)
                remaining[lot.pk] -= used
                quantity -= used
                if quantity <= 0:
                    break
            if quantity > 0:
                missing.append({'material': row['name'], 'quantity': str(quantity), 'unit': row['unit']})
        return missing

    for order in Order.objects.filter(status__in=['pending', 'processing'], inventory_deducted=False).prefetch_related('items__accepted_ingredients').order_by('preparation_at', 'pk'):
        if order.preparation_plan.get('needs_review') and not order.preparation_at:
            # An unaccepted request is not an existing stock commitment.
            continue
        needs = {}
        for item in order.items.all():
            for r in item.accepted_ingredients.all():
                row = needs.setdefault(r.raw_material_id, {'name': r.material_name, 'unit': r.unit, 'quantity': Decimal(0)})
                row['quantity'] += r.quantity_per_portion * item.quantity
        use_by = timezone.localtime(order.preparation_end_at or order.preparation_at).date() if (order.preparation_end_at or order.preparation_at) else timezone.localdate()
        allocate(needs, use_by)
    needs = {}
    for item in items:
        for r in item.product.ingredients.select_related('raw_material'):
            row = needs.setdefault(r.raw_material_id, {'name': r.raw_material.name, 'unit': r.raw_material.unit, 'quantity': Decimal(0)})
            row['quantity'] += r.quantity_required * item.quantity
    return allocate(needs, timezone.localtime(preparation_end_at).date())


def attribute_order(request, order):
    session_id = request.data.get('recommendation_session')
    try:
        session_id = uuid.UUID(str(session_id))
    except (ValueError, TypeError, AttributeError):
        return
    session = RecommendationSession.objects.filter(pk=session_id, owner_key=owner_key(request),
        created_at__gte=timezone.now()-timedelta(hours=24)).first()
    if not session or not session.events.filter(event='impression').exists():
        return
    if not order.items.filter(product_id__in=session.products).exists():
        return
    # Outcome is derived from the order's verified payment state in the report.
    RecommendationEvent.objects.get_or_create(order=order, defaults={
        'session': session, 'event': 'order', 'request_id': uuid.uuid4()})
