"""Removing the test-network feature must not damage earlier order/payment records."""
from datetime import timedelta
from decimal import Decimal
import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderItem, PaymentEvent, Product, Storefront
from .views.order_payment_choice import options_for


class RetiredPaymentTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user('earlier-payment-customer')
        self.owner = User.objects.create_user('earlier-payment-owner', is_staff=True)
        self.store = Storefront.objects.create(pk=1, ordering_mode='scheduled',
            manual_payment_enabled=True, bank_transfer_instructions='Fictional transfer details')
        self.order = Order.objects.create(user=self.customer, payment_method='escrow',
            total_amount=25, shipping_fee=5, delivery_at=timezone.now()+timedelta(days=5),
            payment_instructions={'escrow_sepolia': {'reference':'historical-reference'}})
        self.product = Product.objects.create(name='Current menu name', price=40)
        OrderItem.objects.create(order=self.order, product=self.product,
            product_name='Accepted earlier menu name', quantity=1, unit_price=25, subtotal=25)
        self.client = APIClient()
        self.client.force_authenticate(self.customer)

    def test_retired_api_routes_are_not_available_for_customers_or_staff(self):
        for actor in (self.customer, self.owner):
            self.client.force_authenticate(actor)
            for url in ('/api/payments/escrow/config/', f'/api/orders/{self.order.pk}/escrow/'):
                self.assertEqual(self.client.get(url).status_code, 404)
                self.assertEqual(self.client.post(url, {'action':'verify'}, format='json').status_code, 404)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_old_orders_and_payment_events_remain_readable_after_menu_rename(self):
        event = PaymentEvent.objects.create(order=self.order, request_id=uuid.uuid4(),
            kind='receipt', outcome='completed', amount=30, method='escrow',
            reference='historical-reference', source='escrow_sepolia')
        self.order.payment_status='paid'; self.order.save(update_fields=['payment_status'])
        self.product.name='Renamed again'; self.product.save(update_fields=['name'])
        self.client.force_authenticate(self.owner)
        response=self.client.get(f'/api/admin/orders/{self.order.pk}/payments/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['events'][0]['id'], event.pk)
        self.assertEqual(response.data['events'][0]['source'], 'escrow_sepolia')
        self.order.refresh_from_db()
        self.assertEqual(self.order.items.get().product_name, 'Accepted earlier menu name')
        self.assertEqual(self.order.items.get().unit_price, Decimal('25'))
        self.assertEqual(self.order.payment_instructions['escrow_sepolia']['reference'], 'historical-reference')

    def test_earlier_escrow_cannot_be_marked_paid_or_refunded_manually(self):
        self.client.force_authenticate(self.owner)
        for kind, status in (('receipt','unpaid'), ('refund','paid')):
            self.order.payment_status=status; self.order.save(update_fields=['payment_status'])
            response=self.client.post(f'/api/admin/orders/{self.order.pk}/payments/',
                {'request_id':str(uuid.uuid4()), 'kind':kind, 'outcome':'completed',
                 'reference':'not-verified'}, format='json')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIn('read-only', str(response.data))
            self.order.refresh_from_db(); self.assertEqual(self.order.payment_status, status)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_deferred_payment_never_offers_or_accepts_escrow(self):
        self.order.payment_method='deferred'
        self.order.preparation_at=self.order.delivery_at-timedelta(hours=2)
        self.order.preparation_end_at=self.order.delivery_at-timedelta(hours=1)
        self.order.save()
        self.assertNotIn('escrow', [option['id'] for option in options_for(self.order, self.store)])
        response=self.client.post(f'/api/orders/{self.order.pk}/payment-choice/',
            {'request_id':str(uuid.uuid4()), 'payment':'escrow'}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_method, 'deferred')
