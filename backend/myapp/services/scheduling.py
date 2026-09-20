"""Deterministic backward scheduling: one worker and one unit per named resource.
Existing bookings are immutable. Conservative greedy placement may reject a plan
that a human could improve; it never promises globally optimal packing.
"""
from datetime import datetime, time, timedelta
from math import ceil
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from ..models import Order, OrderItem, KitchenBlock

RESOURCES = {'prep_table', 'stove', 'oven', 'rice_cooker', 'fridge', 'packing_area', 'none'}


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
        for key, default, low, high in [('minutes', 1, 1, 43200), ('additional_batch_minutes', 0, 0, 43200), ('max_wait_minutes', 0, 0, 10080)]:
            v = task.get(key, default)
            if type(v) is not int or not low <= v <= high:
                raise ValidationError(f'{name}: {key.replace("_", " ")} must be a whole number between {low} and {high}.')
            row[key] = v
        for key, default in [('worker', True), ('overnight', False)]:
            v = task.get(key, default)
            if type(v) is not bool:
                raise ValidationError(f'{name}: choose yes or no for {key}.')
            row[key] = v
        if row['overnight'] and (row['worker'] or row['resource'] not in {'fridge', 'none'}):
            raise ValidationError('Only unattended fridge/rest steps can run outside working hours. Split setup and finishing into attended steps.')
        clean.append(row)
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
        steps = [dict(t, minutes=t['minutes']+(batches-1)*t['additional_batch_minutes']) for t in tasks]
        lines.append(dict(product_id=p.id, menu=p.name, portions=item.quantity, batches=batches,
                          batch_size=p.batch_size, minutes=sum(t['minutes'] for t in steps), tasks=steps,
                          max_preparation_days=p.max_preparation_days, max_early_minutes=p.max_early_minutes))
    return lines, sum(line['minutes'] for line in lines)


def order_interval(order, store):
    if not order.preparation_at or not order.delivery_at:
        return None
    end = order.preparation_end_at or order.delivery_at-timedelta(minutes=store.delivery_buffer_minutes)
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


def schedule_order(items, delivery_at, store, now=None, exclude_order_id=None, notice_from=None):
    now = now or timezone.now()
    items = list(items)
    if not items:
        raise ValidationError('Your basket is empty.')
    local = timezone.localtime(delivery_at)
    if not 9 <= local.hour < 21:
        raise ValidationError('Choose delivery between 9am and 9pm Malaysia time (before 9pm).')
    if delivery_at <= now or delivery_at > now+timedelta(days=90):
        raise ValidationError('Choose a future delivery within the next 90 days.')
    booked = dict(OrderItem.objects.filter(product_id__in=[i.product_id for i in items], order__delivery_at__date=local.date()).exclude(order__status='cancelled').exclude(order_id=exclude_order_id).values('product_id').annotate(n=Sum('quantity')).values_list('product_id', 'n'))
    for item in items:
        if booked.get(item.product_id, 0)+item.quantity > item.product.daily_capacity:
            raise ValidationError(f'{item.product.name} has insufficient capacity on this day. Choose another date.')
    lines, minutes = preparation_work(items)
    advance = max(now, (notice_from or now)+timedelta(hours=max(i.product.lead_hours for i in items)))
    ready = delivery_at-timedelta(minutes=store.delivery_buffer_minutes)
    horizon = ready-timedelta(days=max(i.product.max_preparation_days for i in items))
    busy = [dict(start=a, end=b, resource='all', worker=True) for a,b in KitchenBlock.objects.filter(start_at__lt=ready,end_at__gt=horizon).values_list('start_at','end_at')]
    orders = Order.objects.filter(status__in=['pending','processing'],inventory_deducted=False,preparation_at__lt=ready,delivery_at__gt=horizon).exclude(pk=exclude_order_id).only('preparation_at','preparation_end_at','delivery_at','preparation_plan')
    busy.extend(booked_tasks(orders, store))
    planned = []
    # Stable ordering: long menu sequences first; tasks remain in recipe order.
    for line in sorted(lines, key=lambda x: (-x['minutes'], x['product_id'])):
        next_start = ready
        earliest = max(advance, ready-timedelta(days=line['max_preparation_days']))
        for index in range(len(line['tasks'])-1,-1,-1):
            task = line['tasks'][index]
            end = next_start
            wait = line['max_early_minutes'] if index == len(line['tasks'])-1 else task['max_wait_minutes']
            earliest_end = next_start-timedelta(minutes=wait)
            duration = timedelta(minutes=task['minutes'])
            while True:
                if not task['overnight']:
                    day = timezone.localtime(end).date()
                    opening = timezone.make_aware(datetime.combine(day,time(store.kitchen_open_hour)))
                    closing = timezone.make_aware(datetime.combine(day,time(store.kitchen_close_hour)))
                    end = min(end, closing)
                    if end-duration < opening:
                        end = timezone.make_aware(datetime.combine(day-timedelta(days=1),time(store.kitchen_close_hour)))
                        continue_check = True
                    else:
                        continue_check = False
                else:
                    continue_check = False
                start = end-duration
                if start < earliest or end < earliest_end:
                    raise ValidationError(f'No available slot for {line["menu"]}: {task["name"]}. Choose a later delivery or contact the kitchen. Working hours, equipment, worker time and permitted gaps are checked; existing orders will not be moved.')
                if continue_check:
                    continue
                conflicts = [b for b in busy if b['start'] < end and b['end'] > start and
                    (b['resource']=='all' or (task['resource']!='none' and task['resource']==b['resource']) or (task['worker'] and b['worker']))]
                if not conflicts:
                    break
                end = min(b['start'] for b in conflicts)
            step = dict(task, start=start, end=end, menu=line['menu'], product_id=line['product_id'], sequence=index+1, portions=line['portions'])
            busy.append(step)
            planned.append(step)
            next_start = start
    planned.sort(key=lambda t:t['start'])
    return dict(start=min(t['start'] for t in planned), end=max(t['end'] for t in planned),
                minutes=minutes, hands_on_minutes=sum(t['minutes'] for t in planned if t['worker']),
                tasks=[dict(t,start=t['start'].isoformat(),end=t['end'].isoformat()) for t in planned],
                lines=lines, delivery_buffer_minutes=store.delivery_buffer_minutes,
                lead_hours=max(i.product.lead_hours for i in items))


def plan_snapshot(plan):
    return {key:value for key,value in plan.items() if key not in ['start','end']}
