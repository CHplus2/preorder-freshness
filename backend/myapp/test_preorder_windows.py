"""Real trading-window boundaries; fictional isolated records, no live payments."""
import json
from datetime import datetime, time, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import Address, CartItem, Order, Product, Storefront
from .serializers import ProductSerializer
from .services.commitments import preparation_snapshot, scheduled_item
from .services.discovery import next_basket_slots, slot_search
from .services.scheduling import schedule_order


class PreorderWindowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.now = timezone.make_aware(datetime(2030, 1, 7, 16, 59))
        self.delivery = (self.now+timedelta(days=1)).replace(hour=12, minute=0)
        self.store = Storefront.objects.create(manual_payment_enabled=True, bank_transfer_instructions='Fictional test bank details', pk=1)
        self.menu = Product.objects.create(name='Daily lunch', price=10, lead_hours=1,
            preparation_minutes=30, packing_minutes_per_portion=0, max_early_minutes=0)
        self.item = SimpleNamespace(product=self.menu, product_id=self.menu.pk, quantity=1)
        self.buyer = User.objects.create_user('preorder-window-buyer')
        self.owner = User.objects.create_user('preorder-window-owner', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.buyer)
        self.address = Address.objects.create(user=self.buyer, line1='Fictional address', city='Kuching',
            state='Sarawak', postal_code='93000', phone='0100000000')
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)

    def plan(self, delivery=None, now=None, **kwargs):
        return schedule_order([self.item], delivery or self.delivery, self.store, now=now or self.now, **kwargs)

    def test_optional_defaults_preserve_regular_ordering(self):
        self.assertEqual(self.menu.delivery_dates, [])
        self.assertIsNone(self.menu.order_cutoff_time)
        self.assertTrue(self.plan()['tasks'])

    def test_previous_day_cutoff_closes_at_boundary_in_malaysia_time(self):
        self.menu.order_cutoff_time = time(17)
        self.assertTrue(self.plan()['tasks'])
        utc_now = (self.now+timedelta(minutes=1)).astimezone(dt_timezone.utc)
        with self.assertRaisesMessage(ValidationError, 'closed at 07 Jan 2030, 05:00 PM Malaysia time'):
            self.plan(now=utc_now, allow_manual_review=True, allow_request_exceptions=True)
        # The following offered day remains open.
        self.assertTrue(self.plan(self.delivery+timedelta(days=1), now=utc_now)['tasks'])

    def test_same_day_cutoff_and_cooking_notice_are_independent(self):
        self.menu.order_cutoff_days_before = 0
        self.menu.order_cutoff_time = time(10)
        early = self.delivery.replace(hour=9)
        self.assertTrue(self.plan(now=early)['tasks'])
        with self.assertRaisesMessage(ValidationError, 'closed at'):
            self.plan(now=early.replace(hour=10))
        self.menu.lead_hours = 24
        with self.assertRaisesMessage(ValidationError, 'advance notice'):
            self.plan(now=early)

    def test_fixed_sale_dates_and_weekdays_both_apply(self):
        self.menu.delivery_dates = [self.delivery.date().isoformat()]
        self.assertTrue(self.plan()['tasks'])
        with self.assertRaisesMessage(ValidationError, 'offered only'):
            self.plan(self.delivery+timedelta(days=1), allow_manual_review=True, allow_request_exceptions=True)
        self.menu.delivery_weekdays = [(self.delivery.weekday()+1)%7]
        with self.assertRaisesMessage(ValidationError, 'is delivered on'):
            self.plan()

    def test_mixed_basket_cannot_combine_incompatible_sale_dates(self):
        self.menu.delivery_dates = [self.delivery.date().isoformat()]
        other = Product.objects.create(name='Seasonal box', price=20, lead_hours=1,
            delivery_dates=[(self.delivery+timedelta(days=10)).date().isoformat()])
        items = [self.item, SimpleNamespace(product=other, product_id=other.pk, quantity=1)]
        with patch('django.utils.timezone.now', return_value=self.now):
            result = next_basket_slots(items, None, self.store)
        self.assertEqual(result['unavailable_code'], 'no_common_date')
        self.assertEqual(result['slots'], [])
        with self.assertRaisesMessage(ValidationError, 'offered only'):
            schedule_order(items, self.delivery, self.store, now=self.now)

    def test_next_search_jumps_to_seasonal_date_beyond_next_week(self):
        target = self.delivery+timedelta(days=40)
        self.menu.delivery_dates = [target.date().isoformat()]
        with patch('django.utils.timezone.now', return_value=self.now):
            result = next_basket_slots([self.item], None, self.store)
        self.assertTrue(result['slots'])
        self.assertEqual(result['suggested_date'], target.date().isoformat())
        self.assertEqual(result['searched_days'], 1)
        self.assertEqual(slot_search([self.item], self.delivery.date(), self.store, now=self.now)['slots'], [])

    def test_only_expired_or_closed_sale_dates_return_clear_empty_result(self):
        self.menu.delivery_dates = [self.delivery.date().isoformat()]
        self.menu.order_cutoff_time = time(17)
        with patch('django.utils.timezone.now', return_value=self.now+timedelta(minutes=1)):
            result = next_basket_slots([self.item], None, self.store)
        self.assertEqual(result['slots'], [])
        self.assertEqual(result['unavailable_code'], 'no_common_date')

    def test_owner_search_jumps_to_next_open_accepted_sale_date(self):
        from .services.order_plan_search import next_order_plan
        target = self.delivery+timedelta(days=40)
        self.menu.delivery_dates = [self.delivery.date().isoformat(), target.date().isoformat()]
        self.menu.order_cutoff_time = time(17)
        order = Order.objects.create(user=self.buyer, delivery_at=self.delivery+timedelta(days=10))
        when, plan, search = next_order_plan([self.item], order, self.store, None, self.now+timedelta(minutes=1))
        self.assertEqual(when.date(), target.date())
        self.assertTrue(plan['tasks'])
        self.assertEqual(search['from_date'], target.date().isoformat())

    def test_customer_cannot_bypass_rules_with_custom_request_or_stale_basket(self):
        self.menu.delivery_dates = [(self.delivery+timedelta(days=1)).date().isoformat()]
        self.menu.save()
        body = dict(address_id=self.address.pk, delivery_at=self.delivery.isoformat(), payment='manual')
        with patch('django.utils.timezone.now', return_value=self.now):
            quote = self.client.post('/api/orders/quote/', {'delivery_at': self.delivery.isoformat()}, format='json')
            saved = self.client.post('/api/orders/place/', body, format='json')
        self.assertEqual(quote.status_code, 400, quote.data)
        self.assertEqual(saved.status_code, 400, saved.data)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(CartItem.objects.get().quantity, 1)

    def test_checkout_saves_serializable_accepted_rules_and_no_payment(self):
        self.menu.delivery_dates = [self.delivery.date().isoformat()]
        self.menu.order_cutoff_time = time(17)
        self.menu.save()
        with patch('django.utils.timezone.now', return_value=self.now):
            saved = self.client.post('/api/orders/place/', dict(address_id=self.address.pk,
                delivery_at=self.delivery.isoformat(), payment='manual'), format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        order = Order.objects.get()
        self.assertEqual(order.payment_status, 'unpaid')
        snapshot = order.items.get().preparation_snapshot
        self.assertEqual(snapshot['order_cutoff_time'], '17:00:00')
        self.assertEqual(snapshot['delivery_dates'], self.menu.delivery_dates)
        json.dumps(snapshot)

    def test_accepted_rules_and_original_notice_survive_later_menu_edits(self):
        self.menu.delivery_dates = [self.delivery.date().isoformat()]
        self.menu.order_cutoff_time = time(17)
        snapshot = preparation_snapshot(self.menu)
        accepted = SimpleNamespace(product_id=self.menu.pk, product_name=self.menu.name,
            product=self.menu, quantity=1, preparation_snapshot=snapshot)
        self.menu.delivery_dates = []
        later = self.now+timedelta(minutes=2)
        self.assertTrue(schedule_order([scheduled_item(accepted)], self.delivery, self.store,
            now=later, notice_from=self.now, exclude_order_id=99)['tasks'])
        with self.assertRaisesMessage(ValidationError, 'offered only'):
            schedule_order([scheduled_item(accepted)], self.delivery+timedelta(days=1), self.store,
                now=later, notice_from=later, exclude_order_id=99)
        for key in ['delivery_dates', 'order_cutoff_time', 'order_cutoff_days_before']:
            snapshot.pop(key)
        self.assertTrue(schedule_order([scheduled_item(accepted)], self.delivery+timedelta(days=1), self.store,
            now=later, exclude_order_id=99)['tasks'])

    def test_validation_rejects_invalid_dates_cutoffs_and_offset_ranges(self):
        cases = [{'delivery_dates': value} for value in [None, {}, '2030-01-08', [False],
            ['2030-02-30'], ['20300108'], ['2030-01-08']*2, ['2030-01-08']*91]]
        cases += [{'order_cutoff_time': value} for value in ['25:00', '17:00:01', '17:00:00.5', '17:00:00+08:00', '17:00Z']]
        cases += [{'order_cutoff_days_before': value} for value in [-1, 91, True, 1.5]]
        for payload in cases:
            with self.subTest(payload=payload):
                serializer = ProductSerializer(self.menu, data=payload, partial=True)
                self.assertFalse(serializer.is_valid(), payload)
        serializer = ProductSerializer(self.menu, data={'delivery_dates': ['2030-01-10', '2030-01-08'],
            'order_cutoff_time': '17:00', 'order_cutoff_days_before': 0}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['delivery_dates'], ['2030-01-08', '2030-01-10'])

    def test_owner_only_edits_and_public_menu_exposes_order_rules(self):
        url = f'/api/products/{self.menu.pk}/'
        payload = {'delivery_dates': [self.delivery.date().isoformat()], 'order_cutoff_time': '17:00'}
        self.assertEqual(self.client.patch(url, payload, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, payload, format='json').status_code, 200)
        self.client.force_authenticate(None)
        page = self.client.get('/api/menu/')
        self.assertEqual(page.status_code, 200, page.data)
        self.assertEqual(page.data['results'][0]['delivery_dates'], payload['delivery_dates'])
        self.assertEqual(page.data['results'][0]['order_cutoff_time'], '17:00:00')

    def test_guided_recommendations_do_not_offer_closed_or_wrong_date_menus(self):
        from .models import ProductIngredient, RawMaterial
        ingredient = RawMaterial.objects.create(name='Recipe fixture', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=ingredient, quantity_required=100)
        self.menu.delivery_dates = [(self.delivery+timedelta(days=1)).date().isoformat()]
        self.menu.save()
        payload = {'date': self.delivery.date().isoformat(), 'portions': 1}
        with patch('django.utils.timezone.now', return_value=self.now):
            response = self.client.post('/api/menu/guide/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['results'], [])
        self.menu.delivery_dates = [payload['date']]
        self.menu.order_cutoff_time = time(17)
        self.menu.save()
        with patch('django.utils.timezone.now', return_value=self.now):
            open_result = self.client.post('/api/menu/guide/', payload, format='json')
        self.assertEqual(open_result.status_code, 200, open_result.data)
        self.assertEqual([row['id'] for row in open_result.data['results']], [self.menu.pk])
        with patch('django.utils.timezone.now', return_value=self.now+timedelta(minutes=1)):
            closed = self.client.post('/api/menu/guide/', payload, format='json')
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data['results'], [])
