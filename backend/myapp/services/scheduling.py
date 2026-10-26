"""Deterministic backward scheduling: one worker and one unit per named resource.
Existing bookings are immutable. Conservative greedy placement may reject a plan
that a human could improve; it never promises globally optimal packing.
"""
from datetime import date, datetime, time, timedelta
from collections import Counter
from dataclasses import dataclass
from math import ceil
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Sum, Q
from rest_framework.exceptions import ValidationError
from ..models import Order, OrderItem, KitchenBlock
from .work_sessions import PAUSABLE_RESOURCES, resumable_sessions, work_days
from .preorder_windows import ordering_issue
from .fulfilment import hours

RESOURCES = {'prep_table', 'stove', 'oven', 'rice_cooker', 'fridge', 'packing_area', 'none'}


def capacity_bookings(items):
    """Unaccepted review requests do not reserve a daily delivery quota."""
    return OrderItem.objects.filter(product_id__in=items).exclude(order__status='cancelled').filter(
        Q(order__status__in=['processing', 'cooked', 'shipped', 'delivered'])
        | Q(order__preparation_plan__needs_review__isnull=True) | Q(order__preparation_plan__needs_review=False))


def review_request(reason, store):
    return dict(start=None, end=None, tasks=[], needs_review=True, review_reason=reason,
                delivery_buffer_minutes=store.delivery_buffer_minutes)


def validate_tasks(value):
    if not isinstance(value, list) or len(value) > 20:
        raise ValidationError('Use a list of up to 20 preparation steps.')
    clean = []
    for task in value:
        if not isinstance(task, dict):
            raise ValidationError('Each preparation step must contain a name, duration and resource.')
        name = task.get('name', '')
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValidationError('Give each preparation step a name of up to 80 characters.')
        row = {'name': name.strip(), 'resource': task.get('resource', 'prep_table')}
        if not isinstance(row['resource'], str) or row['resource'] not in RESOURCES:
            raise ValidationError('Choose a supported kitchen resource.')
        for key, default, low, high in [('minutes', 1, 1, 43200), ('additional_batch_minutes', 0, 0, 43200), ('max_wait_minutes', 0, 0, 10080), ('max_pause_minutes', 0, 0, 10080)]:
            v = task.get(key, default)
            if type(v) is not int or not low <= v <= high:
                raise ValidationError(f'{name}: {key.replace("_", " ")} must be a whole number between {low} and {high}.')
            row[key] = v
        for key, default in [('worker', True), ('overnight', False), ('independent_batches', False), ('splittable', False)]:
            v = task.get(key, default)
            if type(v) is not bool:
                raise ValidationError(f'{name}: choose yes or no for {key}.')
            row[key] = v
        if row['overnight'] and (row['worker'] or row['resource'] not in {'fridge', 'none'}):
            raise ValidationError('Only unattended fridge/rest steps can run outside working hours. Split setup and finishing into attended steps.')
        row['pause_resource'] = task.get('pause_resource', 'none')
        if not isinstance(row['pause_resource'], str) or row['pause_resource'] not in {'fridge', 'none'}:
            raise ValidationError(f'{name}: choose fridge or no dedicated equipment for pause storage.')
        if row['splittable'] and (not row['worker'] or row['resource'] not in PAUSABLE_RESOURCES or row['overnight']):
            raise ValidationError(f'{name}: only attended prep-table, packing or no-equipment work may pause. Cooking and unattended steps must remain uninterrupted.')
        if row['splittable'] and not row['max_pause_minutes']:
            raise ValidationError(f'{name}: record a positive maximum pause before allowing this work to resume later.')
        clean.append(row)
    if len({t["independent_batches"] for t in clean}) > 1:
        raise ValidationError("Choose the same batch scheduling mode for every recipe step.")
    return clean


def preparation_work(items):
    lines = []
    for item in items:
        p = item.product
        batches = ceil(item.quantity / p.batch_size)
        tasks = validate_tasks(p.preparation_tasks)
        if not tasks:
            tasks = [dict(name='Cook', minutes=p.preparation_minutes, additional_batch_minutes=p.additional_batch_minutes, resource='prep_table', worker=True, overnight=False, max_wait_minutes=0)]
            if p.packing_minutes_per_portion:
                tasks.append(dict(name='Pack', minutes=item.quantity*p.packing_minutes_per_portion, additional_batch_minutes=0, resource='packing_area', worker=True, overnight=False, max_wait_minutes=0))
        independent = bool(tasks[0].get('independent_batches'))
        if independent and batches > 100:
            raise ValidationError(f'{p.name}: automatic planning supports up to 100 independent batches per menu. Contact the kitchen to review this quantity.')
        runs = range(batches) if independent else range(1)
        for batch_index in runs:
            steps = [dict(t, minutes=t['minutes'] if independent else t['minutes']+(batches-1)*t['additional_batch_minutes']) for t in tasks]
            portions = min(p.batch_size, item.quantity-batch_index*p.batch_size) if independent else item.quantity
            lines.append(dict(product_id=p.id, menu=p.name, portions=portions, batches=1 if independent else batches,
                              batch_number=batch_index+1 if independent else None,
                              batch_size=p.batch_size, minutes=sum(t['minutes'] for t in steps), tasks=steps,
                              max_preparation_days=p.max_preparation_days, max_early_minutes=p.max_early_minutes))
    return lines, sum(line['minutes'] for line in lines)


