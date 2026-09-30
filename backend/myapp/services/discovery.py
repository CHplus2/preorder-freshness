"""Date-aware menu discovery using the same scheduler as checkout."""
import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from types import SimpleNamespace
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from ..models import InventoryItem, Order, RecommendationSession, RecommendationEvent


def owner_key(request):
    key = request.session.get('discovery_key')
    if not key:
        key = uuid.uuid4().hex
        request.session['discovery_key'] = key
    return key


def candidate_item(product, portions):
    return SimpleNamespace(product=product, product_id=product.pk, quantity=portions)


def slots(items, day, store, limit=3):
    from .scheduling import schedule_order
    today = timezone.localdate()
    if day < today or day > today + timedelta(days=90):
        raise ValidationError('Choose today or a future date within 90 days.')
    found = []
    for hour in range(9, 21):
        delivery = timezone.make_aware(datetime.combine(day, time(hour)))
        try:
            plan = schedule_order(items, delivery, store)
        except ValidationError:
            continue
        found.append({'delivery_at': delivery.isoformat(), 'preparation_at': plan['start'].isoformat(),
            'preparation_end_at': plan['end'].isoformat(), 'hands_on_minutes': plan['hands_on_minutes']})
        if len(found) >= limit:
            break
    return found


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
