"""Fulfilment terms used by discovery, checkout and accepted-order planning."""
from copy import copy
from decimal import Decimal
from rest_framework.exceptions import ValidationError
from rest_framework import serializers

METHODS = ('standard', 'express', 'pickup')


class Selection(serializers.Serializer):
    arrival_window_minutes = serializers.ChoiceField(choices=[0,30,60], default=0)
    delivery_method = serializers.ChoiceField(choices=METHODS, required=False)
    delivery_area = serializers.CharField(max_length=80, allow_blank=True, default='')


def request_store(store, data, require_area=False):
    incoming = Selection(data=data)
    incoming.is_valid(raise_exception=True)
    values = incoming.validated_data
    method = values.get('delivery_method', default_method(store))
    return selected_store(store, method, values['delivery_area'], require_area, values['arrival_window_minutes']), method, values['delivery_area']


def default_method(store):
    return 'standard' if getattr(store, 'delivery_enabled', True) else 'pickup'


def hours(store):
    return getattr(store, 'fulfilment_open_hour', getattr(store, 'delivery_open_hour', 9)), getattr(store, 'fulfilment_close_hour', getattr(store, 'delivery_close_hour', 21))


def fee(subtotal, store, method='standard'):
    if method == 'pickup':
        return Decimal('0.00')
    threshold = getattr(store, 'free_delivery_minimum_myr', Decimal('50'))
    if threshold is not None and subtotal >= threshold:
        return Decimal('0.00')
    return Decimal(getattr(store, 'delivery_fee_myr', 5)).quantize(Decimal('.01'))


def selected_store(store, method=None, area='', require_area=False, arrival_window_minutes=0):
    method = default_method(store) if method is None else method
    if method not in METHODS:
        raise ValidationError('Choose owner delivery, express request or self-collection.')
    pickup = method == 'pickup'
    if pickup and arrival_window_minutes:
        raise ValidationError('Self-collection uses one agreed time, not an arrival window.')
    if pickup:
        if not getattr(store, 'pickup_enabled', False) or not getattr(store, 'pickup_location', '').strip():
            raise ValidationError('Self-collection is unavailable. Choose another fulfilment option.')
    elif not getattr(store, 'delivery_enabled', True):
        raise ValidationError('Delivery is unavailable. Choose self-collection if offered.')
    areas = getattr(store, 'delivery_areas', [])
    if not pickup and require_area and areas and area not in areas:
        raise ValidationError('Choose a delivery area served by this kitchen. Contact the kitchen about other areas.')
    selected = copy(store)
    selected.arrival_window_minutes = arrival_window_minutes
    selected.original_delivery_buffer_minutes = store.delivery_buffer_minutes
    selected.delivery_buffer_minutes = 0 if pickup else store.delivery_buffer_minutes
    selected.fulfilment_open_hour = getattr(store, 'pickup_open_hour' if pickup else 'delivery_open_hour', 8 if pickup else 9)
    selected.fulfilment_close_hour = getattr(store, 'pickup_close_hour' if pickup else 'delivery_close_hour', 20 if pickup else 21)
    selected.fulfilment_method = method
    return selected


def snapshot(store, method, area=''):
    first, last = hours(store)
    return dict(method=method, label='Self-collection' if method == 'pickup' else 'Express request' if method == 'express' else 'Owner delivery',
        open_hour=first, close_hour=last, buffer_minutes=store.delivery_buffer_minutes,
        arrival_window_minutes=getattr(store, 'arrival_window_minutes', 0),
        pickup_location=store.pickup_location if method == 'pickup' else '',
        pickup_instructions=store.pickup_instructions if method == 'pickup' else '',
        delivery_area=area if method != 'pickup' else '')


def order_store(store, order):
    """Keep accepted handover terms even if the owner later changes the store."""
    saved = order.fulfilment_snapshot or {}
    from .arrival_windows import duration
    selected = copy(store)
    selected.arrival_window_minutes = duration(order)
    selected.original_delivery_buffer_minutes = store.delivery_buffer_minutes
    selected.delivery_buffer_minutes = saved.get('buffer_minutes', order.preparation_plan.get('delivery_buffer_minutes', store.delivery_buffer_minutes))
    selected.fulfilment_open_hour = saved.get('open_hour', 9)
    selected.fulfilment_close_hour = saved.get('close_hour', 21)
    selected.fulfilment_method = order.delivery_method
    return selected
