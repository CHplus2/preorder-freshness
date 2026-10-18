"""Bounded work sessions for explicitly resumable, non-cooking preparation."""
from collections import defaultdict
from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

PAUSABLE_RESOURCES = {'prep_table', 'packing_area', 'none'}


def overlaps(task, start, end, busy):
    return [b for b in busy if b['start'] < end and b['end'] > start and
        (b['resource'] == 'all' or (task['resource'] != 'none' and task['resource'] == b['resource'])
         or (task['worker'] and b['worker']))]


def resumable_sessions(task, latest_end, earliest, busy, store):
    remaining = timedelta(minutes=task['minutes'])
    end, later_start, reversed_rows = latest_end, None, []
    for _ in range(1000):
        if remaining <= timedelta(0):
            break
        day = timezone.localtime(end).date()
        opening = timezone.make_aware(datetime.combine(day, time(store.kitchen_open_hour)))
        closing = timezone.make_aware(datetime.combine(day, time(store.kitchen_close_hour)))
        end = min(end, closing)
        if end <= opening:
            end = timezone.make_aware(datetime.combine(day-timedelta(days=1), time(store.kitchen_close_hour)))
            continue
        if end <= earliest:
            raise ValidationError(f'{task["name"]}: resumable work cannot fit after the order notice and within its preparation span.')
        start = max(opening, earliest, end-remaining)
        conflicts = overlaps(task, start, end, busy)
        blocked_end = [b for b in conflicts if b['end'] >= end]
        if blocked_end:
            end = min(b['start'] for b in blocked_end)
            continue
        if conflicts:
            start = max(start, max(b['end'] for b in conflicts))
        if later_start is not None and later_start > end:
            gap = later_start-end
            if gap > timedelta(minutes=task['max_pause_minutes']):
                raise ValidationError(f'{task["name"]}: the pause would exceed its {task["max_pause_minutes"]}-minute limit. Review the permitted pause or choose another delivery.')
            pause = dict(task, name=f'Pause: {task["name"]}', worker=False,
                resource=task['pause_resource'], overnight=True, splittable=False,
                minutes=gap.total_seconds()/60, max_wait_minutes=0,
                start=end, end=later_start, segment_role='pause')
            if overlaps(pause, end, later_start, busy):
                raise ValidationError(f'{task["name"]}: its pause storage or kitchen is already reserved. No storage capacity has been assumed.')
            reversed_rows.append(pause)
        duration = end-start
        reversed_rows.append(dict(task, start=start, end=end, minutes=duration.total_seconds()/60,
                                  segment_role='work'))
        remaining -= duration
        later_start, end = start, start
    else:
        raise ValidationError(f'{task["name"]}: work-session search limit reached. Review this order with the owner.')
    rows = list(reversed(reversed_rows))
    count = sum(row['segment_role'] == 'work' for row in rows)
    part = 0
    for index, row in enumerate(rows):
        row['segment_index'] = index+1
        if row['segment_role'] == 'work':
            part += 1
            row.update(part_number=part, part_count=count)
            if count > 1:
                row['name'] = f'{task["name"]} (part {part}/{count})'
        row['max_wait_minutes'] = task['max_wait_minutes'] if index == len(rows)-1 else 0
    return rows


def work_days(tasks):
    days = defaultdict(lambda: {'hands_on_minutes': 0, 'pause_minutes': 0, 'task_count': 0})
    for task in tasks:
        start = parse_datetime(task['start']) if isinstance(task['start'], str) else task['start']
        end = parse_datetime(task['end']) if isinstance(task['end'], str) else task['end']
        day = timezone.localtime(start).date()
        while day <= timezone.localtime(end-timedelta(microseconds=1)).date():
            a = timezone.make_aware(datetime.combine(day, time()))
            b = timezone.make_aware(datetime.combine(day+timedelta(days=1), time()))
            minutes = (min(end, b)-max(start, a)).total_seconds()/60
            row = days[day]
            row['task_count'] += 1
            if task['worker']:
                row['hands_on_minutes'] += minutes
            if task.get('segment_role') == 'pause':
                row['pause_minutes'] += minutes
            day += timedelta(days=1)
    return [{'date': str(day), **row} for day, row in sorted(days.items())]
