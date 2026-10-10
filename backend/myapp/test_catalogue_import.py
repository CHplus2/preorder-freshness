"""Exercise the catalogue importer against the actual Django staff CRUD APIs."""
from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
import importlib.util
import json
import secrets
from pathlib import Path

from django.contrib.auth.models import User
from django.test import LiveServerTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Category, InventoryItem, Order, OrderIngredient, OrderItem, Product, ProductIngredient, RawMaterial

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('catalogue_import', ROOT / 'scripts/import_dapur_kita.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)
SOURCE = json.loads(importer.SOURCE.read_text())


class DjangoAPI:
    def __init__(self, user):
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.writes = []

    def request(self, method, path, data=None):
        if method != 'GET':
            self.writes.append((method, path, data))
        response = getattr(self.client, method.lower())('/api/' + path, data, format='json')
        if response.status_code not in {200, 201}:
            raise importer.ImportErrorDetail(f'{method} {path}: {response.status_code} {response.data}')
        return json.loads(json.dumps(response.data))


class CatalogueImportTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('catalogue-owner', is_staff=True)
        self.api = DjangoAPI(self.owner)
        self.category = Category.objects.create(name='Fruits')
        self.material = RawMaterial.objects.create(name='Rice', unit='g', estimated_unit_cost='0.006')
        self.old = Product.objects.create(name='Mango', category=self.category, price=5)
        ProductIngredient.objects.create(product=self.old, raw_material=self.material, quantity_required=20)
        self.stock = InventoryItem.objects.create(raw_material=self.material, quantity=500,
            received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=2))
        self.order = Order.objects.create(user=self.owner)
        self.item = OrderItem.objects.create(order=self.order, product=self.old, product_name='Mango',
            quantity=2, unit_price=5, subtotal=10)

    def apply(self):
        snapshot, plan = importer.preflight(self.api, SOURCE, True, 'active')
        return importer.apply_catalogue(self.api, SOURCE, snapshot, plan)

    def test_plan_is_read_only_and_reports_actual_counts(self):
        snapshot, plan = importer.preflight(self.api, SOURCE, True, 'active')
        self.assertEqual(plan['new_categories'], ['Bakes', 'Noodles', 'Rice meals'])
        self.assertEqual(len(plan['new_materials']), 34)
        self.assertEqual(len(plan['new_menus']), 24)
        self.assertEqual(plan['recipe_links'], 280)
        self.assertEqual(plan['archive_products'], [{'id': self.old.pk, 'name': 'Mango'}])
        self.assertFalse(self.api.writes)
        self.assertEqual(Product.objects.count(), 1)

    def test_all_fields_recipes_and_history_survive_and_rerun_is_idempotent(self):
        before_item = OrderItem.objects.filter(pk=self.item.pk).values().get()
        before_recipe = list(OrderIngredient.objects.values())
        before_stock = InventoryItem.objects.filter(pk=self.stock.pk).values().get()
        result = self.apply()
        self.assertEqual(result, {'menus_verified': 24, 'materials_verified': 35,
            'recipe_links_verified': 280, 'archived': 1, 'inventory_batches_created': 0})
        self.assertEqual(RawMaterial.objects.count(), 35)
        self.assertEqual(Product.objects.filter(selling_status='active').count(), 24)
        self.assertEqual(ProductIngredient.objects.count(), 281)
        self.old.refresh_from_db()
        self.assertEqual((self.old.name, self.old.selling_status, self.old.category_id), ('Mango', 'archived', self.category.pk))
        self.assertEqual(OrderItem.objects.filter(pk=self.item.pk).values().get(), before_item)
        self.assertEqual(list(OrderIngredient.objects.values()), before_recipe)
        self.assertEqual(InventoryItem.objects.filter(pk=self.stock.pk).values().get(), before_stock)
        self.assertEqual(InventoryItem.objects.count(), 1)
        self.assertTrue(Category.objects.filter(pk=self.category.pk, name='Fruits').exists())
        categories = importer.index_names(self.api.request('GET', 'categories/'), 'category')
        materials = importer.index_names(self.api.request('GET', 'admin/raw-materials/'), 'material')
        for source in SOURCE['menus']:
            product = Product.objects.get(name=source['name'])
            actual = self.api.request('GET', f'products/{product.pk}/')
            expected = importer.menu_payload(source, categories, materials, 'active')
            self.assertTrue(importer.matches(actual, expected), source['name'])
            self.assertEqual(product.delivery_weekdays, [])
        self.api.writes.clear()
        self.apply()
        self.assertFalse(self.api.writes, 'An unchanged second import must make no writes.')

    def test_existing_menu_updates_preserve_accepted_recipe_and_selling_choices(self):
        existing = Product.objects.create(name=SOURCE['menus'][0]['name'], price=1, selling_status='paused', delivery_weekdays=[4])
        ProductIngredient.objects.create(product=existing, raw_material=self.material, quantity_required=10)
        item = OrderItem.objects.create(order=self.order, product=existing, product_name=existing.name,
            quantity=1, unit_price=1, subtotal=1)
        snapshot = item.preparation_snapshot
        ingredients = list(item.accepted_ingredients.values())
        self.apply()
        existing.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(existing.price, Decimal('7.50'))
        self.assertEqual(existing.selling_status, 'paused')
        self.assertEqual(existing.delivery_weekdays, [4])
        self.assertEqual(item.preparation_snapshot, snapshot)
        self.assertEqual(list(item.accepted_ingredients.values()), ingredients)

    def test_wrong_material_unit_and_duplicate_product_abort_before_any_writes(self):
        self.material.unit = 'kg'
        self.material.save()
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'existing unit differs'):
            importer.preflight(self.api, SOURCE, True)
        self.assertFalse(self.api.writes)
        self.material.unit = 'g'
        self.material.save()
        Product.objects.create(name='mango', price=3)
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'Duplicate'):
            importer.preflight(self.api, SOURCE, True)
        self.assertFalse(self.api.writes)

    def test_invalid_final_recipe_aborts_before_any_writes(self):
        source = deepcopy(SOURCE)
        source['menus'][-1]['ingredients'][-1]['raw_material'] = 'Unspecified food'
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'missing or duplicate'):
            importer.preflight(self.api, source, True)
        self.assertFalse(self.api.writes)

    def test_customer_cannot_import(self):
        buyer = User.objects.create_user('catalogue-buyer')
        api = DjangoAPI(buyer)
        with self.assertRaisesMessage(importer.ImportErrorDetail, '403'):
            importer.preflight(api, SOURCE)
        self.assertFalse(api.writes)
        response = api.client.post('/api/categories/', {'name': 'Rice meals'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_failed_menu_write_keeps_old_menus_visible_and_resume_does_not_duplicate(self):
        snapshot, plan = importer.preflight(self.api, SOURCE, True, 'active')
        request = self.api.request

        def fail(method, path, data=None):
            if method == 'POST' and path == 'products/' and data['name'] == SOURCE['menus'][1]['name']:
                raise importer.ImportErrorDetail('Simulated connection failure')
            return request(method, path, data)

        self.api.request = fail
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'Simulated connection failure'):
            importer.apply_catalogue(self.api, SOURCE, snapshot, plan)
        self.old.refresh_from_db()
        self.assertEqual(self.old.selling_status, 'active')
        self.assertEqual(Product.objects.count(), 2)
        self.api.request = request
        self.apply()
        self.assertEqual(Product.objects.count(), 25)

    def test_concurrent_change_to_old_product_is_not_archived(self):
        snapshot, plan = importer.preflight(self.api, SOURCE, True, 'active')
        self.old.name = 'Updated retail mango'
        self.old.save()
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'changed since the plan'):
            importer.apply_catalogue(self.api, SOURCE, snapshot, plan)
        self.old.refresh_from_db()
        self.assertEqual(self.old.selling_status, 'active')


class CatalogueStaffHTTPTests(LiveServerTestCase):
    def test_real_login_csrf_and_staff_writes(self):
        password = secrets.token_urlsafe(24)
        User.objects.create_user('http-catalogue-owner', password=password, is_staff=True)
        api = importer.StaffAPI(self.live_server_url, 'http-catalogue-owner', password, allow_local_http=True)
        row = api.request('POST', 'categories/', {'name': 'Rice meals'})
        self.assertEqual(row['name'], 'Rice meals')
        snapshot, plan = importer.preflight(api, SOURCE, new_menu_status='paused')
        result = importer.apply_catalogue(api, SOURCE, snapshot, plan)
        self.assertEqual(result['menus_verified'], 24)
        self.assertEqual(Product.objects.filter(selling_status='paused').count(), 24)
        self.assertEqual(InventoryItem.objects.count(), 0)
        User.objects.create_user('http-buyer', password=password)
        with self.assertRaisesMessage(importer.ImportErrorDetail, 'staff account is required'):
            importer.StaffAPI(self.live_server_url, 'http-buyer', password, allow_local_http=True)
