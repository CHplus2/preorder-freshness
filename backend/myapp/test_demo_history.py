"""Synthetic seed checks use isolated fixture databases, never real training data."""
import io
import json
from datetime import datetime, time, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone

from . import test_local_planning as fixtures
from .models import (InventoryItem, Order, OrderItem, OrderIngredient, OrderAmendment,
                     PaymentEvent, Product, ProductIngredient, Storefront)
from .services.demo_provenance import HISTORY_KEY, synthetic_history
from .services.kitchen_decisions import decision_support
from .services.local_planning import local_plan
from .services.kitchen_forecast import kitchen_forecast, monday
from .views.planning import sales_summary
from .management.commands.seed_freshcast_demo_history import BUYER


class DemoHistoryTests(TestCase):
    def setUp(self):
        fixtures.LocalPlanningTests.setUp(self)
        Storefront.objects.create(pk=1)
        self.second = Product.objects.create(name='Second meal', price=12, daily_capacity=2, delivery_weekdays=[0,2,4])
        ProductIngredient.objects.create(product=self.second, raw_material=self.material, quantity_required=50)

    def command(self, *args):
        output = io.StringIO()
        call_command('seed_freshcast_demo_history', *args, stdout=output)
        return json.loads(output.getvalue())

    def apply(self, preview, backup):
        return self.command('--apply', '--confirm-fictional', '--expected-fingerprint', preview['fingerprint'],
                            '--actor-id', str(self.staff.pk), '--backup', str(backup))

    def test_preview_is_nonmutating_deterministic_and_requires_explicit_apply(self):
        first = self.command(); second = self.command()
        self.assertEqual(first['fingerprint'], second['fingerprint'])
        self.assertGreater(first['proposed_menu_records'], 100)
        self.assertLessEqual(first['proposed_daily_summaries'], 118)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(get_user_model().objects.filter(username=BUYER).exists())
        with self.assertRaises(CommandError): self.command('--apply')

    def test_apply_preserves_orders_stock_and_produces_labeled_delivery_history_and_audits(self):
        existing = fixtures.LocalPlanningTests.order(self, status='delivered',
            delivery_at=timezone.localtime()-timedelta(days=10), payment_status='paid')
        Order.objects.filter(pk=existing.pk).update(created_at=existing.delivery_at-timedelta(days=1))
        existing.refresh_from_db(); original_date = existing.created_at
        pending = fixtures.LocalPlanningTests.order(self)
        stock = fixtures.LocalPlanningTests.batch(self, 500)
        preview = self.command()
        with TemporaryDirectory() as directory, patch('predictive_ai.service.bundle',side_effect=AssertionError('No Genpact')):
            path=Path(directory)/'before.json'
            result = self.apply(preview, path)
            self.assertEqual(len(json.loads(path.read_text())['database']['orders']), 2)
        created = Order.objects.filter(pk__in=result['created_order_ids']).prefetch_related('items')
        self.assertEqual(created.count(), preview['proposed_daily_summaries'])
        for order in created:
            self.assertTrue(synthetic_history(order))
            self.assertEqual(order.payment_status, 'paid'); self.assertEqual(order.status, 'delivered')
            self.assertLess(order.created_at, order.delivery_at)
            self.assertLess(timezone.localtime(order.delivery_at).date(), timezone.localdate())
            self.assertFalse(order.inventory_deducted)
            self.assertIsNone(order.preparation_at)
            self.assertEqual(order.preparation_plan['tasks'], [])
            self.assertEqual(sum(i.subtotal for i in order.items.all()), order.total_amount)
        self.assertEqual(OrderAmendment.objects.count(), created.count())
        self.assertEqual(PaymentEvent.objects.filter(source='synthetic_history').count(), created.count())
        self.assertTrue(OrderIngredient.objects.filter(order_item__recipe_source='synthetic_demo').exists())
        self.assertFalse(created.filter(items__product=self.menu, delivery_at__date=timezone.localtime(existing.delivery_at).date()).exists())
        existing.refresh_from_db(); self.assertEqual(existing.created_at, original_date)
        pending.refresh_from_db(); self.assertEqual(pending.status, 'pending')
        stock.refresh_from_db(); self.assertEqual(stock.quantity, 500)
        buyer = get_user_model().objects.get(username=BUYER)
        self.assertFalse(buyer.is_active); self.assertFalse(buyer.has_usable_password())
        self.assertEqual(result['after']['kitchen']['menus_without_history'], [])
        self.assertEqual(result['after']['weekly']['status'], 'evaluated')
        cutoff = timezone.make_aware(datetime.combine(monday(timezone.localdate()), time()))
        self.assertEqual(result['after']['weekly']['synthetic_history_orders'], created.filter(delivery_at__lt=cutoff).count())

    def test_rerun_does_not_duplicate_or_refill_daily_history(self):
        with TemporaryDirectory() as directory:
            self.apply(self.command(), Path(directory)/'first.json')
            counts=(Order.objects.count(), OrderItem.objects.count(), PaymentEvent.objects.count())
            second=self.command(); self.assertEqual(second['proposed_menu_records'], 0)
            result=self.apply(second, Path(directory)/'second.json')
        self.assertEqual(result['created_order_ids'], [])
        self.assertEqual(counts,(Order.objects.count(), OrderItem.objects.count(), PaymentEvent.objects.count()))

    def test_changed_price_or_archived_state_requires_new_preview(self):
        preview=self.command()
        self.menu.price=15; self.menu.save()
        with TemporaryDirectory() as directory:
            path=Path(directory)/'no.json'
            with self.assertRaises(CommandError): self.apply(preview,path)
            self.assertFalse(path.exists())
        self.assertFalse(Order.objects.exists())

    def test_receipt_failure_rolls_back_new_buyer_orders_items_and_audits(self):
        preview=self.command()
        with TemporaryDirectory() as directory, patch('myapp.models.PaymentEvent.objects.bulk_create',side_effect=RuntimeError('test receipt failure')):
            with self.assertRaises(RuntimeError): self.apply(preview,Path(directory)/'before.json')
        self.assertFalse(Order.objects.exists()); self.assertFalse(OrderItem.objects.exists())
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertFalse(get_user_model().objects.filter(username=BUYER).exists())

    def test_weekdays_capacity_and_provenance_reach_forecast_and_sales_apis(self):
        with TemporaryDirectory() as directory:
            self.apply(self.command(),Path(directory)/'before.json')
        for item in OrderItem.objects.filter(product=self.second).select_related('order'):
            self.assertIn(timezone.localtime(item.order.delivery_at).weekday(),self.second.delivery_weekdays)
            self.assertLessEqual(item.quantity,self.second.daily_capacity)
        daily=decision_support(local_plan())
        self.assertTrue(all(m['synthetic_history_items']>0 for m in daily['menus']))
        weekly=kitchen_forecast(); self.assertGreater(weekly['synthetic_history_orders'],0)
        self.assertTrue(any(o['synthetic_history'] for o in weekly['recent_orders']))
        self.assertGreater(sales_summary()['analytics']['synthetic_history_orders'],0)
        self.assertEqual(self.client.get('/api/admin/predictive/local-decisions/').data['decision_support']['synthetic_history_items'],daily['synthetic_history_items'])
