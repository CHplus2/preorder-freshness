"""Menu, stock and planner boundaries on isolated records."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .models import (Product, ProductIngredient, RawMaterial, InventoryItem,
    InventoryLog, IngredientConsumption, Order, OrderItem, Storefront)
from .serializers import ProductSerializer


class OperationsBoundaryTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('operations-owner',is_staff=True)
        self.buyer=User.objects.create_user('operations-buyer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.today=timezone.localdate()
        self.material=RawMaterial.objects.create(name='Operations ingredient',unit='g')
        Storefront.objects.create(pk=1)

    def test_oversized_shelf_and_handling_dates_return_validation_errors(self):
        base={'raw_material':self.material.pk,'quantity':100,'storage_location':'Fridge',
            'received_date':str(self.today),'expiry_date':str(self.today+timedelta(days=10)),
            'guidance_note':'Fixture documented duration'}
        cases=[{'expiry_basis':'storage','shelf_life_days':2147483647},
            {'expiry_basis':'manufactured','manufactured_date':str(self.today),'shelf_life_days':2147483647},
            {'opened_date':str(self.today),'after_open_days':2147483647},
            {'thawed_date':str(self.today),'after_thaw_days':2147483647}]
        for changes in cases:
            with self.subTest(changes=changes):
                response=self.client.post('/api/admin/inventory-items/',{**base,**changes},format='json')
                self.assertEqual(response.status_code,400,response.data)
        self.assertFalse(InventoryItem.objects.exists())

    def test_menu_span_is_revalidated_against_the_locked_current_menu(self):
        product=Product.objects.create(name='Stale menu',price=10,max_preparation_days=7,max_early_minutes=120)
        serializer=ProductSerializer(product,data={'max_early_minutes':2880},partial=True)
        self.assertTrue(serializer.is_valid(),serializer.errors)
        # Another editor commits after initial validation but before this save.
        Product.objects.filter(pk=product.pk).update(max_preparation_days=1)
        with self.assertRaises(ValidationError):serializer.save()
        product.refresh_from_db()
        self.assertEqual(product.max_preparation_days,1)
        self.assertEqual(product.max_early_minutes,120)

    def test_reading_plan_history_and_delivery_eligibility_takes_no_kitchen_lock(self):
        order=Order.objects.create(user=self.buyer)
        with patch('myapp.models.Storefront.objects.select_for_update',side_effect=AssertionError('Read must not lock all checkout scheduling')):
            self.assertEqual(self.client.get(f'/api/admin/orders/{order.pk}/manual-plan/').status_code,200)
            self.assertEqual(self.client.get(f'/api/orders/{order.pk}/reschedule/').status_code,200)
        self.client.force_authenticate(self.buyer)
        other=Order.objects.create(user=self.owner)
        self.assertEqual(self.client.get(f'/api/orders/{other.pk}/reschedule/').status_code,404)

    def test_operational_writes_require_staff_and_csrf(self):
        for actor in [None,self.buyer]:
            self.client.force_authenticate(actor)
            for url in ['/api/admin/raw-materials/','/api/admin/inventory-items/',
                        '/api/admin/kitchen-blocks/','/api/admin/orders/1/preparation-plan/']:
                self.assertEqual(self.client.post(url,{},format='json').status_code,403,url)
            for url in ['/api/admin/raw-materials/','/api/admin/inventory-items/','/api/admin/planning/']:
                self.assertEqual(self.client.get(url).status_code,403,url)
            self.assertEqual(self.client.post('/api/products/',{'name':'Injected','price':1},format='json').status_code,403)
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.owner)
        self.assertEqual(client.post('/api/admin/raw-materials/',{'name':'Injected','unit':'g'}).status_code,403)


class CookingStockTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('cooking-owner',is_staff=True)
        self.buyer=User.objects.create_user('cooking-buyer')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.today=timezone.localdate()
        self.material=RawMaterial.objects.create(name='FEFO ingredient',unit='g')
        self.product=Product.objects.create(name='Accepted meal',price=10)
        ProductIngredient.objects.create(product=self.product,raw_material=self.material,quantity_required=100)

    def lot(self,quantity,days,**changes):
        return InventoryItem.objects.create(raw_material=self.material,quantity=quantity,
            received_date=self.today,expiry_date=self.today+timedelta(days=days),**changes)

    def order(self,products=None):
        order=Order.objects.create(user=self.buyer,status='processing')
        for product in products or [self.product]:
            OrderItem.objects.create(order=order,product=product,product_name=product.name,quantity=1,unit_price=10,subtotal=10)
        return order

    def cook(self,order):
        return self.client.patch(f'/api/admin/orders/{order.pk}/',{'status':'cooked'},format='json')

    def test_cooking_uses_earliest_usable_expiry_once_with_accepted_recipe(self):
        near=self.lot(60,1);later=self.lot(100,8)
        excluded=[self.lot(100,-1),self.lot(100,2,quarantined=True)]
        future=self.lot(100,5);future.received_date=self.today+timedelta(days=1);future.save()
        excluded.append(future)
        order=self.order()
        self.product.ingredients.update(quantity_required=500)  # Preserve accepted 100g.
        self.assertEqual(self.cook(order).status_code,200)
        near.refresh_from_db();later.refresh_from_db()
        self.assertEqual(near.quantity,0);self.assertEqual(later.quantity,60)
        for lot in excluded:
            lot.refresh_from_db();self.assertEqual(lot.quantity,100)
        self.assertEqual(sum(IngredientConsumption.objects.values_list('quantity',flat=True)),Decimal('100'))
        self.assertEqual(self.cook(order).status_code,200)
        self.assertEqual(InventoryLog.objects.count(),2)

    def test_shortage_rolls_back_all_items_stock_and_audit(self):
        lot=self.lot(150,1);order=self.order([self.product,self.product])
        response=self.cook(order)
        self.assertEqual(response.status_code,400,response.data)
        lot.refresh_from_db();order.refresh_from_db()
        self.assertEqual(lot.quantity,150);self.assertFalse(order.inventory_deducted)
        self.assertEqual(order.status,'processing')
        self.assertFalse(InventoryLog.objects.exists());self.assertFalse(IngredientConsumption.objects.exists())

    def test_stock_rows_are_loaded_once_for_the_whole_order(self):
        self.lot(500,1)
        products=[self.product]
        for index in range(3):
            product=Product.objects.create(name=f'Another menu {index}',price=10)
            ProductIngredient.objects.create(product=product,raw_material=self.material,quantity_required=50)
            products.append(product)
        order=self.order(products)
        with CaptureQueriesContext(connection) as queries:
            response=self.cook(order)
        self.assertEqual(response.status_code,200,response.data)
        stock_reads=[q['sql'] for q in queries if q['sql'].startswith('SELECT') and 'FROM "myapp_inventoryitem"' in q['sql']]
        self.assertEqual(len(stock_reads),1)
        self.assertEqual(IngredientConsumption.objects.count(),4)
