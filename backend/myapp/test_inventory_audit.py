from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from .models import InventoryItem, RawMaterial
from .views.inventory import InventoryItemDetail, InventoryItemListCreate
from .views.planning import planning, sales_analytics


class InventoryAuditTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='inventory-audit', is_staff=True)
        self.factory = APIRequestFactory()
        self.material = RawMaterial.objects.create(name='Chicken', unit='g')
        self.lot = InventoryItem.objects.create(raw_material=self.material, quantity=100,
            received_date=timezone.localdate(), expiry_date=timezone.localdate() + timedelta(days=2))

    def patch(self, data):
        request = self.factory.patch('/', data, format='json')
        force_authenticate(request, self.owner)
        return InventoryItemDetail.as_view()(request, pk=self.lot.pk)

    def test_stale_edit_cannot_restore_consumed_stock(self):
        version = self.lot.updated_at.isoformat()
        self.lot.quantity = 5
        self.lot.save(update_fields=['quantity', 'updated_at'])
        response = self.patch({'quantity': 100, 'updated_at': version})
        self.assertEqual(response.status_code, 409)
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.quantity, 5)

    def test_missing_or_invalid_version_rejected(self):
        for value in (None, 'invalid', '2026-99-99T00:00:00'):
            with self.subTest(value=value):
                self.assertEqual(self.patch({'quantity': 50, 'updated_at': value}).status_code, 409)
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.quantity, 100)

    def test_fresh_edit_accepted_and_version_advanced(self):
        version = self.lot.updated_at
        response = self.patch({'quantity': 80, 'updated_at': version.isoformat()})
        self.assertEqual(response.status_code, 200)
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.quantity, 80)
        self.assertGreater(self.lot.updated_at, version)

    def test_inventory_list_query_count_does_not_grow_with_batches(self):
        for count in (1, 30):
            if count == 30:
                InventoryItem.objects.bulk_create([InventoryItem(raw_material=self.material, quantity=1,
                    received_date=self.lot.received_date, expiry_date=self.lot.expiry_date) for _ in range(29)])
            request = self.factory.get('/')
            force_authenticate(request, self.owner)
            with self.assertNumQueries(1):
                response = InventoryItemListCreate.as_view()(request)
                self.assertEqual(len(response.data), count)
                self.assertEqual(response.data[0]['raw_material_name'], 'Chicken')

    def test_sales_endpoint_retains_totals_without_operational_payload(self):
        request = self.factory.get('/')
        force_authenticate(request, self.owner)
        full = planning(request).data
        request = self.factory.get('/')
        force_authenticate(request, self.owner)
        with self.assertNumQueries(5):
            compact = sales_analytics(request).data
        self.assertEqual(set(compact), {'analytics', 'forecast'})
        self.assertEqual(compact['analytics'], full['analytics'])
        self.assertEqual(compact['forecast'], full['forecast'])

    def test_sales_endpoint_requires_owner(self):
        request = self.factory.get('/')
        response = sales_analytics(request)
        self.assertIn(response.status_code, (401, 403))
