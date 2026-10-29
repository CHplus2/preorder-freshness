"""Real row-lock tests; run only on an isolated PostgreSQL test database."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier, Event
from unittest import skipUnless

from django.contrib.auth.models import User
from django.db import connection, connections, close_old_connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (Product, ProductIngredient, RawMaterial, InventoryItem,
    InventoryLog, IngredientConsumption, Order, OrderItem)


@skipUnless(connection.vendor=='postgresql','Requires isolated PostgreSQL row locking')
class PostgreSQLOperationsTests(TransactionTestCase):
    def setUp(self):
        self.owner=User.objects.create_user('operations-concurrent-owner',is_staff=True)
        self.buyer=User.objects.create_user('operations-concurrent-buyer')
        self.today=timezone.localdate()

    def api_client(self):
        client=APIClient();client.force_authenticate(User.objects.get(pk=self.owner.pk))
        return client

    def lot(self,material,quantity):
        return InventoryItem.objects.create(raw_material=material,quantity=quantity,
            received_date=self.today,expiry_date=self.today+timedelta(days=2))

    def order(self,products):
        start=timezone.now()+timedelta(hours=1)
        order=Order.objects.create(user=self.buyer,status='processing',
            preparation_at=start,preparation_end_at=start+timedelta(hours=1),
            delivery_at=start+timedelta(hours=2))
        for product in products:
            OrderItem.objects.create(order=order,product=product,product_name=product.name,
                quantity=1,unit_price=10,subtotal=10)
        return order

    def test_opposite_menu_order_locks_stock_consistently_and_cannot_overdraw(self):
        materials=[RawMaterial.objects.create(name=f'Ingredient {i}',unit='g') for i in range(2)]
        products=[]
        for material in materials:
            product=Product.objects.create(name=f'Menu {material.pk}',price=10)
            ProductIngredient.objects.create(product=product,raw_material=material,quantity_required=60)
            products.append(product)
        lots=[self.lot(material,100) for material in materials]
        orders=[self.order(products),self.order(list(reversed(products)))]
        barrier=Barrier(2)
        def cook(pk):
            close_old_connections()
            try:
                client=self.api_client();barrier.wait(timeout=10)
                response=client.patch(f'/api/admin/orders/{pk}/',{'status':'cooked'},format='json')
                return response.status_code,response.data
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(cook,[o.pk for o in orders]))
        self.assertEqual(sorted(code for code,_ in results),[200,400],results)
        self.assertIn('Insufficient',str(next(data for code,data in results if code==400)))
        for lot in lots:
            lot.refresh_from_db();self.assertEqual(lot.quantity,Decimal('40'))
        self.assertEqual(Order.objects.filter(inventory_deducted=True,status='cooked').count(),1)
        self.assertEqual(Order.objects.filter(inventory_deducted=False,status='processing').count(),1)
        self.assertEqual(IngredientConsumption.objects.count(),2)
        self.assertEqual(InventoryLog.objects.count(),2)

    def test_delete_waits_for_stock_adjustment_then_preserves_new_audit_history(self):
        material=RawMaterial.objects.create(name='Delete race ingredient',unit='g')
        lot=self.lot(material,100)
        locked=Event();release=Event();deleting=Event()
        def adjust():
            close_old_connections()
            try:
                with transaction.atomic():
                    current=InventoryItem.objects.select_for_update().get(pk=lot.pk)
                    current.quantity=90;current.save(update_fields=['quantity','updated_at'])
                    InventoryLog.objects.create(inventory_item=current,change=-10,reason='Concurrent physical count',admin=self.owner)
                    locked.set()
                    if not release.wait(timeout=10):raise AssertionError('Test did not release adjustment')
            finally:connections.close_all()
        def delete():
            close_old_connections()
            try:
                client=self.api_client();deleting.set()
                return client.delete(f'/api/admin/inventory-items/{lot.pk}/').status_code
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            adjustment=pool.submit(adjust)
            self.assertTrue(locked.wait(timeout=10))
            removal=pool.submit(delete)
            self.assertTrue(deleting.wait(timeout=10))
            # Let deletion attempt its row lock while adjustment is uncommitted.
            # It must wait, rather than deciding from the old audit snapshot.
            try:
                with self.assertRaises(TimeoutError):removal.result(timeout=.25)
            finally:release.set()
            adjustment.result(timeout=10)
            self.assertEqual(removal.result(timeout=10),400)
        lot.refresh_from_db();self.assertEqual(lot.quantity,90)
        self.assertEqual(InventoryLog.objects.get().inventory_item_id,lot.pk)

    def test_stale_stock_edit_cannot_restore_concurrently_consumed_quantity(self):
        material=RawMaterial.objects.create(name='Stale count ingredient',unit='g')
        product=Product.objects.create(name='Stale count meal',price=10)
        ProductIngredient.objects.create(product=product,raw_material=material,quantity_required=60)
        lot=self.lot(material,100);order=self.order([product])
        version=lot.updated_at.isoformat()
        barrier=Barrier(2)
        def act(action):
            close_old_connections()
            try:
                client=self.api_client();barrier.wait(timeout=10)
                if action=='cook':return client.patch(f'/api/admin/orders/{order.pk}/',{'status':'cooked'},format='json').status_code
                return client.patch(f'/api/admin/inventory-items/{lot.pk}/',{'quantity':80,'updated_at':version,
                    'adjustment_reason':'Concurrent stock count'},format='json').status_code
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            cooked,edited=list(pool.map(act,['cook','edit']))
        self.assertEqual(cooked,200);self.assertIn(edited,[200,409])
        lot.refresh_from_db()
        self.assertEqual(lot.quantity,20 if edited==200 else 40)
        self.assertEqual(sum(IngredientConsumption.objects.values_list('quantity',flat=True)),Decimal('60'))
