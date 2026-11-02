from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (Address, CartItem, Category, InventoryItem, Order, OrderItem, PaymentEvent,
                     Product, ProductIngredient, RawMaterial, Storefront, Wallet)
from .serializers import ProductSerializer
from .services.discovery import candidate_item, slot_search
from .services.scheduling import schedule_order


SHIPPING = dict(unit='box', ordering_mode='shipping_enquiry', dispatch_from='2030-12-01',
                dispatch_through='2030-12-31', shipping_note='Courier and costs agreed with the owner.')


class DailyOperationsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.now = timezone.make_aware(datetime(2030, 1, 7, 9))
        self.clock = patch('django.utils.timezone.now', return_value=self.now)
        self.clock.start(); self.addCleanup(self.clock.stop)
        self.buyer = User.objects.create_user('operations-buyer')
        self.owner = User.objects.create_user('operations-owner', is_staff=True)
        self.client = APIClient(); self.client.force_authenticate(self.buyer)
        self.store = Storefront.objects.create(pk=1, pickup_enabled=True, pickup_location='Fictional counter')
        self.category = Category.objects.create(name='Seasonal boxes')
        self.menu = Product.objects.create(name='Festive gift box', category=self.category, price=18,
            selling_details=SHIPPING.copy(), lead_hours=1, preparation_minutes=20,
            packing_minutes_per_portion=0, batch_size=10)
        self.material = RawMaterial.objects.create(name='Fixture flour', unit='g')
        ProductIngredient.objects.create(product=self.menu, raw_material=self.material, quantity_required=120)
        self.address = Address.objects.create(user=self.buyer, line1='Fictional address', city='Kuching',
            state='Sarawak', postal_code='93000', phone='0100000000')
        self.delivery = (self.now+timedelta(days=3)).replace(hour=15)

    def test_dispatch_window_normalizes_to_json_dates_and_is_public(self):
        serializer = ProductSerializer(self.menu, data={'selling_details': SHIPPING}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save(); saved.refresh_from_db()
        self.assertEqual(saved.selling_details['dispatch_from'], '2030-12-01')
        self.assertEqual(self.client.get(f'/api/products/{self.menu.pk}/').data['selling_details']['ordering_mode'], 'shipping_enquiry')

    def test_invalid_shipping_settings_are_rejected(self):
        for change in [dict(ordering_mode='unknown'), dict(dispatch_from=None), dict(dispatch_through='2029-01-01'),
                       dict(dispatch_through='2032-12-01'), dict(shipping_note='x'*301), dict(dispatch_from='2030-02-30')]:
            with self.subTest(change=change):
                serializer = ProductSerializer(self.menu, data={'selling_details': {**SHIPPING, **change}}, partial=True)
                self.assertFalse(serializer.is_valid())

    def test_shipping_offer_cannot_be_added_to_cart_or_via_assistant(self):
        for endpoint, body in [('/api/cart/', dict(product_id=self.menu.pk, quantity=2)),
                               ('/api/help/cart/', dict(product_id=self.menu.pk, quantity=2))]:
            result = self.client.post(endpoint, body, format='json')
            self.assertEqual(result.status_code, 400, result.data)
            self.assertIn('shipping enquiry', str(result.data).lower())
        self.assertFalse(CartItem.objects.exists())

    def test_stale_cart_cannot_create_order_payment_or_reservation(self):
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=2)
        wallet = Wallet.objects.create(user=self.buyer, wallet_address='fictional-operations-wallet', balance=100)
        for payment in ['wallet', 'cod', 'paypal', 'manual', 'escrow']:
            result = self.client.post('/api/orders/place/', dict(delivery_at=self.delivery.isoformat(),
                address_id=self.address.pk, payment=payment), format='json')
            self.assertEqual(result.status_code, 400, result.data)
        wallet.refresh_from_db(); self.assertEqual(wallet.balance, 100)
        self.assertFalse(Order.objects.exists()); self.assertFalse(PaymentEvent.objects.exists())

    def test_stale_cart_can_be_reduced_or_removed_but_not_increased(self):
        item = CartItem.objects.create(user=self.buyer, product=self.menu, quantity=2)
        self.assertEqual(self.client.patch(f'/api/cart/{item.pk}/', {'quantity': 3}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/cart/{item.pk}/', {'quantity': 1}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/cart/{item.pk}/', {'quantity': 0}, format='json').status_code, 200)
        self.assertFalse(CartItem.objects.exists())

    def test_quotes_and_date_search_do_not_treat_dispatch_as_arrival(self):
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=2)
        quote = self.client.post('/api/orders/quote/', {'delivery_at': self.delivery.isoformat()}, format='json')
        self.assertEqual(quote.status_code, 400, quote.data)
        for find_next in [False, True]:
            response = self.client.post('/api/orders/slots/', {'date': str(self.delivery.date()), 'find_next': find_next}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['slots'], [])
            self.assertEqual(response.data['unavailable_code'], 'shipping_enquiry')

    def test_instant_discovery_keeps_offer_but_date_guide_explains_enquiry(self):
        instant = self.client.post('/api/menu/suggestions/', {}, format='json')
        self.assertEqual(instant.status_code, 200, instant.data)
        self.assertEqual(instant.data['results'][0]['selling_details']['ordering_mode'], 'shipping_enquiry')
        dated = self.client.post('/api/menu/guide/', {'date': str(self.delivery.date()), 'portions': 2,
            'category': self.category.pk}, format='json')
        self.assertEqual(dated.status_code, 200, dated.data)
        self.assertEqual(dated.data['results'], [])
        self.assertEqual(dated.data['empty_reason'], 'shipping_enquiry')

    def test_planner_setup_excludes_enquiry_only_recipe_setup(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/admin/planning/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['setup_menus'], [])

    def test_daily_capacity_failure_is_distinct_from_ingredient_shortage(self):
        self.menu.selling_details = {}; self.menu.daily_capacity = 2; self.menu.save()
        order = Order.objects.create(user=self.buyer, delivery_at=self.delivery, status='processing')
        OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=2, subtotal=36)
        result = slot_search([candidate_item(self.menu, 1)], self.delivery.date(), self.store, now=self.now)
        self.assertEqual(result['slots'], [])
        self.assertEqual(result['unavailable_code'], 'daily_capacity')
        self.assertIn('already booked', result['unavailable_reason'])

    def test_existing_accepted_local_order_can_still_be_replanned(self):
        # A current offer change must not invalidate an already accepted order.
        self.menu.selling_details = {}; self.menu.save()
        order = Order.objects.create(user=self.buyer, delivery_at=self.delivery)
        item = OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=1, subtotal=18)
        self.menu.selling_details = SHIPPING.copy(); self.menu.save()
        from .services.commitments import scheduled_item
        plan = schedule_order([scheduled_item(item)], self.delivery, self.store, now=self.now, exclude_order_id=order.pk)
        self.assertFalse(plan.get('needs_review', False))

    def test_shipping_questions_stay_with_owner_without_model_or_payment_calls(self):
        response = self.client.post('/api/help/shop/', {'message': 'Can you arrange parcel shipping in December?'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['mode'], 'owner_review')
        self.assertEqual(response.data['results'], [])

    def test_shipping_forecast_history_is_kept_but_not_allocated_as_local_demand(self):
        for offset in range(35, 0, -1):
            when = self.now-timedelta(days=offset)
            order = Order.objects.create(user=self.buyer, status='delivered', payment_status='paid', delivery_at=when)
            Order.objects.filter(pk=order.pk).update(created_at=when-timedelta(days=1))
            OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
                unit_price=18, quantity=2, subtotal=36)
        self.client.force_authenticate(self.owner)
        result = self.client.get('/api/admin/predictive/local-decisions/?horizon_days=7')
        self.assertEqual(result.status_code, 200, result.data)
        menu = result.data['decision_support']['menus'][0]
        self.assertEqual(menu['forecast_portions'], 14)
        self.assertEqual(menu['additional_forecast_portions'], 0)
        self.assertEqual(menu['demand_adjustments']['shipping_enquiry_excluded'], 14)

    def test_unconfirmed_request_does_not_consume_advisory_stock(self):
        self.menu.selling_details = {}; self.menu.save()
        InventoryItem.objects.create(raw_material=self.material, quantity=150,
            received_date=self.now.date(), expiry_date=self.delivery.date())
        request = Order.objects.create(user=self.buyer, delivery_at=self.delivery,
            preparation_plan={'needs_review': True, 'tasks': []})
        OrderItem.objects.create(order=request, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=2, subtotal=36)
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        result = self.client.post('/api/orders/quote/', {'delivery_at': self.delivery.isoformat()}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertFalse(result.data['procurement_required'])

    def test_scheduled_unpaid_booking_still_counts_in_advisory_stock(self):
        self.menu.selling_details = {}; self.menu.save()
        InventoryItem.objects.create(raw_material=self.material, quantity=150,
            received_date=self.now.date(), expiry_date=self.delivery.date())
        existing = Order.objects.create(user=self.buyer, delivery_at=self.delivery,
            preparation_at=self.delivery.replace(hour=10), preparation_end_at=self.delivery.replace(hour=11))
        OrderItem.objects.create(order=existing, product=self.menu, product_name=self.menu.name,
            unit_price=18, quantity=1, subtotal=18)
        CartItem.objects.create(user=self.buyer, product=self.menu, quantity=1)
        result = self.client.post('/api/orders/quote/', {'delivery_at': self.delivery.isoformat()}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertTrue(result.data['procurement_required'])
