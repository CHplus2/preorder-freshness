"""Review and audit one fictional order's delivery change using existing kitchen rules."""
import hashlib
import json
import os
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from myapp.models import KitchenBlock, Order, OrderAmendment, Product, Storefront
from myapp.services.commitments import preparation_snapshot
from myapp.services.scheduling import plan_snapshot, schedule_order
from .prepare_freshcast_demo import ROOT, ORDER_FIELDS, reviewed_snapshot


def encode(value):
    return json.dumps(value, default=str, sort_keys=True)


class Command(BaseCommand):
    help = 'Preview or explicitly save one fictional order delivery and feasible task plan, with backup and audit.'

    def add_arguments(self, parser):
        parser.add_argument('--order-id', type=int, required=True)
        parser.add_argument('--delivery-at', required=True, help='ISO timestamp with timezone, e.g. 2027-01-13T15:00:00+08:00')
        parser.add_argument('--allow-manual-review', action='store_true',
                            help='Allow saving an unscheduled delivery request that still needs owner planning; reserves no tasks.')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--actor-id', type=int)
        parser.add_argument('--backup')

    def handle(self, *args, **options):
        try:
            delivery = parse_datetime(options['delivery_at'])
        except ValueError:
            delivery = None
        if delivery is None or timezone.is_naive(delivery):
            raise CommandError('Use a valid ISO delivery timestamp including its timezone.')
        if options['apply'] and not all(options[k] for k in ('confirm_fictional', 'expected_fingerprint', 'actor_id', 'backup')):
            raise CommandError('Apply requires --confirm-fictional, --expected-fingerprint, --actor-id and --backup.')
        with transaction.atomic():
            # Same lock order as checkout and delivery changes: store, orders, menus.
            store_query = Storefront.objects.select_for_update() if options['apply'] else Storefront.objects
            store = store_query.filter(pk=1).first()
            if not store:
                raise CommandError('Existing storefront settings are required; none were created.')
            if options['apply']:
                list(Order.objects.select_for_update().order_by('pk'))
                list(Product.objects.select_for_update().order_by('pk'))
            order = Order.objects.filter(pk=options['order_id']).first()
            if not order:
                raise CommandError('Order does not exist.')
            if (order.status != 'pending' or order.payment_status != 'paid' or order.inventory_deducted
                    or order.payment_events.filter(kind='refund').exists()):
                raise CommandError('Only paid pending fictional orders with no stock deduction or refund records can be rescheduled.')
            before, _ = reviewed_snapshot()
            context = {'database': before, 'store': list(Storefront.objects.filter(pk=1).values()),
                       'blocks': list(KitchenBlock.objects.order_by('pk').values()),
                       'order_id': order.pk, 'delivery_at': delivery.isoformat(),
                       'allow_manual_review': options['allow_manual_review']}
            fingerprint = hashlib.sha256(encode(context).encode()).hexdigest()
            if options['apply'] and options['expected_fingerprint'] != fingerprint:
                raise CommandError('Data or requested delivery changed; run and review a new preview.')
            items = list(order.items.select_related('product'))
            if not items or any(not item.product or not item.product.preparation_tasks for item in items):
                raise CommandError('Every menu must already have detailed preparation tasks.')
            try:
                plan = schedule_order(items, delivery, store, exclude_order_id=order.pk,
                                      notice_from=order.created_at, allow_manual_review=options['allow_manual_review'])
            except ValidationError as error:
                if options['apply']:
                    raise CommandError('Schedule remains infeasible; no records were changed: ' + str(error.detail)) from None
                self.stdout.write(encode({'mode': 'preview', 'ready': False, 'requires_manual_planning': False, 'order_id': order.pk,
                                         'detail': error.detail, 'fingerprint': fingerprint}))
                return
            needs_review = bool(plan.get('needs_review'))
            result = {'mode': 'preview', 'ready': not needs_review, 'requires_manual_planning': needs_review,
                      'review_reason': plan.get('review_reason'), 'order_id': order.pk, 'fingerprint': fingerprint,
                      'old_delivery_at': order.delivery_at, 'proposed_delivery_at': delivery,
                      'preparation_start': plan['start'], 'preparation_end': plan['end'],
                      'task_count': len(plan['tasks']),
                      'note': ('Unscheduled delivery request only. No preparation tasks or kitchen capacity reserved. Owner planning is still required.'
                               if needs_review else 'Existing recipe, holding, resource, capacity and working-hour limits remain in force. No payment or stock changes.')}
            if options['apply']:
                actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
                if not actor:
                    raise CommandError('Choose an existing staff actor ID.')
                backup = Path(options['backup']).resolve()
                if backup.is_relative_to(ROOT):
                    raise CommandError('Keep the private backup outside the repository.')
                run_id = str(uuid4())
                try:
                    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, 'w') as file:
                        file.write(encode(dict(context, maintenance_id=run_id, staff_actor_id=actor.pk)))
                except OSError:
                    raise CommandError('Cannot create a new private backup; choose an existing directory and unused filename.') from None
                original = next(row for row in before['orders'] if row['id'] == order.pk)
                original_items = [row for row in before['items'] if row['order_id'] == order.pk]
                if not needs_review:
                    for item in items:
                        item.preparation_snapshot = preparation_snapshot(item.product)
                        item.save(update_fields=['preparation_snapshot'])
                order.delivery_at = delivery
                order.preparation_at, order.preparation_end_at = plan['start'], plan['end']
                order.preparation_plan = dict(plan_snapshot(plan), maintenance_source='fictional_demo')
                order.save(update_fields=['delivery_at', 'preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
                OrderAmendment.objects.create(order=order, actor=actor,
                    before=json.loads(encode({'maintenance_source': 'fictional_demo', 'maintenance_id': run_id,
                                              'order': original, 'items': original_items})),
                    after=json.loads(encode({'maintenance_source': 'fictional_demo', 'maintenance_id': run_id,
                                             'order': {field: getattr(order, field) for field in ORDER_FIELDS}})))
                result.update(mode='applied', maintenance_id=run_id,
                              outcome='delivery_request_saved_needs_review' if needs_review else 'scheduled')
            self.stdout.write(encode(result))
