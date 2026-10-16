"""Explicit operator maintenance for fictional demo data; never part of a build."""
import hashlib
import json
import os
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from myapp.models import Product, Order, PaymentEvent, OrderAmendment, Storefront
from myapp.services.commitments import PREPARATION_FIELDS, preparation_snapshot
from myapp.services.scheduling import validate_tasks, schedule_order, plan_snapshot

ROOT = Path(__file__).resolve().parents[4]
ORDER_FIELDS = ['id', 'status', 'payment_status', 'created_at', 'delivery_at', 'preparation_at',
                'preparation_end_at', 'preparation_plan', 'inventory_deducted', 'total_amount', 'updated_at']
PRODUCT_FIELDS = ['id', 'name', *PREPARATION_FIELDS]


def snapshot():
    return {
        'purpose': 'PRIVATE BACKUP — fictional FreshCast maintenance; no real payment captured',
        'products': list(Product.objects.order_by('pk').values(*PRODUCT_FIELDS)),
        'orders': list(Order.objects.order_by('pk').values(*ORDER_FIELDS)),
        'items': [],  # Filled below without customer/contact data.
        'payments': list(PaymentEvent.objects.order_by('pk').values('id', 'order_id', 'kind', 'outcome', 'amount', 'source')),
    }


def reviewed_snapshot():
    from myapp.models import OrderItem
    data = snapshot()
    data['items'] = list(OrderItem.objects.order_by('pk').values('id', 'order_id', 'product_id', 'quantity', 'preparation_snapshot'))
    encoded = json.dumps(data, default=str, sort_keys=True, separators=(',', ':'))
    return data, hashlib.sha256(encoded.encode()).hexdigest()


def templates(path):
    source = json.loads(Path(path).read_text())
    result = {}
    for menu in source['menus']:
        tasks = validate_tasks(menu.get('preparation_tasks', []))
        if not tasks:
            continue
        fields = {key: menu[key] for key in PREPARATION_FIELDS if key in menu and key not in {'lead_hours', 'daily_capacity', 'delivery_weekdays'}}
        fields['preparation_tasks'] = tasks
        fields['preparation_minutes'] = sum(t['minutes'] for t in tasks)
        result[menu['name'].strip().casefold()] = fields
    return result


