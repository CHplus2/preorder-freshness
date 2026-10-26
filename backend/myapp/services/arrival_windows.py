"""Accepted arrival ranges. delivery_at remains the latest-arrival deadline."""
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers

WINDOW_MINUTES = (0, 30, 60)


def duration(store_or_order):
    saved = getattr(store_or_order, 'fulfilment_snapshot', None)
    value = saved.get('arrival_window_minutes', 0) if isinstance(saved, dict) else getattr(store_or_order, 'arrival_window_minutes', 0)
    if type(value) is not int or value not in WINDOW_MINUTES:
        raise serializers.ValidationError('The saved arrival window needs kitchen review.')
    return value


def window(delivery_at, minutes):
    if not delivery_at or not minutes:
        return None
    return {'start': (delivery_at-timedelta(minutes=minutes)).isoformat(),
            'end': delivery_at.isoformat(), 'minutes': minutes}


def start(order):
    return order.delivery_at-timedelta(minutes=duration(order)) if order.delivery_at else None


def validate_window(delivery_at, store, now):
    minutes = duration(store)
    if not minutes:
        return
    if getattr(store, 'fulfilment_method', '') == 'pickup':
        raise serializers.ValidationError('Self-collection uses one agreed time, not an arrival window.')
    first, last = timezone.localtime(delivery_at-timedelta(minutes=minutes)), timezone.localtime(delivery_at)
    from .fulfilment import hours
    opening, closing = hours(store)
    if first.date() != last.date() or first.hour < opening or last.hour*60+last.minute > closing*60:
        raise serializers.ValidationError('The whole arrival window must fit within delivery hours on the same date.')
    if first <= now:
        raise serializers.ValidationError('Choose an arrival window that starts in the future.')


def label(order):
    if not order.delivery_at:
        return 'a time to agree with the kitchen'
    last = timezone.localtime(order.delivery_at)
    if not duration(order):
        return last.strftime('%d %b %Y, %I:%M %p')+' Malaysia time'
    first = timezone.localtime(start(order))
    return first.strftime('%d %b %Y, %I:%M %p')+'–'+last.strftime('%I:%M %p')+' Malaysia time'


def dispatch_by(order):
    if order.delivery_method == 'pickup' or not order.delivery_at or not order.preparation_end_at or order.preparation_plan.get('needs_review'):
        return None
    buffer = order.fulfilment_snapshot.get('buffer_minutes', order.preparation_plan.get('delivery_buffer_minutes'))
    return order.delivery_at-timedelta(minutes=buffer) if type(buffer) is int and buffer >= 0 else None
