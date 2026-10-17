import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.utils import timezone

from .models import Order, OrderAmendment, OrderItem, PaymentEvent, Product


class LegacyDemoCleanupTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner-cleanup', is_staff=True)
        self.old = Product.objects.create(name='Jasmine Rice', price=5, selling_status='archived')
        self.current = Product.objects.create(name='Nasi Lemak Telur', price=7, selling_status='active')

    def order(self, products, **fields):
        order = Order.objects.create(user=self.owner, **fields)
        for product in products:
            OrderItem.objects.create(order=order, product=product, product_name=product.name,
                                     quantity=1, unit_price=product.price, subtotal=product.price)
        return order

    def run_command(self, *args):
        out = io.StringIO()
        call_command('close_archived_demo_orders', *args, stdout=out)
        return json.loads(out.getvalue())

    def apply(self, preview, path):
        return self.run_command('--apply', '--confirm-fictional', '--expected-fingerprint', preview['fingerprint'],
                                '--actor-id', str(self.owner.pk), '--backup', str(path))

    def test_preview_identifies_archived_only_and_does_not_change_records(self):
        old = self.order([self.old])
        current = self.order([self.current])
        mixed = self.order([self.old, self.current])
        empty = self.order([])
        data = self.run_command()
        self.assertEqual([row['id'] for row in data['proposed_cancellations']], [old.pk])
        self.assertEqual({row['id'] for row in data['open_orders_missing_delivery']}, {old.pk, current.pk, mixed.pk, empty.pk})
        old.refresh_from_db()
        self.assertEqual(old.status, 'pending')
        self.assertFalse(OrderAmendment.objects.exists())
        with self.assertRaises(CommandError):
            self.run_command('--apply')

    def test_apply_closes_only_eligible_requests_with_backup_audit_and_stable_references(self):
        old = self.order([self.old], payment_status='paid')
        payment = PaymentEvent.objects.create(order=old, request_id=uuid4(), kind='receipt', outcome='completed',
            amount=5, method='demo', source='fictional_demo')
        current = self.order([self.current])
        delivered = self.order([self.old], status='delivered', payment_status='paid')
        preview = self.run_command()
        with TemporaryDirectory() as folder:
            path = Path(folder)/'private.json'
            result = self.apply(preview, path)
            self.assertEqual(json.loads(path.read_text())['database']['orders'][0]['status'], 'pending')
            if os.name != 'nt':
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        old.refresh_from_db(); current.refresh_from_db(); delivered.refresh_from_db(); payment.refresh_from_db()
        self.assertEqual(old.status, 'cancelled')
        self.assertIsNone(old.delivery_at)
        self.assertEqual(old.payment_status, 'paid')
        self.assertFalse(old.inventory_deducted)
        self.assertEqual(current.status, 'pending')
        self.assertEqual(delivered.status, 'delivered')
        self.assertEqual(result['closed_order_ids'], [old.pk])
        self.assertEqual([row['id'] for row in result['remaining_open_missing_delivery']], [current.pk])
        self.assertEqual(Order.objects.count(), 3)
        self.assertEqual(payment.order_id, old.pk)
        self.assertEqual(OrderAmendment.objects.get().after['kind'], 'close_archived_demo_order')
        self.assertEqual(self.run_command()['proposed_cancellations'], [])

    def test_started_scheduled_stock_refunds_and_external_payment_records_are_preserved(self):
        rows = [self.order([self.old], status='processing'),
                self.order([self.old], preparation_at=timezone.now()),
                self.order([self.old], preparation_plan={'tasks':[{'name':'Reserved'}]}),
                self.order([self.old], inventory_deducted=True),
                self.order([self.old], payment_status='refunded'), self.order([self.old])]
        PaymentEvent.objects.create(order=rows[-1], request_id=uuid4(), kind='receipt', outcome='completed',
            amount=5, method='bank_transfer', source='owner')
        preview = self.run_command()
        self.assertEqual(preview['proposed_cancellations'], [])
        self.assertEqual(len(preview['preserved_archived_requests']), len(rows))

    def test_changed_menu_status_or_order_invalidates_preview_and_writes_nothing(self):
        order = self.order([self.old])
        preview = self.run_command()
        Product.objects.filter(pk=self.old.pk).update(selling_status='active')
        with TemporaryDirectory() as folder:
            path = Path(folder)/'no.json'
            with self.assertRaises(CommandError):
                self.apply(preview, path)
            self.assertFalse(path.exists())
        order.refresh_from_db(); self.assertEqual(order.status, 'pending')
        self.assertFalse(OrderAmendment.objects.exists())

    def test_backup_failure_or_nonstaff_actor_prevents_all_changes(self):
        order = self.order([self.old])
        preview = self.run_command()
        with TemporaryDirectory() as folder:
            path = Path(folder)/'exists.json'
            path.write_text('keep')
            with self.assertRaises(CommandError):
                self.apply(preview, path)
            self.assertEqual(path.read_text(), 'keep')
            self.owner.is_staff = False
            self.owner.save()
            with self.assertRaises(CommandError):
                self.apply(preview, Path(folder)/'new.json')
        order.refresh_from_db(); self.assertEqual(order.status, 'pending')
        self.assertFalse(OrderAmendment.objects.exists())
