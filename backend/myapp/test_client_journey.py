"""Client acceptance paths over real APIs with isolated stock and receipt images."""
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (Storefront, Product, RawMaterial, ProductIngredient, InventoryItem,
    PackagingItem, ProductPackaging, Order, IngredientConsumption, PackagingMovement, PaymentEvent)
from .test_guest_checkout import receipt_image


class ClientJourneyTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('journey-owner', is_staff=True)
        self.owner = APIClient()
        self.owner.force_authenticate(self.staff)
        self.store = Storefront.objects.create(pk=1, manual_payment_enabled=True,
            duitnow_qr_url='https://example.com/isolated-qr.png', pickup_enabled=True,
            pickup_location='Saved collection counter', delivery_areas=['North'],
            delivery_area_fees={'North': '4.50'}, free_delivery_minimum_myr=None)
        self.product = Product.objects.create(name='Accepted rice meal', price=12, lead_hours=1000, daily_capacity=1)
        self.raw = RawMaterial.objects.create(name='Journey rice', unit='g')
        ProductIngredient.objects.create(product=self.product, raw_material=self.raw, quantity_required=100)
        today = timezone.localdate()
        self.early = InventoryItem.objects.create(raw_material=self.raw, quantity=400,
            received_date=today, expiry_date=today + timedelta(days=5), storage_location='Dry shelf A')
        self.later = InventoryItem.objects.create(raw_material=self.raw, quantity=600,
            received_date=today, expiry_date=today + timedelta(days=30), storage_location='Dry shelf B')
        self.box = PackagingItem.objects.create(name='Journey container', quantity=10)
        ProductPackaging.objects.create(product=self.product, packaging_item=self.box, quantity_per_item=1)
        self.delivery = (timezone.localtime() + timedelta(days=2)).replace(hour=7, minute=30, second=0, microsecond=0)
        self.guest = self.start_guest()

    def start_guest(self):
        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/check-auth/')
        response = client.post('/api/guest-session/', {}, format='json',
            HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        self.assertEqual(response.status_code, 201)
        client.credentials(HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        return client

    def details(self, pickup=False):
        return dict(delivery_at=self.delivery.isoformat(), delivery_method='pickup' if pickup else 'standard',
            delivery_area='' if pickup else 'North', arrival_window_minutes=0)

    def place(self, quantity=2, pickup=False, proof=None):
        response = self.guest.post('/api/cart/', {'product_id': self.product.pk, 'quantity': quantity}, format='json')
        self.assertIn(response.status_code, [200, 201])
        body = dict(**self.details(pickup), customer={'name': 'Journey buyer', 'phone': '012 345 6789'},
            delivery_address={} if pickup else {'line1': 'House 1, Journey street, Kuching'},
            payment='manual' if pickup else 'cod', payment_proof_id=proof,
            expected_total=str(12 * quantity + (0 if pickup else Decimal('4.50'))), request_id=str(uuid.uuid4()))
        return body

    def assert_stock(self, rice, boxes):
        self.early.refresh_from_db(); self.later.refresh_from_db(); self.box.refresh_from_db()
        self.assertEqual(self.early.quantity + self.later.quantity, rice)
        self.assertEqual(self.box.quantity, boxes)

    def mark_received(self, order):
        order.refresh_from_db()
        response = self.owner.post('/api/admin/orders/receipts/', {'received': True,
            'orders': [{'id': order.pk, 'version': order.updated_at.isoformat()}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def sales(self):
        return self.owner.get('/api/admin/reports/period-sales/',
            {'start': str(self.delivery.date()), 'end': str(self.delivery.date())}).data

    def record_payment(self, order, kind='receipt'):
        response = self.owner.post(f'/api/admin/orders/{order.pk}/payments/',
            {'request_id': str(uuid.uuid4()), 'kind': kind, 'outcome': 'completed',
             'reference': 'Isolated verified fixture'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)

    def test_cash_placement_stock_payment_receipt_report_and_print_are_consistent(self):
        body = self.place()
        quote = self.guest.post('/api/orders/quote/', body, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assert_stock(1000, 10)
        response = self.guest.post('/api/orders/place/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['order_id'])
        original_version = order.updated_at.isoformat()
        self.assertIsNone(order.preparation_at)
        self.assertEqual(order.preparation_plan['ordering_mode'], 'simple')
        self.assertEqual(order.payment_status, 'unpaid')
        self.assert_stock(800, 8)
        self.assertEqual(self.early.quantity, 200)
        replay = self.guest.post('/api/orders/place/', body, format='json')
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.data['order_id'], order.pk)
        self.assert_stock(800, 8)
        self.record_payment(order)
        stale = self.owner.post('/api/admin/orders/receipts/', {'received': True,
            'orders': [{'id': order.pk, 'version': original_version}]}, format='json')
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.sales()['paid_received_orders'], 0)
        self.mark_received(order)
        self.assert_stock(800, 8)
        self.assertEqual(self.sales()['total_sales'], '28.50')
        self.product.name = 'Changed current menu'; self.product.price = 999; self.product.save()
        slip = self.owner.get(f'/api/admin/orders/{order.pk}/slip/').data
        self.assertEqual(slip['name'], 'Journey buyer')
        self.assertEqual(slip['phone'], '+60123456789')
        self.assertEqual(slip['items'][0]['unit_price'], '12.00')
        self.assertEqual(slip['items'][0]['name'], 'Accepted rice meal')
        self.assertEqual(slip['total'], '28.50')
        self.assertIn('House 1, Journey street, Kuching', slip['address_lines'])
        self.assertIn(self.guest.get(f'/api/admin/orders/{order.pk}/slip/').status_code, [401, 403])
        self.assertEqual(IngredientConsumption.objects.filter(returned_at__isnull=True).count(), 1)
        self.assertEqual(PaymentEvent.objects.count(), 1)

    def test_qr_pickup_proof_verification_receipt_and_refund_do_not_invent_stock_returns(self):
        body = self.place(quantity=1, pickup=True)
        response = self.guest.post('/api/checkout-proofs/',
            {**self.details(True), 'image': receipt_image('green')}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        proof = response.data
        outsider = self.start_guest()
        self.assertEqual(outsider.get(proof['url']).status_code, 404)
        body['payment_proof_id'] = proof['id']
        response = self.guest.post('/api/orders/place/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['order_id'])
        self.assertEqual(order.payment_status, 'unpaid')
        self.assert_stock(900, 9)
        self.mark_received(order)
        self.assertEqual(self.sales()['total_sales'], '0.00')
        self.assertEqual(self.sales()['unpaid_received_orders'], 1)
        policy = self.owner.get(f'/api/admin/orders/{order.pk}/payments/').data['policy']
        self.assertNotIn('Sandbox', policy)
        self.assertIn('bank records or cash collected', policy)
        self.record_payment(order)
        self.assertEqual(self.sales()['total_sales'], '12.00')
        self.store.pickup_location = 'Changed current collection counter'; self.store.save()
        slip = self.owner.get(f'/api/admin/orders/{order.pk}/slip/').data
        self.assertEqual(slip['pickup_location'], 'Saved collection counter')
        self.assertEqual(slip['address_lines'], [])
        self.record_payment(order, 'refund')
        self.assertEqual(self.sales()['total_sales'], '0.00')
        self.assert_stock(900, 9)
        self.assertEqual(PaymentEvent.objects.count(), 2)
        self.assertTrue(all(row.source == 'owner_verified' for row in PaymentEvent.objects.all()))

    def test_cancelled_unused_order_returns_original_allocations_once_and_never_records_payment(self):
        body = self.place()
        response = self.guest.post('/api/orders/place/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['order_id'])
        self.assert_stock(800, 8)
        cancellation = {'version': order.updated_at.isoformat(), 'reason': 'Not prepared; cancelled before use', 'return_unused_stock': True}
        for _ in range(2):
            response = self.owner.post(f'/api/admin/orders/{order.pk}/cancel/', cancellation, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        self.assert_stock(1000, 10)
        self.assertEqual(self.early.quantity, 400)
        self.assertEqual(self.later.quantity, 600)
        self.assertEqual(IngredientConsumption.objects.filter(returned_at__isnull=False).count(), 1)
        self.assertEqual(PackagingMovement.objects.filter(kind='release').count(), 1)
        self.assertEqual(self.sales()['total_sales'], '0.00')
        self.assertFalse(PaymentEvent.objects.exists())
        day = self.owner.get('/api/admin/reports/daily-orders/', {'date': str(self.delivery.date())}).data
        self.assertEqual(day['count'], 0)
        self.assertEqual(day['cancelled_count'], 1)