def order_interval(order, store):
    if not order.preparation_at or not order.delivery_at:
        return None
    default_buffer = getattr(store, 'original_delivery_buffer_minutes', store.delivery_buffer_minutes)
    buffer = order.fulfilment_snapshot.get('buffer_minutes', order.preparation_plan.get('delivery_buffer_minutes', default_buffer))
    end = order.preparation_end_at or order.delivery_at-timedelta(minutes=buffer)
    return order.preparation_at, max(end, order.preparation_at+timedelta(minutes=1))


def booked_tasks(orders, store):
    result = []
    for order in orders:
        steps = order.preparation_plan.get('tasks', [])
        if steps:
            for step in steps:
                result.append(dict(step, start=parse_datetime(step['start']), end=parse_datetime(step['end'])))
        else:
            interval = order_interval(order, store)
            if interval:
                result.append(dict(start=interval[0], end=interval[1], resource='all', worker=True))
    return result


def earliest_finish(line, ready, store):
    """Zero selects flexible same-dispatch-day finishing, never exact synchrony.

    Positive allowances remain explicit limits and may permit a previous-day
    finish. Earlier recipe work still respects the separate preparation span.
    """
    if line['max_early_minutes']:
        return ready-timedelta(minutes=line['max_early_minutes'])
    day = timezone.localtime(ready).date()
    return timezone.make_aware(datetime.combine(day, time(store.kitchen_open_hour)))


def place_line(line, ready, advance, busy, store):
    earliest = max(advance, ready-timedelta(days=line['max_preparation_days']))
    finish_limit = earliest_finish(line, ready, store)
    finish_rule = (f'the {line["max_early_minutes"]}-minute early-finish limit'
        if line['max_early_minutes'] else 'the flexible same-day finish window')
    working_minutes = (store.kitchen_close_hour-store.kitchen_open_hour)*60
    for task in line['tasks']:
        if not task['overnight'] and not task.get('splittable') and task['minutes'] > working_minutes:
            raise ValidationError(f'{line["menu"]}: {task["name"]} needs {task["minutes"]} uninterrupted minutes, '
                f'but kitchen hours allow {working_minutes} minutes per day. A later date alone will not fix this. '
                'Ask the owner to review portions per batch, durations or independent-batch planning.')
    candidate = ready
    for attempt in range(200):
        trial = []
        next_start = candidate
        shift = None
        for index in range(len(line['tasks'])-1, -1, -1):
            task = line['tasks'][index]
            if task.get('splittable'):
                sessions = resumable_sessions(task, next_start, earliest, busy, store)
                actual_end = sessions[-1]['end']
                earliest_end = finish_limit if index == len(line['tasks'])-1 else next_start-timedelta(minutes=task['max_wait_minutes'])
                if actual_end < earliest_end:
                    if index < len(line['tasks'])-1:
                        shift = max(timedelta(minutes=1), earliest_end-actual_end)
                        break
                    raise ValidationError(f'{line["menu"]}: resumable work would finish before its permitted early-finish limit.')
                trial.extend(dict(row, menu=line['menu'], product_id=line['product_id'],
                    sequence=index+1, portions=line['portions'], batch_number=line.get('batch_number')) for row in sessions)
                next_start = sessions[0]['start']
                continue
            duration = timedelta(minutes=task['minutes'])
            end = next_start
            earliest_end = finish_limit if index == len(line['tasks'])-1 else next_start-timedelta(minutes=task['max_wait_minutes'])
            while True:
                if not task['overnight']:
                    day = timezone.localtime(end).date()
                    opening = timezone.make_aware(datetime.combine(day,time(store.kitchen_open_hour)))
                    closing = timezone.make_aware(datetime.combine(day,time(store.kitchen_close_hour)))
                    end = min(end, closing)
                    if end-duration < opening:
                        end = timezone.make_aware(datetime.combine(day-timedelta(days=1),time(store.kitchen_close_hour)))
                start = end-duration
                if start < earliest or end < earliest_end:
                    if index < len(line['tasks'])-1 and start >= earliest and end < earliest_end:
                        shift = max(timedelta(minutes=1), earliest_end-end)
                        break
                    raise ValidationError(f'{line["menu"]}: cannot fit {task["name"]} ({task["minutes"]} minutes) within '
                        f'kitchen hours {store.kitchen_open_hour}:00–{store.kitchen_close_hour}:00, existing bookings, '
                        f'{finish_rule} and permitted step gaps. '
                        'Try a later delivery time, fewer portions or contact the owner to review the recipe plan. '
                        'Changing only the date may not help; no booking or handling limit has been overridden.')
                conflicts = [b for b in busy if b['start'] < end and b['end'] > start and
                    (b['resource']=='all' or (task['resource']!='none' and task['resource']==b['resource']) or (task['worker'] and b['worker']))]
                if not conflicts:
                    break
                end = min(b['start'] for b in conflicts)
            if shift is not None:
                break
            trial.append(dict(task, start=start, end=end, menu=line['menu'], product_id=line['product_id'],
                sequence=index+1, portions=line['portions'], batch_number=line.get('batch_number')))
            next_start = start
        if shift is None:
            return trial
        candidate -= shift
    raise ValidationError(f'{line["menu"]}: automatic planning reached its search limit. Contact the owner to review the plan; availability has not been confirmed.')


