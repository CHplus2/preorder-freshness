"""Isolated fictional maintenance checks; no production connection or model training."""
import io
import json
import os
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone
from .models import Product, RawMaterial, ProductIngredient, Order, OrderItem, PaymentEvent, OrderAmendment

class DemoPreparationMaintenanceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('maintenance-owner', is_staff=True)
        self.buyer = User.objects.create_user('maintenance-buyer')
        self.menu = Product.objects.create(name='Nasi Lemak Telur', price=10)
        material = RawMaterial.objects.create(name='Rice', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=material, quantity_required=100)
        now = timezone.localtime()
        self.future = self.order((now + timedelta(days=5)).replace(hour=16, minute=0, second=0, microsecond=0))
        self.past = self.order(now - timedelta(days=15))
        Order.objects.filter(pk=self.past.pk).update(created_at=now-timedelta(days=16))
        self.cancelled = self.order(now+timedelta(days=6), status='cancelled')

    def order(self, delivery, **kwargs):
        order = Order.objects.create(user=self.buyer, delivery_at=delivery, total_amount=20, **kwargs)
        OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name, quantity=2, unit_price=10, subtotal=20)
        return order

    def preview(self, *args):
        output = io.StringIO()
        call_command('prepare_freshcast_demo', *args, stdout=output)
        return json.loads(output.getvalue())

    def test_preview_is_nonmutating_and_apply_requires_confirmation(self):
        data = self.preview('--mark-demo-paid', '--complete-past-demo-orders')
        self.assertEqual(data['missing_preparation'][0]['name'], self.menu.name)
        self.menu.refresh_from_db(); self.assertEqual(self.menu.preparation_tasks, [])
        self.assertEqual(PaymentEvent.objects.count(), 0)
        with self.assertRaises(CommandError): self.preview('--apply')

    def test_apply_keeps_dates_refunds_and_inventory_independent_and_audits_demo_receipts(self):
        flags = ['--mark-demo-paid', '--complete-past-demo-orders']
        data = self.preview(*flags)
        delivery = self.past.delivery_at
        with TemporaryDirectory() as folder:
            backup = Path(folder)/'private-before.json'
            result = self.preview(*flags, '--apply', '--confirm-fictional', '--expected-fingerprint', data['fingerprint'], '--backup', str(backup), '--actor-id', str(self.owner.pk))
            self.assertEqual(os.stat(backup).st_mode & 0o777, 0o600)
            self.assertEqual(len(json.loads(backup.read_text())['orders']), 3)
        self.menu.refresh_from_db(); self.assertEqual(len(self.menu.preparation_tasks), 5)
        self.assertEqual(self.menu.daily_capacity, 30)
        self.future.refresh_from_db(); self.assertEqual(self.future.payment_status, 'paid')
        self.assertTrue(self.future.preparation_plan['tasks'])
        self.assertFalse(self.future.preparation_plan.get('needs_review'))
        self.past.refresh_from_db(); self.assertEqual(self.past.status, 'delivered')
        self.assertEqual(self.past.delivery_at, delivery)
        self.assertFalse(self.past.inventory_deducted)
        self.cancelled.refresh_from_db(); self.assertEqual(self.cancelled.status, 'cancelled')
        self.assertEqual(self.cancelled.payment_status, 'unpaid')
        self.assertEqual(PaymentEvent.objects.filter(source='fictional_demo').count(), 2)
        self.assertEqual(OrderAmendment.objects.count(), 2)
        self.assertIn(self.cancelled.pk, [r['id'] for r in result['unresolved']])
        self.assertEqual(self.past.items.first().accepted_ingredients.count(), 1)

    def test_changed_snapshot_or_changed_intent_refuses_all_writes(self):
        data = self.preview()
        self.menu.name = 'Changed menu'; self.menu.save()
        with TemporaryDirectory() as folder:
            path = Path(folder)/'before.json'
            with self.assertRaises(CommandError):
                self.preview('--apply', '--confirm-fictional', '--expected-fingerprint', data['fingerprint'], '--backup', str(path), '--actor-id', str(self.owner.pk))
            self.assertFalse(path.exists())
        self.assertFalse(PaymentEvent.objects.exists())
        self.assertFalse(OrderAmendment.objects.exists())

    def test_second_reviewed_apply_does_not_duplicate_demo_receipts_or_replace_valid_tasks(self):
        flags = ['--mark-demo-paid', '--complete-past-demo-orders']
        with TemporaryDirectory() as folder:
            first = self.preview(*flags)
            self.preview(*flags, '--apply', '--confirm-fictional', '--expected-fingerprint', first['fingerprint'], '--backup', str(Path(folder)/'first.json'), '--actor-id', str(self.owner.pk))
            self.future.refresh_from_db(); tasks = self.future.preparation_plan
            count = PaymentEvent.objects.count()
            second = self.preview(*flags)
            result = self.preview(*flags, '--apply', '--confirm-fictional', '--expected-fingerprint', second['fingerprint'], '--backup', str(Path(folder)/'second.json'), '--actor-id', str(self.owner.pk))
            self.assertEqual(PaymentEvent.objects.count(), count)
            self.assertEqual(result['changed_order_ids'], [])
            self.future.refresh_from_db(); self.assertEqual(self.future.preparation_plan, tasks)

    def test_intent_change_and_refund_records_are_protected(self):
        data = self.preview()
        with TemporaryDirectory() as folder:
            with self.assertRaises(CommandError):
                self.preview('--mark-demo-paid', '--apply', '--confirm-fictional', '--expected-fingerprint', data['fingerprint'], '--backup', str(Path(folder)/'no.json'), '--actor-id', str(self.owner.pk))
            PaymentEvent.objects.create(order=self.future,request_id=__import__('uuid').uuid4(),kind='refund',outcome='pending',amount=5,method='demo',reference='fixture')
            data = self.preview('--mark-demo-paid')
            result=self.preview('--mark-demo-paid','--apply','--confirm-fictional','--expected-fingerprint',data['fingerprint'],'--backup',str(Path(folder)/'refund.json'),'--actor-id',str(self.owner.pk))
            self.future.refresh_from_db();self.assertEqual(self.future.payment_status,'unpaid')
            self.assertIn(self.future.pk,[r['id'] for r in result['unresolved']])
