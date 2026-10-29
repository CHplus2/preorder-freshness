"""Fictional orders only: payment policy, ownership and durable retry boundaries."""
import copy
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Address, CartItem, Order, PaymentEvent, Product, Storefront


@override_settings(PAYPAL_SANDBOX_ENABLED=True, PAYPAL_SANDBOX_CLIENT_ID='fixture-id', PAYPAL_SANDBOX_CLIENT_SECRET='fixture-secret')
class OrderPaymentChoiceTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('choice-buyer')
        self.other = User.objects.create_user('choice-other')
        self.owner = User.objects.create_user('choice-owner', is_staff=True)
        self.client = APIClient(); self.client.force_authenticate(self.buyer)
        self.store = Storefront.objects.create(pk=1, pickup_enabled=True, pickup_location='Fixture counter',
            manual_payment_enabled=True, bank_transfer_instructions='Fictional bank details')
        self.delivery = (timezone.localtime()+timedelta(days=5)).replace(hour=18, minute=0, second=0, microsecond=0)
        self.menu = Product.objects.create(name='Fixture payment meal', price=12, lead_hours=0)
        self.address = Address.objects.create(user=self.buyer, line1='Fixture', city='KL', state='KL', postal_code='50000', phone='0123456789')
        self.order = Order.objects.create(user=self.buyer, total_amount=Decimal('24.00'), shipping_fee=5,
            payment_method='deferred', payment_status='unpaid', delivery_at=self.delivery,
            preparation_at=self.delivery-timedelta(hours=2), preparation_end_at=self.delivery-timedelta(minutes=90),
            preparation_plan=dict(needs_review=False, tasks=[]))
        self.url = f'/api/orders/{self.order.pk}/payment-choice/'
        self.request_id = str(uuid.uuid4())

    def choose(self, method='paypal', **extra):
        return self.client.post(self.url, dict(payment=method, request_id=self.request_id, **extra), format='json')

    def test_delivery_rejects_cash_even_with_forged_paid_status_without_losing_basket(self):
        line = CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        for method in ['standard', 'express']:
            response = self.client.post('/api/orders/place/', dict(address_id=self.address.pk, payment='cod',
                payment_status='paid', delivery_method=method, delivery_at=self.delivery.isoformat()), format='json')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIn('self-collection only', str(response.data))
        self.assertEqual(Order.objects.count(), 1)
        self.assertTrue(CartItem.objects.filter(pk=line.pk).exists())
        self.assertFalse(PaymentEvent.objects.exists())

    def test_cash_at_collection_still_works_and_ignores_forged_paid_status(self):
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        response = self.client.post('/api/orders/place/', dict(payment='cod', payment_status='paid',
            delivery_method='pickup', delivery_at=self.delivery.isoformat()), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        saved = Order.objects.get(pk=response.data['order_id'])
        self.assertEqual((saved.payment_method, saved.payment_status, saved.shipping_fee), ('cod', 'unpaid', 0))

    def test_review_request_is_deferred_without_instructions_debit_or_provider_call(self):
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        plan = dict(needs_review=True, start=None, end=None, tasks=[], minutes=0, hands_on_minutes=0,
            delivery_buffer_minutes=90, reason='Fixture owner review')
        with patch('myapp.services.scheduling.schedule_order', return_value=plan), patch('myapp.views.paypal.SandboxClient') as provider:
            response = self.client.post('/api/orders/place/', dict(payment='deferred', address_id=self.address.pk,
                delivery_at=self.delivery.isoformat()), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        saved = Order.objects.get(pk=response.data['order_id'])
        self.assertEqual((saved.payment_method, saved.payment_status, saved.payment_instructions), ('deferred', 'unpaid', {}))
        self.assertIsNone(saved.preparation_at); provider.assert_not_called()
        self.assertFalse(PaymentEvent.objects.exists())

    def test_scheduled_order_cannot_use_review_only_payment(self):
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        response = self.client.post('/api/orders/place/', dict(payment='deferred', address_id=self.address.pk,
            delivery_at=self.delivery.isoformat()), format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Order.objects.count(), 1)
        self.assertTrue(CartItem.objects.exists())

    def test_options_are_private_configured_and_exclude_delivery_cash_and_wallet(self):
        before = copy.deepcopy(self.order.__dict__)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([o['id'] for o in response.data['options']], ['paypal', 'manual'])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertNotIn('fixture-secret', str(response.data))
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_instructions, before['payment_instructions'])
        self.assertFalse(PaymentEvent.objects.exists())

    def test_own_order_and_csrf_required_including_staff(self):
        for user in [self.other, self.owner]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url).status_code, 404)
            self.assertEqual(self.choose().status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.choose().status_code, [401, 403])
        csrf_client = APIClient(enforce_csrf_checks=True); csrf_client.force_login(self.buyer)
        self.assertEqual(csrf_client.post(self.url, dict(payment='paypal', request_id=self.request_id), format='json').status_code, 403)
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_method, 'deferred')

    def test_ineligible_plan_or_status_cannot_select_payment(self):
        initial = dict(preparation_plan=self.order.preparation_plan, delivery_at=self.order.delivery_at,
            preparation_at=self.order.preparation_at, preparation_end_at=self.order.preparation_end_at,
            payment_status='unpaid', status='pending')
        for change in [dict(preparation_plan=dict(needs_review=True)), dict(preparation_at=None),
                dict(preparation_end_at=None), dict(status='cancelled'), dict(payment_status='paid'),
                dict(delivery_at=timezone.now()-timedelta(hours=1))]:
            Order.objects.filter(pk=self.order.pk).update(**{**initial, **change})
            self.assertEqual(self.client.get(self.url).data['options'], [])
            self.assertEqual(self.choose().status_code, 400, change)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_choice_is_once_only_retry_safe_and_does_not_charge_or_change_total(self):
        with patch('myapp.views.paypal.SandboxClient') as provider:
            first = self.choose(amount='0.01', payment_status='paid')
            self.assertEqual(first.status_code, 200, first.data)
            self.assertEqual(self.choose().data, first.data)
            provider.assert_not_called()
        self.order.refresh_from_db()
        self.assertEqual((self.order.total_amount+self.order.shipping_fee, self.order.payment_status), (Decimal('29.00'), 'unpaid'))
        self.assertEqual(self.order.payment_instructions['payment_selection']['request_id'], self.request_id)
        self.request_id = str(uuid.uuid4())
        self.assertEqual(self.choose('manual').status_code, 400)
        self.assertEqual(self.client.get(self.url).status_code, 400)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_manual_details_snapshot_and_collection_cash(self):
        self.assertEqual(self.choose('manual').status_code, 200)
        self.store.bank_transfer_instructions = 'Updated fixture'; self.store.save()
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_instructions['instructions'], 'Fictional bank details')
        Order.objects.filter(pk=self.order.pk).update(payment_method='deferred', payment_instructions={}, delivery_method='pickup')
        self.assertIn('cod', [o['id'] for o in self.client.get(self.url).data['options']])
        self.assertEqual(self.choose('cod').status_code, 200)

    def test_disabled_methods_and_delivery_cash_fail_closed(self):
        self.assertEqual(self.choose('cod').status_code, 400)
        with override_settings(PAYPAL_SANDBOX_ENABLED=False):
            self.assertEqual(self.choose('paypal').status_code, 400)
        self.store.manual_payment_enabled = False; self.store.save()
        self.assertEqual(self.choose('manual').status_code, 400)
        self.order.refresh_from_db(); self.assertEqual(self.order.payment_method, 'deferred')

    def test_selected_paypal_uses_existing_server_verified_capture_flow(self):
        from .test_paypal import FakePayPal
        provider = FakePayPal()
        self.assertEqual(self.choose().status_code, 200)
        with patch('myapp.views.paypal.SandboxClient', return_value=provider):
            url = f'/api/orders/{self.order.pk}/paypal/'
            started = self.client.post(url, dict(action='create'), format='json')
            self.assertEqual(started.status_code, 200, started.data)
            provider_id = started.data['paypal_order_id']
            provider.records[provider_id]['status'] = 'APPROVED'
            result = self.client.post(url, dict(action='capture', paypal_order_id=provider_id), format='json')
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(result.data['payment_status'], 'paid')
            self.assertEqual(self.choose().data['payment_status'], 'paid')
        self.assertEqual(PaymentEvent.objects.count(), 1)
        self.assertEqual(PaymentEvent.objects.get().amount, Decimal('29.00'))

    def test_owner_cannot_record_receipt_before_customer_selects_payment(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/admin/orders/{self.order.pk}/payments/', dict(request_id=str(uuid.uuid4()),
            kind='receipt', outcome='completed', reference='Unconfirmed choice'), format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(PaymentEvent.objects.exists())
