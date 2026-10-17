"""Explicit synthetic historical daily summaries; never recover or rewrite actual history."""
import hashlib
import json
import os
from collections import Counter
from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from myapp.models import (Order, OrderItem, OrderIngredient, OrderAmendment, PaymentEvent,
                         Product, Storefront)
from myapp.services.commitments import preparation_snapshot
from myapp.services.demo_provenance import HISTORY_KEY, HISTORY_VERSION, synthetic_history
from myapp.services.kitchen_forecast import kitchen_forecast, monday
from .prepare_freshcast_demo import ROOT, reviewed_snapshot
from .seed_freshcast_demo_inventory import projection

BUYER = 'freshcast_synthetic_history_v1'


def encode(value):
    return json.dumps(value, default=str, sort_keys=True)


def summary():
    weekly = kitchen_forecast()
    return {'kitchen': projection(), 'weekly': {key: weekly.get(key) for key in (
        'status', 'history_weeks', 'eligible_orders', 'synthetic_history_orders',
        'selected_method', 'next_week_portions', 'evaluation')},
        'notice': 'Generated history evaluates a synthetic scenario, not real customer accuracy.'}


class Command(BaseCommand):
    help = 'Preview/add labeled synthetic daily sales summaries for active menus, preserving all existing history.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-fictional', action='store_true')
        parser.add_argument('--expected-fingerprint')
        parser.add_argument('--backup')
        parser.add_argument('--actor-id', type=int)

    def handle(self, *args, **options):
        if options['apply'] and not all(options[k] for k in ('confirm_fictional', 'expected_fingerprint', 'backup', 'actor_id')):
            raise CommandError('Apply requires --confirm-fictional, --expected-fingerprint, --backup and --actor-id.')
        with transaction.atomic():
            if options['apply']:
                if not Storefront.objects.select_for_update().filter(pk=1).first():
                    raise CommandError('Existing storefront settings are required. Check database/schema.')
                list(Order.objects.select_for_update().order_by('pk'))
                list(Product.objects.select_for_update().order_by('pk'))
            today = timezone.localdate()
            start, end = monday(today)-timedelta(weeks=16), today-timedelta(days=1)
            products = list(Product.objects.filter(selling_status='active').prefetch_related('ingredients__raw_material').order_by('pk'))
            orders = list(Order.objects.prefetch_related('items').order_by('pk'))
            database, _ = reviewed_snapshot()
            buyer = get_user_model().objects.filter(username=BUYER).first()
            if buyer and (buyer.is_active or buyer.has_usable_password() or buyer.first_name != 'SYNTHETIC' or buyer.email):
                raise CommandError('Reserved synthetic buyer name belongs to a different account; no changes made.')
            covered = set()
            for order in orders:
                if order.status != 'delivered' or order.payment_status != 'paid':
                    continue
                day = timezone.localtime(order.delivery_at or order.created_at).date()
                if not start <= day <= end or timezone.localtime(order.created_at).date() > day:
                    continue
                for item in order.items.all():
                    if item.quantity > 0:
                        covered.add((item.product_id, item.product_name, day))
            proposals, generated, preserved, missing_recipes = [], Counter(), Counter(), []
            for product in products:
                if not product.ingredients.all():
                    missing_recipes.append(product.name)
            day = start
            existing_keys = {o.checkout_request_id: o for o in orders if o.checkout_request_id}
            while day <= end:
                lines = []
                for product in products:
                    if (product.pk, product.name, day) in covered or (product.pk, '', day) in covered:
                        preserved[product.pk] += 1
                        continue
                    if product.delivery_weekdays and day.weekday() not in product.delivery_weekdays:
                        continue
                    if not product.daily_capacity:
                        continue
                    digest = hashlib.sha256(f'freshcast-history-v1:{product.pk}:{day}'.encode()).digest()
                    # A fixed toy pattern with zero-sales days, weekday variation and noise.
                    # No distribution is fitted to held-out targets or Genpact data.
                    if digest[0] % 5 == 0:
                        continue
                    quantity = min(product.daily_capacity, 1 + ((digest[1]+day.weekday()) % 4))
                    subtotal = (product.price*quantity).quantize(Decimal('.01'))
                    if subtotal < 0 or subtotal > Decimal('99999999.99'):
                        raise CommandError('A menu price exceeds synthetic order field limits.')
                    lines.append({'product_id': product.pk, 'name': product.name, 'quantity': quantity,
                                  'unit_price': product.price, 'subtotal': subtotal})
                    generated[product.pk] += 1
                if lines:
                    key = uuid5(NAMESPACE_URL, f'freshcast-history-v1:{day}:'+','.join(str(i['product_id']) for i in lines))
                    if key in existing_keys:
                        raise CommandError('A matching synthetic record exists but is no longer eligible. Preserve it; review its status instead of replacing it.')
                    total = sum((line['subtotal'] for line in lines), Decimal(0))
                    if total > Decimal('99999999.99'):
                        raise CommandError('Daily aggregate exceeds order amount limits.')
                    proposals.append({'key': str(key), 'delivery_day': str(day), 'total': total, 'items': lines})
                day += timedelta(days=1)
            product_context = [{'id': p.pk, 'name': p.name, 'price': p.price,
                'weekdays': p.delivery_weekdays, 'capacity': p.daily_capacity,
                'packaging': p.packaging_cost,
                'recipe': [{'material_id': i.raw_material_id, 'material': i.raw_material.name,
                            'unit': i.raw_material.unit, 'quantity': i.quantity_required} for i in p.ingredients.all()]} for p in products]
            context = {'as_of': today, 'start': start, 'end': end, 'history_version': HISTORY_VERSION,
                'database': database, 'products': product_context, 'buyer_id': buyer.pk if buyer else None,
                'order_markers': [{'id': o.pk, 'key': o.checkout_request_id, 'synthetic': synthetic_history(o),
                                   'items': [(i.product_id, i.product_name, i.quantity) for i in o.items.all()]} for o in orders]}
            fingerprint = hashlib.sha256(encode({'context': context, 'proposals': proposals}).encode()).hexdigest()
            report = {'mode': 'preview', 'fingerprint': fingerprint, 'history_start': start, 'history_end': end,
                'active_menus': len(products), 'proposed_daily_summaries': len(proposals),
                'proposed_menu_records': sum(generated.values()),
                'menu_coverage': [{'menu': p.name, 'generated_selling_days': generated[p.pk],
                                   'existing_selling_days_preserved': preserved[p.pk]} for p in products],
                'menus_missing_recipes': missing_recipes, 'samples': (proposals[:1]+proposals[-1:]) if proposals else [],
                'before': summary(),
                'assumptions': [
                    'All new sales, delivery dates, quantities and receipts are explicitly SYNTHETIC DEMO history, not recovered records.',
                    'One generated order is a daily aggregate across menus, not an individual customer transaction; order counts and average order values are artificial.',
                    'Generated quantities follow a deterministic toy pattern of 0-4 portions per allowed menu/day, capped by current daily capacity.',
                    'Existing eligible menu/day history is preserved, not topped up. Existing orders, prices, dates, payments and inventory are never edited.',
                    'Current prices and recipe/preparation snapshots are copied into synthetic records; no actual historical recipe, payment, cooking or delivery is verified.',
                    'No money is captured, wallet changed, inventory deducted, customer notified or cooking schedule fabricated.',
                    'Generated data can exercise evaluation and forecasting, but numerical accuracy is only on synthetic patterns and cannot establish real-world reliability.']}
            if options['apply']:
                if fingerprint != options['expected_fingerprint']:
                    raise CommandError('Data/date changed since preview; review a new fingerprint.')
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
                        file.write(encode(dict(context, maintenance_id=run_id, actor_id=actor.pk, proposed_daily_summaries=proposals)))
                except OSError:
                    raise CommandError('Cannot create a new private backup. Choose an existing directory and unused filename.') from None
                if proposals and not buyer:
                    buyer = get_user_model().objects.create_user(username=BUYER, password=None, is_active=False,
                                                                 first_name='SYNTHETIC', last_name='FreshCast history')
                new_orders = []
                for row in proposals:
                    day = datetime.fromisoformat(row['delivery_day']).date()
                    delivery = timezone.make_aware(datetime.combine(day, time(12)))
                    new_orders.append(Order(user=buyer, checkout_request_id=row['key'], status='delivered', payment_status='paid',
                        payment_method='synthetic_demo', total_amount=row['total'], delivery_at=delivery,
                        payment_instructions={HISTORY_KEY: {'version': HISTORY_VERSION, 'maintenance_id': run_id,
                            'daily_aggregate': True, 'notice': 'SYNTHETIC scenario; no real sale, receipt, preparation or delivery.'}},
                        preparation_plan={'mode': 'synthetic_history', 'tasks': [], 'source': 'SYNTHETIC_DEMO'}))
                Order.objects.bulk_create(new_orders, batch_size=200)
                for order in new_orders:
                    order.created_at = order.delivery_at-timedelta(days=2)
                Order.objects.bulk_update(new_orders, ['created_at'], batch_size=200)
                product_map = {p.pk: p for p in products}
                items = []
                for order, row in zip(new_orders, proposals):
                    for line in row['items']:
                        p = product_map[line['product_id']]
                        items.append(OrderItem(order=order, product=p, product_name=p.name, quantity=line['quantity'],
                            unit_price=p.price, subtotal=line['subtotal'], recipe_source='synthetic_demo',
                            preparation_snapshot=preparation_snapshot(p), packaging_unit_cost=p.packaging_cost))
                OrderItem.objects.bulk_create(items, batch_size=200)
                ingredients = [OrderIngredient(order_item=item, raw_material=i.raw_material,
                    material_name=i.raw_material.name, unit=i.raw_material.unit, quantity_per_portion=i.quantity_required)
                    for item in items for i in product_map[item.product_id].ingredients.all()]
                OrderIngredient.objects.bulk_create(ingredients, batch_size=500)
                PaymentEvent.objects.bulk_create([PaymentEvent(order=o,
                    request_id=uuid5(NAMESPACE_URL, f'freshcast-synthetic-receipt:{o.checkout_request_id}'),
                    kind='receipt', outcome='completed', amount=o.total_amount, method='synthetic_demo',
                    source='synthetic_history', reference=f'SYNTHETIC daily summary {o.pk}', actor=actor,
                    note='SYNTHETIC historical scenario only. No money captured or actual customer payment verified.')
                    for o in new_orders if o.total_amount > 0], batch_size=200)
                OrderAmendment.objects.bulk_create([OrderAmendment(order=o, actor=actor,
                    before={'kind': 'synthetic_history_creation', 'existed': False},
                    after={'source': 'SYNTHETIC_DEMO', 'maintenance_id': run_id, 'daily_aggregate': True,
                           'delivery_at': o.delivery_at.isoformat(), 'synthetic_created_at': o.created_at.isoformat()})
                    for o in new_orders], batch_size=200)
                report.update(mode='applied', maintenance_id=run_id, created_order_ids=[o.pk for o in new_orders], after=summary())
            self.stdout.write(encode(report))