class Command(BaseCommand):
    help = 'Preview demo menu steps/order readiness, or explicitly apply fictional-data maintenance with a private backup.'

    def add_arguments(self, parser):
        parser.add_argument('--source', default=str(ROOT / 'docs/DAPUR-KITA-STARTER-DATA.json'))
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--backup')
        parser.add_argument('--actor-id', type=int)
        parser.add_argument('--mark-demo-paid', action='store_true')
        parser.add_argument('--complete-past-demo-orders', action='store_true')

    def handle(self, *args, **options):
        if options['complete_past_demo_orders'] and not options['mark_demo_paid']:
            raise CommandError('Completing fictional past orders also requires --mark-demo-paid.')
        catalogue = templates(options['source'])
        data, _ = reviewed_snapshot()
        intent = {'mark_demo_paid': options['mark_demo_paid'], 'complete_past_demo_orders': options['complete_past_demo_orders']}
        def fingerprint_for(rows):
            return hashlib.sha256(json.dumps({'database': rows, 'templates': catalogue, 'intent': intent}, default=str, sort_keys=True).encode()).hexdigest()
        fingerprint = fingerprint_for(data)
        candidates = [p for p in data['products'] if not p['preparation_tasks']]
        report = {'mode': 'preview', 'fingerprint': fingerprint, 'requested_changes': intent,
                  'missing_preparation': [{'id': p['id'], 'name': p['name'], 'template_available': p['name'].strip().casefold() in catalogue} for p in candidates],
                  'orders': [{'id': o['id'], 'status': o['status'], 'payment_status': o['payment_status'],
                              'delivery_at': o['delivery_at'], 'has_tasks': bool(o['preparation_plan'].get('tasks'))} for o in data['orders']],
                  'notes': ['Timings are guide templates, not measured kitchen performance.',
                            'No dates, quantities, recipes, prices, stock, refunds or wallet balances will be invented or changed.',
                            'Past completion is fictional reporting only; past task times are not fabricated.',
                            'Future task plans use the existing scheduler; conflicts/missing dates remain unresolved.']}
        if not options['apply']:
            self.stdout.write(json.dumps(report, default=str, indent=2))
            return
        if not all([options['confirm_fictional'], options['expected_fingerprint'], options['backup'], options['actor_id']]):
            raise CommandError('Apply requires --confirm-fictional, --expected-fingerprint, --backup and --actor-id.')
        actor = get_user_model().objects.filter(pk=options['actor_id'], is_staff=True).first()
        if not actor:
            raise CommandError('Choose an existing staff actor ID.')
        backup = Path(options['backup']).resolve()
        if backup.is_relative_to(ROOT):
            raise CommandError('Keep the private backup outside the repository.')
        changed_menus, changed_orders, skipped, payment_ids = [], [], [], []
        maintenance_id = str(uuid4())
        with transaction.atomic():
            list(Product.objects.select_for_update().order_by('pk'))
            orders = list(Order.objects.select_for_update().order_by('pk'))
            before, _ = reviewed_snapshot()
            if fingerprint_for(before) != options['expected_fingerprint']:
                raise CommandError('Database changed since preview; review a new fingerprint.')
            try:
                fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, 'w') as file:
                    json.dump(dict(before, maintenance_id=maintenance_id, requested_changes=intent, staff_actor_id=actor.pk), file, default=str, indent=2)
            except OSError:
                raise CommandError('Cannot create a new private backup. Choose an existing directory and unused filename.') from None
            for product in Product.objects.order_by('pk'):
                values = catalogue.get(product.name.strip().casefold())
                if product.preparation_tasks or not values:
                    continue
                for field, value in values.items():
                    setattr(product, field, value)
                product.save(update_fields=[*values, 'updated_at'])
                changed_menus.append(product.pk)
            store, _ = Storefront.objects.get_or_create(pk=1)
            store = Storefront.objects.select_for_update().get(pk=store.pk)
            now = timezone.now()
            # Earlier deliveries reserve kitchen resources first.
            for order in sorted(orders, key=lambda o: (o.delivery_at is None, o.delivery_at or now, o.pk)):
                if order.status == 'cancelled' or order.payment_status == 'refunded' or order.payment_events.filter(kind='refund').exists():
                    skipped.append({'id': order.pk, 'reason': 'cancelled_or_refund_record_preserved'})
                    continue
                if not order.delivery_at or order.created_at > order.delivery_at:
                    skipped.append({'id': order.pk, 'reason': 'missing_or_invalid_delivery_date_preserved'})
                    continue
                original = next(row for row in before['orders'] if row['id'] == order.pk)
                old_items = [row for row in before['items'] if row['order_id'] == order.pk]
                changed = False
                if options['mark_demo_paid'] and order.payment_status != 'paid':
                    receipts = sum((p.amount for p in order.payment_events.filter(kind='receipt', outcome='completed')), Decimal(0))
                    due = order.total_amount - receipts
                    if due < 0:
                        skipped.append({'id': order.pk, 'reason': 'payment_balance_needs_review'})
                        continue
                    if due:
                        receipt = PaymentEvent.objects.create(order=order, request_id=uuid4(), kind='receipt', outcome='completed', amount=due,
                            method='demo', reference='FICTIONAL FRESHCAST '+maintenance_id, source='fictional_demo', actor=actor,
                            note='Synthetic demo receipt only. No money captured, wallet debit or customer payment verification.')
                        payment_ids.append(receipt.pk)
                    order.payment_status = 'paid'
                    changed = True
                if order.delivery_at < now:
                    if options['complete_past_demo_orders'] and order.status != 'delivered':
                        order.status = 'delivered'
                        changed = True
                elif order.status == 'pending' and not order.inventory_deducted:
                    items = list(order.items.select_related('product'))
                    if not items or any(not i.product or not i.product.preparation_tasks for i in items):
                        skipped.append({'id': order.pk, 'reason': 'missing_menu_or_preparation_steps'})
                    elif order.preparation_plan.get('tasks') and not order.preparation_plan.get('needs_review'):
                        pass  # Preserve an already accepted detailed plan.
                    else:
                        try:
                            plan = schedule_order(items, order.delivery_at, store, exclude_order_id=order.pk, notice_from=order.created_at)
                        except ValidationError as error:
                            skipped.append({'id': order.pk, 'reason': 'schedule_needs_review', 'detail': error.detail})
                        else:
                            for item in items:
                                item.preparation_snapshot = preparation_snapshot(item.product)
                                item.save(update_fields=['preparation_snapshot'])
                            order.preparation_at, order.preparation_end_at = plan['start'], plan['end']
                            order.preparation_plan = dict(plan_snapshot(plan), maintenance_source='fictional_demo')
                            changed = True
                if changed:
                    order.save(update_fields=['payment_status', 'status', 'preparation_at', 'preparation_end_at', 'preparation_plan', 'updated_at'])
                    OrderAmendment.objects.create(order=order, actor=actor,
                        before=json.loads(json.dumps({'maintenance_source': 'fictional_demo', 'maintenance_id': maintenance_id, 'order': original, 'items': old_items}, default=str)),
                        after={'maintenance_source': 'fictional_demo', 'maintenance_id': maintenance_id, 'order': json.loads(json.dumps({key: getattr(order, key) for key in ORDER_FIELDS}, default=str))})
                    changed_orders.append(order.pk)
        report.update(mode='applied', maintenance_id=maintenance_id, created_payment_ids=payment_ids, changed_menu_ids=changed_menus, changed_order_ids=changed_orders, unresolved=skipped,
                      status='partial_review_needed' if skipped else 'applied')
        self.stdout.write(json.dumps(report, default=str, indent=2))
