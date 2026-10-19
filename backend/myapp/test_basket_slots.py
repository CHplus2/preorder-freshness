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
        self.assertEqual(response.data['unavailable_code'], 'simultaneous_finish')
        self.assertIn('Walnut Brownies', response.data['unavailable_reason'])
        self.assertIn('exactly at dispatch', response.data['unavailable_reason'])
        next_day = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        self.assertEqual(next_day.data['unavailable_code'], 'simultaneous_finish')
        self.assertEqual(next_day.data['searched_days'], 1)
        quote = self.client.post('/api/orders/quote/', {'delivery_at': '2026-10-21T18:00:00+08:00'}, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertTrue(quote.data['needs_review'])
        self.assertFalse(quote.data['tasks'])
        self.assertFalse(Order.objects.exists())

    def test_bakery_recipes_need_finish_flexibility_not_more_calendar_days(self):
        # Reproduce the published demo recipes, including two cookie batches.
        def steps(durations, names):
            resources = ['prep_table', 'oven', 'oven', 'oven', 'none', 'packing_area']
            return [dict(name=name, minutes=minutes, additional_batch_minutes=minutes,
                worker=i not in [2, 4], resource=resources[i], max_wait_minutes=0)
                for i, (minutes, name) in enumerate(zip(durations, names))]
        self.cookies.preparation_tasks = steps([25, 15, 20, 5, 45, 15],
            ['Mix dough', 'Load cookies', 'Bake cookies', 'Unload cookies', 'Cool cookies', 'Count, label and pack'])
        self.cookies.save()
        self.line.quantity = 10
        self.line.save()
        brownies = Product.objects.create(name='Walnut Brownies - Box of 6', price=18,
            lead_hours=24, max_early_minutes=0, batch_size=4, daily_capacity=8,
            preparation_tasks=steps([25, 15, 30, 5, 75, 15],
                ['Mix batter', 'Load brownies', 'Bake brownies', 'Unload brownies', 'Cool brownies', 'Cut and box']))
        CartItem.objects.create(user=self.customer, product=brownies, quantity=1)
        failed = self.search('2026-10-21')
        self.assertEqual(failed.data['unavailable_code'], 'simultaneous_finish')
        self.assertIn('Count, label and pack', failed.data['unavailable_reason'])
        self.assertIn('Cut and box', failed.data['unavailable_reason'])
        # A hypothetical reviewed allowance in this isolated test can make the
        # same basket feasible. This is not a recommended real holding limit.
        brownies.max_early_minutes = 300
        brownies.save()
        found = self.search('2026-10-21')
        self.assertTrue(found.data['slots'], found.data)
        self.assertEqual(found.data['unavailable_code'], '')
        quote = self.client.post('/api/orders/quote/',
            {'delivery_at': found.data['slots'][0]['delivery_at']}, format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertFalse(quote.data.get('needs_review', False))
        self.cookies.refresh_from_db()
        self.assertEqual(self.cookies.max_early_minutes, 0)
        self.assertFalse(Order.objects.exists())

    def test_finish_rule_detection_only_rejects_shared_resources(self):
        from .services.scheduling import validate_finish_rules
        def line(name, resource, worker):
            return dict(menu=name, max_early_minutes=0,
                tasks=[dict(name='Rest', minutes=15, worker=worker, resource=resource)])
        # Two unattended, independent endings can legitimately coincide.
        validate_finish_rules([line('One', 'none', False), line('Two', 'none', False)])
        validate_finish_rules([line('One', 'oven', False), line('Two', 'fridge', False)])
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as caught:
            validate_finish_rules([line('One', 'oven', False), line('Two', 'oven', False)])
        self.assertEqual(caught.exception.detail[0].code, 'simultaneous_finish')
        self.assertIn('same oven', str(caught.exception.detail))

    def test_database_failure_is_not_reported_as_no_available_slots(self):
        with patch('myapp.services.scheduling.schedule_order', side_effect=OperationalError('private connection info')):
            with self.assertLogs('myapp.exceptions', level='ERROR'):
                response = self.search()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private connection info', str(response.data))
        self.assertNotIn('slots', response.data)

    def test_next_day_search_skips_notice_and_returns_a_recheckable_time(self):
        self.now = parse_datetime('2026-10-19T15:27:00+08:00')
        with patch('django.utils.timezone.now', return_value=self.now):
            self.line.quantity = 1
            self.line.save()
            response = self.client.post('/api/orders/slots/', {'date': '2026-10-19', 'find_next': True}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['suggested_date'], '2026-10-20')
            self.assertEqual(parse_datetime(response.data['earliest_preparation_at']), self.now+timedelta(hours=24))
            self.assertEqual(response.data['searched_days'], 1)
            slot = response.data['slots'][0]
            self.assertGreaterEqual(parse_datetime(slot['preparation_at']), self.now+timedelta(hours=24))
            quote = self.client.post('/api/orders/quote/', {'delivery_at': slot['delivery_at']}, format='json')
            self.assertEqual(quote.status_code, 200, quote.data)
            self.assertFalse(quote.data.get('needs_review', False))
        self.assertFalse(Order.objects.exists())

    def test_next_search_without_date_respects_weekdays_and_skips_closures(self):
        self.line.quantity = 1
        self.line.save()
        self.cookies.delivery_weekdays = [2]  # Wednesday, 21 October.
        self.cookies.save()
        response = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        self.assertEqual(response.data['suggested_date'], '2026-10-21')
        self.assertEqual(response.data['searched_days'], 2)
        KitchenBlock.objects.create(start_at=parse_datetime('2026-10-21T00:00:00+08:00'),
            end_at=parse_datetime('2026-10-22T00:00:00+08:00'), reason='Closed Wednesday')
        blocked = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        self.assertEqual(blocked.data['slots'], [])
        self.assertEqual(blocked.data['searched_days'], 7)
        self.assertEqual(blocked.data['searched_from'], '2026-10-20')
        self.assertEqual(blocked.data['searched_through'], '2026-10-26')

    def test_next_search_never_solves_quantity_limit_by_changing_date(self):
        response = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        self.assertEqual(response.data['slots'], [])
        self.assertIn('daily limit 10', response.data['unavailable_reason'])
        self.assertLessEqual(response.data['searched_days'], 7)
        self.assertFalse(Order.objects.exists())

    def test_hourly_checks_share_three_read_queries_and_match_fresh_scheduling(self):
        from .services.discovery import slot_search
        from .services.scheduling import schedule_order
        from rest_framework.exceptions import ValidationError
        from datetime import datetime, time
        self.line.quantity = 1
        self.line.save()
        day = timezone.localdate()+timedelta(days=3)
        items = list(CartItem.objects.filter(user=self.customer).select_related('product'))
        KitchenBlock.objects.create(start_at=timezone.make_aware(datetime.combine(day, time(9))),
            end_at=timezone.make_aware(datetime.combine(day, time(12))), reason='Morning closure')
        with self.assertNumQueries(3):
            response = slot_search(items, day, self.store, limit=13)
        expected = []
        for hour in range(9, 22):
            delivery = timezone.make_aware(datetime.combine(day, time(hour)))
            try:
                plan = schedule_order(items, delivery, self.store, now=self.now)
            except ValidationError:
                continue
            expected.append((delivery.isoformat(), plan['start'].isoformat()))
        self.assertEqual([(s['delivery_at'], s['preparation_at']) for s in response['slots']], expected)

    def test_suggestions_are_not_reservations_checkout_rechecks_new_bookings(self):
        self.line.quantity = 10
        self.line.save()
        response = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        slot = response.data['slots'][0]
        delivery = parse_datetime(slot['delivery_at'])
        order = Order.objects.create(user=self.customer, delivery_at=delivery)
        OrderItem.objects.create(order=order, product=self.cookies, product_name=self.cookies.name,
            quantity=1, unit_price=10, subtotal=10)
        quote = self.client.post('/api/orders/quote/', {'delivery_at': slot['delivery_at']}, format='json')
        self.assertEqual(quote.status_code, 400)
        self.assertIn('daily limit 10', str(quote.data))
        self.assertEqual(Order.objects.count(), 1)

    def test_next_search_is_bounded_by_the_ninety_day_booking_window(self):
        self.line.quantity = 1
        self.line.save()
        self.cookies.lead_hours = 90*24
        self.cookies.save()
        response = self.client.post('/api/orders/slots/', {'find_next': True}, format='json')
        self.assertEqual(response.data['slots'], [])
        self.assertEqual(response.data['searched_days'], 0)
        self.assertIn('90-day booking window', response.data['unavailable_reason'])
        self.assertEqual(self.client.post('/api/orders/slots/', {}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/orders/slots/', {'find_next':'maybe'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/orders/slots/', {'find_next':True, 'date':'2027-10-19'}, format='json').status_code, 400)
