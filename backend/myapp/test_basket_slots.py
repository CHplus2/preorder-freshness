"""Customer suggestions explain constraints without relaxing checkout rules."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import OperationalError
from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from .models import CartItem, KitchenBlock, Order, OrderItem, Product, Storefront


class BasketSlotTests(TestCase):
    def setUp(self):
        self.now = parse_datetime('2026-10-19T09:00:00+08:00')
        clock = patch('django.utils.timezone.now', return_value=self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.customer = User.objects.create_user('slot-customer')
        self.client = APIClient()
        self.client.force_authenticate(self.customer)
        self.store = Storefront.objects.create(pk=1)
        self.cookies = Product.objects.create(name='Chocolate Chip Cookies - Pack of 6',
            price=10, lead_hours=24, daily_capacity=10, max_early_minutes=0,
            preparation_minutes=60, batch_size=5, additional_batch_minutes=30,
            packing_minutes_per_portion=1)
        self.line = CartItem.objects.create(user=self.customer, product=self.cookies, quantity=12)

    def search(self, date='2026-10-19'):
        return self.client.post('/api/orders/slots/', {'date': date}, format='json')

    def test_twelve_cookie_packs_explain_daily_limit_even_on_later_dates(self):
        for date in ['2026-10-19', '2026-10-22']:
            response = self.search(date)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['slots'], [])
            self.assertIn('12 requested + 0 already booked; daily limit 10', response.data['unavailable_reason'])
            self.assertIn('separate deliveries', response.data['unavailable_reason'])
        self.assertFalse(Order.objects.exists())

    def test_same_day_under_daily_limit_explains_advance_notice(self):
        self.line.quantity = 10
        self.line.save()
        response = self.search()
        self.assertEqual(response.data['slots'], [])
        self.assertIn('advance notice', response.data['unavailable_reason'])
        self.assertIn('20 Oct 2026, 09:00 AM Malaysia time', response.data['unavailable_reason'])
        self.assertIn('90 minutes for delivery', response.data['unavailable_reason'])

    def test_reduced_quantity_on_later_day_has_recheckable_suggestions(self):
        self.line.quantity = 10
        self.line.save()
        response = self.search('2026-10-20')
        self.assertTrue(response.data['slots'], response.data)
        self.assertEqual(response.data['unavailable_reason'], '')
        for slot in response.data['slots']:
            self.assertGreaterEqual(parse_datetime(slot['preparation_at']), self.now+timedelta(hours=24))
            quote = self.client.post('/api/orders/quote/', {'delivery_at': slot['delivery_at']}, format='json')
            self.assertEqual(quote.status_code, 200, quote.data)
            self.assertFalse(quote.data.get('needs_review', False))
        self.assertFalse(Order.objects.exists())

    def test_existing_bookings_are_counted_in_explanation(self):
        self.line.quantity = 8
        self.line.save()
        order = Order.objects.create(user=self.customer,
            delivery_at=parse_datetime('2026-10-20T15:00:00+08:00'))
        OrderItem.objects.create(order=order, product=self.cookies,
            product_name=self.cookies.name, quantity=3, unit_price=10, subtotal=30)
        response = self.search('2026-10-20')
        self.assertEqual(response.data['slots'], [])
        self.assertIn('8 requested + 3 already booked; daily limit 10', response.data['unavailable_reason'])

    def test_nine_pm_is_suggested_when_it_is_the_only_feasible_hour(self):
        self.line.quantity = 1
        self.line.save()
        self.cookies.lead_hours = 1
        self.cookies.save()
        day = self.now+timedelta(days=1)
        KitchenBlock.objects.create(start_at=day.replace(hour=8), end_at=day.replace(hour=18), reason='Kitchen booked')
        response = self.search('2026-10-20')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([timezone.localtime(parse_datetime(s['delivery_at'])).hour for s in response.data['slots']], [21])
        quote = self.client.post('/api/orders/quote/', {'delivery_at': response.data['slots'][0]['delivery_at']}, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertFalse(quote.data.get('needs_review', False))

    def test_no_suggestions_does_not_relax_two_zero_holding_recipes(self):
        self.line.quantity = 1
        self.line.save()
        brownies = Product.objects.create(name='Walnut Brownies - Box of 6', price=18,
            lead_hours=24, max_early_minutes=0, preparation_minutes=60, packing_minutes_per_portion=15)
        CartItem.objects.create(user=self.customer, product=brownies, quantity=1)
        response = self.search('2026-10-21')
        self.assertEqual(response.data['slots'], [])
        self.assertIn('early-finish limit', response.data['unavailable_reason'])
        quote = self.client.post('/api/orders/quote/', {'delivery_at': '2026-10-21T18:00:00+08:00'}, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertTrue(quote.data['needs_review'])
        self.assertFalse(quote.data['tasks'])
        self.assertFalse(Order.objects.exists())

    def test_database_failure_is_not_reported_as_no_available_slots(self):
        with patch('myapp.services.scheduling.schedule_order', side_effect=OperationalError('private connection info')):
            with self.assertLogs('myapp.exceptions', level='ERROR'):
                response = self.search()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private connection info', str(response.data))
        self.assertNotIn('slots', response.data)
