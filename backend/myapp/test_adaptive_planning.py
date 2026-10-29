"""Flexible finishing and review requests never promise unavailable capacity."""
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import Address, CartItem, KitchenBlock, Order, PaymentEvent, Product, Storefront, Wallet, WalletTransaction
from .services.scheduling import schedule_order


class AdaptivePlanningTests(TestCase):
    def setUp(self):
        self.now = parse_datetime('2026-10-19T08:00:00+08:00')
        clock = patch('django.utils.timezone.now', return_value=self.now)
        clock.start(); self.addCleanup(clock.stop)
        self.buyer = User.objects.create_user('adaptive-buyer')
        self.client = APIClient(); self.client.force_authenticate(self.buyer)
        self.store = Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1)
        self.menu = Product.objects.create(name='Flexible meal', price=10, lead_hours=24,
            daily_capacity=2, max_early_minutes=0, max_preparation_days=7,
            preparation_tasks=[dict(name='Prepare', minutes=20, worker=True, resource='prep_table', max_wait_minutes=0),
                dict(name='Pack', minutes=15, worker=True, resource='packing_area', max_wait_minutes=0)])
        self.address = Address.objects.create(user=self.buyer, line1='Test', city='KL', state='KL', postal_code='50000', phone='0100000000')
        self.line = CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        self.delivery = (self.now+timedelta(days=3)).replace(hour=18)

    def plan(self):
        item = SimpleNamespace(product=self.menu, product_id=self.menu.pk, quantity=1)
        return schedule_order([item], self.delivery, self.store, now=self.now)

    def place(self, delivery=None, payment='manual'):
        return self.client.post('/api/orders/place/', dict(address_id=self.address.pk,
            delivery_at=(delivery or self.delivery).isoformat(), payment=payment), format='json')

    def test_delivery_can_follow_kitchen_closing_without_late_cooking(self):
        self.store.kitchen_close_hour = 16
        plan = self.plan()  # Dispatch at 16:30; cooking closes at 16:00.
        self.assertEqual(timezone.localtime(plan['end']).hour, 16)
        self.assertEqual(timezone.localtime(plan['end']).minute, 0)
        self.assertLess(plan['end'], self.delivery-timedelta(minutes=90))
        for task in plan['tasks']:
            self.assertLessEqual(parse_datetime(task['end']), self.delivery.replace(hour=16))

    def test_flexible_finish_does_not_silently_allow_previous_day_completion(self):
        KitchenBlock.objects.create(start_at=self.delivery.replace(hour=8),
            end_at=self.delivery.replace(hour=20), reason='Closed on dispatch day')
        with self.assertRaises(ValidationError):
            self.plan()
        self.menu.max_early_minutes = 1440  # Explicit earlier-day permission.
        plan = self.plan()
        self.assertLess(timezone.localtime(plan['end']).date(), timezone.localtime(self.delivery).date())
        self.assertGreaterEqual(plan['end'], self.delivery-timedelta(minutes=90, days=1))

    def test_short_notice_request_is_unpaid_and_reserves_no_tasks(self):
        delivery = self.now.replace(hour=18)
        strict = self.client.post('/api/orders/slots/', {'date': str(timezone.localdate(delivery))}, format='json')
        self.assertFalse(strict.data['slots'])
        quote = self.client.post('/api/orders/quote/', {'delivery_at': delivery.isoformat()}, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertTrue(quote.data['needs_review']); self.assertFalse(quote.data['tasks'])
        self.assertIn('advance notice', quote.data['review_reason'])
        wallet = Wallet.objects.create(user=self.buyer, balance=100, wallet_address='isolated-adaptive-wallet')
        result = self.place(delivery, payment='wallet')
        self.assertEqual(result.status_code, 201, result.data)
        order = Order.objects.get()
        self.assertEqual(order.payment_method, 'deferred'); self.assertEqual(order.payment_status, 'unpaid')
        self.assertTrue(order.preparation_plan['needs_review']); self.assertFalse(order.preparation_plan['tasks'])
        self.assertIsNone(order.preparation_at); self.assertIsNone(order.preparation_end_at)
        wallet.refresh_from_db(); self.assertEqual(wallet.balance, Decimal('100'))
        self.assertFalse(WalletTransaction.objects.exists()); self.assertFalse(PaymentEvent.objects.exists())
        self.assertFalse(order.inventory_deducted)

    def test_over_limit_request_does_not_block_another_feasible_booking(self):
        self.line.quantity = 3; self.line.save()
        request = self.place()
        self.assertEqual(request.status_code, 201, request.data)
        review = Order.objects.get()
        self.assertTrue(review.preparation_plan['needs_review'])
        self.assertFalse(review.preparation_plan['tasks'])
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=2)
        search = self.client.post('/api/orders/slots/', {'date': str(timezone.localdate(self.delivery))}, format='json')
        self.assertTrue(search.data['slots'], search.data)
        booking = self.place()
        self.assertEqual(booking.status_code, 201, booking.data)
        accepted = Order.objects.get(pk=booking.data['order_id'])
        self.assertFalse(accepted.preparation_plan.get('needs_review', False))
        self.assertTrue(accepted.preparation_plan['tasks'])
        # Accepted quantities count; the original unaccepted request still does not.
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        full = self.client.post('/api/orders/slots/', {'date': str(timezone.localdate(self.delivery))}, format='json')
        self.assertFalse(full.data['slots'])
        self.assertIn('2 already booked', full.data['unavailable_reason'])
        self.assertNotIn('5 already booked', full.data['unavailable_reason'])

    def test_invalid_or_unoffered_times_still_cannot_be_submitted(self):
        for delivery in [self.now-timedelta(minutes=1), self.delivery.replace(hour=7),
                self.delivery.replace(hour=22), self.delivery+timedelta(days=100)]:
            result = self.place(delivery)
            self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Order.objects.exists())
        self.assertTrue(CartItem.objects.filter(pk=self.line.pk).exists())
