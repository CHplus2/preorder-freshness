"""Owner time edits retain accepted task identities, durations and resources."""
from collections import defaultdict
from datetime import timedelta
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError


def edit_steps(order, changes, store):
    original = order.preparation_plan.get('tasks', [])
    if not original or order.preparation_plan.get('mode') == 'manual_window':
        raise ValidationError('Generate a detailed task plan before editing individual steps.')
    if len(changes) != len(original) or sorted(c['index'] for c in changes) != list(range(len(original))):
        raise ValidationError('Include every preparation step exactly once. Refresh the order and try again.')
    by_index = {c['index']: c['start'] for c in changes}
    tasks, warnings, groups = [], [], defaultdict(list)
    for index, task in enumerate(original):
        old_start, old_end = parse_datetime(task['start']), parse_datetime(task['end'])
        if not old_start or not old_end or old_end <= old_start:
            raise ValidationError('The saved task times need repair. Generate a new task plan first.')
        start = by_index[index]
        end = start + (old_end-old_start)
        row = dict(task, start=start.isoformat(), end=end.isoformat())
        tasks.append(row)
        groups[(task.get('product_id'), task.get('batch_number'))].append(row)
        a, b = timezone.localtime(start), timezone.localtime(end)
        if not task.get('overnight') and (a.date()!=b.date() or a.hour<store.kitchen_open_hour or (b.hour,b.minute,b.second)>(store.kitchen_close_hour,0,0)):
            warnings.append(f'{task["menu"]}: {task["name"]} falls outside kitchen working hours.')
    for rows in groups.values():
        rows.sort(key=lambda t:t.get('sequence',0))
        for earlier, later in zip(rows, rows[1:]):
            gap = parse_datetime(later['start'])-parse_datetime(earlier['end'])
            if gap < timedelta(0):
                raise ValidationError(f'{earlier["menu"]}: keep {later["name"]} after {earlier["name"]} finishes.')
            if gap > timedelta(minutes=earlier.get('max_wait_minutes',0)):
                warnings.append(f'{earlier["menu"]}: the gap after {earlier["name"]} exceeds the accepted waiting limit. Review storage and handling before confirming.')
        product_id=rows[0].get('product_id')
        limits=next((line for line in order.preparation_plan.get('lines',[]) if line.get('product_id')==product_id),None)
        if limits:
            ready=order.delivery_at-timedelta(minutes=store.delivery_buffer_minutes)
            if parse_datetime(rows[-1]['end']) < ready-timedelta(minutes=limits['max_early_minutes']):
                warnings.append(f'{rows[0]["menu"]}: preparation finishes earlier than its accepted holding limit.')
            if parse_datetime(rows[0]['start']) < ready-timedelta(days=limits['max_preparation_days']):
                warnings.append(f'{rows[0]["menu"]}: preparation starts outside its accepted preparation span.')
    for index, task in enumerate(tasks):
        for other in tasks[index+1:]:
            if conflict(task,other):
                warnings.append(f'Within this order, {task["menu"]}: {task["name"]} overlaps {other["menu"]}: {other["name"]} on shared equipment or worker time.')
    return tasks, list(dict.fromkeys(warnings))


def conflict(a, b):
    def stamp(value):
        return parse_datetime(value) if isinstance(value,str) else value
    overlaps=stamp(a['start']) < stamp(b['end']) and stamp(a['end']) > stamp(b['start'])
    resource=a['resource']=='all' or b['resource']=='all' or (a['resource']!='none' and a['resource']==b['resource'])
    return overlaps and (resource or (a['worker'] and b['worker']))
