"""Close obsolete fictional requests without deleting or renumbering order history."""
import hashlib
import json
import os
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from myapp.models import Order, OrderAmendment, Product, Storefront
from .prepare_freshcast_demo import ROOT, reviewed_snapshot


def encode(value):
    return json.dumps(value, default=str, sort_keys=True)


def review():
    database, _ = reviewed_snapshot()
    menus = list(Product.objects.order_by('pk').values('id', 'name', 'selling_status', 'updated_at'))
    orders = list(Order.objects.prefetch_related('items__product', 'items__consumption', 'payment_events').order_by('pk'))
    candidates, missing, preserved = [], [], []
    for order in orders:
        items = list(order.items.all())
        archived_only = bool(items) and all(item.product and item.product.selling_status == 'archived' for item in items)
        row = {'id': order.pk, 'status': order.status, 'payment_status': order.payment_status,
               'delivery_at': order.delivery_at, 'archived_menus_only': archived_only,
               'menus': [item.product_name for item in items]}
        if order.status in ('pending', 'processing') and not order.delivery_at:
            missing.append(row)
        if not archived_only or order.status in ('delivered', 'cancelled'):
            continue
        if order.status != 'pending':
            reason = 'work_already_started'
        elif order.inventory_deducted or any(item.consumption.all() for item in items):
            reason = 'stock_records_exist'
        elif order.preparation_at or order.preparation_end_at or order.preparation_plan.get('tasks'):
            reason = 'preparation_reserved'
        elif order.payment_status == 'refunded' or any(
            event.kind == 'refund' or event.source != 'fictional_demo'
            for event in order.payment_events.all()
        ):
            reason = 'payment_records_require_review'
        else:
            candidates.append(row)
            continue
        preserved.append(dict(row, reason=reason))
    # Include identities and archive status: a changed menu/order/payment invalidates the preview.
    context = {'database': database, 'menus': menus, 'candidates': candidates,
               'missing_delivery': missing, 'preserved': preserved}
    fingerprint = hashlib.sha256(encode(context).encode()).hexdigest()
    return context, fingerprint


class Command(BaseCommand):
    help = 'Preview closing obsolete, unscheduled fictional requests containing only archived menus. Keeps IDs and history.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--actor-id', type=int)
        parser.add_argument('--backup')

    def handle(self, *args, **options):
        if options['apply'] and not all(options[key] for key in ('confirm_fictional', 'expected_fingerprint', 'actor_id', 'backup')):
            raise CommandError('Apply requires --confirm-fictional, --expected-fingerprint, --actor-id and --backup.')
        with transaction.atomic():
            if options['apply']:
                # Follow normal kitchen mutation lock order.
                list(Storefront.objects.select_for_update().order_by('pk'))
                list(Order.objects.select_for_update().order_by('pk'))
                list(Product.objects.select_for_update().order_by('pk'))
            context, fingerprint = review()
            result = {'mode': 'preview', 'fingerprint': fingerprint,
                      'proposed_cancellations': context['candidates'],
                      'open_orders_missing_delivery': context['missing_delivery'],
                      'preserved_archived_requests': context['preserved'],
                      'note': 'Only obsolete fictional requests may be closed. No deletion, renumbering, invented dates, payments or stock changes.'}
            if options['apply']:
                if fingerprint != options['expected_fingerprint']:
                    raise CommandError('Records changed; run and review a new preview.')
                actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
                if not actor:
                    raise CommandError('Choose an existing staff actor ID.')
                backup = Path(options['backup']).resolve()
                if backup.is_relative_to(ROOT):
                    raise CommandError('Keep the private backup outside the repository.')
                maintenance_id = str(uuid4())
                try:
                    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(descriptor, 'w') as file:
                        file.write(encode(dict(context, maintenance_id=maintenance_id, actor_id=actor.pk)))
                except OSError:
                    raise CommandError('Could not create a new private backup. Use an existing folder and unused filename.') from None
                for row in context['candidates']:
                    order = Order.objects.get(pk=row['id'])
                    before = {'status': order.status, 'delivery_at': order.delivery_at,
                              'preparation_plan': order.preparation_plan}
                    order.status = 'cancelled'
                    order.save(update_fields=['status', 'updated_at'])
                    OrderAmendment.objects.create(order=order, actor=actor,
                        before=json.loads(encode(before)), after={
                            'kind': 'close_archived_demo_order', 'status': 'cancelled',
                            'maintenance_source': 'fictional_demo', 'maintenance_id': maintenance_id,
                            'reason': 'Obsolete fictional request containing only archived menus; no fulfilment or refund asserted.'})
                remaining, _ = review()
                result.update(mode='applied', maintenance_id=maintenance_id,
                    closed_order_ids=[row['id'] for row in context['candidates']],
                    remaining_open_missing_delivery=remaining['missing_delivery'])
            self.stdout.write(encode(result))
