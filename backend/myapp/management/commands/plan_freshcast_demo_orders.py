"""Review actual kitchen schedules for fictional requests from a connected terminal."""
import hashlib
import json
import os
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core import serializers, signing
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from myapp.models import (IngredientConsumption, KitchenBlock, Order, OrderAmendment,
                          OrderItem, Product, Storefront)
from myapp.services.commitments import preparation_snapshot, scheduled_item
from myapp.services.scheduling import plan_snapshot, preparation_work, schedule_order
from myapp.services.initial_delivery import initial_delivery_plan
from myapp.views.delivery_date_batch import context as date_context, propose as propose_dates
from myapp.views.rescheduling import CUTOFF_HOURS
from .prepare_freshcast_demo import ROOT

SALT = 'fictional-preparation-batch-v2'


def encode(value):
    return json.dumps(value, default=str, sort_keys=True)


def digest(value):
    return hashlib.sha256(encode(value).encode()).hexdigest()


def committed_changes(plans, repairs):
    """Sign saved decisions, independent of ordering and explanatory failure text."""
    return {
        'plans': sorted(plans, key=lambda row: row['order_id']),
        'repairs': [dict(order_id=row['order_id'], before_status=row['before_status'],
            after_status=row['after_status'], delivery_at=row['delivery_at'],
            payment_status=row['payment_status'],
            needs_review=row['request_plan']['needs_review'], tasks=row['request_plan']['tasks'],
            delivery_buffer_minutes=row['request_plan']['delivery_buffer_minutes'])
            for row in sorted(repairs, key=lambda row: row['order_id'])],
    }


def diagnosis(order):
    consumption = sum(len(item.consumption.all()) for item in order.items.all())
    return {'order_id': order.pk, 'status': order.status,
            'payment_status': order.payment_status, 'inventory_deducted': order.inventory_deducted,
            'consumption_records': consumption,
            'menus': [item.product_name for item in order.items.all()]}