@dataclass(frozen=True)
class AvailabilitySnapshot:
    day: date
    product_ids: frozenset
    booked: dict
    busy: tuple
    exclude_order_id: int | None = None


def availability_snapshot(items, day, store, exclude_order_id=None):
    """Request-local read snapshot for advisory hourly checks, never checkout."""
    items = list(items)
    ids = frozenset(item.product_id for item in items)
    opening, closing = hours(store)
    first_ready = timezone.make_aware(datetime.combine(day, time(opening)))-timedelta(minutes=store.delivery_buffer_minutes)
    last_ready = timezone.make_aware(datetime.combine(day, time(closing)))-timedelta(minutes=store.delivery_buffer_minutes)
    horizon = first_ready-timedelta(days=max(item.product.max_preparation_days for item in items))
    booked = dict(capacity_bookings(ids).filter(order__delivery_at__date=day).exclude(order_id=exclude_order_id)
        .values('product_id').annotate(n=Sum('quantity')).values_list('product_id', 'n'))
    busy = [dict(start=a, end=b, resource='all', worker=True) for a,b in
        KitchenBlock.objects.filter(start_at__lt=last_ready, end_at__gt=horizon).values_list('start_at', 'end_at')]
    orders = Order.objects.filter(status__in=['pending','processing'], inventory_deducted=False,
        preparation_at__lt=last_ready, delivery_at__gt=horizon).exclude(pk=exclude_order_id).only(
            'preparation_at','preparation_end_at','delivery_at','preparation_plan','fulfilment_snapshot')
    busy.extend(booked_tasks(orders, store))
    return AvailabilitySnapshot(day, ids, booked, tuple(busy), exclude_order_id)


