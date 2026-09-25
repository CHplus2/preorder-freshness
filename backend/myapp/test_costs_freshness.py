from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Product, RawMaterial, ProductIngredient, InventoryItem, WasteRecord, InventoryLog
from .serializers import InventoryItemSerializer

class CostsAndFreshnessTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate()
        self.owner=User.objects.create_user('costowner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.raw=RawMaterial.objects.create(name='Rice',unit='g',estimated_unit_cost='0.010000')
        self.menu=Product.objects.create(name='Rice bowl',price=10,packaging_cost='0.50')
        ProductIngredient.objects.create(product=self.menu,raw_material=self.raw,quantity_required=100)
        self.lot=InventoryItem.objects.create(raw_material=self.raw,quantity=500,unit_cost='0.012000',storage_location='Shelf',received_date=self.today-timedelta(days=2),expiry_date=self.today+timedelta(days=10))

    def test_costs_and_unknowns(self):
        row=self.client.get('/api/admin/costs/').json()['menus'][0]
        self.assertEqual(row['estimated_contribution'],'8.50')
        self.assertEqual(row['estimated_margin_percent'],'85.0')
        self.raw.estimated_unit_cost=None;self.raw.save()
        self.assertIsNone(self.client.get('/api/admin/costs/').json()['menus'][0]['estimated_contribution'])

    def test_waste_deducts_once_and_preserves_cost(self):
        data={'request_id':str(uuid4()),'inventory_item':self.lot.pk,'quantity':'100','reason':'Damaged'}
        self.assertEqual(self.client.post('/api/admin/waste/',data).status_code,201)
        self.assertEqual(self.client.post('/api/admin/waste/',data).status_code,200)
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity,400)
        self.assertEqual(WasteRecord.objects.get().estimated_cost,Decimal('1.20'))
        self.assertEqual(InventoryLog.objects.count(),1)
        self.assertEqual(self.client.delete(f'/api/admin/inventory-items/{self.lot.pk}/').status_code,400)

    def test_waste_overdraw_rejected(self):
        response=self.client.post('/api/admin/waste/',{'request_id':str(uuid4()),'inventory_item':self.lot.pk,'quantity':'501','reason':'Damaged'})
        self.assertEqual(response.status_code,400)
        self.lot.refresh_from_db();self.assertEqual(self.lot.quantity,500)

    def test_expense_retry_and_void(self):
        data={'request_id':str(uuid4()),'date':str(self.today),'amount':'12.50','category':'utilities','note':'Power'}
        first=self.client.post('/api/admin/expenses/',data)
        self.assertEqual(first.status_code,201)
        self.assertEqual(self.client.post('/api/admin/expenses/',data).status_code,200)
        self.assertEqual(Decimal(self.client.get('/api/admin/costs/').json()['operating_expenses']),Decimal('12.50'))
        self.client.post(f"/api/admin/expenses/{first.json()['id']}/void/")
        self.assertEqual(Decimal(self.client.get('/api/admin/costs/').json()['operating_expenses']),0)

    def test_earliest_deadline_and_original_preserved(self):
        s=InventoryItemSerializer(self.lot,data={'opened_date':str(self.today),'after_open_days':2,'guidance_note':'Supplier use within two days after opening'},partial=True)
        self.assertTrue(s.is_valid(),s.errors);s.save()
        self.lot.refresh_from_db()
        self.assertEqual(self.lot.expiry_date,self.today+timedelta(days=2))
        self.assertEqual(self.lot.original_expiry_date,self.today+timedelta(days=10))
        s=InventoryItemSerializer(self.lot,data={'thawed_date':str(self.today),'after_thaw_days':1},partial=True)
        self.assertTrue(s.is_valid(),s.errors);s.save()
        self.assertEqual(self.lot.expiry_date,self.today+timedelta(days=1))

    def test_uncertain_storage_forces_hold(self):
        s=InventoryItemSerializer(self.lot,data={'handling_history':'unknown','quarantined':False},partial=True)
        self.assertTrue(s.is_valid(),s.errors);s.save();self.assertTrue(self.lot.quarantined)

    def test_event_requires_duration_and_evidence(self):
        s=InventoryItemSerializer(self.lot,data={'opened_date':str(self.today)},partial=True)
        self.assertFalse(s.is_valid())
        s=InventoryItemSerializer(self.lot,data={'opened_date':str(self.today),'after_open_days':1},partial=True)
        self.assertFalse(s.is_valid())

    def test_owner_only_and_private_cost(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/admin/costs/').status_code,[401,403])
        self.assertNotIn('packaging_cost',self.client.get(f'/api/products/{self.menu.pk}/').json())
