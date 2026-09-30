from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Storefront, Product, RawMaterial, ProductIngredient, InventoryItem


class SetupChecklistTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner',is_staff=True)
        self.client = APIClient();self.client.force_authenticate(self.owner)
        self.url='/api/admin/setup-checklist/'

    def test_owner_only(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code,[401,403])
        self.client.force_authenticate(User.objects.create_user('buyer'))
        self.assertEqual(self.client.get(self.url).status_code,403)

    def test_empty_setup_is_not_complete_and_get_does_not_create_store(self):
        result=self.client.get(self.url)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.data['completed'],0)
        self.assertEqual(result.data['menu_count'],0)
        self.assertFalse(Storefront.objects.exists())
        self.assertEqual(self.client.post(self.url,{},format='json').status_code,405)

    def menu(self):
        product=Product.objects.create(name='Lunch',price=12,packaging_cost=0,
            preparation_tasks=[{'name':'Cook','minutes':30,'resource':'stove'}])
        material=RawMaterial.objects.create(name='Rice',unit='g',estimated_unit_cost=0)
        ProductIngredient.objects.create(product=product,raw_material=material,quantity_required=100)
        return product,material

    def test_complete_setup_allows_zero_cost_and_no_stock_for_future_preorders(self):
        Storefront.objects.create(pk=1,name='My kitchen',tagline='Home meals',founder_name='Owner',
            service_area='Local area',contact_email='owner@example.test')
        self.menu()
        result=self.client.get(self.url).data
        self.assertEqual(result['completed'],result['total'])
        self.assertEqual(result['inventory']['received_batches'],0)

    def test_menu_gaps_recompute_after_edits(self):
        product,material=self.menu()
        product.packaging_cost=None;product.preparation_tasks=[];product.save()
        material.estimated_unit_cost=None;material.save()
        product.ingredients.update(quantity_required=0)
        data=self.client.get(self.url).data
        for step in data['steps'][2:]:
            self.assertFalse(step['complete'])
            self.assertEqual(step['affected_count'],1)
            self.assertEqual(step['examples'][0]['name'],'Lunch')

    def test_all_menus_checked_but_examples_bounded(self):
        for n in range(12):Product.objects.create(name=f'Menu {n}',price=10)
        data=self.client.get(self.url).data
        self.assertEqual(data['steps'][2]['affected_count'],12)
        self.assertEqual(len(data['steps'][2]['examples']),10)

    def test_invalid_legacy_tasks_do_not_break_checklist(self):
        product,_=self.menu();product.preparation_tasks=[{'name':'Invalid','resource':'unknown'}];product.save()
        data=self.client.get(self.url).data
        self.assertFalse(data['steps'][3]['complete'])

    def test_stock_counts_exclude_empty_future_and_costed_batches(self):
        _,material=self.menu();today=timezone.localdate()
        base=dict(raw_material=material,quantity=100,received_date=today,expiry_date=today+timedelta(days=2))
        InventoryItem.objects.create(**base)
        InventoryItem.objects.create(**{**base,'unit_cost':0})
        InventoryItem.objects.create(**{**base,'expiry_date':today-timedelta(days=1),'quarantined':True})
        InventoryItem.objects.create(**{**base,'quantity':0})
        InventoryItem.objects.create(**{**base,'received_date':today+timedelta(days=1)})
        data=self.client.get(self.url).data['inventory']
        self.assertEqual(data,{'received_batches':3,'usable_by_recorded_date':2,
            'expired_batches':1,'held_batches':1,'usable_batches_missing_cost':1})
