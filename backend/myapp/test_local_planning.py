"""Real ORM/API calculations in an isolated database, never model training data."""
from datetime import timedelta
from decimal import Decimal
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import InventoryItem, Order, OrderIngredient, OrderItem, Product, ProductIngredient, RawMaterial


URL = '/api/admin/predictive/local-plan/'


class LocalPlanningTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('local-owner', password='test-only-password', is_staff=True)
        self.buyer = User.objects.create_user('local-buyer')
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.today = timezone.localdate()
        self.start = (timezone.localtime() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        self.material = RawMaterial.objects.create(name='Chicken', unit='g', estimated_unit_cost=Decimal('.03'))
        self.menu = Product.objects.create(name='Rice meal', price=10)
        self.recipe = ProductIngredient.objects.create(product=self.menu, raw_material=self.material, quantity_required=100)

    def order(self, portions=2, **changes):
        values = dict(user=self.buyer, payment_status='paid', preparation_at=self.start,
                      preparation_end_at=self.start + timedelta(hours=1),
                      delivery_at=self.start + timedelta(hours=3), preparation_plan={'needs_review': False, 'mode': 'manual_window'})
        values.update(changes)
        order = Order.objects.create(**values)
        OrderItem.objects.create(order=order, product=self.menu, product_name=self.menu.name,
                                 unit_price=10, quantity=portions, subtotal=10 * portions)
        return order

    def batch(self, quantity, expiry_days=5, **changes):
        values = dict(raw_material=self.material, quantity=quantity, received_date=self.today,
                      expiry_date=self.today + timedelta(days=expiry_days), storage_location='Fridge', unit_cost=Decimal('.02'))
        values.update(changes)
        return InventoryItem.objects.create(**values)

    def test_staff_session_permissions_and_method(self):
        for user in (None, self.buyer):
            client = APIClient()
            if user:
                client.force_authenticate(user)
            self.assertEqual(client.get(URL).status_code, 403)
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.staff)
        self.assertEqual(client.get(URL).status_code, 200)
        self.assertEqual(self.client.post(URL, {}, format='json').status_code, 405)

    def test_parameters_and_valid_empty_result(self):
        for query in ('?horizon_days=0', '?horizon_days=29', '?horizon_days=true', '?horizon_days=1.5',
                      '?horizon_days=7&horizon_days=7', '?center_id=13', '?horizon_days=', '?as_of=2026-01-01'):
            response = self.client.get(URL + query)
            self.assertEqual(response.status_code, 400, query)
            self.assertEqual(response.data['code'], 'invalid_parameters')
        response = self.client.get(URL + '?horizon_days=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['window']['start_date'], response.data['window']['end_date'])
        self.assertEqual(response.data['ingredient_risks'], [])
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_multiday_shortfall_and_expiry_surplus_exclude_ineligible_batches(self):
        order = self.order(preparation_end_at=self.start + timedelta(days=1),
                           delivery_at=self.start + timedelta(days=1, hours=3))
        early = self.batch(150, expiry_days=1)
        usable = self.batch(120, expiry_days=5)
        expired = self.batch(20, expiry_days=-1)
        held = self.batch(10, quarantined=True)
        future = self.batch(90, received_date=self.today + timedelta(days=1))
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        risk = data['ingredient_risks'][0]
        self.assertEqual(risk['risk_type'], 'expiry_surplus_and_shortage')
        self.assertEqual(risk['confirmed_requirement'], 200)
        self.assertEqual(risk['eligible_stock'], 270)
        self.assertEqual(risk['allocated_quantity'], 120)
        self.assertEqual(risk['shortfall_quantity'], 80)
        self.assertEqual(risk['expiring_unused_quantity'], 150)
        self.assertEqual(risk['potential_waste_cost_myr'], 3)
        self.assertEqual(risk['estimated_purchase_cost_myr'], 2.4)
        self.assertEqual(data['batch_allocations'][0]['batch_id'], usable.pk)
        self.assertEqual(data['batch_allocations'][0]['order_id'], order.pk)
        rows = {b['batch_id']: b for b in data['batches']}
        self.assertEqual(rows[early.pk]['allocated_quantity'], 0)
        for batch, reason in ((expired, 'expired'), (held, 'quarantined'), (future, 'not_received')):
            self.assertFalse(rows[batch.pk]['eligible'])
            self.assertIn(reason, rows[batch.pk]['exclusion_reasons'])
            self.assertEqual(rows[batch.pk]['allocated_quantity'], 0)

    def test_fefo_does_not_reuse_stock_and_honours_accepted_recipe(self):
        first = self.order(portions=2)
        second = self.order(portions=2)
        late = self.batch(150, expiry_days=6)
        early = self.batch(100, expiry_days=2)
        self.recipe.quantity_required = 900
        self.recipe.save()
        data = self.client.get(URL).data
        self.assertEqual(data['ingredient_risks'][0]['confirmed_requirement'], 400)
        self.assertEqual(data['ingredient_risks'][0]['shortfall_quantity'], 150)
        self.assertEqual([a['batch_id'] for a in data['batch_allocations']], [early.pk, late.pk, late.pk])
        self.assertEqual([a['order_id'] for a in data['batch_allocations']], [first.pk, first.pk, second.pk])
        self.assertEqual([a['quantity'] for a in data['batch_allocations']], [100, 100, 50])

    def test_unit_conversion_and_incompatible_recipe_excludes_whole_order(self):
        order = self.order(portions=1)
        ingredient = OrderIngredient.objects.get(order_item__order=order)
        ingredient.quantity_per_portion = Decimal('.2')
        ingredient.unit = 'kg'
        ingredient.save()
        self.assertEqual(self.client.get(URL).data['ingredient_risks'][0]['confirmed_requirement'], 200)
        ingredient.unit = 'ml'
        ingredient.save()
        data = self.client.get(URL).data
        self.assertEqual(data['coverage']['included_orders'], 0)
        self.assertEqual(data['excluded_orders'][0]['reason'], 'invalid_recipe_quantity_or_unit')
        self.assertEqual(data['ingredient_risks'], [])

    def test_order_exclusions_and_missing_recipe_are_visible(self):
        self.order(payment_status='unpaid')
        self.order(inventory_deducted=True)
        self.order(preparation_plan={'needs_review': True})
        self.order(delivery_at=None)
        self.order(preparation_at=self.start - timedelta(days=3))
        self.order(preparation_at=self.start + timedelta(days=10),
                   preparation_end_at=self.start + timedelta(days=10, hours=1),
                   delivery_at=self.start + timedelta(days=10, hours=3))
        missing = self.order()
        empty_menu = Product.objects.create(name='Unlinked', price=10)
        OrderItem.objects.create(order=missing, product=empty_menu, product_name='Unlinked', unit_price=10, quantity=1, subtotal=10)
        self.order(status='cancelled')
        self.order(status='delivered')
        data = self.client.get(URL).data
        self.assertEqual(data['coverage']['active_orders'], 7)
        self.assertEqual(data['coverage']['included_orders'], 0)
        self.assertEqual({x['reason'] for x in data['excluded_orders']},
                         {'not_paid', 'inventory_already_deducted', 'preparation_needs_review', 'missing_schedule',
                          'overdue_preparation', 'outside_horizon', 'missing_accepted_recipe'})

    def test_unknown_cost_and_inventory_only_expiry(self):
        self.material.estimated_unit_cost = None
        self.material.save()
        self.batch(50, expiry_days=0, unit_cost=None)
        data = self.client.get(URL).data
        risk = data['ingredient_risks'][0]
        self.assertEqual(risk['risk_type'], 'expiry_surplus')
        self.assertEqual(risk['confirmed_requirement'], 0)
        self.assertEqual(risk['expiring_unused_quantity'], 50)
        self.assertIsNone(risk['potential_waste_cost_myr'])
        self.assertIsNone(risk['estimated_purchase_cost_myr'])
        self.assertEqual(data['recommendations'][0]['priority'], 1)
        self.assertIn('unknown waste exposure', ' '.join(data['warnings']))

    def test_recommendations_use_urgency_and_cost_not_incompatible_quantities(self):
        self.batch(10, expiry_days=2, unit_cost=Decimal('1'))
        oil = RawMaterial.objects.create(name='Oil', unit='ml')
        salt = RawMaterial.objects.create(name='Salt', unit='kg')
        InventoryItem.objects.create(raw_material=oil, quantity=10000, received_date=self.today,
                                     expiry_date=self.today, storage_location='Shelf', unit_cost=None)
        InventoryItem.objects.create(raw_material=salt, quantity=1, received_date=self.today,
                                     expiry_date=self.today + timedelta(days=2), storage_location='Shelf', unit_cost=50)
        data = self.client.get(URL).data
        self.assertEqual([r['raw_material_id'] for r in data['recommendations']], [oil.pk, salt.pk, self.material.pk])
        self.assertEqual([r['priority'] for r in data['recommendations']], [1, 2, 3])

    def test_model_independence_no_writes_or_customer_data(self):
        self.order()
        batch = self.batch(300)
        with TemporaryDirectory() as empty:
            with override_settings(PREDICTIVE_ARTIFACT_DIR=empty, PREDICTIVE_DATA_DIR=empty):
                with patch('predictive_ai.service.bundle', side_effect=AssertionError('No ML in local planning')):
                    with CaptureQueriesContext(connection) as queries:
                        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(q['sql'].lstrip().upper().startswith('SELECT') for q in queries))
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 300)
        self.assertFalse(Order.objects.get().inventory_deducted)
        self.assertEqual(response.data['model_status'], 'not_used')
        self.assertEqual(response.data['sources']['operational'], 'DATABASE')
        self.assertNotIn('local-buyer', str(response.data))
        self.assertNotIn('predicted_orders', str(response.data))
