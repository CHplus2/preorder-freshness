import json
from datetime import timedelta
from pathlib import Path
from unittest import skipUnless

from django.db import connection, transaction, DatabaseError
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from .models import InventoryItem, InventoryLog, RawMaterial
from .services.sample_stock_storage import sample_storage_location, PLACEHOLDER_LOCATIONS

ROOT = Path(__file__).resolve().parents[2]


class SampleStorageTests(SimpleTestCase):
    def test_storage_examples_match_recorded_type_without_changing_it(self):
        cases = [('Chicken', 'chilled', 'Bottom shelf'), ('Chicken', 'frozen', 'Lower basket'),
                 ('Butter', 'chilled', 'Chilled ingredients'), ('Egg', 'chilled', 'Egg tray'),
                 ('Long bean', 'chilled', 'Vegetable drawer'), ('Rice', 'ambient', 'Dry goods'),
                 ('Garlic', 'ambient', 'Ventilated'), ('Cooking oil', 'ambient', 'Bottles tray')]
        for name, storage_type, fragment in cases:
            with self.subTest(name=name, storage_type=storage_type):
                result = sample_storage_location(name, storage_type)
                self.assertIn(fragment, result)
                self.assertNotIn('demo', result.lower())
                self.assertLessEqual(len(result), 200)
        self.assertIsNone(sample_storage_location('Unknown', 'unknown'))


@skipUnless(connection.vendor == 'postgresql', 'Requires isolated PostgreSQL SQL correction')
class SampleStorageSQLTests(TestCase):
    def setUp(self):
        # Only the namespace changes in this isolated test DB; the SQL is unchanged.
        self.sql = (ROOT/'deploy/sql/refresh_sample_storage_locations.sql').read_text().replace('django_app.', 'public.')
        self.before = {}
        names = ['Chicken', 'Butter', 'Egg', 'Cabbage', 'Fresh flat rice noodles', 'Onion', 'Garlic', 'Rice', 'Cooking oil', 'Sweet soy sauce']
        for index, name in enumerate(names):
            material = RawMaterial.objects.create(name=name, unit='g')
            for kind in ['chilled', 'frozen', 'ambient']:
                row = InventoryItem.objects.create(raw_material=material, batch_code=f'DEMO-FC-INV-{material.pk}-{ "NEAR" if kind != "ambient" else "RESERVE"}',
                    storage_type=kind, storage_location=PLACEHOLDER_LOCATIONS[index % 2],
                    quantity=123.456, received_date=timezone.localdate()-timedelta(days=8),
                    expiry_date=timezone.localdate()-timedelta(days=2), unit_cost='0.012', quarantined=index % 2 == 0)
                self.before[row.pk] = dict(InventoryItem.objects.filter(pk=row.pk).values().get())
        material = RawMaterial.objects.first()
        base = dict(raw_material=material, quantity=50, received_date=timezone.localdate(), expiry_date=timezone.localdate()+timedelta(days=1))
        self.extra = InventoryItem.objects.create(**base, batch_code='FRESHCAST-DEMO-2026-10-10-3', storage_type='ambient', storage_location=PLACEHOLDER_LOCATIONS[1])
        self.before[self.extra.pk] = dict(InventoryItem.objects.filter(pk=self.extra.pk).values().get())
        self.custom = InventoryItem.objects.create(**base, batch_code='DEMO-FC-INV-9-NEAR', storage_location='Owner chosen location')
        self.real = InventoryItem.objects.create(**base, batch_code='REAL-LOT-1', storage_location=PLACEHOLDER_LOCATIONS[0])
        self.unknown = InventoryItem.objects.create(**base, batch_code='DEMO-FC-INV-99-NEAR', storage_type='unknown', storage_location=PLACEHOLDER_LOCATIONS[0])

    def run_sql(self):
        with connection.cursor() as cursor:
            cursor.execute(self.sql)
            count, changes = cursor.fetchone()
            return count, json.loads(changes) if isinstance(changes, str) else changes

    def test_exact_targets_preserve_values_audit_before_after_and_repeat_is_noop(self):
        count, changes = self.run_sql()
        self.assertEqual(count, len(self.before))
        self.assertEqual(len(changes), count)
        for row in InventoryItem.objects.filter(pk__in=self.before).select_related('raw_material'):
            before = self.before[row.pk]
            self.assertEqual(row.storage_location, sample_storage_location(row.raw_material.name, row.storage_type))
            after = InventoryItem.objects.filter(pk=row.pk).values().get()
            for key in set(before)-{'storage_location', 'updated_at'}:
                self.assertEqual(after[key], before[key], (row.pk, key))
            log = InventoryLog.objects.get(inventory_item=row)
            self.assertEqual(log.change, 0)
            self.assertIsNone(log.admin_id)
            self.assertEqual(json.loads(log.reason), {'storage_before': before['storage_location'], 'storage_after': row.storage_location})
        self.custom.refresh_from_db(); self.real.refresh_from_db(); self.unknown.refresh_from_db()
        self.assertEqual(self.custom.storage_location, 'Owner chosen location')
        self.assertEqual(self.real.storage_location, PLACEHOLDER_LOCATIONS[0])
        self.assertEqual(self.unknown.storage_location, PLACEHOLDER_LOCATIONS[0])
        self.assertEqual(self.run_sql(), (0, []))
        self.assertEqual(InventoryLog.objects.count(), len(self.before))

    def test_audit_failure_rolls_back_location_changes(self):
        with connection.cursor() as cursor:
            cursor.execute("CREATE FUNCTION reject_sample_location_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$")
            cursor.execute('CREATE TRIGGER reject_sample_location_log BEFORE INSERT ON myapp_inventorylog FOR EACH ROW EXECUTE FUNCTION reject_sample_location_log()')
        with self.assertRaises(DatabaseError), transaction.atomic():
            self.run_sql()
        for row in InventoryItem.objects.filter(pk__in=self.before):
            self.assertEqual(row.storage_location, self.before[row.pk]['storage_location'])
        self.assertFalse(InventoryLog.objects.exists())
