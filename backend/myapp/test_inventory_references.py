"""Generated references change labels, never quantities or allocation snapshots."""
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import RawMaterial,InventoryItem,InventoryLog


class InventoryReferenceTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('stock-reference-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.raw=RawMaterial.objects.create(name='Chicken boneless trimmed',unit='g')
        self.today=timezone.localdate()
        self.body=dict(raw_material=self.raw.pk,quantity='1000',received_date=str(self.today),
            expiry_date=str(self.today+timedelta(days=1)),storage_location='Fridge A - Bottom shelf')

    def create(self,**changes):
        r=self.client.post('/api/admin/inventory-items/',{**self.body,**changes},format='json')
        self.assertEqual(r.status_code,201,r.data)
        return InventoryItem.objects.get(pk=r.data['id'])

    def test_blank_code_generated_and_existing_supplier_code_preserved(self):
        one=self.create();two=self.create(batch_code='')
        self.assertEqual(one.batch_code,f'CHK-{self.today:%Y%m%d}-{one.pk:03d}')
        self.assertNotEqual(one.batch_code,two.batch_code)
        self.assertEqual(self.create(batch_code='Supplier-lot-ABC').batch_code,'Supplier-lot-ABC')

    def test_normalizing_label_keeps_stock_dates_hold_and_records_original_reference(self):
        row=self.create(batch_code='chk-5',quarantined=True)
        old=row.updated_at
        r=self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='',updated_at=old.isoformat()),format='json')
        self.assertEqual(r.status_code,200,r.data);row.refresh_from_db()
        self.assertEqual(row.batch_code,f'CHK-{self.today:%Y%m%d}-{row.pk:03d}')
        self.assertEqual(row.quantity,1000);self.assertTrue(row.quarantined)
        self.assertEqual(row.received_date,self.today);self.assertEqual(row.expiry_date,self.today+timedelta(days=1))
        log=InventoryLog.objects.get(inventory_item=row)
        self.assertEqual(log.change,0);self.assertIn('chk-5',log.reason);self.assertIn(row.batch_code,log.reason)
        self.assertEqual(log.admin,self.owner)
        r=self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='',updated_at=row.updated_at.isoformat()),format='json')
        self.assertEqual(r.status_code,200,r.data);self.assertEqual(InventoryLog.objects.filter(inventory_item=row).count(),1)

    def test_normalized_code_uses_updated_receipt_date(self):
        row=self.create(batch_code='CHK-1');received=self.today-timedelta(days=1)
        r=self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='',received_date=str(received),updated_at=row.updated_at.isoformat()),format='json')
        self.assertEqual(r.status_code,200,r.data);row.refresh_from_db()
        self.assertEqual(row.batch_code,f'CHK-{received:%Y%m%d}-{row.pk:03d}')

    def test_collision_or_stale_update_cannot_overwrite_a_label_or_quantity(self):
        row=self.create(batch_code='CHK-1')
        other=self.create(batch_code=f'CHK-{self.today:%Y%m%d}-{row.pk:03d}')
        r=self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='',updated_at=row.updated_at.isoformat()),format='json')
        self.assertEqual(r.status_code,400,r.data);row.refresh_from_db()
        self.assertEqual(row.batch_code,'CHK-1');self.assertEqual(row.quantity,1000)
        self.assertFalse(InventoryLog.objects.filter(inventory_item=row).exists())
        r=self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='Something else',updated_at='2000-01-01T00:00:00Z'),format='json')
        self.assertEqual(r.status_code,409,r.data)
        other.refresh_from_db();self.assertEqual(other.batch_code,f'CHK-{self.today:%Y%m%d}-{row.pk:03d}')

    def test_customer_cannot_edit_or_create_inventory(self):
        row=self.create(batch_code='CHK-1')
        self.client.force_authenticate(User.objects.create_user('stock-reference-buyer'))
        self.assertEqual(self.client.post('/api/admin/inventory-items/',self.body,format='json').status_code,403)
        self.assertEqual(self.client.patch(f'/api/admin/inventory-items/{row.pk}/',dict(batch_code='',updated_at=row.updated_at.isoformat()),format='json').status_code,403)
