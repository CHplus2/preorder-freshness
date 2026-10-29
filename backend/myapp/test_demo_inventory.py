"""Real stock/forecast services with isolated fictional fixture data only."""
import io
import json
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone

from . import test_local_planning as fixtures
from .models import InventoryItem, InventoryLog, Order, OrderItem, PaymentEvent, Storefront


class DemoInventoryTests(TestCase):
    def setUp(self):
        fixtures.LocalPlanningTests.setUp(self)
        Storefront.objects.create(pk=1)

    def command(self, *args):
        output = io.StringIO()
        call_command('seed_freshcast_demo_inventory', *args, stdout=output)
        return json.loads(output.getvalue())

    def apply(self, preview, backup):
        return self.command('--apply', '--confirm-fictional', '--expected-fingerprint', preview['fingerprint'],
                            '--actor-id', str(self.staff.pk), '--backup', str(backup))

    def test_preview_no_writes_and_explicit_fictional_confirmation_required(self):
        data = self.command()
        self.assertEqual(len(data['proposed_batches']), 2)
        self.assertEqual(data['proposed_batches'][0]['quantity'], '1000.000')
        self.assertEqual(data['proposed_batches'][0]['expiry_date'], str(timezone.localdate()+timedelta(days=2)))
        self.assertEqual(data['before']['menus_without_history'], [self.menu.name])
        self.assertFalse(InventoryItem.objects.exists())
        self.assertFalse(InventoryLog.objects.exists())
        with self.assertRaises(CommandError): self.command('--apply')

    def test_apply_connects_stock_to_expiry_without_creating_history_or_overwriting_quarantine(self):
        old = fixtures.LocalPlanningTests.batch(self, 500, quarantined=True)
        preview = self.command()
        with TemporaryDirectory() as directory:
            path = Path(directory)/'stock-before.json'
            result = self.apply(preview, path)
            self.assertEqual(len(json.loads(path.read_text())['stock']), 1)
        self.assertEqual(len(result['created_batch_ids']), 2)
        for row in InventoryItem.objects.filter(pk__in=result['created_batch_ids']):
            self.assertNotIn('fictional', row.storage_location.lower())
            self.assertTrue(row.storage_location.startswith(('Fridge A', 'Freezer A', 'Pantry A')))
        self.assertEqual(InventoryLog.objects.count(), 2)
        old.refresh_from_db(); self.assertTrue(old.quarantined); self.assertEqual(old.quantity, 500)
        near = InventoryItem.objects.get(batch_code__endswith='-NEAR')
        self.assertIn('FICTIONAL', near.handling_note)
        self.assertEqual(near.unit_cost, self.material.estimated_unit_cost)
        self.assertFalse(Order.objects.exists()); self.assertFalse(PaymentEvent.objects.exists())
        self.assertEqual(result['before']['menu_forecasts'], result['after']['menu_forecasts'])
        risk = result['after']['ingredient_projections'][0]
        self.assertEqual(risk['projected_unused_at_expiry'], 1000)
        self.assertEqual(risk['potential_waste_cost_myr'], 30)
        self.assertEqual(risk['signal'], 'review')
        response = self.client.get('/api/admin/predictive/local-decisions/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(b['batch_code'].startswith('DEMO-FC-INV-') for b in response.data['batches']))
        self.assertTrue(any('FICTIONAL INVENTORY' in w for w in response.data['warnings']))

    def test_repeated_apply_does_not_refill_consumed_stock_or_duplicate_logs(self):
        with TemporaryDirectory() as directory:
            self.apply(self.command(), Path(directory)/'first.json')
            near = InventoryItem.objects.get(batch_code__endswith='-NEAR')
            InventoryItem.objects.filter(pk=near.pk).update(quantity=0)
            second = self.command()
            self.assertEqual(second['proposed_batches'], [])
            result = self.apply(second, Path(directory)/'second.json')
        self.assertEqual(result['created_batch_ids'], [])
        self.assertEqual(InventoryItem.objects.count(), 2)
        self.assertEqual(InventoryLog.objects.count(), 2)
        near.refresh_from_db(); self.assertEqual(near.quantity, 0)

    def test_stale_stock_snapshot_refuses_changes_before_backup(self):
        preview = self.command()
        fixtures.LocalPlanningTests.batch(self, 10)
        with TemporaryDirectory() as directory:
            path = Path(directory)/'no.json'
            with self.assertRaises(CommandError): self.apply(preview, path)
            self.assertFalse(path.exists())
        self.assertEqual(InventoryItem.objects.count(), 1)
        self.assertFalse(InventoryLog.objects.exists())

    def test_failed_audit_rolls_back_all_added_stock(self):
        preview = self.command()
        with TemporaryDirectory() as directory, patch('myapp.models.InventoryLog.objects.create', side_effect=RuntimeError('test audit failure')):
            with self.assertRaises(RuntimeError): self.apply(preview, Path(directory)/'before.json')
        self.assertFalse(InventoryItem.objects.exists())
        self.assertFalse(InventoryLog.objects.exists())

    def test_unknown_cost_remains_null_and_archived_recipes_do_not_add_stock(self):
        self.material.estimated_unit_cost = None; self.material.save()
        with TemporaryDirectory() as directory:
            result = self.apply(self.command(), Path(directory)/'before.json')
        self.assertIsNone(result['after']['ingredient_projections'][0]['potential_waste_cost_myr'])
        self.menu.selling_status = 'archived'; self.menu.save()
        self.assertEqual(self.command()['recipe_materials'], 0)

    def test_history_forecasts_consume_near_expiry_stock_without_changing_predictions(self):
        now = timezone.localtime()
        for offset in range(7, 0, -1):
            delivered = now-timedelta(days=offset)
            order = Order.objects.create(user=self.buyer, status='delivered', payment_status='paid', delivery_at=delivered)
            Order.objects.filter(pk=order.pk).update(created_at=delivered-timedelta(days=1))
            OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
                                     quantity=2, unit_price=10, subtotal=20)
        with patch('predictive_ai.service.bundle', side_effect=AssertionError('Never load Genpact')):
            before = self.command()
            with TemporaryDirectory() as directory:
                result = self.apply(before, Path(directory)/'before.json')
        self.assertEqual(result['before']['menu_forecasts'], result['after']['menu_forecasts'])
        self.assertGreater(result['after']['menu_forecasts'][0]['forecast_portions'], 0)
        risk = result['after']['ingredient_projections'][0]
        self.assertGreater(risk['forecast_requirement'], 0)
        self.assertGreater(risk['projected_unused_at_expiry'], 0)
        self.assertLess(risk['projected_unused_at_expiry'], 1000)
        self.assertEqual(Order.objects.count(), 7)
