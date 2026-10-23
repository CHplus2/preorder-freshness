"""Optional menu trading rules, independent of cooking lead time and capacity.

Dates and cutoffs are Malaysia calendar rules. Existing accepted orders use
their saved terms and original notice time when retaining their delivery date.
"""
from datetime import datetime, timedelta
from django.utils import timezone
from django.utils.dateparse import parse_time


def delivery_day_allowed(product, day):
    weekdays = getattr(product, 'delivery_weekdays', [])
    dates = getattr(product, 'delivery_dates', [])
    return (not weekdays or day.weekday() in weekdays) and (not dates or day.isoformat() in dates)


def common_specific_dates(items):
    """None means unrestricted dates; an empty set means an incompatible basket."""
    common = None
    for item in items:
        dates = getattr(item.product, 'delivery_dates', [])
        if dates:
            common = set(dates) if common is None else common.intersection(dates)
    return common


def preorder_deadline(product, day):
    cutoff = getattr(product, 'order_cutoff_time', None)
    if not cutoff:
        return None
    if isinstance(cutoff, str):
        cutoff = parse_time(cutoff)
    return timezone.make_aware(datetime.combine(
        day-timedelta(days=getattr(product, 'order_cutoff_days_before', 1)), cutoff))


def orders_open(product, day, placed_at):
    deadline = preorder_deadline(product, day)
    return deadline is None or placed_at < deadline


def ordering_issue(product, day, placed_at):
    dates = getattr(product, 'delivery_dates', [])
    if dates and day.isoformat() not in dates:
        shown = ', '.join(dates[:3]) + (' …' if len(dates) > 3 else '')
        return f'{product.name} is offered only on these delivery dates: {shown}. Choose an offered date or order it separately.'
    if not orders_open(product, day, placed_at):
        deadline = preorder_deadline(product, day)
        return (f'{product.name}: orders for {day.isoformat()} closed at '
            f'{deadline:%d %b %Y, %I:%M %p} Malaysia time. Choose a later offered date or contact the kitchen.')
    return ''
