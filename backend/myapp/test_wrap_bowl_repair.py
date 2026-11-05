"""Recovery of partially applied client setup, using the exact owner-run SQL."""
import importlib.util
import json
from pathlib import Path
from unittest import skipUnless

from django.db import connection, transaction, DatabaseError
from django.test import SimpleTestCase, TransactionTestCase

from .models import (Product, ProductIngredient, RawMaterial, InventoryItem,
                     PackagingItem, Order, OrderAmendment, PaymentEvent)
from .test_wrap_bowl_catalogue import WrapBowlImportTests

ROOT = Path(__file__).resolve().parents[2]


class CompletionBuildTests(SimpleTestCase):
    def test_committed_sql_matches_reviewed_builder(self):
        spec = importlib.util.spec_from_file_location('completion_builder', ROOT / 'deploy/build_wrap_bowl_catalogue.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.build_completion(), (ROOT / 'deploy/sql/complete_wrap_bowl_setup.sql').read_text())


@skipUnless(connection.vendor == 'postgresql', 'Catalogue recovery requires actual PostgreSQL')
class PartialCatalogueRepairTests(TransactionTestCase):
    def setUp(self):
        WrapBowlImportTests.setUp(self)
        self.sql = (ROOT / 'deploy/sql/complete_wrap_bowl_setup.sql').read_text().replace('django_app.', self.schema + '.')

    def run_sql(self, sql=None):
        with connection.cursor() as cursor:
            cursor.execute(sql or self.sql)
            result = cursor.fetchone()[0]
        return json.loads(result) if isinstance(result, str) else result

    def assert_complete(self):
        self.assertEqual(Product.objects.filter(selling_status='active').count(), 8)
        self.assertEqual(Product.objects.count(), 8)
        self.assertEqual(RawMaterial.objects.count(), 25)
        self.assertEqual(PackagingItem.objects.count(), 9)
        self.store.refresh_from_db()
        self.assertEqual(self.store.name, 'Wrap & Bowl Kuch')
        self.assertEqual(self.store.bank_transfer_instructions, 'Saved bank settings')
        self.assertTrue(self.store.manual_payment_enabled)
        self.assertEqual(self.store.bulk_discount_percent, 10)
        self.assertEqual(Order.objects.count(), 1)
        self.assertTrue(InventoryItem.objects.filter(quantity__gt=0).exists())

    def test_brand_only_setup_with_forty_active_old_menus(self):
        self.store.name = 'Wrap & Bowl Kuch'
        self.store.founder_name = 'Ayu Shafinaz'
        self.store.save()
        for n in range(39):
            Product.objects.create(name=f'Earlier menu {n}', price=10)
        self.assertEqual(Product.objects.filter(selling_status='active').count(), 40)
        self.assertEqual(self.run_sql()['status'], 'refreshed')
        self.assert_complete()
        amendment = OrderAmendment.objects.get(order=self.order)
        recovery = amendment.before['operational_backup']['earlier_changes'][0]['before']['catalogue_repair_backup']
        self.assertEqual(len(recovery['products']), 40)
        self.assertEqual(amendment.before['items'][0]['product_name'], self.old.name)
        self.assertEqual(amendment.before['order']['payment_method'], 'paypal')

    def test_reuses_partial_menu_id_and_image_and_restores_recipe(self):
        menu = Product.objects.create(name=' chicken grilled salad ', price=99,
                                      image_url='https://example.com/client-photo.jpg', selling_status='archived')
        ProductIngredient.objects.create(product=menu, raw_material=self.raw, quantity_required=999)
        self.assertEqual(self.run_sql()['status'], 'refreshed')
        self.assert_complete()
        menu.refresh_from_db()
        self.assertEqual(menu.name, 'Chicken Grilled Salad')
        self.assertEqual(menu.price, 13)
        self.assertEqual(menu.image_url, 'https://example.com/client-photo.jpg')
        self.assertEqual(menu.ingredients.count(), 11)
        self.assertFalse(menu.ingredients.filter(raw_material__name='Rice').exists())
        self.assertEqual(menu.packaging_requirements.count(), 4)

    def test_all_client_names_with_extra_active_menus(self):
        with connection.cursor() as cursor:
            cursor.execute((ROOT / 'deploy/sql/apply_wrap_bowl_catalogue.sql').read_text().replace('django_app.', self.schema + '.'))
        self.old.selling_status = 'active'
        self.old.save()
        for n in range(32):
            Product.objects.create(name=f'Extra menu {n}', price=10)
        self.assertEqual(Product.objects.filter(selling_status='active').count(), 41)
        self.assertEqual(self.run_sql()['status'], 'refreshed')
        self.assert_complete()

    def test_repeat_preserves_later_edits_stock_and_payment_events(self):
        self.run_sql()
        menu = Product.objects.first()
        menu.price = 55
        menu.save()
        batch = InventoryItem.objects.filter(quantity__gt=1).first()
        batch.quantity -= 1
        batch.save()
        remaining = batch.quantity
        events = list(PaymentEvent.objects.values())
        orders = list(Order.objects.values())
        self.assertEqual(self.run_sql()['status'], 'already_applied')
        menu.refresh_from_db()
        batch.refresh_from_db()
        self.assertEqual(menu.price, 55)
        self.assertEqual(batch.quantity, remaining)
        self.assertEqual(list(Order.objects.values()), orders)
        self.assertEqual(list(PaymentEvent.objects.values()), events)
        self.assertEqual(OrderAmendment.objects.count(), 1)

    def test_duplicate_client_names_abort_without_catalogue_or_history_changes(self):
        for name in ('Chicken Grilled Salad', 'chicken grilled salad'):
            Product.objects.create(name=name, price=13)
        before = list(Product.objects.values())
        with self.assertRaisesMessage(DatabaseError, 'Duplicate client menu names'):
            with transaction.atomic():
                self.run_sql()
        self.assertEqual(list(Product.objects.values()), before)
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertEqual(list(Order.objects.values()), self.old_order)

    def test_unit_conflict_rolls_back_repair_and_snapshot(self):
        self.raw.unit = 'kg'
        self.raw.save()
        with self.assertRaisesMessage(DatabaseError, 'another unit'):
            with transaction.atomic():
                self.run_sql()
        self.assertEqual(Product.objects.count(), 1)
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertEqual(list(Order.objects.values()), self.old_order)

    def test_later_refresh_failure_rolls_back_earlier_repair(self):
        bad_sql = self.sql.replace('"validated_for_apply":true', '"validated_for_apply":false')
        self.assertNotEqual(bad_sql, self.sql)
        with self.assertRaisesMessage(DatabaseError, 'awaiting PostgreSQL verification'):
            with transaction.atomic():
                self.run_sql(bad_sql)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(RawMaterial.objects.count(), 1)
        self.assertFalse(PackagingItem.objects.exists())
        self.assertFalse(OrderAmendment.objects.exists())
        self.assertEqual(list(Order.objects.values()), self.old_order)
        self.store.refresh_from_db()
        self.assertEqual(self.store.name, 'Original kitchen')
