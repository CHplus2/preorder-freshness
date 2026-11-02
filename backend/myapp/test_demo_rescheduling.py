"""Exercise reviewed rescheduling without weakening recipe or holding constraints."""
import io
import json
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import Order, OrderAmendment, OrderItem, PaymentEvent, Product, Storefront


class DemoReschedulingTests(TestCase):
    def setUp(self):
        self.actor = User.objects.create_user('reschedule-staff', is_staff=True)
        self.buyer = User.objects.create_user('reschedule-buyer')
        self.store = Storefront.objects.create(pk=1, delivery_buffer_minutes=90)
        self.menu = Product.objects.create(name='Test rice', price=10, max_early_minutes=0,
            max_preparation_days=1, lead_hours=24, preparation_tasks=[dict(name='Cook and pack',
                minutes=45, resource='packing_area', worker=True, overnight=False,
                max_wait_minutes=0, additional_batch_minutes=0)])
        self.original = (timezone.localtime()+timedelta(days=5)).replace(hour=9, minute=5, second=0, microsecond=0)
        self.later = self.original.replace(hour=15, minute=0)
        self.order = Order.objects.create(user=self.buyer, total_amount=10, payment_status='paid', delivery_at=self.original)
        OrderItem.objects.create(order=self.order, product=self.menu, product_name=self.menu.name,
                                 quantity=1, unit_price=10, subtotal=10)

    def run_command(self, *args, delivery=None):
        output = io.StringIO()
        call_command('reschedule_freshcast_demo', '--order-id', str(self.order.pk),
                     '--delivery-at', (delivery or self.later).isoformat(), *args, stdout=output)
        return json.loads(output.getvalue())

    def apply(self, preview, path, **kwargs):
        return self.run_command('--apply', '--confirm-fictional', '--expected-fingerprint', preview['fingerprint'],
                                '--actor-id', str(self.actor.pk), '--backup', str(path), **kwargs)

    def test_preview_is_read_only_and_original_zero_holding_rule_is_kept(self):
        data = self.run_command()
        self.assertTrue(data['ready'])
        self.order.refresh_from_db(); self.menu.refresh_from_db()
        self.assertEqual(self.order.delivery_at, self.original)
        self.assertEqual(self.order.preparation_plan, {})
        self.assertEqual(self.menu.max_early_minutes, 0)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_apply_saves_only_target_plan_and_date_with_backup_and_audit(self):
        other = Order.objects.create(user=self.buyer, payment_status='paid', delivery_at=self.original)
        preview = self.run_command()
        with TemporaryDirectory() as directory:
            path = Path(directory)/'before.json'
            result = self.apply(preview, path)
            before = json.loads(path.read_text())
            self.assertEqual(before['order_id'], self.order.pk)
            self.assertEqual(parse_datetime(before['database']['orders'][0]['delivery_at']), self.original)
        self.assertEqual(result['mode'], 'applied')
        self.order.refresh_from_db(); self.menu.refresh_from_db(); other.refresh_from_db()
        self.assertEqual(self.order.delivery_at, self.later)
        self.assertTrue(self.order.preparation_plan['tasks'])
        self.assertEqual(self.order.payment_status, 'paid')
        self.assertFalse(self.order.inventory_deducted)
        self.assertEqual(self.menu.max_early_minutes, 0)
        self.assertEqual(other.delivery_at, self.original)
        self.assertFalse(PaymentEvent.objects.exists())
        audit = OrderAmendment.objects.get(order=self.order)
        self.assertEqual(audit.before['order']['id'], self.order.pk)

    def test_infeasible_schedule_cannot_be_applied_or_backed_up_as_success(self):
        preview = self.run_command(delivery=self.original)
        self.assertFalse(preview['ready'])
        with TemporaryDirectory() as directory:
            path = Path(directory)/'no.json'
            with self.assertRaises(CommandError):
                self.apply(preview, path, delivery=self.original)
            self.assertFalse(path.exists())
        self.order.refresh_from_db(); self.assertEqual(self.order.delivery_at, self.original)
        self.assertFalse(OrderAmendment.objects.exists())

    def test_changed_store_settings_or_requested_date_require_new_preview(self):
        preview = self.run_command()
        with TemporaryDirectory() as directory:
            with self.assertRaises(CommandError):
                self.apply(preview, Path(directory)/'wrong-date.json', delivery=self.later+timedelta(days=1))
            self.store.delivery_buffer_minutes = 60; self.store.save()
            with self.assertRaises(CommandError):
                self.apply(preview, Path(directory)/'changed-store.json')
        self.assertFalse(OrderAmendment.objects.exists())

    def test_apply_requires_confirmation_and_protects_nonpending_or_unpaid_orders(self):
        with self.assertRaises(CommandError):
            self.run_command('--apply')
        for fields in ({'status': 'delivered'}, {'status': 'pending', 'payment_status': 'unpaid'},
                       {'payment_status': 'paid', 'inventory_deducted': True}):
            Order.objects.filter(pk=self.order.pk).update(**fields)
            with self.assertRaises(CommandError):
                self.run_command()

    def test_explicit_manual_review_saves_only_request_without_fabricated_tasks(self):
        original_snapshot = self.order.items.get().preparation_snapshot
        requested = self.original + timedelta(days=1)
        preview = self.run_command('--allow-manual-review', delivery=requested)
        self.assertFalse(preview['ready'])
        self.assertTrue(preview['requires_manual_planning'])
        self.assertEqual(preview['task_count'], 0)
        self.assertIsNone(preview['preparation_start'])
        self.order.refresh_from_db(); self.assertEqual(self.order.preparation_plan, {})
        with TemporaryDirectory() as directory:
            result = self.run_command('--allow-manual-review', '--apply', '--confirm-fictional',
                '--expected-fingerprint', preview['fingerprint'], '--actor-id', str(self.actor.pk),
                '--backup', str(Path(directory)/'request.json'), delivery=requested)
        self.assertEqual(result['outcome'], 'delivery_request_saved_needs_review')
        self.order.refresh_from_db(); self.menu.refresh_from_db()
        self.assertEqual(self.order.status, 'pending')
        self.assertEqual(self.order.delivery_at, requested)
        self.assertEqual(self.order.payment_status, 'paid')
        self.assertTrue(self.order.preparation_plan['needs_review'])
        self.assertEqual(self.order.preparation_plan['tasks'], [])
        self.assertIsNone(self.order.preparation_at)
        self.assertEqual(self.order.items.get().preparation_snapshot, original_snapshot)
        self.assertEqual(self.menu.max_early_minutes, 0)
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertEqual(OrderAmendment.objects.count(), 1)

    def test_manual_review_intent_requires_its_own_fingerprint(self):
        preview = self.run_command()
        with TemporaryDirectory() as directory:
            with self.assertRaises(CommandError):
                self.run_command('--allow-manual-review', '--apply', '--confirm-fictional',
                    '--expected-fingerprint', preview['fingerprint'], '--actor-id', str(self.actor.pk),
                    '--backup', str(Path(directory)/'no.json'))
        self.assertFalse(OrderAmendment.objects.exists())

    def test_manual_review_cannot_bypass_delivery_horizon(self):
        delivery = self.later+timedelta(days=100)
        preview = self.run_command('--allow-manual-review', delivery=delivery)
        self.assertFalse(preview['ready'])
        self.assertFalse(preview['requires_manual_planning'])
        with TemporaryDirectory() as directory:
            with self.assertRaises(CommandError):
                self.run_command('--allow-manual-review', '--apply', '--confirm-fictional',
                    '--expected-fingerprint', preview['fingerprint'], '--actor-id', str(self.actor.pk),
                    '--backup', str(Path(directory)/'no.json'), delivery=delivery)
            self.assertFalse((Path(directory)/'no.json').exists())
        self.order.refresh_from_db(); self.assertEqual(self.order.delivery_at, self.original)
        self.assertFalse(OrderAmendment.objects.exists())
