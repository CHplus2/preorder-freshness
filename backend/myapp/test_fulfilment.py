"""Fictional collection/delivery operations, shared scheduling and payment totals."""
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Address, CartItem, InventoryItem, Order, Product, ProductIngredient,
                     RawMaterial, Storefront, Wallet, PaymentEvent)
from .services.fulfilment import request_store
from .services.scheduling import schedule_order


class FulfilmentTests(TestCase):
    def setUp(self):
        cache.clear()
        self.now = timezone.make_aware(datetime(2030, 1, 7, 10))
        self.day = self.now+timedelta(days=3)
        self.store = Storefront.objects.create(pk=1, pickup_enabled=True,
            pickup_location='Fictional collection point, Kuching', pickup_instructions='Collect at the front counter.',
            pickup_open_hour=7, pickup_close_hour=14, delivery_open_hour=9, delivery_close_hour=12,
            delivery_areas=['Batu Kawa', 'Moyan'], delivery_fee_myr=7, free_delivery_minimum_myr=60)
        self.buyer = User.objects.create_user('fulfilment-buyer')
        self.other = User.objects.create_user('fulfilment-other')
        self.owner = User.objects.create_user('fulfilment-owner', is_staff=True)
        self.client = APIClient(); self.client.force_authenticate(self.buyer)
        self.menu = Product.objects.create(name='Fictional collection meal', price=12, lead_hours=1,
            batch_size=10, max_early_minutes=1440, preparation_tasks=[dict(name='Cook and pack',
                minutes=30, additional_batch_minutes=10, resource='stove', worker=True, max_wait_minutes=0)])
        self.material = RawMaterial.objects.create(name='Recipe test rice', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=self.material, quantity_required=100)
        self.cart = CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        self.address = Address.objects.create(user=self.buyer, line1='Fictional delivery address',
            city='Kuching', state='Sarawak', postal_code='93000', phone='0100000000')
        self.foreign = Address.objects.create(user=self.other, line1='Other fictional address',
            city='Kuching', state='Sarawak', postal_code='93000', phone='0100000000')
        self.clock = patch('django.utils.timezone.now', return_value=self.now)
        self.clock.start(); self.addCleanup(self.clock.stop)

    def body(self, method='pickup', hour=12, **extra):
        return dict(delivery_at=self.day.replace(hour=hour).isoformat(), delivery_method=method,
            payment='cod', **extra)

    def place(self, **extra):
        return self.client.post('/api/orders/place/', self.body(**extra), format='json')

    def test_pickup_ignores_client_fee_and_needs_no_address_or_travel_buffer(self):
        response = self.place(shipping_fee='999', address_id=self.foreign.pk)
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get()
        self.assertEqual(order.shipping_fee, 0)
        self.assertIsNone(order.address)
        self.assertEqual(order.delivery_address, {})
        self.assertEqual(order.fulfilment_snapshot['pickup_location'], self.store.pickup_location)
        self.assertEqual(order.fulfilment_snapshot['buffer_minutes'], 0)
        self.assertEqual(order.preparation_plan['delivery_buffer_minutes'], 0)
        self.assertEqual(order.payment_status, 'unpaid')
        self.assertEqual(order.preparation_end_at, order.delivery_at)
        listed = self.client.get('/api/orders/').data
        row = listed['results'][0] if isinstance(listed, dict) else listed[0]
        self.assertIsNone(row['address'])
        self.assertEqual(row['delivery_method'], 'pickup')

    def test_pickup_slots_include_7am_when_accepted_preparation_allows_previous_day(self):
        response = self.client.post('/api/orders/slots/', dict(date=str(self.day.date()), delivery_method='pickup'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        times = [timezone.localtime(datetime.fromisoformat(s['delivery_at'])).hour for s in response.data['slots']]
        self.assertEqual(times, list(range(7, 15)))
        self.assertEqual(response.data['slots'][0]['preparation_end_at'][:10], str((self.day-timedelta(days=1)).date()))

    def test_lunch_delivery_hours_and_collection_hours_are_hard_rules_for_requests(self):
        for method, hour in [('pickup', 6), ('pickup', 15), ('standard', 8), ('standard', 13)]:
            response = self.client.post('/api/orders/place/', self.body(method, hour,
                address_id=self.address.pk, delivery_area='Moyan'), format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Order.objects.exists())
        for method, hour in [('pickup', 14), ('standard', 12)]:
            response = self.client.post('/api/orders/quote/', self.body(method, hour, delivery_area='Moyan'), format='json')
            self.assertEqual(response.status_code, 200, response.data)

    def test_delivery_requires_own_address_and_a_configured_area(self):
        for extra in [dict(delivery_area='Moyan'), dict(address_id=self.foreign.pk, delivery_area='Moyan'),
                      dict(address_id=self.address.pk), dict(address_id=self.address.pk, delivery_area='Other place')]:
            response = self.place(method='standard', **extra)
            self.assertIn(response.status_code, [400, 404], response.data)
        self.assertFalse(Order.objects.exists())
        response = self.place(method='standard', address_id=self.address.pk, delivery_area='Moyan', shipping_fee=0)
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get()
        self.assertEqual(order.shipping_fee, 7)
        self.assertEqual(order.fulfilment_snapshot['delivery_area'], 'Moyan')
        self.assertEqual(order.fulfilment_snapshot['buffer_minutes'], 90)

    def test_custom_fee_free_threshold_and_wallet_debit_match_saved_total(self):
        self.cart.quantity = 5; self.cart.save()
        wallet = Wallet.objects.create(user=self.buyer, wallet_address='fictional-fulfilment-wallet', balance=100)
        body = self.body('standard', address_id=self.address.pk, delivery_area='Batu Kawa')
        body['payment'] = 'wallet'
        response = self.client.post('/api/orders/place/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(); wallet.refresh_from_db()
        self.assertEqual(order.shipping_fee, 0)
        self.assertEqual(order.total_amount, 60)
        self.assertEqual(wallet.balance, 40)
        self.assertEqual(order.payment_status, 'paid')

    def test_null_free_threshold_always_charges_delivery_fee(self):
        self.store.free_delivery_minimum_myr = None; self.store.save()
        self.cart.quantity = 5; self.cart.save()
        response = self.place(method='standard', address_id=self.address.pk, delivery_area='Moyan')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Order.objects.get().shipping_fee, 7)

    def test_duplicate_pickup_checkout_is_idempotent_and_records_no_payment(self):
        body = self.body(request_id=str(uuid.uuid4()))
        first = self.client.post('/api/orders/place/', body, format='json')
        second = self.client.post('/api/orders/place/', body, format='json')
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data['order_id'], second.data['order_id'])
        self.assertEqual(Order.objects.count(), 1)
        self.assertFalse(PaymentEvent.objects.exists())

    def test_disabled_methods_cannot_be_forced_and_both_off_closes_checkout(self):
        self.store.pickup_enabled = False; self.store.save()
        self.assertEqual(self.place().status_code, 400)
        self.store.delivery_enabled = False; self.store.save()
        self.assertEqual(self.place(method='standard', address_id=self.address.pk, delivery_area='Moyan').status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_pickup_does_not_bypass_recipe_lead_time_capacity_or_cutoffs(self):
        self.menu.delivery_dates = [str((self.day+timedelta(days=1)).date())]; self.menu.save()
        self.assertEqual(self.place().status_code, 400)
        self.menu.delivery_dates = []; self.menu.order_cutoff_time = '17:00'; self.menu.order_cutoff_days_before = 90; self.menu.save()
        self.assertEqual(self.place().status_code, 400)
        self.menu.order_cutoff_time = None; self.menu.daily_capacity = 1; self.menu.save()
        self.cart.quantity = 2; self.cart.save()
        quote = self.client.post('/api/orders/quote/', self.body(), format='json')
        self.assertEqual(quote.status_code, 200, quote.data)
        self.assertTrue(quote.data['needs_review'])
        self.assertIsNone(quote.data['preparation_at'])

    def test_pickup_and_delivery_share_worker_and_equipment_bookings(self):
        self.store.delivery_areas = []; self.store.delivery_close_hour = 21; self.store.save()
        first = self.place(hour=12)
        self.assertEqual(first.status_code, 201, first.data)
        booked = Order.objects.get()
        selected, _, _ = request_store(self.store, {'delivery_method': 'standard'})
        plan = schedule_order([self.cart], self.day.replace(hour=13, minute=30), selected, now=self.now)
        self.assertLessEqual(plan['end'], booked.preparation_at)

    def test_pickup_search_keeps_the_travel_buffer_of_older_delivery_bookings(self):
        from .services.scheduling import order_interval
        delivery = self.day.replace(hour=12)
        legacy = Order.objects.create(user=self.other, delivery_at=delivery,
            preparation_at=delivery-timedelta(hours=3), preparation_plan={}, fulfilment_snapshot={})
        selected, _, _ = request_store(self.store, {'delivery_method':'pickup'})
        _, end = order_interval(legacy, selected)
        self.assertEqual(end, delivery-timedelta(minutes=90))

    def test_owner_replanning_keeps_saved_location_hours_and_zero_buffer_after_store_changes(self):
        result = self.place(hour=7)
        self.assertEqual(result.status_code, 201, result.data)
        order = Order.objects.get(); original = order.fulfilment_snapshot.copy()
        self.store.pickup_enabled = False; self.store.pickup_open_hour = 10; self.store.pickup_close_hour = 11
        self.store.pickup_location = 'Changed location'; self.store.save()
        self.client.force_authenticate(self.owner)
        response = self.client.post(f'/api/admin/orders/{order.pk}/preparation-plan/',
            dict(delivery_at=(self.day+timedelta(days=1)).replace(hour=7).isoformat(), reason='Fictional agreed collection change'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['preview']['plan']['delivery_buffer_minutes'], 0)
        confirmed = self.client.post(f'/api/admin/orders/{order.pk}/preparation-plan/', {'confirm': response.data['confirm']}, format='json')
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        order.refresh_from_db()
        self.assertEqual(order.fulfilment_snapshot, original)

    def test_customer_collection_change_keeps_saved_terms_and_price(self):
        self.assertEqual(self.place().status_code, 201)
        order = Order.objects.get()
        response = self.client.post(f'/api/orders/{order.pk}/reschedule/', dict(
            delivery_at=(self.day+timedelta(days=2)).replace(hour=13).isoformat(), reason='Agreed collection change'), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        saved = self.client.post(f'/api/orders/{order.pk}/reschedule/', {'confirm':response.data['confirm']}, format='json')
        self.assertEqual(saved.status_code, 200, saved.data)
        order.refresh_from_db(); self.assertEqual(order.shipping_fee, 0)
        self.assertEqual(order.preparation_plan['delivery_buffer_minutes'], 0)

    def test_pickup_progress_deducts_stock_once_and_collected_uses_delivered_state(self):
        self.assertEqual(self.place().status_code, 201)
        order = Order.objects.get()
        batch = InventoryItem.objects.create(raw_material=self.material, quantity=500, received_date=self.now.date(), expiry_date=self.day.date())
        self.client.force_authenticate(self.owner)
        url = f'/api/admin/orders/{order.pk}/'
        self.assertEqual(self.client.patch(url, {'status':'cooked'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(url, {'status':'shipped'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'status':'delivered'}, format='json').status_code, 200)
        batch.refresh_from_db(); order.refresh_from_db()
        self.assertEqual(batch.quantity, 400)
        self.assertTrue(order.inventory_deducted)
        self.assertEqual(order.payment_status, 'unpaid')

    def test_pickup_escrow_is_explicitly_unavailable_without_changing_delivery_escrow(self):
        body = self.body(); body['payment'] = 'escrow'
        result = self.client.post('/api/orders/place/', body, format='json')
        self.assertEqual(result.status_code, 400, result.data)
        self.assertIn('delivery orders', str(result.data))

    def test_pickup_wallet_debits_food_only_without_an_address(self):
        wallet = Wallet.objects.create(user=self.buyer, wallet_address='fictional-pickup-wallet', balance=25)
        body = self.body(); body['payment'] = 'wallet'
        response = self.client.post('/api/orders/place/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        wallet.refresh_from_db(); order = Order.objects.get()
        self.assertEqual(wallet.balance, 13)
        self.assertEqual(order.shipping_fee, 0)
        self.assertIsNone(order.address)
        self.assertEqual(order.payment_status, 'paid')

    def test_pickup_paypal_verifies_food_total_without_delivery_fee(self):
        from .test_paypal import FakePayPal
        provider = FakePayPal()
        with override_settings(PAYPAL_SANDBOX_ENABLED=True, PAYPAL_SANDBOX_CLIENT_ID='fixture-id', PAYPAL_SANDBOX_CLIENT_SECRET='fixture-secret'), patch('myapp.views.paypal.SandboxClient', return_value=provider):
            body = self.body(); body['payment'] = 'paypal'
            saved = self.client.post('/api/orders/place/', body, format='json')
            self.assertEqual(saved.status_code, 201, saved.data)
            order = Order.objects.get()
            url = f'/api/orders/{order.pk}/paypal/'
            created = self.client.post(url, {'action':'create'}, format='json')
            self.assertEqual(created.status_code, 200, created.data)
            self.assertEqual(provider.creates[0]['amount'], '12.00')
            payment = created.data['paypal_order_id']; provider.records[payment]['status'] = 'APPROVED'
            captured = self.client.post(url, {'action':'capture', 'paypal_order_id':payment}, format='json')
            self.assertEqual(captured.status_code, 200, captured.data)
            order.refresh_from_db(); self.assertEqual(order.payment_status, 'paid')
            self.assertEqual(order.shipping_fee, 0)

    def test_settings_are_owner_only_and_validate_locations_hours_prices_and_areas(self):
        self.assertEqual(self.client.patch('/api/storefront/', {'pickup_enabled':False}, format='json').status_code, 403)
        self.client.force_authenticate(self.owner)
        invalid = [dict(pickup_location=''),dict(pickup_open_hour=14),dict(delivery_close_hour=8),
            dict(delivery_open_hour=-1),dict(pickup_close_hour=24),dict(delivery_fee_myr='-1'),
            dict(delivery_fee_myr='1.001'),dict(free_delivery_minimum_myr='NaN'),
            dict(delivery_areas=['Moyan','moyan']),dict(delivery_areas=['']),dict(delivery_areas='Moyan')]
        for payload in invalid:
            with self.subTest(payload=payload):
                response = self.client.patch('/api/storefront/', payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
        response = self.client.patch('/api/storefront/', dict(delivery_areas=[' Batu Kawa ', 'Moyan'], free_delivery_minimum_myr=None), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['delivery_areas'], ['Batu Kawa','Moyan'])

    def test_disabled_pickup_location_is_hidden_from_public_settings_but_retained_for_owner(self):
        self.store.pickup_enabled = False; self.store.save()
        public = self.client.get('/api/storefront/')
        self.assertEqual(public.data['pickup_location'], '')
        self.assertEqual(public.data['pickup_instructions'], '')
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/storefront/').data['pickup_location'], self.store.pickup_location)