class Command(BaseCommand):
    help = 'Preview/apply feasible detailed plans for fictional pending orders; diagnose unresolved dates and timings.'

    def add_arguments(self, parser):
        parser.add_argument('--actor-id', type=int, required=True)
        parser.add_argument('--order-id', type=int, action='append', help='Optional repeatable order filter.')
        parser.add_argument('--use-current-preparation', action='store_true',
                            help='Explicitly amend preparation snapshots to current menu timings only; preserve accepted ingredient recipes and prices.')
        parser.add_argument('--repair-unstarted-requests', action='store_true',
                            help='Return undated fictional processing records with no tasks, preparation times or stock use to pending, and propose future request dates.')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--confirm', help='Signed token from the reviewed preview (valid for ten minutes).')
        parser.add_argument('--backup', help='New private JSON backup outside the checkout.')

    def handle(self, *args, **options):
        actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
        if not actor:
            raise CommandError('Choose an existing staff actor ID.')
        previous = None
        if options['apply']:
            if not all(options[k] for k in ('confirm_fictional', 'confirm', 'backup')):
                raise CommandError('Apply requires --confirm-fictional, --confirm and --backup.')
            try:
                previous = signing.loads(options['confirm'], salt=SALT, max_age=600)
            except signing.BadSignature:
                raise CommandError('Preview expired or is invalid. Run a new preview.') from None
            if previous['actor'] != actor.pk:
                raise CommandError('This preview belongs to another staff actor.')
        elif options['confirm']:
            raise CommandError('Use --apply to save a reviewed preview.')
        intent = {'order_ids': sorted(set(options['order_id'] or [])),
                  'use_current_preparation': options['use_current_preparation'],
                  'repair_unstarted_requests': options['repair_unstarted_requests']}
        if previous and previous['intent'] != intent:
            raise CommandError('Options differ from the reviewed preview. Run a new preview with these options.')

        with transaction.atomic():
            # Same lock order as checkout and owner scheduling; provisional preview
            # reservations are rolled back before any result is returned.
            store = Storefront.objects.select_for_update().filter(pk=1).first()
            if not store:
                raise CommandError('Existing kitchen settings are required.')
            list(Order.objects.select_for_update().order_by('pk'))
            list(Product.objects.select_for_update().order_by('pk'))
            if previous:
                applied = OrderAmendment.objects.filter(actor=actor, after__planning_batch_id=previous['request_id'])
                if applied.exists():
                    ids = sorted(applied.values_list('order_id', flat=True))
                    if ids != sorted(previous['changed_ids']):
                        raise CommandError('Incomplete batch audit; inspect the records before retrying.')
                    self.stdout.write(encode({'mode': 'applied', 'already_applied': True,
                        'updated_order_ids': ids, 'planned_order_ids': previous['planned_ids']}))
                    return
            source = {
                'orders': list(Order.objects.order_by('pk').values()),
                'items': list(OrderItem.objects.order_by('pk').values()),
                'products': list(Product.objects.order_by('pk').values()),
                'store': list(Storefront.objects.filter(pk=store.pk).values()),
                'blocks': list(KitchenBlock.objects.order_by('pk').values()),
                'consumption': list(IngredientConsumption.objects.order_by('pk').values()),
                'refunds': list(Order.objects.filter(payment_events__kind='refund').order_by('pk').values_list('pk', flat=True)),
            }
            fingerprint = digest(source)
            if previous and previous['fingerprint'] != fingerprint:
                raise CommandError('Orders, menus or kitchen availability changed. Run a new preview.')
            orders = Order.objects.filter(status__in=['pending', 'processing']).prefetch_related(
                Prefetch('items', queryset=OrderItem.objects.select_related('product')
                    .prefetch_related('consumption').order_by('pk')),
                'payment_events').order_by('delivery_at', 'pk')
            if intent['order_ids']:
                orders = orders.filter(pk__in=intent['order_ids'])
            orders = list(orders)
            if len(orders) > 100:
                raise CommandError('Use --order-id to review up to 100 open requests per batch.')
            now = timezone.now()
            plans, blocked, missing, unchanged, repairs = [], [], [], [], []
            with transaction.atomic():
                if intent['repair_unstarted_requests']:
                    eligible = []
                    for order in orders:
                        facts = diagnosis(order)
                        if (order.status == 'processing' and order.delivery_at is None
                                and order.preparation_at is None and order.preparation_end_at is None
                                and not order.preparation_plan.get('tasks') and not order.inventory_deducted
                                and not facts['consumption_records'] and order.payment_status != 'refunded'
                                and not any(p.kind == 'refund' for p in order.payment_events.all())):
                            order.status = 'pending'
                            order.save(update_fields=['status'])
                            eligible.append(order)
                    if previous:
                        # Confirmation retains exactly the dates reviewed by the
                        # owner. Re-running the suggestion algorithm can choose a
                        # different day as its rolling notice cutoff advances.
                        dates = previous['request_dates']
                    else:
                        _, _, counts = date_context(store, now)
                        dates, _ = propose_dates(eligible, store, now, counts)
                    by_id = {row['order_id']: row for row in dates}
                    for order in eligible:
                        if order.pk not in by_id:
                            order.status = 'processing'
                            order.save(update_fields=['status'])
                            continue
                        date = parse_datetime(by_id[order.pk]['delivery_at'])
                        if previous:
                            terms = [scheduled_item(item) if item.preparation_snapshot else item
                                for item in order.items.all()]
                            earliest = now + timedelta(hours=max(CUTOFF_HOURS,
                                max(item.product.lead_hours for item in terms)),
                                minutes=store.delivery_buffer_minutes)
                            if date <= earliest:
                                raise CommandError(f'Order #{order.pk}: the reviewed delivery date is now too close '
                                    'for the required notice and delivery buffer. No changes saved. Run a fresh preview.')
                        try:
                            request_plan = initial_delivery_plan(list(order.items.all()), date, store, order.pk, now)
                        except ValidationError as error:
                            raise CommandError(f'Order #{order.pk}: the reviewed delivery date is no longer valid: '
                                f'{error.detail}. Run a fresh preview.') from None
                        repairs.append(dict(order_id=order.pk, before_status='processing', after_status='pending',
                            old_delivery_at=None, delivery_at=date, request_plan=plan_snapshot(request_plan),
                            payment_status=order.payment_status,
                            reason='Fictional request incorrectly marked processing: no recorded tasks, preparation times or ingredient consumption.'))
                        order.delivery_at, order.preparation_plan = date, plan_snapshot(request_plan)
                        order.save(update_fields=['delivery_at', 'preparation_plan'])
                for order in orders:
                    facts = diagnosis(order)
                    if not order.delivery_at:
                        missing.append(dict(facts, reason='Delivery date is missing.',
                            next_step=('Review existing preparation and stock use before correcting the fictional delivery record; do not restart or deduct stock again.'
                                if order.status != 'pending' or order.inventory_deducted or facts['consumption_records']
                                else 'Use assign_freshcast_demo_dates to propose a future request date.')))
                        continue
                    if (order.status != 'pending' or order.inventory_deducted or facts['consumption_records']
                            or order.payment_status == 'refunded' or any(p.kind == 'refund' for p in order.payment_events.all())):
                        unchanged.append(dict(facts, reason='Started work, consumed stock or refund records preserved.'))
                        continue
                    if order.preparation_plan.get('tasks') and not order.preparation_plan.get('needs_review'):
                        unchanged.append(dict(facts, reason='Existing accepted task plan preserved.'))
                        continue
                    items = list(order.items.all())
                    zero_finish = []
                    try:
                        if not items or any(not item.product_id for item in items):
                            raise ValidationError('Resolve missing menu references first.')
                        scheduled = items if intent['use_current_preparation'] else [scheduled_item(item) for item in items]
                        if any(not item.product.preparation_tasks for item in scheduled):
                            raise ValidationError('Accepted preparation steps are missing. Review --use-current-preparation to adopt current timings without replacing ingredient recipes.')
                        lines, _ = preparation_work(scheduled)
                        exact_finish = [line for line in lines if line['max_early_minutes'] == 0]
                        for index, line in enumerate(exact_finish):
                            final = line['tasks'][-1]
                            for other in exact_finish[index+1:]:
                                other_final = other['tasks'][-1]
                                if ((final['worker'] and other_final['worker'])
                                        or (final['resource'] != 'none' and final['resource'] == other_final['resource'])):
                                    zero_finish.extend([line['menu'], other['menu']])
                        plan = schedule_order(scheduled, order.delivery_at, store,
                            exclude_order_id=order.pk, notice_from=order.created_at, now=now)
                    except ValidationError as error:
                        row = dict(facts, delivery_at=order.delivery_at, reason=error.detail)
                        if len(zero_finish) > 1:
                            row['timing_issue'] = ('Multiple menu batches must finish exactly at dispatch but share a worker or equipment. '
                                'Changing the delivery date cannot resolve that constraint. Review actual permitted early-finish times in Menus, '
                                'then preview adoption of those preparation settings; no handling limit has been changed.')
                            row['zero_early_finish_menus'] = list(dict.fromkeys(zero_finish))
                        blocked.append(row)
                        continue
                    row = dict(order_id=order.pk, delivery_at=order.delivery_at,
                        preparation_start=plan['start'], preparation_end=plan['end'],
                        task_count=len(plan['tasks']), plan=plan_snapshot(plan),
                        preparation_changes=[{'item_id': item.pk, 'menu': item.product_name,
                            'before': item.preparation_snapshot, 'after': preparation_snapshot(item.product)}
                            for item in items if intent['use_current_preparation']
                            and item.preparation_snapshot != preparation_snapshot(item.product)])
                    plans.append(row)
                    # Later candidates must see earlier proposed reservations.
                    order.preparation_at, order.preparation_end_at = plan['start'], plan['end']
                    order.preparation_plan = row['plan']
                    order.save(update_fields=['preparation_at', 'preparation_end_at', 'preparation_plan'])
                transaction.set_rollback(True)
            changes = committed_changes(plans, repairs)
            signed = {'actor': actor.pk, 'intent': intent, 'fingerprint': fingerprint,
                      'plans_digest': digest(changes),
                      'plan_digests': {str(row['order_id']): digest(row) for row in changes['plans']},
                      'request_dates': [{'order_id': row['order_id'], 'delivery_at': row['delivery_at'].isoformat()}
                          for row in repairs],
                      'planned_ids': [row['order_id'] for row in plans],
                      'changed_ids': sorted({row['order_id'] for row in plans + repairs}),
                      'request_id': previous['request_id'] if previous else str(uuid4())}
            report = {'mode': 'preview', 'proposed_plans': plans, 'blocked_plans': blocked,
                      'proposed_request_repairs': repairs,
                      'missing_delivery_dates': missing, 'unchanged_orders': unchanged,
                      'note': 'Only feasible detailed task plans can be saved. Explicit request repairs change only eligible fictional processing records to pending with future request dates. No payments, ingredient recipes, stock or menu policies change.'}
            if not previous:
                report['confirm'] = signing.dumps(signed, salt=SALT, compress=True)
            else:
                if signed != previous:
                    changed_plans = sorted(set(signed['plan_digests']) | set(previous['plan_digests']), key=int)
                    changed_plans = [pk for pk in changed_plans
                        if signed['plan_digests'].get(pk) != previous['plan_digests'].get(pk)]
                    detail = ('Task timings or preparation settings changed for orders: '
                        + ', '.join('#'+pk for pk in changed_plans)) if changed_plans else 'The reviewed request repairs changed'
                    raise CommandError(detail + '. No changes saved. Run a fresh preview.')
                if not signed['changed_ids']:
                    raise CommandError('No feasible plans to save. Review blocked_plans and missing_delivery_dates.')
                path = Path(options['backup']).resolve()
                if path.is_relative_to(ROOT):
                    raise CommandError('Keep the private backup outside the repository.')
                ids = previous['changed_ids']
                backup = {'purpose': 'PRIVATE fictional preparation-plan before-backup', 'review': signed,
                          'records': json.loads(serializers.serialize('json', [
                              *Order.objects.filter(pk__in=ids).order_by('pk'),
                              *OrderItem.objects.filter(order_id__in=ids).order_by('pk')]))}
                try:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(descriptor, 'w') as file:
                        json.dump(backup, file, indent=2, default=str)
                except OSError:
                    raise CommandError('Could not create a new private backup. Choose an unused writable path.') from None
                plan_by_id = {row['order_id']: row for row in plans}
                repair_by_id = {row['order_id']: row for row in repairs}
                for pk in ids:
                    order = Order.objects.get(pk=pk)
                    row, repair = plan_by_id.get(pk), repair_by_id.get(pk)
                    before = {'preparation_at': order.preparation_at, 'preparation_end_at': order.preparation_end_at,
                              'status': order.status, 'delivery_at': order.delivery_at, 'plan': order.preparation_plan,
                              'preparation_changes': row['preparation_changes'] if row else []}
                    if repair:
                        order.status, order.delivery_at = 'pending', repair['delivery_at']
                        order.preparation_plan = repair['request_plan']
                    if row:
                        for change in row['preparation_changes']:
                            OrderItem.objects.filter(pk=change['item_id']).update(preparation_snapshot=change['after'])
                        order.preparation_at, order.preparation_end_at = row['preparation_start'], row['preparation_end']
                        order.preparation_plan = dict(row['plan'], maintenance_source='fictional_demo')
                    order.save(update_fields=['status', 'delivery_at', 'preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
                    OrderAmendment.objects.create(order=order, actor=actor, before=json.loads(encode(before)),
                        after=json.loads(encode(dict(plan=row, request_repair=repair,
                            planning_batch_id=signed['request_id'], maintenance_source='fictional_demo'))))
                report.update(mode='applied', updated_order_ids=ids, planned_order_ids=signed['planned_ids'],
                              repaired_request_ids=sorted(repair_by_id), backup=str(path), already_applied=False)
        self.stdout.write(encode(report))
