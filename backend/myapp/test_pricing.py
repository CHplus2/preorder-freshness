from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Product, ProductIngredient, RawMaterial, Storefront


class PricingPreviewTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('owner',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.store=Storefront.objects.create(pk=1,bulk_minimum=10,bulk_discount_percent=10)
        self.material=RawMaterial.objects.create(name='Rice',unit='g',estimated_unit_cost='0.02')
        self.product=Product.objects.create(name='Meal',price=10,packaging_cost=1)
        ProductIngredient.objects.create(product=self.product,raw_material=self.material,quantity_required=100)
        self.url='/api/admin/pricing-preview/'
        self.data={'product':self.product.pk,'portions':10,'price':'12.00','discount_percent':'20.0',
            'ingredient_increase_percent':'50.0','additional_cost_per_portion':'0.50'}

    def preview(self,**kwargs):
        return self.client.post(self.url,{**self.data,**kwargs},format='json')

    def test_scenario_calculation_and_no_saved_changes(self):
        result=self.preview();self.assertEqual(result.status_code,200)
        baseline=result.data['baseline'];proposed=result.data['proposed']
        self.assertEqual(baseline['food_revenue'],'90.00')
        self.assertEqual(baseline['contribution'],'55.00')
        self.assertEqual(proposed['food_revenue'],'96.00')
        self.assertEqual(proposed['ingredient_cost'],'30.00')
        self.assertEqual(proposed['contribution'],'51.00')
        self.assertEqual(proposed['break_even_price'],'5.63')
        self.assertEqual(result.data['contribution_change'],'-4.00')
        self.product.refresh_from_db();self.material.refresh_from_db();self.store.refresh_from_db()
        self.assertEqual(self.product.price,10)
        self.assertEqual(self.material.estimated_unit_cost,Decimal('0.02'))
        self.assertEqual(self.store.bulk_discount_percent,10)

    def test_baseline_threshold_and_explicit_scenario_discount(self):
        result=self.preview(portions=9).data
        self.assertEqual(result['baseline']['discount_percent'],'0')
        self.assertEqual(result['proposed']['discount_percent'],'20.0')
        self.assertEqual(result['baseline']['food_revenue'],'90.00')

    def test_unknown_cost_never_becomes_profit_or_breakeven(self):
        self.material.estimated_unit_cost=None;self.material.save()
        result=self.preview().data
        self.assertTrue(result['missing'])
        self.assertIsNone(result['contribution_change'])
        for key in ['baseline','proposed']:
            self.assertIsNone(result[key]['contribution'])
            self.assertIsNone(result[key]['break_even_price'])
            self.assertIsNone(result[key]['below_cost'])

    def test_missing_packaging_recipe_and_invalid_recipe(self):
        self.product.packaging_cost=None;self.product.save()
        self.assertIsNone(self.preview().data['proposed']['contribution'])
        self.product.packaging_cost=0;self.product.save()
        self.product.ingredients.update(quantity_required=0)
        self.assertIsNone(self.preview().data['proposed']['contribution'])
        self.product.ingredients.all().delete()
        self.assertIn('Recipe not recorded',self.preview().data['missing'])

    def test_explicit_zero_costs_are_valid(self):
        self.material.estimated_unit_cost=0;self.material.save()
        self.product.packaging_cost=0;self.product.save()
        row=self.preview(additional_cost_per_portion='0').data['proposed']
        self.assertEqual(row['total_cost'],'0.00')
        self.assertEqual(row['contribution'],'96.00')
        self.assertFalse(row['below_cost'])

    def test_loss_flag_and_currency_rounding(self):
        row=self.preview(price='1.01',discount_percent='33.3',portions=3).data['proposed']
        self.assertEqual(row['discount_amount'],'1.01')
        self.assertEqual(row['food_revenue'],'2.02')
        self.assertTrue(row['below_cost'])
        self.assertEqual(row['contribution'],'-11.48')

    def test_permissions_and_missing_menu(self):
        self.assertEqual(self.preview(product=9999).status_code,404)
        self.client.force_authenticate(User.objects.create_user('buyer'))
        self.assertEqual(self.preview().status_code,403)
        self.client.force_authenticate(None)
        self.assertIn(self.preview().status_code,[401,403])

    def test_input_bounds_and_nonfinite_values(self):
        for key,value in [('portions',0),('portions',10001),('portions',1.5),('price','0'),
            ('price','NaN'),('price','Infinity'),('discount_percent','50.1'),('discount_percent','-1'),
            ('ingredient_increase_percent','501'),('additional_cost_per_portion','-1')]:
            with self.subTest(key=key,value=value):
                self.assertEqual(self.preview(**{key:value}).status_code,400)
