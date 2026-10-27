"""Grouped actual progress: no real mail, courier booking or payment changes."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIClient
from . import test_simple_order_workflow as fixtures
from .models import Order, OrderItem, IngredientConsumption, InventoryLog


class BatchProgressTests(TestCase):
    def setUp(self):
        fixtures.SimpleOrderWorkflowTests.setUp(self)
        self.second = self.another()
        self.url = '/api/admin/orders/progress/'

    def another(self, **changes):
        values = {name: getattr(self.order, name) for name in ('user','delivery_at','preparation_at','preparation_end_at','preparation_plan')}
        order = Order.objects.create(**dict(values, **changes))
        OrderItem.objects.create(order=order, product=self.product, product_name=self.product.name, quantity=1, unit_price=10, subtotal=10)
        return order

    def payload(self, target='cooked', orders=None):
        rows = orders or [self.order, self.second]
        return {'status': target, 'orders': [{'id': row.pk, 'version': Order.objects.get(pk=row.pk).updated_at.isoformat()} for row in rows]}

    def test_ready_then_dispatch_then_actual_receipt_with_payment_and_email_separate(self):
        self.order.fulfilment_snapshot = {'customer_reminder': {'enabled':True, 'dispatch_updates':True, 'email':'buyer@example.test'}}
        self.order.save()
        with patch('myapp.services.reminders.send_mail') as mail:
            for target in ('cooked','shipped','delivered'):
                response = self.client.post(self.url, self.payload(target), format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual({row['id'] for row in response.data['updated']}, {self.order.pk,self.second.pk})
                self.assertTrue(all(row['status']==target for row in response.data['updated']))
            mail.assert_not_called()
        self.order.refresh_from_db();self.lot.refresh_from_db()
        self.assertEqual(self.order.status, 'delivered')
        self.assertEqual(self.order.payment_status, 'unpaid')
        self.assertTrue(self.order.fulfilment_snapshot['dispatch_notice']['key'])
        self.assertEqual(self.lot.quantity, 300)
        self.assertEqual(IngredientConsumption.objects.count(), 2)
        self.assertEqual(InventoryLog.objects.count(), 2)

    def test_stale_selection_or_lost_success_response_does_not_repeat_deduction(self):
        data = self.payload()
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 200)
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 409)
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity, 300)
        self.assertEqual(IngredientConsumption.objects.count(), 2)

    def test_shortage_rolls_back_all_orders_stock_receipts_and_logs(self):
        self.lot.quantity = 150;self.lot.save()
        result = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('No selected orders were updated', str(result.data))
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity, 150)
        self.assertEqual(list(Order.objects.values_list('status', flat=True)), ['pending','pending'])
        self.assertFalse(IngredientConsumption.objects.exists());self.assertFalse(InventoryLog.objects.exists())

    def test_stale_missing_and_unconfirmed_order_prevent_all_writes(self):
        data = self.payload();self.second.save()
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 409)
        data = self.payload();data['orders'][1]['id'] = 999999
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 404)
        self.second.preparation_plan = {'needs_review':True};self.second.save()
        self.assertEqual(self.client.post(self.url, self.payload(), format='json').status_code, 400)
        self.assertFalse(IngredientConsumption.objects.exists())
        self.assertEqual(Order.objects.filter(status='pending').count(), 2)

    def test_pickup_not_dispatched_and_delivery_never_skips_ready(self):
        self.assertEqual(self.client.post(self.url, self.payload('delivered'), format='json').status_code, 400)
        self.second.delivery_method = 'pickup';self.second.save()
        self.assertEqual(self.client.post(self.url, self.payload(), format='json').status_code, 200)
        self.assertEqual(self.client.post(self.url, self.payload('shipped'), format='json').status_code, 400)
        self.assertEqual(Order.objects.filter(status='cooked').count(), 2)
        self.assertEqual(self.client.post(self.url, self.payload('delivered'), format='json').status_code, 200)

    def test_invalid_processing_plan_cannot_be_marked_ready_individually_or_in_group(self):
        self.order.status = 'processing';self.order.preparation_end_at = None;self.order.save()
        result = self.client.patch(f'/api/admin/orders/{self.order.pk}/', {'status':'cooked'}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.post(self.url, self.payload(), format='json').status_code, 400)
        self.assertFalse(IngredientConsumption.objects.exists())

    def test_staff_only_bounded_unique_versioned_input_and_no_payment_updates(self):
        data = self.payload()
        for payload in ({'status':'cooked','orders':[]}, dict(data, payment_status='paid'),
                dict(data,status='processing'),dict(data,orders=[data['orders'][0]]*2),
                dict(data,orders=[{'id':self.order.pk}]),dict(data,orders=[{'id':index+1,'version':timezone.now().isoformat()} for index in range(21)])):
            self.assertEqual(self.client.post(self.url, payload, format='json').status_code, 400)
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url, data, format='json').status_code, 403)
        client = APIClient(enforce_csrf_checks=True);client.force_login(self.owner)
        self.assertEqual(client.post(self.url, data, format='json').status_code, 403)
        self.assertFalse(IngredientConsumption.objects.exists())


class BatchProgressConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update_skip_locked')
    def test_competing_group_confirmations_only_deduct_once(self):
        fixtures.SimpleOrderWorkflowTests.setUp(self)
        data = {'status':'cooked','orders':[{'id':self.order.pk,'version':self.order.updated_at.isoformat()}]}
        started, release = Event(), Event()
        from .views.orders import deduct_order_inventory
        def held(*args):
            started.set()
            if not release.wait(5): raise RuntimeError('Test synchronization timeout')
            return deduct_order_inventory(*args)
        def call():
            close_old_connections()
            try:
                client=APIClient();client.force_authenticate(self.owner)
                return client.post('/api/admin/orders/progress/',data,format='json').status_code
            finally:close_old_connections()
        with patch('myapp.views.orders.deduct_order_inventory',side_effect=held), ThreadPoolExecutor(max_workers=2) as pool:
            first=pool.submit(call)
            try:
                self.assertTrue(started.wait(5));second=pool.submit(call)
            finally:release.set()
            self.assertEqual(sorted([first.result(timeout=10),second.result(timeout=10)]),[200,409])
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity,400)
        self.assertEqual(IngredientConsumption.objects.count(),1)
