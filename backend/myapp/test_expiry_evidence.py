"""Recorded deadlines, not predictions of spoilage or fabricated safety limits."""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import RawMaterial, InventoryItem


class ExpiryEvidenceTests(TestCase):
    def setUp(self):
        self.today=timezone.localdate()
        self.owner=User.objects.create_user('expiry-owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.raw=RawMaterial.objects.create(name='Unlabelled fixture ingredient',unit='g')
        self.url='/api/admin/inventory-items/'
        self.base=dict(raw_material=self.raw.pk,quantity=100,received_date=str(self.today),storage_location='Fixture fridge',storage_type='chilled')

    def create(self, **changes):
        return self.client.post(self.url,dict(self.base,**changes),format='json')

    def test_unlabelled_storage_needs_no_manufacture_or_raw_material_preset(self):
        result=self.create(expiry_basis='storage',source_type='market',shelf_life_days=2,guidance_note='Fixture supplier document: received fresh, chilled at documented temperature')
        self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=2)))
        self.assertIsNone(result.data['manufactured_date']);self.assertIsNone(result.data['original_expiry_date'])

    def test_manufacture_and_storage_have_different_anchors(self):
        result=self.create(expiry_basis='manufactured',manufactured_date=str(self.today-timedelta(days=2)),shelf_life_days=3,guidance_note='Fixture documented manufacture-based life')
        self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=1)))

    def test_printed_limit_caps_calculated_life_and_opening_can_shorten_it(self):
        result=self.create(expiry_basis='storage',shelf_life_days=30,original_expiry_date=str(self.today+timedelta(days=5)),opened_date=str(self.today),after_open_days=2,guidance_note='Fixture supplier limits')
        self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=2)))
        self.assertEqual(result.data['original_expiry_date'],str(self.today+timedelta(days=5)))
        result=self.client.patch(self.url+str(result.data['id'])+'/',dict(updated_at=result.data['updated_at'],opened_date=None,after_open_days=None),format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=5)))

    def test_switching_legacy_printed_record_to_storage_does_not_extend_its_deadline(self):
        lot=InventoryItem.objects.create(raw_material=self.raw,quantity=100,received_date=self.today,expiry_date=self.today+timedelta(days=3),expiry_basis='label')
        result=self.client.patch(self.url+str(lot.pk)+'/',dict(updated_at=lot.updated_at.isoformat(),expiry_basis='storage',shelf_life_days=30,guidance_note='Fixture generic storage reference'),format='json')
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=3)))
        self.assertEqual(result.data['original_expiry_date'],str(self.today+timedelta(days=3)))

    def test_supplied_effective_date_cannot_override_calculated_rules(self):
        result=self.create(expiry_basis='storage',shelf_life_days=2,guidance_note='Fixture limits',expiry_date=str(self.today+timedelta(days=300)))
        self.assertEqual(result.status_code,201,result.data)
        self.assertEqual(result.data['expiry_date'],str(self.today+timedelta(days=2)))

    def test_missing_source_invalid_anchors_and_printed_cap_before_receipt_are_rejected(self):
        cases=[dict(expiry_basis='storage',shelf_life_days=2,guidance_note='   '),
            dict(expiry_basis='manufactured',manufactured_date=str(self.today+timedelta(days=1)),shelf_life_days=2,guidance_note='Fixture'),
            dict(expiry_basis='storage',shelf_life_days=2,guidance_note='Fixture',original_expiry_date=str(self.today-timedelta(days=1))),
            dict(expiry_basis='storage',shelf_life_days=2,guidance_note='Fixture',opened_date=str(self.today)),
            dict(expiry_basis='storage',shelf_life_days=2,guidance_note='Fixture',received_date=str(self.today+timedelta(days=1)))]
        for case in cases:
            with self.subTest(case=case):self.assertEqual(self.create(**case).status_code,400)
        self.assertFalse(InventoryItem.objects.exists())

    def test_uncertain_handling_is_held_even_with_a_future_computed_deadline(self):
        result=self.create(expiry_basis='storage',shelf_life_days=2,guidance_note='Fixture storage guidance',handling_history='unknown',quarantined=False)
        self.assertEqual(result.status_code,201,result.data)
        self.assertTrue(result.data['quarantined'])