def schedule_order(items, delivery_at, store, now=None, exclude_order_id=None, notice_from=None, allow_manual_review=False, availability=None, allow_request_exceptions=False):
    now = now or timezone.now()
    items = list(items)
    if not items:
        raise ValidationError('Your basket is empty.')
    if exclude_order_id is None:
        from .selling import require_local_preorder
        for item in items:
            require_local_preorder(item.product)
            if getattr(item.product, 'selling_status', 'active') != 'active':
                raise ValidationError(f'{item.product.name} is not accepting new orders. Remove it from your basket before continuing.')
    local = timezone.localtime(delivery_at)
    if availability is not None and (availability.exclude_order_id != exclude_order_id or availability.day != local.date()
            or availability.product_ids != frozenset(i.product_id for i in items)):
        raise ValueError('Advisory availability snapshot does not match this basket and date.')
    for item in items:
        issue = ordering_issue(item.product, local.date(), notice_from or now)
        if issue:
            # Trading rules are not bypassed by the unconfirmed-request path.
            raise ValidationError(issue)
        weekdays = getattr(item.product, "delivery_weekdays", [])
        if weekdays and local.weekday() not in weekdays:
            names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            allowed = ", ".join(names[day] for day in weekdays)
            raise ValidationError(f"{item.product.name} is delivered on {allowed}. Choose one of these delivery days.")
    opening, closing = hours(store)
    if not time(opening) <= local.time() <= time(closing):
        raise ValidationError(f'Choose {"collection" if getattr(store, "fulfilment_method", "") == "pickup" else "delivery"} between {opening:02d}:00 and {closing:02d}:00 Malaysia time.')
    if delivery_at <= now or delivery_at > now+timedelta(days=90):
        raise ValidationError('Choose a future delivery within the next 90 days.')
    booked = availability.booked if availability is not None else dict(capacity_bookings([i.product_id for i in items]).filter(order__delivery_at__date=local.date()).exclude(order_id=exclude_order_id).values('product_id').annotate(n=Sum('quantity')).values_list('product_id', 'n'))
    request_reasons = []
    requested = Counter()
    for item in items:
        requested[item.product_id] += item.quantity
    for item in items:
        reserved = booked.get(item.product_id, 0)
        quantity = requested[item.product_id]
        capacity = item.product.daily_capacity
        if reserved+quantity > capacity:
            next_step = ('Reduce the quantity or contact the kitchen about separate deliveries.'
                if quantity > capacity else 'Choose another date or reduce the quantity.')
            reason = (f'{item.product.name} exceeds the automatic capacity on this day: '
                f'{quantity} requested + {reserved} already booked; daily limit {capacity}. {next_step}')
            if not (allow_manual_review and allow_request_exceptions):
                raise ValidationError(reason, code='daily_capacity')
            request_reasons.append(reason)
    advance = max(now, (notice_from or now)+timedelta(hours=max(i.product.lead_hours for i in items)))
    if delivery_at < advance+timedelta(minutes=store.delivery_buffer_minutes):
        starts = timezone.localtime(advance).strftime('%d %b %Y, %I:%M %p')
        reason = ('Automatic planning needs a delivery time after the menu advance notice and delivery buffer. '
            f'Preparation can start no earlier than {starts} Malaysia time; '
            f'allow {store.delivery_buffer_minutes} minutes for delivery, plus the recipe preparation time.')
        if not (allow_manual_review and allow_request_exceptions):
            raise ValidationError(reason)
        request_reasons.append(reason)
    if request_reasons:
        return review_request(' '.join(request_reasons), store)
    try:
        return automatic_plan(items, delivery_at, store, exclude_order_id, advance,
            existing_busy=availability.busy if availability is not None else None)
    except ValidationError as exc:
        if not allow_manual_review:
            raise
        # Only recipe/planning validation is advisory. Database and unexpected
        # failures propagate; never turn an outage into an accepted request.
        return review_request(' '.join(str(part) for part in exc.detail), store)


def automatic_plan(items, delivery_at, store, exclude_order_id, advance, existing_busy=None):
    lines, minutes = preparation_work(items)
    ready = delivery_at-timedelta(minutes=store.delivery_buffer_minutes)
    horizon = ready-timedelta(days=max(i.product.max_preparation_days for i in items))
    if existing_busy is None:
        busy = [dict(start=a, end=b, resource='all', worker=True) for a,b in KitchenBlock.objects.filter(start_at__lt=ready,end_at__gt=horizon).values_list('start_at','end_at')]
        orders = Order.objects.filter(status__in=['pending','processing'],inventory_deducted=False,preparation_at__lt=ready,delivery_at__gt=horizon).exclude(pk=exclude_order_id).only('preparation_at','preparation_end_at','delivery_at','preparation_plan','fulfilment_snapshot')
        busy.extend(booked_tasks(orders, store))
    else:
        busy = list(existing_busy)
    # A long recipe placed first can unnecessarily block a recipe that must
    # finish close to dispatch. Try bounded alternative orderings, always from
    # the same immutable existing bookings; never relax storage/gap limits.
    longest = sorted(lines, key=lambda x: (-x['minutes'], x['product_id']))
    tightest = sorted(lines, key=lambda x: (ready-earliest_finish(x, ready, store), -x['minutes'], x['product_id']))
    failure = None
    for sequence in (longest, tightest, list(reversed(longest))):
        trial_busy = list(busy)
        planned = []
        try:
            for line in sequence:
                placed = place_line(line, ready, advance, trial_busy, store)
                trial_busy.extend(placed)
                planned.extend(placed)
            break
        except ValidationError as exc:
            failure = failure or exc
    else:
        raise failure
    planned.sort(key=lambda t:t['start'])
    days = work_days(planned)
    return dict(start=min(t['start'] for t in planned), end=max(t['end'] for t in planned),
                minutes=sum(t['minutes'] for t in planned), recipe_minutes=minutes,
                hands_on_minutes=sum(t['minutes'] for t in planned if t['worker']),
                pause_minutes=sum(t['minutes'] for t in planned if t.get('segment_role') == 'pause'),
                daily_work=days, calendar_days=len(days), hands_on_days=sum(d['hands_on_minutes'] > 0 for d in days),
                tasks=[dict(t,start=t['start'].isoformat(),end=t['end'].isoformat()) for t in planned],
                lines=lines, delivery_buffer_minutes=store.delivery_buffer_minutes,
                lead_hours=max(i.product.lead_hours for i in items))


def plan_snapshot(plan):
    return {key:value for key,value in plan.items() if key not in ['start','end']}
