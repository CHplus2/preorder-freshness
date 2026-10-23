"""Bounded owner search for an existing order; no reservation until confirmation."""
from collections import Counter
from datetime import date, datetime, time, timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .scheduling import availability_snapshot, schedule_order
from .preorder_windows import common_specific_dates, delivery_day_allowed, orders_open


def next_order_plan(items, order, store, first, now):
    today = timezone.localtime(now).date()
    latest = today + timedelta(days=90)
    first = max(first or today, today)
    if first > latest:
        raise ValidationError('Choose a search date within the next 90 days.')
    specific = common_specific_dates(items)
    if specific is not None:
        offered = sorted(date.fromisoformat(d) for d in specific if first.isoformat() <= d <= latest.isoformat())
        offered = [d for d in offered if all(delivery_day_allowed(i.product, d) and orders_open(
            i.product, d, order.created_at if order.delivery_at and d == timezone.localtime(order.delivery_at).date() else now) for i in items)]
        if not offered:
            return None, None, dict(from_date=first.isoformat(), through_date=first.isoformat(),
                reason='No shared offered date remains in this booking window. Review the accepted menu dates or arrange separate orders.')
        first = offered[0]
    last = min(first + timedelta(days=6), latest)
    quantities = Counter()
    weekdays = set(range(7))
    for item in items:
        quantities[item.product_id] += item.quantity
        if item.product.delivery_weekdays:
            weekdays.intersection_update(item.product.delivery_weekdays)
    summary = dict(from_date=first.isoformat(), through_date=last.isoformat())
    if not weekdays or any(quantities[i.product_id] > i.product.daily_capacity for i in items):
        return None, None, dict(summary, reason='These menus have no common delivery day or exceed a menu daily limit. Review the menu quantities or arrange separate orders.')
    reason = ''
    for offset in range((last-first).days+1):
        day = first + timedelta(days=offset)
        if day.weekday() not in weekdays:
            continue
        availability = availability_snapshot(items, day, store, exclude_order_id=order.pk)
        for hour in range(9, 22):
            delivery = timezone.make_aware(datetime.combine(day, time(hour)))
            try:
                plan = schedule_order(items, delivery, store, now=now, exclude_order_id=order.pk,
                    notice_from=order.created_at if delivery == order.delivery_at else now,
                    availability=availability)
            except ValidationError as exc:
                reason = ' '.join(str(part) for part in exc.detail)
                continue
            return delivery, plan, dict(summary, through_date=day.isoformat())
    return None, None, dict(summary, reason=reason or 'No automatic plan fits these menu rules within this search. Review preparation settings or a manual arrangement.')
